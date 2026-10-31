import * as Crypto from 'expo-crypto';
import nacl from 'tweetnacl';

const PREFIX = 'e2ee:v1:';

// Configure tweetnacl's PRNG to use Expo's OS CSPRNG
nacl.setPRNG((x, n) => {
  const randomBytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = randomBytes[i];
});

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface KeyPairBase64 {
  publicKey: string;
  secretKey: string;
}

export function generateIdentityKeyPair(): KeyPairBase64 {
  const kp = nacl.box.keyPair();
  return { publicKey: toBase64(kp.publicKey), secretKey: toBase64(kp.secretKey) };
}

export function isEncryptedEnvelope(body?: string | null): boolean {
  return typeof body === 'string' && body.startsWith(PREFIX);
}

/**
 * Encrypts UTF-8 plaintext using X25519 + XSalsa20-Poly1305.
 * Format: e2ee:v1:<senderPubB64>:<nonceB64>:<cipherB64>
 */
export function encryptText(
  plaintext: string,
  myKeyPair: KeyPairBase64,
  peerPublicKeyB64: string,
): string {
  const nonce = Crypto.getRandomBytes(nacl.box.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const peerPub = fromBase64(peerPublicKeyB64);
  const mySec = fromBase64(myKeyPair.secretKey);

  const boxed = nacl.box(messageBytes, nonce, peerPub, mySec);
  return `${PREFIX}${myKeyPair.publicKey}:${toBase64(nonce)}:${toBase64(boxed)}`;
}

/**
 * Decrypts an e2ee:v1 envelope. Works whether the current user is the recipient
 * (uses senderPub from the envelope) or the sender (uses peerPublicKeyB64).
 */
export function decryptText(
  envelope: string,
  myKeyPair: KeyPairBase64,
  peerPublicKeyB64?: string | null,
): string | null {
  if (!isEncryptedEnvelope(envelope)) return envelope;
  try {
    const parts = envelope.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return null;
    const [senderPubB64, nonceB64, cipherB64] = parts;

    const nonce = fromBase64(nonceB64);
    const cipher = fromBase64(cipherB64);
    const mySec = fromBase64(myKeyPair.secretKey);

    const isMine = senderPubB64 === myKeyPair.publicKey;
    const peerPubBytes = isMine
      ? peerPublicKeyB64
        ? fromBase64(peerPublicKeyB64)
        : null
      : fromBase64(senderPubB64);

    if (!peerPubBytes) return null;

    const unboxed = nacl.box.open(cipher, nonce, peerPubBytes, mySec);
    if (!unboxed) return null;

    return new TextDecoder().decode(unboxed);
  } catch {
    return null;
  }
}

/**
 * Computes a deterministic 12-digit safety number between two public keys.
 */
export function computeSafetyNumber(pubA: string, pubB: string): string {
  const sorted = [pubA, pubB].sort().join(':');
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = (hash << 5) - hash + sorted.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash).toString();
  const padded = (positive + '123456789012').slice(0, 12);
  return `${padded.slice(0, 4)} ${padded.slice(4, 8)} ${padded.slice(8, 12)}`;
}
