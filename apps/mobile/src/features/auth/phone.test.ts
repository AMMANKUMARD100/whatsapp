import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('client phone normalization', () => {
  it('formats clean E.164 phone number', () => {
    expect(normalizePhone('+1 (555) 019-2834')).toBe('+15550192834');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('5550192834')).toBeNull();
  });
});
