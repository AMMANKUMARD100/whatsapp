export const DEFAULT_ABOUT = 'Hey there! I am using Chatterly';
export const MAX_NAME = 60;
export const MAX_ABOUT = 139;

/** Returns the cleaned name, or null if it is empty or too long. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  return name.length >= 1 && name.length <= MAX_NAME ? name : null;
}

/** Returns the cleaned about text (default if empty), or null if too long. */
export function cleanAbout(raw: string): string | null {
  const about = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (about.length === 0) return DEFAULT_ABOUT;
  return about.length <= MAX_ABOUT ? about : null;
}
