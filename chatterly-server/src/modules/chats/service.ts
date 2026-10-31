import type { Pool } from 'pg';
import type { MediaKind } from '../media/policy';
import { signDownloadUrl } from '../media/s3';
import { MessageDto, MessageRow, toMessageDto } from './dto';
import { canDeleteForEveryone, canEditMessage, directKey } from './rules';

export class ChatError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export async function assertMember(db: Pool, userId: string, chatId: string) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, userId],
  );
  if (!rowCount) throw new ChatError('not_member');
}

export async function memberIds(db: Pool, chatId: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    'SELECT user_id FROM chat_members WHERE chat_id = $1',
    [chatId],
  );
  return rows.map((r) => r.user_id);
}

export async function otherMemberIds(db: Pool, chatId: string, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    'SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id <> $2',
    [chatId, userId],
  );
  return rows.map((r) => r.user_id);
}

export async function peerIds(db: Pool, userId: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT DISTINCT cm2.user_id
     FROM chat_members cm1
     JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id AND cm1.user_id <> cm2.user_id
     WHERE cm1.user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.user_id);
}

export async function openDirectChat(db: Pool, me: string, peerId: string) {
  if (me === peerId) throw new ChatError('self_chat');

  const peer = await db.query('SELECT name, about, avatar_url FROM users WHERE id = $1 AND verified_at IS NOT NULL', [peerId]);
  if (!peer.rowCount) throw new ChatError('recipient_not_verified');

  const key = directKey(me, peerId);
  const existing = await db.query('SELECT id FROM chats WHERE direct_key = $1', [key]);

  let chatId: string;
  if (existing.rowCount) {
    chatId = existing.rows[0].id;
  } else {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        "INSERT INTO chats (type, direct_key) VALUES ('direct', $1) RETURNING id",
        [key],
      );
      chatId = res.rows[0].id;
      await client.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, $3), ($1, $4, $3)',
        [chatId, me, 'member', peerId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return { id: chatId };
}

export async function listUserChats(db: Pool, userId: string) {
  const { rows } = await db.query(
    `SELECT
       c.id, c.type, c.name AS group_name, c.last_seq,
       cm.role AS my_role, cm.last_read_seq, cm.last_delivered_seq,
       (SELECT count(*)::int FROM chat_members WHERE chat_id = c.id) AS member_count,
       (SELECT count(*)::int FROM messages m WHERE m.chat_id = c.id AND m.seq > cm.last_read_seq AND m.deleted_at IS NULL) AS unread,
       u.id AS peer_id, u.name AS peer_name, u.about AS peer_about, u.avatar_url AS peer_avatar, u.last_seen_at
     FROM chats c
     JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
     LEFT JOIN chat_members cm2 ON c.type = 'direct' AND cm2.chat_id = c.id AND cm2.user_id <> $1
     LEFT JOIN users u ON u.id = cm2.user_id
     ORDER BY c.updated_at DESC`,
    [userId],
  );

  return rows.map((r) => {
    const isDirect = r.type === 'direct';
    return {
      id: r.id,
      type: r.type,
      peerId: isDirect ? r.peer_id : null,
      name: isDirect ? r.peer_name ?? 'Unknown' : r.group_name ?? 'Group',
      about: isDirect ? r.peer_about ?? '' : '',
      avatarUri: isDirect ? r.peer_avatar : null,
      myRole: r.my_role,
      memberCount: Number(r.member_count),
      unread: Number(r.unread),
      lastSeq: Number(r.last_seq),
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).getTime() : null,
      receipt: {
        delivered: Number(r.last_delivered_seq),
        read: Number(r.last_read_seq),
      },
    };
  });
}

export async function fetchMessages(
  db: Pool,
  userId: string,
  chatId: string,
  opts: { before?: number; after?: number; limit?: number } = {},
) {
  await assertMember(db, userId, chatId);

  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const conditions = ['m.chat_id = $1'];
  const params: any[] = [chatId];
  let idx = 2;

  if (opts.before) {
    conditions.push(`m.seq < $${idx++}`);
    params.push(opts.before);
  }
  if (opts.after) {
    conditions.push(`m.seq > $${idx++}`);
    params.push(opts.after);
  }

  conditions.push(`NOT EXISTS (SELECT 1 FROM message_deletions md WHERE md.message_id = m.id AND md.user_id = $${idx++})`);
  params.push(userId);

  params.push(limit + 1);

  const query = `
    SELECT m.*, u.name as sender_name,
           md.storage_key as media_storage_key, md.mime_type as media_mime_type,
           md.size_bytes as media_size_bytes, md.file_name as media_file_name,
           md.width as media_width, md.height as media_height, md.duration_ms as media_duration_ms
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN media md ON md.id = m.media_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.seq DESC
    LIMIT $${idx}
  `;

  const { rows } = await db.query<MessageRow>(query, params);
  const hasMore = rows.length > limit;
  const list = hasMore ? rows.slice(0, limit) : rows;

  const dtos = await Promise.all(
    list.map(async (r) => {
      const url = r.media_storage_key ? await signDownloadUrl(r.media_storage_key) : null;
      return toMessageDto(r, url);
    }),
  );

  return { messages: dtos, hasMore };
}

