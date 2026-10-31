import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { pool } from '../db/pool';
import { env } from '../config/env';

export default fp(async (app) => {
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  app.decorate('db', pool);
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
    await pool.end();
  });
});
