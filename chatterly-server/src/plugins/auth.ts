import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env';

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      // Check session validity in db or redis
      const { rows } = await app.db.query(
        'SELECT 1 FROM device_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()',
        [req.user.sid]
      );
      if (!rows.length) {
        return reply.code(401).send({ error: 'Session revoked or expired' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
