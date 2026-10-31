import { describe, expect, it } from 'vitest';
import { formatPushBody } from './payload';

describe('formatPushBody', () => {
  it('formats media and truncates long text', () => {
    expect(formatPushBody('image', null)).toBe('📷 Sent a photo');
    expect(formatPushBody('audio', null)).toBe('🎤 Sent a voice note');
    expect(formatPushBody('document', null)).toBe('📄 Sent a document');
    expect(formatPushBody('text', 'a'.repeat(130))).toHaveLength(120);
  });

  it('hides encrypted ciphertext preview', () => {
    expect(formatPushBody('text', 'e2ee:v1:some-cipher-text')).toBe('🔒 Encrypted message');
  });
});
