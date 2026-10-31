export const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (!PHONE_REGEX.test(cleaned)) return null;
  return cleaned;
}
