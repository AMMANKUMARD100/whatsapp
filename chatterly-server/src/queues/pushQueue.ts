import { Queue, Worker } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env';
import { formatPushBody, type PushJobData } from '../modules/push/payload';

const QUEUE_NAME = 'push-notifications';

function redisConnectionOpts() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

let pushQueue: Queue<PushJobData> | null = null;

export function getPushQueue() {
  if (!pushQueue) {
    pushQueue = new Queue<PushJobData>(QUEUE_NAME, {
      connection: redisConnectionOpts(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return pushQueue;
}

export async function enqueueMessagePush(
  app: FastifyInstance,
  job: Omit<PushJobData, 'senderName'> & { senderName?: string }
) {
  try {
    let senderName = job.senderName;
    if (!senderName) {
      const { rows } = await app.db.query('SELECT name FROM users WHERE id = $1', [job.senderId]);
      senderName = rows[0]?.name || 'Chatterly';
    }

    const q = getPushQueue();
    await q.add('message-push', { ...job, senderName });
  } catch (err) {
    app.log.warn({ err: (err as Error).message }, 'Failed to enqueue push notification');
  }
}

export function startPushWorker(app: FastifyInstance) {
  if (env.FIREBASE_SERVICE_ACCOUNT_BASE64 && getApps().length === 0) {
    try {
      const saJson = Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      initializeApp({ credential: { getAccessToken: () => Promise.resolve({ access_token: '', expires_in: 0 }) } });
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'Failed to initialize Firebase Admin');
    }
  }

  const worker = new Worker<PushJobData>(
    QUEUE_NAME,
    async (job) => {
      const { chatId, messageId, recipientIds, kind, text, senderName } = job.data;
      if (!recipientIds.length) return;

      const { rows } = await app.db.query<{ id: string; push_token: string }>(
        `SELECT ds.id, ds.push_token
         FROM device_sessions ds
         JOIN chat_members cm ON cm.chat_id = $1 AND cm.user_id = ds.user_id
         WHERE ds.user_id = ANY($2::uuid[])
           AND ds.revoked_at IS NULL
           AND ds.expires_at > now()
           AND ds.push_token IS NOT NULL
           AND cm.muted = false`,
        [chatId, recipientIds],
      );
      if (rows.length === 0) return;

      if (getApps().length === 0) {
        app.log.debug({ count: rows.length }, 'Firebase Admin not initialized; skipping FCM send');
        return;
      }

      const tokens = rows.map((r) => r.push_token);
      const body = formatPushBody(kind, text);

      try {
        const response = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: senderName, body },
          data: { chatId, messageId, url: `/chat/${chatId}` },
          android: {
            priority: 'high',
            notification: { channelId: 'messages', tag: chatId, sound: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', threadId: chatId } },
          },
        });

        // Prune dead tokens
        const staleSessionIds: string[] = [];
        response.responses.forEach((res, idx) => {
          const code = res.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleSessionIds.push(rows[idx].id);
          }
        });
        if (staleSessionIds.length > 0) {
          await app.db.query('UPDATE device_sessions SET push_token = NULL WHERE id = ANY($1::uuid[])', [staleSessionIds]);
        }
      } catch (fcmErr) {
        app.log.warn({ err: (fcmErr as Error).message }, 'FCM multicast error');
      }
    },
    { connection: redisConnectionOpts(), concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    app.log.warn({ jobId: job?.id, err: err.message }, 'push worker job failed');
  });

  return worker;
}
