import { describe, expect, it } from 'vitest';
import {
  computeSafetyNumber,
  decryptText,
  encryptText,
  generateIdentityKeyPair,
  isEncryptedEnvelope,
} from './crypto';

describe('e2ee crypto', () => {
  it('encrypts and decrypts symmetrically between two keypairs', () => {
    const alice = generateIdentityKeyPair();
    const bob = generateIdentityKeyPair();

    const plaintext = 'Hello Bob! Secret meeting at 5pm.';
    const envelope = encryptText(plaintext, alice, bob.publicKey);

    expect(isEncryptedEnvelope(envelope)).toBe(true);

    // Bob decrypts
    const decryptedByBob = decryptText(envelope, bob, alice.publicKey);
    expect(decryptedByBob).toBe(plaintext);

    // Alice also can decrypt what she sent
    const decryptedByAlice = decryptText(envelope, alice, bob.publicKey);
    expect(decryptedByAlice).toBe(plaintext);
  });

  it('computes identical safety numbers regardless of order', () => {
    const alice = generateIdentityKeyPair();
    const bob = generateIdentityKeyPair();

    const num1 = computeSafetyNumber(alice.publicKey, bob.publicKey);
    const num2 = computeSafetyNumber(bob.publicKey, alice.publicKey);

    expect(num1).toBe(num2);
    expect(num1).toMatch(/^\d{4} \d{4} \d{4}$/);
  });
});
