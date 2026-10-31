import { describe, expect, it } from 'vitest';
import { canDeleteForEveryone, canEditMessage, directKey } from './rules';

describe('chat rules', () => {
  it('directKey is deterministic regardless of order', () => {
    expect(directKey('userA', 'userB')).toBe('userA:userB');
    expect(directKey('userB', 'userA')).toBe('userA:userB');
  });

  it('canDeleteForEveryone enforces 48 hours window', () => {
    const now = Date.now();
    expect(canDeleteForEveryone(now, now)).toBe(true);
    expect(canDeleteForEveryone(now - 47 * 3600 * 1000, now)).toBe(true);
    expect(canDeleteForEveryone(now - 49 * 3600 * 1000, now)).toBe(false);
  });

  it('canEditMessage enforces 15 minutes window', () => {
    const now = Date.now();
    expect(canEditMessage(now, now)).toBe(true);
    expect(canEditMessage(now - 14 * 60 * 1000, now)).toBe(true);
    expect(canEditMessage(now - 16 * 60 * 1000, now)).toBe(false);
  });
});
