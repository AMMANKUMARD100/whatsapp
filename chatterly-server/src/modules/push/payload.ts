import type { MediaKind } from '../media/policy';

export interface PushJobData {
  chatId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  kind: 'text' | MediaKind;
  text: string | null;
}

export function formatPushBody(kind: 'text' | MediaKind, text: string | null): string {
  if (kind === 'image') return text && !text.startsWith('e2ee:v1:') ? `📷 ${text}` : '📷 Sent a photo';
  if (kind === 'audio') return '🎤 Sent a voice note';
  if (kind === 'document') return '📄 Sent a document';
  if (text?.startsWith('e2ee:v1:')) return '🔒 Encrypted message';
  const trimmed = (text ?? '').trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed || 'New message';
}
