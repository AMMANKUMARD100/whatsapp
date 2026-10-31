export const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000;
export const EDIT_MESSAGE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function directKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function canDeleteForEveryone(createdAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - createdAtMs <= DELETE_FOR_EVERYONE_WINDOW_MS;
}

export function canEditMessage(createdAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - createdAtMs <= EDIT_MESSAGE_WINDOW_MS;
}
