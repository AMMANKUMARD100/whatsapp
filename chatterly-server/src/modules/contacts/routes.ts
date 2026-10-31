import type { FastifyInstance } from 'fastify';

const MAX_REQUESTS_PER_HOUR = 300;

export async function contactRoutes(app: FastifyInstance) {
  // 1. Direct phone lookup by number
  app.get<{ Querystring: { phone: string } }>(
    '/contacts/lookup',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Lookup user by phone number',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          required: ['phone'],
          properties: { phone: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const { rows } = await app.db.query(
        `SELECT id, name, about, avatar_url AS "avatarUrl", phone_hash AS "phoneHash", phone
         FROM users
         WHERE phone = $1
           AND verified_at IS NOT NULL
           AND id <> $2`,
        [req.query.phone, req.user.sub],
      );
      if (!rows.length) return reply.code(404).send({ error: 'User not found' });
      return { user: rows[0] };
    },
  );

  // 2. Discover all registered users (great for Web/testing when device address book is unavailable)
  app.get(
    '/contacts/discover',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Discover registered users',
        security: [{ bearerAuth: [] }],
      },
    },
    async (req) => {
      const { rows } = await app.db.query(
        `SELECT id, name, about, avatar_url AS "avatarUrl", phone_hash AS "phoneHash", phone
         FROM users
         WHERE verified_at IS NOT NULL
           AND name IS NOT NULL
           AND id <> $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [req.user.sub],
      );
      return { users: rows };
    },
  );

  // 3. Match by SHA-256 hashes (mobile device address book)
  app.post<{ Body: { hashes: string[] } }>(
    '/contacts/match',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Find registered users from SHA-256 hashes of E.164 phone numbers',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['hashes'],
          properties: {
            hashes: {
              type: 'array',
              minItems: 1,
              maxItems: 1000,
              items: { type: 'string', pattern: '^[0-9a-f]{64}$' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const key = `contacts:match:${req.user.sub}`;
      const count = await app.redis.incr(key);
      if (count === 1) await app.redis.expire(key, 3600);
      if (count > MAX_REQUESTS_PER_HOUR) {
        return reply.code(429).send({ error: 'Too many contact lookups. Try again later.' });
      }

      const hashes = [...new Set(req.body.hashes)];
      const { rows } = await app.db.query(
        `SELECT id, name, about, avatar_url AS "avatarUrl", phone_hash AS "phoneHash"
         FROM users
         WHERE phone_hash = ANY($1::bpchar[])
           AND verified_at IS NOT NULL
           AND name IS NOT NULL
           AND id <> $2`,
        [hashes, req.user.sub],
      );
      return { users: rows };
    },
  );
}
