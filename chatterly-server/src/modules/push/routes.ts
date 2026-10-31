import type { FastifyInstance } from 'fastify';

const security = [{ bearerAuth: [] }];

export async function pushRoutes(app: FastifyInstance) {
  app.put<{ Body: { pushToken: string } }>(
    '/me/push-token',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['push'],
        summary: 'Register or update the FCM push token for the current device session',
        security,
        body: {
          type: 'object',
          required: ['pushToken'],
          properties: { pushToken: { type: 'string', minLength: 16, maxLength: 512 } },
        },
      },
    },
    async (req, reply) => {
      const { pushToken } = req.body;
      await app.db.query(
        'UPDATE device_sessions SET push_token = $1, updated_at = now() WHERE id = $2',
        [pushToken, req.user.sid],
      );
      return reply.code(204).send();
    },
  );
}
