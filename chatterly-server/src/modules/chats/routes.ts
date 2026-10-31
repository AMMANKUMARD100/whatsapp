import type { FastifyInstance, FastifyReply } from 'fastify';
import { userRoom } from '../../realtime/gateway';
import {
  ChatError,
  deleteForEveryone,
  deleteForMe,
  editMessage,
  fetchMessages,
  listUserChats,
  openDirectChat,
} from './service';

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const security = [{ bearerAuth: [] }];

const STATUS: Record<string, number> = {
  not_member: 403,
  not_found: 404,
  recipient_not_verified: 403,
  invalid_reply: 400,
  not_sender: 403,
  too_late: 409,
  invalid_user: 404,
  self_chat: 400,
  invalid_media: 400,
};

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ChatError) {
    const code = STATUS[err.code] ?? 400;
    return reply.code(code).send({ error: err.code });
  }
  throw err;
}

export async function chatRoutes(app: FastifyInstance) {
  app.get('/chats', { preHandler: app.authenticate, schema: { tags: ['chats'], security } }, async (req) => {
    return { chats: await listUserChats(app.db, req.user.sub) };
  });

  app.post<{ Body: { userId: string } }>(
    '/chats/direct',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chats'],
        security,
        body: { type: 'object', required: ['userId'], properties: { userId: { type: 'string', pattern: UUID_PATTERN } } },
      },
    },
    async (req, reply) => {
      try {
        return await openDirectChat(app.db, req.user.sub, req.body.userId);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { before?: number; after?: number; limit?: number } }>(
    '/chats/:id/messages',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chats'],
        security,
        params: { type: 'object', properties: { id: { type: 'string', pattern: UUID_PATTERN } } },
        querystring: {
          type: 'object',
          properties: {
            before: { type: 'integer', minimum: 1 },
            after: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await fetchMessages(app.db, req.user.sub, req.params.id, req.query);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.patch<{ Params: { id: string; messageId: string }; Body: { text: string } }>(
    '/chats/:id/messages/:messageId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chats'],
        summary: 'Edit a message within 15 minutes of sending (sender only)',
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: UUID_PATTERN }, messageId: { type: 'string', pattern: UUID_PATTERN } },
        },
        body: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 1, maxLength: 4000 } } },
      },
    },
    async (req, reply) => {
      try {
        const { id: chatId, messageId } = req.params;
        const text = req.body.text.trim();
        const { editedAt, memberIds: members } = await editMessage(app.db, req.user.sub, chatId, messageId, text);
        app.io.to(members.map((m) => `user:${m}`)).emit('message:edited', { chatId, messageId, text, editedAt });
        return { editedAt };
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.delete<{ Params: { id: string; messageId: string }; Querystring: { scope: 'me' | 'everyone' } }>(
    '/chats/:id/messages/:messageId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['chats'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: UUID_PATTERN }, messageId: { type: 'string', pattern: UUID_PATTERN } },
        },
        querystring: { type: 'object', required: ['scope'], properties: { scope: { type: 'string', enum: ['me', 'everyone'] } } },
      },
    },
    async (req, reply) => {
      try {
        const { id: chatId, messageId } = req.params;
        if (req.query.scope === 'everyone') {
          const members = await deleteForEveryone(app.db, req.user.sub, chatId, messageId);
          app.io.to(members.map(userRoom)).emit('message:deleted', { chatId, messageId });
        } else {
          await deleteForMe(app.db, req.user.sub, chatId, messageId);
        }
        return reply.code(204).send();
      } catch (err) {
        return fail(reply, err);
      }
    },
  );
}