export async function sendMessage(
  db: Pool,
  userId: string,
  input: {
    chatId: string;
    clientMsgId: string;
    kind: 'text' | MediaKind;
    text: string | null;
    mediaId: string | null;
    replyToId: string | null;
  },
): Promise<{ message: MessageDto; created: boolean; recipientIds: string[] }> {
  await assertMember(db, userId, input.chatId);

  // Check if already exists
  const existing = await db.query<MessageRow>(
    `SELECT m.*, u.name as sender_name,
            md.storage_key as media_storage_key, md.mime_type as media_mime_type,
            md.size_bytes as media_size_bytes, md.file_name as media_file_name,
            md.width as media_width, md.height as media_height, md.duration_ms as media_duration_ms
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN media md ON md.id = m.media_id
     WHERE m.chat_id = $1 AND m.client_msg_id = $2`,
    [input.chatId, input.clientMsgId],
  );

  if (existing.rowCount) {
    const url = existing.rows[0].media_storage_key ? await signDownloadUrl(existing.rows[0].media_storage_key) : null;
    const others = await otherMemberIds(db, input.chatId, userId);
    return { message: toMessageDto(existing.rows[0], url), created: false, recipientIds: others };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const chatRes = await client.query<{ last_seq: string }>(
      'UPDATE chats SET last_seq = last_seq + 1, updated_at = now() WHERE id = $1 RETURNING last_seq',
      [input.chatId],
    );
    const seq = Number(chatRes.rows[0].last_seq);

    const msgRes = await client.query<MessageRow>(
      `INSERT INTO messages (chat_id, sender_id, client_msg_id, seq, kind, body, media_id, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.chatId, userId, input.clientMsgId, seq, input.kind, input.text, input.mediaId, input.replyToId],
    );

    await client.query(
      'UPDATE chat_members SET last_read_seq = GREATEST(last_read_seq, $2), last_delivered_seq = GREATEST(last_delivered_seq, $2) WHERE chat_id = $1 AND user_id = $3',
      [input.chatId, seq, userId],
    );

    await client.query('COMMIT');

    const { rows: userRows } = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
    const row = { ...msgRes.rows[0], sender_name: userRows[0]?.name ?? null };

    let mediaUrl: string | null = null;
    if (input.mediaId) {
      const { rows: mRows } = await db.query('SELECT * FROM media WHERE id = $1', [input.mediaId]);
      if (mRows[0]) {
        row.media_storage_key = mRows[0].storage_key;
        row.media_mime_type = mRows[0].mime_type;
        row.media_size_bytes = mRows[0].size_bytes;
        row.media_file_name = mRows[0].file_name;
        row.media_width = mRows[0].width;
        row.media_height = mRows[0].height;
        row.media_duration_ms = mRows[0].duration_ms;
        mediaUrl = await signDownloadUrl(mRows[0].storage_key);
      }
    }

    const others = await otherMemberIds(db, input.chatId, userId);
    return { message: toMessageDto(row, mediaUrl), created: true, recipientIds: others };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function advanceDelivered(db: Pool, userId: string, chatId: string, seq: number) {
  const { rows } = await db.query(
    `UPDATE chat_members cm
     SET last_delivered_seq = t.v
     FROM (SELECT LEAST($3::bigint, last_seq) AS v FROM chats WHERE id = $1) t
     WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.last_delivered_seq < t.v
     RETURNING cm.last_delivered_seq, cm.last_read_seq`,
    [chatId, userId, seq],
  );
  return rows[0]
    ? { deliveredSeq: Number(rows[0].last_delivered_seq), readSeq: Number(rows[0].last_read_seq) }
    : null;
}

export async function advanceRead(db: Pool, userId: string, chatId: string, seq: number) {
  const { rows } = await db.query(
    `UPDATE chat_members cm
     SET last_read_seq = t.v, last_delivered_seq = GREATEST(cm.last_delivered_seq, t.v)
     FROM (SELECT LEAST($3::bigint, last_seq) AS v FROM chats WHERE id = $1) t
     WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.last_read_seq < t.v
     RETURNING cm.last_read_seq, cm.last_delivered_seq`,
    [chatId, userId, seq],
  );
  return rows[0]
    ? { readSeq: Number(rows[0].last_read_seq), deliveredSeq: Number(rows[0].last_delivered_seq) }
    : null;
}

export async function deleteForMe(db: Pool, userId: string, chatId: string, messageId: string): Promise<void> {
  await assertMember(db, userId, chatId);
  const found = await db.query('SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
  if (!found.rowCount) throw new ChatError('not_found');
  await db.query('INSERT INTO message_deletions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [messageId, userId]);
}

export async function deleteForEveryone(db: Pool, userId: string, chatId: string, messageId: string): Promise<string[]> {
  await assertMember(db, userId, chatId);
  const { rows } = await db.query<MessageRow>('SELECT * FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
  const message = rows[0];
  if (!message) throw new ChatError('not_found');
  if (message.sender_id !== userId) throw new ChatError('not_sender');
  if (!canDeleteForEveryone(message.created_at.getTime())) throw new ChatError('too_late');
  await db.query('UPDATE messages SET deleted_at = now(), body = NULL, media_id = NULL WHERE id = $1 AND deleted_at IS NULL', [
    messageId,
  ]);
  return memberIds(db, chatId);
}

export async function editMessage(
  db: Pool,
  userId: string,
  chatId: string,
  messageId: string,
  newText: string,
): Promise<{ editedAt: number; memberIds: string[] }> {
  const trimmed = newText.trim();
  if (!trimmed) throw new ChatError('invalid_media');
  const { rows } = await db.query<MessageRow>('SELECT * FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
  const message = rows[0];
  if (!message || message.deleted_at) throw new ChatError('not_found');
  if (message.sender_id !== userId) throw new ChatError('not_sender');
  if (!canEditMessage(message.created_at.getTime())) throw new ChatError('too_late');

  const updated = await db.query<{ edited_at: Date }>(
    'UPDATE messages SET body = $2, edited_at = now() WHERE id = $1 RETURNING edited_at',
    [messageId, trimmed],
  );
  return {
    editedAt: updated.rows[0].edited_at.getTime(),
    memberIds: await memberIds(db, chatId),
  };
}
