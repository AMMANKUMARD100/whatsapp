import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { MediaKind, normalizeMimeType, sanitizeFileName, validateMediaPolicy } from './policy';
import { readUploadedBuffer, saveUploadedBuffer, signDownloadUrl, signUploadUrl } from './s3';

const security = [{ bearerAuth: [] }];

export async function mediaRoutes(app: FastifyInstance) {
  // Accept raw binary uploads (image, audio, PDF, zip, etc.) up to 30 MB
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: 32 * 1024 * 1024 },
    (_req, payload, done) => {
      done(null, payload);
    },
  );

  app.post<{
    Body: {
      kind: MediaKind;
      mimeType: string;
      sizeBytes: number;
      fileName?: string;
      width?: number;
      height?: number;
      durationMs?: number;
    };
  }>(
    '/media/presign',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['media'],
        summary: 'Create a media record and return its upload & download URLs',
        security,
        body: {
          type: 'object',
          required: ['kind', 'mimeType', 'sizeBytes'],
          properties: {
            kind: { type: 'string', enum: ['image', 'audio', 'document'] },
            mimeType: { type: 'string', maxLength: 120 },
            sizeBytes: { type: 'integer', minimum: 1 },
            fileName: { type: 'string', maxLength: 200 },
            width: { type: 'integer', minimum: 1, maximum: 10000 },
            height: { type: 'integer', minimum: 1, maximum: 10000 },
            durationMs: { type: 'integer', minimum: 0, maximum: 3_600_000 },
          },
        },
      },
    },
    async (req, reply) => {
      const { kind, mimeType, sizeBytes, fileName, width, height, durationMs } = req.body;
      const cleanMime = normalizeMimeType(kind, mimeType);
      const check = validateMediaPolicy(kind, cleanMime, sizeBytes);
      if (!check.ok) return reply.code(400).send({ error: check.reason });

      const id = randomUUID();
      const safeName = sanitizeFileName(fileName);
      const storageKey = `${req.user.sub}/${id}/${safeName}`;

      await app.db.query(
        `INSERT INTO media (id, owner_id, storage_key, kind, mime_type, size_bytes, file_name, width, height, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, req.user.sub, storageKey, kind, cleanMime, sizeBytes, safeName, width ?? null, height ?? null, durationMs ?? null],
      );

      const uploadUrl = await signUploadUrl(storageKey, cleanMime, sizeBytes);
      const downloadUrl = await signDownloadUrl(storageKey);
      return {
        media: {
          id,
          kind,
          mimeType: cleanMime,
          sizeBytes,
          fileName: safeName,
          width: width ?? null,
          height: height ?? null,
          durationMs: durationMs ?? null,
          url: downloadUrl,
        },
        uploadUrl,
      };
    },
  );

  // Direct binary upload endpoint (works on Web + Android + iOS without MinIO CORS issues)
  app.put<{ Params: { id: string } }>(
    '/media/:id/upload',
    {
      preHandler: app.authenticate,
      bodyLimit: 32 * 1024 * 1024,
      schema: {
        tags: ['media'],
        summary: 'Upload binary bytes for a presigned media item',
        security,
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const { rows } = await app.db.query<{ storage_key: string; owner_id: string }>(
        'SELECT storage_key, owner_id FROM media WHERE id = $1',
        [req.params.id],
      );
      const media = rows[0];
      if (!media || media.owner_id !== req.user.sub) {
        return reply.code(404).send({ error: 'Media record not found' });
      }

      const body = req.body;
      const buf = Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
        ? Buffer.from(body, 'binary')
        : Buffer.alloc(0);

      if (buf.length === 0) {
        return reply.code(400).send({ error: 'Empty upload payload' });
      }

      saveUploadedBuffer(media.storage_key, buf);
      await app.db.query('UPDATE media SET size_bytes = $2 WHERE id = $1', [req.params.id, buf.length]);
      return reply.code(200).send({ ok: true });
    },
  );

  // Serve the uploaded file (images, voice notes, documents)
  app.get<{ Params: { id: string } }>(
    '/media/:id/file',
    {
      schema: {
        tags: ['media'],
        summary: 'Stream/download the media file',
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const { rows } = await app.db.query<{ storage_key: string; mime_type: string; file_name: string | null }>(
        'SELECT storage_key, mime_type, file_name FROM media WHERE id = $1',
        [req.params.id],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
      const buf = readUploadedBuffer(rows[0].storage_key);
      if (!buf) return reply.code(404).send({ error: 'File not found on disk' });

      return reply
        .header('Content-Type', rows[0].mime_type || 'application/octet-stream')
        .header('Cache-Control', 'public, max-age=86400')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .header('Content-Disposition', `inline; filename="${rows[0].file_name ?? 'file'}"`)
        .send(buf);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/media/:id/url',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['media'],
        summary: 'Get a download URL for a media attachment',
        security,
        params: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const { rows } = await app.db.query<{ storage_key: string }>(
        'SELECT storage_key FROM media WHERE id = $1',
        [req.params.id],
      );
      if (!rows[0]) return reply.code(404).send({ error: 'Media not found' });
      const url = await signDownloadUrl(rows[0].storage_key);
      return { url };
    },
  );
}
