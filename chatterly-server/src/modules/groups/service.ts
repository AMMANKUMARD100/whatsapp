import type { Pool } from 'pg';
import { assertMember, ChatError, memberIds } from '../chats/service';

export async function assertAdmin(db: Pool, userId: string, chatId: string) {
  const { rows } = await db.query<{ role: string }>(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, userId],
  );
  if (!rows[0]) throw new ChatError('not_member');
  if (rows[0].role !== 'admin') throw new ChatError('not_admin');
}

export async function createGroup(
  db: Pool,
  creatorId: string,
  name: string,
  initialMemberIds: string[],
): Promise<{ id: string; memberIds: string[] }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) throw new ChatError('invalid_name');

  const unique = Array.from(new Set([creatorId, ...initialMemberIds]));
  if (unique.length < 2) throw new ChatError('too_few_members');

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO chats (type, name, created_by) VALUES ('group', $1, $2) RETURNING id",
      [trimmed, creatorId],
    );
    const chatId = rows[0].id;

    for (const memberId of unique) {
      const role = memberId === creatorId ? 'admin' : 'member';
      await client.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3)',
        [chatId, memberId, role],
      );
    }
    await client.query('COMMIT');
    return { id: chatId, memberIds: unique };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getGroupDetails(db: Pool, userId: string, chatId: string) {
  await assertMember(db, userId, chatId);
  const { rows: chatRows } = await db.query(
    "SELECT id, name, created_by FROM chats WHERE id = $1 AND type = 'group'",
    [chatId],
  );
  if (!chatRows[0]) throw new ChatError('not_found');

  const { rows: myMember } = await db.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, userId],
  );

  const { rows: members } = await db.query(
    `SELECT u.id AS "userId", u.name, u.about, u.avatar_url AS "avatarUrl", cm.role, cm.joined_at AS "joinedAt"
     FROM chat_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.chat_id = $1
     ORDER BY cm.role ASC, cm.joined_at ASC`,
    [chatId],
  );

  return {
    id: chatRows[0].id,
    name: chatRows[0].name,
    iconUrl: `/groups/${chatId}/icon`,
    createdBy: chatRows[0].created_by,
    myRole: myMember[0]?.role || 'member',
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name ?? 'Unknown',
      about: m.about ?? '',
      avatarUrl: m.avatarUrl,
      role: m.role,
      joinedAt: new Date(m.joinedAt).getTime(),
    })),
  };
}

export async function updateGroupName(
  db: Pool,
  userId: string,
  chatId: string,
  name: string,
): Promise<string[]> {
  await assertAdmin(db, userId, chatId);
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) throw new ChatError('invalid_name');
  await db.query("UPDATE chats SET name = $1, updated_at = now() WHERE id = $2 AND type = 'group'", [trimmed, chatId]);
  return memberIds(db, chatId);
}

export async function addGroupMembers(
  db: Pool,
  userId: string,
  chatId: string,
  newMemberIds: string[],
): Promise<string[]> {
  await assertAdmin(db, userId, chatId);
  for (const mId of newMemberIds) {
    await db.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [chatId, mId, 'member'],
    );
  }
  return memberIds(db, chatId);
}

export async function updateMemberRole(
  db: Pool,
  adminId: string,
  chatId: string,
  targetUserId: string,
  newRole: 'admin' | 'member',
): Promise<string[]> {
  await assertAdmin(db, adminId, chatId);
  await db.query(
    'UPDATE chat_members SET role = $1 WHERE chat_id = $2 AND user_id = $3',
    [newRole, chatId, targetUserId],
  );
  return memberIds(db, chatId);
}

export async function removeOrLeaveGroup(
  db: Pool,
  userId: string,
  chatId: string,
  targetUserId: string,
): Promise<string[]> {
  if (userId !== targetUserId) {
    await assertAdmin(db, userId, chatId);
  } else {
    await assertMember(db, userId, chatId);
  }
  await db.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, targetUserId]);
  return memberIds(db, chatId);
}
