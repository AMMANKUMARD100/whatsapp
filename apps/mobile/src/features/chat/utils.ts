import { Message } from '../../core/services/types';

export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function isSameDay(t1: number, t2: number): boolean {
  const d1 = new Date(t1);
  const d2 = new Date(t2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function dayLabel(timestamp: number): string {
  const now = new Date();
  const d = new Date(timestamp);
  if (isSameDay(now.getTime(), timestamp)) return 'Today';
  const yesterday = new Date(now.setDate(now.getDate() - 1));
  if (isSameDay(yesterday.getTime(), timestamp)) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(ms?: number | null): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export function messageSummary(message?: Message | null): string {
  if (!message) return '';
  if (message.deleted) return '🚫 This message was deleted';
  if (message.kind === 'image') return message.text ? `📷 ${message.text}` : '📷 Photo';
  if (message.kind === 'audio') return '🎤 Voice message';
  if (message.kind === 'document') return `📄 ${message.media?.fileName || 'Document'}`;
  return message.text || '';
}

export function friendlyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
