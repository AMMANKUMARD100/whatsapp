import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env';
import authPlugin from './plugins/auth';
import infraPlugin from './plugins/infra';
import maintenancePlugin from './plugins/maintenance';
import gatewayPlugin from './realtime/gateway';
import { authRoutes } from './modules/auth/routes';
import { chatRoutes } from './modules/chats/routes';
import { contactRoutes } from './modules/contacts/routes';
import { e2eeRoutes } from './modules/e2ee/routes';
import { groupRoutes } from './modules/groups/routes';
import { mediaRoutes } from './modules/media/routes';
import { pushRoutes } from './modules/push/routes';
import { statusRoutes } from './modules/status/routes';
import { userRoutes } from './modules/users/routes';
import { startPushWorker } from './queues/pushQueue';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.refreshToken', 'req.body.phone'],
    },
  });

  app.addContentTypeParser('*', function (_req, payload, done) {
    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer) => chunks.push(chunk));
    payload.on('end', () => done(null, Buffer.concat(chunks)));
    payload.on('error', (err: Error) => done(err, undefined));
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  await app.register(infraPlugin);
  await app.register(maintenancePlugin);
  await app.register(gatewayPlugin);

  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute', redis: app.redis });

  await app.register(swagger, {
    openapi: {
      info: { title: 'Chatterly API', version: '0.1.0' },
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(contactRoutes);
  await app.register(chatRoutes);
  await app.register(groupRoutes);
  await app.register(mediaRoutes);
  await app.register(pushRoutes);
  await app.register(statusRoutes);
  await app.register(e2eeRoutes);

  app.get('/health', { schema: { tags: ['system'], summary: 'Liveness and dependency check' } }, async (_req, reply) => {
    try {
      await app.db.query('SELECT 1');
      await app.redis.ping();
      return { status: 'ok' };
    } catch (err) {
      app.log.error({ err: (err as Error).message }, 'health check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  const pushWorker = startPushWorker(app);
  app.addHook('onClose', async () => {
    await pushWorker.close();
  });

  return app;
}
