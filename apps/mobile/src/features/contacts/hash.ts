import * as Crypto from 'expo-crypto';

export async function hashPhoneNumber(phone: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, phone);
}
