import { createAdapter } from '@socket.io/redis-adapter';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { z } from 'zod';
import {
  advanceDelivered,
  advanceRead,
  memberIds,
  otherMemberIds,
  peerIds,
  sendMessage,
} from '../modules/chats/service';
import { enqueueMessagePush } from '../queues/pushQueue';
import { presence } from './presence';

const uuid = z.string().uuid();
const sendSchema = z.object({
  chatId: uuid,
  clientMsgId: uuid,
  kind: z.enum(['text', 'image', 'audio', 'document']).default('text'),
  text: z.string().trim().max(4000).nullish(),
  mediaId: uuid.nullish(),
  replyToId: uuid.nullish(),
});

const receiptSchema = z.object({
  chatId: uuid,
  seq: z.number().int().positive(),
});

const typingSchema = z.object({
  chatId: uuid,
  isTyping: z.boolean(),
});

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export default fp(async (app: FastifyInstance) => {
  const pubClient = app.redis.duplicate();
  const subClient = app.redis.duplicate();

  const io = new Server(app.server, {
    cors: { origin: '*' },
    adapter: createAdapter(pubClient, subClient),
  });
  app.decorate('io', io);

  app.addHook('onClose', async () => {
    io.close();
    await pubClient.quit();
    await subClient.quit();
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('unauthorized'));
      const payload = app.jwt.verify<{ sub: string; sid: string }>(token);
      socket.data.userId = payload.sub;
      socket.data.sessionId = payload.sid;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  async function cachedMemberIds(chatId: string): Promise<string[]> {
    const cacheKey = `chat:members:${chatId}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as string[];
    const ids = await memberIds(app.db, chatId);
    await app.redis.set(cacheKey, JSON.stringify(ids), 'EX', 60);
    return ids;
  }

  async function broadcastPresence(userId: string, online: boolean, lastSeenAt: Date) {
    const peers = await peerIds(app.db, userId);
    if (peers.length) {
      io.to(peers.map(userRoom)).emit('presence', {
        userId,
        online,
        lastSeenAt: lastSeenAt.getTime(),
      });
    }
  }

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    await socket.join(userRoom(userId));

    const wentOnline = await presence.addSocket(app.redis, userId, socket.id);
    if (wentOnline) {
      await broadcastPresence(userId, true, new Date());
    }

    const heartbeat = setInterval(() => void presence.heartbeat(app.redis, userId), 25000);

    const safe = (name: string, fn: (payload: any) => Promise<void>) => async (payload: any) => {
      try {
        await fn(payload);
      } catch (err) {
        app.log.warn({ err: (err as Error).message, event: name }, 'socket handler error');
      }
    };

    socket.on(
      'message:send',
      safe('message:send', async (payload) => {
        const p = sendSchema.safeParse(payload);
        if (!p.success) return socket.emit('error', { code: 'bad_request' });

        const { message, created, recipientIds } = await sendMessage(app.db, userId, {
          chatId: p.data.chatId,
          clientMsgId: p.data.clientMsgId,
          kind: p.data.kind,
          text: p.data.text ?? null,
          mediaId: p.data.mediaId ?? null,
          replyToId: p.data.replyToId ?? null,
        });

        if (created) {
          io.to([...recipientIds.map(userRoom), userRoom(userId)]).emit('message:new', message);
          void enqueueMessagePush(app, {
            chatId: message.chatId,
            messageId: message.id,
            senderId: userId,
            recipientIds,
            kind: message.kind,
            text: message.text,
          });
        }
      }),
    );

    socket.on(
      'message:delivered',
      safe('message:delivered', async (payload) => {
        const p = receiptSchema.safeParse(payload);
        if (!p.success) return;
        const result = await advanceDelivered(app.db, userId, p.data.chatId, p.data.seq);
        if (!result) return;
        const others = await otherMemberIds(app.db, p.data.chatId, userId);
        if (others.length) {
          io.to(others.map(userRoom)).emit('receipt', {
            chatId: p.data.chatId,
            userId,
            deliveredSeq: result.deliveredSeq,
            readSeq: result.readSeq,
          });
        }
      }),
    );

    socket.on(
      'message:read',
      safe('message:read', async (payload) => {
        const p = receiptSchema.safeParse(payload);
        if (!p.success) return;
        const result = await advanceRead(app.db, userId, p.data.chatId, p.data.seq);
        if (!result) return;
        const others = await otherMemberIds(app.db, p.data.chatId, userId);
        if (others.length) {
          io.to(others.map(userRoom)).emit('receipt', {
            chatId: p.data.chatId,
            userId,
            deliveredSeq: result.deliveredSeq,
            readSeq: result.readSeq,
          });
        }
      }),
    );

    socket.on(
      'typing',
      safe('typing', async (payload) => {
        const p = typingSchema.safeParse(payload);
        if (!p.success) return;
        const members = await cachedMemberIds(p.data.chatId);
        if (!members.includes(userId)) return;
        const others = members.filter((m) => m !== userId);
        if (others.length) {
          io.to(others.map(userRoom)).emit('typing', { chatId: p.data.chatId, userId, isTyping: p.data.isTyping });
        }
      }),
    );

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      try {
        const wentOffline = await presence.removeSocket(app.redis, userId, socket.id);
        if (wentOffline) {
          const { rows } = await app.db.query('UPDATE users SET last_seen_at = now() WHERE id = $1 RETURNING last_seen_at', [userId]);
          await broadcastPresence(userId, false, rows[0]?.last_seen_at ?? new Date());
        }
      } catch (err) {
        app.log.error({ err: (err as Error).message }, 'presence remove failed');
      }
    });
  });
});
