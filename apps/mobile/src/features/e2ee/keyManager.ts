import { apiFetch } from '../../core/api/client';
import { storage } from '../../core/storage/secureStorage';
import {
  computeSafetyNumber,
  decryptText,
  encryptText,
  generateIdentityKeyPair,
  isEncryptedEnvelope,
  type KeyPairBase64,
} from './crypto';

const peerKeyCache = new Map<string, string>();
let cachedPair: { userId: string; pair: KeyPairBase64 } | null = null;

function keyStorageName(userId: string) {
  return `e2ee:identity:${userId}`;
}

export async function ensureMyKeyPair(userId: string): Promise<KeyPairBase64> {
  if (cachedPair?.userId === userId) return cachedPair.pair;

  const stored = await storage.get(keyStorageName(userId));
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as KeyPairBase64;
      cachedPair = { userId, pair: parsed };
      // Keep server public key synced
      await apiFetch<void>('/e2ee/keys', { method: 'PUT', body: { publicKey: parsed.publicKey } }).catch(() => undefined);
      return parsed;
    } catch {
      // Fall through to regenerate
    }
  }

  const pair = generateIdentityKeyPair();
  await storage.set(keyStorageName(userId), JSON.stringify(pair));
  cachedPair = { userId, pair };
  await apiFetch<void>('/e2ee/keys', { method: 'PUT', body: { publicKey: pair.publicKey } }).catch(() => undefined);
  return pair;
}

export async function getPeerPublicKey(peerUserId: string): Promise<string | null> {
  if (peerKeyCache.has(peerUserId)) return peerKeyCache.get(peerUserId) ?? null;
  try {
    const res = await apiFetch<{ userId: string; publicKey: string | null }>(`/e2ee/keys/${peerUserId}`);
    if (res.publicKey) peerKeyCache.set(peerUserId, res.publicKey);
    return res.publicKey;
  } catch {
    return null;
  }
}

export async function encryptForDirectPeer(
  myUserId: string,
  peerUserId: string | null,
  plaintext: string,
): Promise<string> {
  if (!peerUserId) return plaintext;
  const [myPair, peerPub] = await Promise.all([ensureMyKeyPair(myUserId), getPeerPublicKey(peerUserId)]);
  if (!peerPub) return plaintext;
  return encryptText(plaintext, myPair, peerPub);
}

export async function decryptFromDirectPeer(
  myUserId: string,
  peerUserId: string | null,
  body: string | null,
): Promise<{ text: string | null; encrypted: boolean }> {
  if (!body || !isEncryptedEnvelope(body)) return { text: body, encrypted: false };
  const [myPair, peerPub] = await Promise.all([
    ensureMyKeyPair(myUserId),
    peerUserId ? getPeerPublicKey(peerUserId) : Promise.resolve(null),
  ]);
  const plain = decryptText(body, myPair, peerPub);
  return { text: plain ?? '🔒 Waiting for peer encryption key…', encrypted: true };
}

export async function getSafetyNumberWithPeer(myUserId: string, peerUserId: string): Promise<string | null> {
  const [myPair, peerPub] = await Promise.all([ensureMyKeyPair(myUserId), getPeerPublicKey(peerUserId)]);
  if (!peerPub) return null;
  return computeSafetyNumber(myPair.publicKey, peerPub);
}
