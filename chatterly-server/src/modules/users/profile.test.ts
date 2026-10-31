import { describe, expect, it } from 'vitest';
import { cleanAbout, cleanName, DEFAULT_ABOUT } from './profile';

describe('cleanName', () => {
  it('trims and collapses whitespace', () => expect(cleanName('  Aman   Kumar ')).toBe('Aman Kumar'));
  it('strips control characters', () => expect(cleanName('Aman\u0000\u0007')).toBe('Aman'));
  it('rejects empty', () => expect(cleanName('   ')).toBeNull());
  it('rejects names over 60 characters', () => expect(cleanName('a'.repeat(61))).toBeNull());
  it('accepts exactly 60', () => expect(cleanName('a'.repeat(60))).toHaveLength(60));
});

describe('cleanAbout', () => {
  it('falls back to the default when empty', () => expect(cleanAbout('  ')).toBe(DEFAULT_ABOUT));
  it('rejects over 139 characters', () => expect(cleanAbout('a'.repeat(140))).toBeNull());
  it('keeps a normal value', () => expect(cleanAbout('At work')).toBe('At work'));
});
