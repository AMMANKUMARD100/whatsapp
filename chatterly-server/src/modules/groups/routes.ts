import type { FastifyInstance, FastifyReply } from 'fastify';
import sharp from 'sharp';
import { userRoom } from '../../realtime/gateway';
import { ChatError } from '../chats/service';
import {
  addGroupMembers,
  createGroup,
  getGroupDetails,
  removeOrLeaveGroup,
  updateGroupName,
  updateMemberRole,
} from './service';

const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const security = [{ bearerAuth: [] }];

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof ChatError) {
    const status = err.code === 'not_admin' || err.code === 'not_member' ? 403 : 400;
    return reply.code(status).send({ error: err.code });
  }
  throw err;
}

export async function groupRoutes(app: FastifyInstance) {
  const notifyUsers = (members: string[], chatId: string) => {
    app.io.to(members.map(userRoom)).emit('chat_updated', { chatId });
  };

  app.post<{ Body: { name: string; memberIds: string[] } }>(
    '/groups',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        body: {
          type: 'object',
          required: ['name', 'memberIds'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 50 },
            memberIds: { type: 'array', items: { type: 'string', pattern: UUID_PATTERN } },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { id, memberIds } = await createGroup(app.db, req.user.sub, req.body.name, req.body.memberIds);
        notifyUsers(memberIds, id);
        return { id };
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/groups/:id',
    {
      preHandler: app.authenticate,
      schema: { tags: ['groups'], security, params: { type: 'object', properties: { id: { type: 'string', pattern: UUID_PATTERN } } } },
    },
    async (req, reply) => {
      try {
        return await getGroupDetails(app.db, req.user.sub, req.params.id);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/groups/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        params: { type: 'object', properties: { id: { type: 'string', pattern: UUID_PATTERN } } },
        body: { type: 'object', required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 50 } } },
      },
    },
    async (req, reply) => {
      try {
        const members = await updateGroupName(app.db, req.user.sub, req.params.id, req.body.name);
        notifyUsers(members, req.params.id);
        return await getGroupDetails(app.db, req.user.sub, req.params.id);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { image: string } }>(
    '/groups/:id/icon',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        params: { type: 'object', properties: { id: { type: 'string', pattern: UUID_PATTERN } } },
        body: { type: 'object', required: ['image'], properties: { image: { type: 'string' } } },
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

        await app.db.query('UPDATE chats SET icon = $1, updated_at = now() WHERE id = $2 AND type = $3', [
          resized,
          req.params.id,
          'group',
        ]);
        return { iconUrl: `/groups/${req.params.id}/icon` };
      } catch (err) {
        return reply.code(400).send({ error: 'Invalid image' });
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/groups/:id/icon',
    async (req, reply) => {
      const { rows } = await app.db.query('SELECT icon FROM chats WHERE id = $1', [req.params.id]);
      if (!rows.length || !rows[0].icon) {
        return reply.code(404).send({ error: 'Icon not found' });
      }
      return reply
        .header('Content-Type', 'image/jpeg')
        .header('Cache-Control', 'public, max-age=86400')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(rows[0].icon);
    },
  );

  app.post<{ Params: { id: string }; Body: { userIds: string[] } }>(
    '/groups/:id/members',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        params: { type: 'object', properties: { id: { type: 'string', pattern: UUID_PATTERN } } },
        body: { type: 'object', required: ['userIds'], properties: { userIds: { type: 'array', items: { type: 'string' } } } },
      },
    },
    async (req, reply) => {
      try {
        const members = await addGroupMembers(app.db, req.user.sub, req.params.id, req.body.userIds);
        notifyUsers(members, req.params.id);
        return await getGroupDetails(app.db, req.user.sub, req.params.id);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.patch<{ Params: { id: string; userId: string }; Body: { role: 'admin' | 'member' } }>(
    '/groups/:id/members/:userId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: UUID_PATTERN }, userId: { type: 'string', pattern: UUID_PATTERN } },
        },
        body: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['admin', 'member'] } } },
      },
    },
    async (req, reply) => {
      try {
        const members = await updateMemberRole(app.db, req.user.sub, req.params.id, req.params.userId, req.body.role);
        notifyUsers(members, req.params.id);
        return await getGroupDetails(app.db, req.user.sub, req.params.id);
      } catch (err) {
        return fail(reply, err);
      }
    },
  );

  app.delete<{ Params: { id: string; userId: string } }>(
    '/groups/:id/members/:userId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['groups'],
        security,
        params: {
          type: 'object',
          properties: { id: { type: 'string', pattern: UUID_PATTERN }, userId: { type: 'string', pattern: UUID_PATTERN } },
        },
      },
    },
    async (req, reply) => {
      try {
        const affected = await removeOrLeaveGroup(app.db, req.user.sub, req.params.id, req.params.userId);
        notifyUsers(affected, req.params.id);
        return reply.code(204).send();
      } catch (err) {
        return fail(reply, err);
      }
    },
  );
}
