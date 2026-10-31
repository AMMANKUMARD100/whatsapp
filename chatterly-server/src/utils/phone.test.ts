import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('accepts valid E.164', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('strips formatting spaces and dashes', () => {
    expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
    expect(normalizePhone('+91 98765-43210')).toBe('+919876543210');
  });

  it('rejects invalid numbers', () => {
    expect(normalizePhone('14155552671')).toBeNull();
    expect(normalizePhone('+012345678')).toBeNull();
    expect(normalizePhone('invalid')).toBeNull();
  });
});
