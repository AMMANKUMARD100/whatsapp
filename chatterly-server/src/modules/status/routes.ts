import type { FastifyInstance } from 'fastify';
import { peerIds } from '../chats/service';
import { signDownloadUrl, verifyObjectExists } from '../media/s3';

const security = [{ bearerAuth: [] }];

export async function statusRoutes(app: FastifyInstance) {
  app.get(
    '/status',
    {
      preHandler: app.authenticate,
      schema: { tags: ['status'], summary: 'List active 24h status stories from me and my contacts/peers', security },
    },
    async (req) => {
      const peers = await peerIds(app.db, req.user.sub);
      // Also include any verified user saved in user_contacts so their statuses appear too
      const savedRes = await app.db.query<{ id: string }>(
        `SELECT u.id
         FROM user_contacts uc
         JOIN users u ON u.phone_hash = uc.phone_hash
         WHERE uc.owner_id = $1 AND u.verified_at IS NOT NULL`,
        [req.user.sub],
      ).catch(() => ({ rows: [] as { id: string }[] }));

      const visibleUserIds = [...new Set([req.user.sub, ...peers, ...savedRes.rows.map((r) => r.id)])];

      const { rows } = await app.db.query<{
        id: string;
        user_id: string;
        user_name: string | null;
        user_avatar_url: string | null;
        caption: string | null;
        bg_color: string;
        storage_key: string | null;
        media_kind: 'image' | 'video' | null;
        media_mime: string | null;
        created_at: Date;
        view_count: number;
        viewed_by_me: boolean;
      }>(
        `SELECT s.id, s.user_id, u.name AS user_name, u.avatar_url AS user_avatar_url,
                s.caption, s.bg_color,
                md.storage_key, md.kind AS media_kind, md.mime_type AS media_mime,
                s.created_at,
                (SELECT count(*)::int FROM status_views sv WHERE sv.status_id = s.id) AS view_count,
                EXISTS (SELECT 1 FROM status_views sv WHERE sv.status_id = s.id AND sv.viewer_id = $1) AS viewed_by_me
         FROM statuses s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN media md ON md.id = s.media_id
         WHERE s.user_id = ANY($2::uuid[]) AND s.expires_at > now()
         ORDER BY s.created_at DESC`,
        [req.user.sub, visibleUserIds],
      );

      const items = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name ?? 'Unknown',
          userAvatarUrl: r.user_avatar_url,
          caption: r.caption,
          bgColor: r.bg_color,
          mediaKind: r.media_kind === 'video' ? 'video' : r.storage_key ? 'image' : null,
          mediaMimeType: r.media_mime,
          mediaUrl: r.storage_key ? await signDownloadUrl(r.storage_key) : null,
          createdAt: r.created_at.getTime(),
          viewCount: r.view_count,
          viewedByMe: r.viewed_by_me,
        })),
      );
      return { statuses: items };
    },
  );

  app.post<{ Body: { caption?: string; bgColor?: string; mediaId?: string } }>(
    '/status',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['status'],
        summary: 'Post a 24-hour text, image, or video status story',
        security,
        body: {
          type: 'object',
          properties: {
            caption: { type: 'string', maxLength: 700 },
            bgColor: { type: 'string', maxLength: 16 },
            mediaId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const caption = req.body.caption?.trim() || null;
      const mediaId = req.body.mediaId || null;
      if (!caption && !mediaId) return reply.code(400).send({ error: 'Provide a caption, photo, or video' });

      if (mediaId) {
        const { rows } = await app.db.query<{ storage_key: string; owner_id: string; kind: string }>(
          'SELECT storage_key, owner_id, kind FROM media WHERE id = $1 AND kind IN ($2, $3)',
          [mediaId, 'image', 'video'],
        );
        if (!rows[0] || rows[0].owner_id !== req.user.sub || !(await verifyObjectExists(rows[0].storage_key))) {
          return reply.code(400).send({ error: 'Invalid status image or video' });
        }
      }

      const bgColor = /^#[0-9a-fA-F]{6}$/.test(req.body.bgColor ?? '') ? req.body.bgColor! : '#0E8A7D';
      const { rows } = await app.db.query<{ id: string }>(
        'INSERT INTO statuses (user_id, caption, bg_color, media_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.user.sub, caption, bgColor, mediaId],
      );
      return { id: rows[0].id };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/status/:id/view',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['status'],
        summary: 'Record that the current user viewed a status story',
        security,
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      await app.db.query(
        'INSERT INTO status_views (status_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, req.user.sub],
      );
      return reply.code(204).send();
    },
  );
}
