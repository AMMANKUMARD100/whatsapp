import type { FastifyInstance } from 'fastify';

const security = [{ bearerAuth: [] }];
// 32-byte key encoded in base64 is 44 chars ending with '='
const BASE64_32B = '^[A-Za-z0-9+/]{43}=$';
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export async function e2eeRoutes(app: FastifyInstance) {
  app.put<{ Body: { publicKey: string } }>(
    '/e2ee/keys',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['e2ee'],
        summary: 'Publish the current user X25519 identity public key (32 bytes, base64)',
        security,
        body: {
          type: 'object',
          required: ['publicKey'],
          properties: { publicKey: { type: 'string', pattern: BASE64_32B } },
        },
      },
    },
    async (req, reply) => {
      await app.db.query('UPDATE users SET public_key = $2, updated_at = now() WHERE id = $1', [
        req.user.sub,
        req.body.publicKey,
      ]);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { userId: string } }>(
    '/e2ee/keys/:userId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['e2ee'],
        summary: 'Fetch a user X25519 public key for E2EE session establishment',
        security,
        params: { type: 'object', properties: { userId: { type: 'string', pattern: UUID_PATTERN } } },
      },
    },
    async (req, reply) => {
      const { rows } = await app.db.query<{ public_key: string | null }>(
        'SELECT public_key FROM users WHERE id = $1 AND verified_at IS NOT NULL',
        [req.params.userId],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'User not found' });
      return { userId: req.params.userId, publicKey: rows[0].public_key };
    },
  );
}
