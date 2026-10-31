import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { cleanAbout, cleanName, MAX_ABOUT, MAX_NAME } from './profile';

export async function userRoutes(app: FastifyInstance) {
  // Update profile
  app.patch<{ Body: { name?: string; about?: string } }>(
    '/users/profile',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: MAX_NAME },
            about: { type: 'string', maxLength: MAX_ABOUT },
          },
        },
      },
    },
    async (req, reply) => {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (req.body.name !== undefined) {
        const cleaned = cleanName(req.body.name);
        if (!cleaned) return reply.code(400).send({ error: 'Invalid name' });
        updates.push(`name = $${idx++}`);
        values.push(cleaned);
      }

      if (req.body.about !== undefined) {
        const cleaned = cleanAbout(req.body.about);
        if (!cleaned) return reply.code(400).send({ error: 'Invalid about text' });
        updates.push(`about = $${idx++}`);
        values.push(cleaned);
      }

      if (!updates.length) return reply.code(400).send({ error: 'Nothing to update' });

      updates.push(`updated_at = now()`);
      values.push(req.user.sub);

      const { rows } = await app.db.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, phone, name, about, avatar_url AS "avatarUrl"`,
        values
      );
      return rows[0];
    }
  );

  // Upload avatar
  app.post<{ Body: { image: string } }>(
    '/users/avatar',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['image'],
          properties: { image: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      try {
        const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const resized = await sharp(buffer)
          .resize(256, 256, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();

        const avatarUrl = `/users/${req.user.sub}/avatar`;
        await app.db.query('UPDATE users SET avatar = $1, avatar_url = $2, updated_at = now() WHERE id = $3', [
          resized,
          avatarUrl,
          req.user.sub,
        ]);

        return { avatarUrl };
      } catch (err) {
        return reply.code(400).send({ error: 'Invalid image data' });
      }
    }
  );

  // Serve avatar
  app.get<{ Params: { id: string } }>(
    '/users/:id/avatar',
    async (req, reply) => {
      const { rows } = await app.db.query('SELECT avatar FROM users WHERE id = $1', [req.params.id]);
      if (!rows.length || !rows[0].avatar) {
        return reply.code(404).send({ error: 'Avatar not found' });
      }

      return reply
        .header('Content-Type', 'image/jpeg')
        .header('Cache-Control', 'public, max-age=86400')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(rows[0].avatar);
    }
  );
}
