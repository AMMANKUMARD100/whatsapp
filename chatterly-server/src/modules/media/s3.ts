import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { env } from '../../config/env';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

function filePathForKey(storageKey: string): string {
  // Prevent any path traversal
  const safeRel = storageKey.split('/').map((part) => part.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/');
  return join(UPLOAD_ROOT, safeRel);
}

export function saveUploadedBuffer(storageKey: string, data: Buffer): void {
  const fullPath = filePathForKey(storageKey);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, data);
}

export function readUploadedBuffer(storageKey: string): Buffer | null {
  const fullPath = filePathForKey(storageKey);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath);
}

export async function signUploadUrl(storageKey: string, _mimeType: string, _sizeBytes: number): Promise<string> {
  // Extract media ID from "<userId>/<mediaId>/<fileName>"
  const parts = storageKey.split('/');
  const mediaId = parts.length > 1 ? parts[1] : parts[0];
  return `/media/${mediaId}/upload`;
}

export async function signDownloadUrl(storageKey: string): Promise<string> {
  const parts = storageKey.split('/');
  const mediaId = parts.length > 1 ? parts[1] : parts[0];
  return `/media/${mediaId}/file`;
}

export async function verifyObjectExists(storageKey: string): Promise<boolean> {
  void env;
  return existsSync(filePathForKey(storageKey));
}
