import type { MediaKind } from '../media/policy';

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name?: string | null;
  client_msg_id: string;
  seq: string | number;
  kind: 'text' | MediaKind;
  body: string | null;
  media_id: string | null;
  reply_to_id: string | null;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  media_storage_key?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: string | number | null;
  media_file_name?: string | null;
  media_width?: number | null;
  media_height?: number | null;
  media_duration_ms?: number | null;
}

export interface MediaAttachmentDto {
  id: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
}

export interface MessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string | null;
  clientMsgId: string;
  seq: number;
  kind: 'text' | MediaKind;
  text: string | null;
  media: MediaAttachmentDto | null;
  replyToId: string | null;
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
}

export function toMessageDto(row: MessageRow, signedMediaUrl?: string | null): MessageDto {
  const deleted = row.deleted_at !== null;
  const hasMedia = !deleted && row.media_id && row.media_mime_type && signedMediaUrl;
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? null,
    clientMsgId: row.client_msg_id,
    seq: Number(row.seq),
    kind: row.kind ?? 'text',
    text: deleted ? null : row.body,
    media: hasMedia
      ? {
          id: row.media_id!,
          kind: (row.kind === 'text' ? 'document' : row.kind) as MediaKind,
          mimeType: row.media_mime_type!,
          sizeBytes: Number(row.media_size_bytes ?? 0),
          fileName: row.media_file_name ?? 'file',
          width: row.media_width ?? null,
          height: row.media_height ?? null,
          durationMs: row.media_duration_ms ?? null,
          url: signedMediaUrl!,
        }
      : null,
    replyToId: row.reply_to_id,
    createdAt: row.created_at.getTime(),
    editedAt: row.edited_at ? row.edited_at.getTime() : null,
    deleted,
  };
}
