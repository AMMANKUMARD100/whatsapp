export type MediaKind = 'image' | 'audio' | 'document';

export const LIMITS: Record<MediaKind, { maxBytes: number }> = {
  image: { maxBytes: 15 * 1024 * 1024 },    // 15 MB
  audio: { maxBytes: 20 * 1024 * 1024 },    // 20 MB
  document: { maxBytes: 30 * 1024 * 1024 }, // 30 MB
};

export function normalizeMimeType(kind: MediaKind, rawMime?: string | null): string {
  const clean = (rawMime ?? '').split(';')[0].trim().toLowerCase();
  if (kind === 'image') {
    if (clean === 'image/jpg') return 'image/jpeg';
    return clean.startsWith('image/') ? clean : 'image/jpeg';
  }
  if (kind === 'audio') {
    return clean.startsWith('audio/') || clean === 'video/webm' ? clean : 'audio/webm';
  }
  return clean || 'application/octet-stream';
}

export function validateMediaPolicy(
  kind: MediaKind,
  mimeType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; reason: string } {
  const rule = LIMITS[kind];
  if (!rule) return { ok: false, reason: 'Invalid media kind' };
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: 'File size must be a positive integer' };
  }
  if (sizeBytes > rule.maxBytes) {
    return { ok: false, reason: `File exceeds maximum size of ${Math.round(rule.maxBytes / (1024 * 1024))} MB` };
  }
  void mimeType;
  return { ok: true };
}

export function sanitizeFileName(raw?: string | null): string {
  if (!raw) return 'file';
  const cleaned = raw.replace(/[/\\?%*:|"<>[\]\u0000-\u001F]/g, '_').trim();
  return cleaned.slice(0, 120) || 'file';
}

export function validateMediaUpload(kind: MediaKind, mimeType: string, sizeBytes: number): string | null {
  const res = validateMediaPolicy(kind, mimeType, sizeBytes);
  return res.ok ? null : res.reason;
}
