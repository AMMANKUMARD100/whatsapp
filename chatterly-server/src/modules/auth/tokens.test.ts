import { describe, expect, it } from 'vitest';
import { generateRefreshToken, hashPhone, hashToken } from './tokens';

describe('auth tokens', () => {
  it('generates 64 character hex string for refresh token', () => {
    const token = generateRefreshToken();
    expect(token).toHaveLength(64);
  });

  it('generates consistent sha256 hash', () => {
    const hash = hashToken('test-token');
    expect(hash).toHaveLength(64);
    expect(hashToken('test-token')).toBe(hash);
  });

  it('hashes phone consistently', () => {
    const p1 = hashPhone('+1234567890');
    expect(p1).toHaveLength(64);
    expect(hashPhone('+1234567890')).toBe(p1);
  });
});
