import { resolveAssetUrl } from '../../core/api/assetUrl';
import { apiFetch, API_BASE } from '../../core/api/client';
import { storage } from '../../core/storage/secureStorage';
import { LocalMediaUpload, MediaAttachment } from '../../core/services/types';

interface PresignResponse {
  media: MediaAttachment;
  uploadUrl: string;
}

/**
 * Reads the local file URI as a Blob, requests an upload URL from `/media/presign`,
 * uploads the binary payload, and returns the resolved MediaAttachment with a full URL.
 */
export async function uploadMedia(local: LocalMediaUpload): Promise<MediaAttachment> {
  const fileResponse = await fetch(local.uri);
  const blob = await fileResponse.blob();
  const sizeBytes = blob.size > 0 ? blob.size : local.sizeBytes && local.sizeBytes > 0 ? local.sizeBytes : 1;
  const mimeType = (local.mimeType || blob.type || 'application/octet-stream').split(';')[0].trim();

  const { media, uploadUrl } = await apiFetch<PresignResponse>('/media/presign', {
    method: 'POST',
    body: {
      kind: local.kind,
      mimeType,
      sizeBytes,
      fileName: local.fileName,
      width: local.width,
      height: local.height,
      durationMs: local.durationMs,
    },
  });

  const fullUploadUrl = uploadUrl.startsWith('http') ? uploadUrl : `${API_BASE}${uploadUrl}`;
  const token = await storage.get('accessToken');

  const putRes = await fetch(fullUploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': media.mimeType || 'application/octet-stream',
      ...(token && !uploadUrl.startsWith('http') ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => '');
    throw new Error(`Upload failed (${putRes.status}): ${errText}`);
  }

  return {
    ...media,
    url: resolveAssetUrl(media.url) ?? media.url,
  };
}

export const uploadMediaAttachment = uploadMedia;

export async function refreshMediaUrl(mediaId: string): Promise<string> {
  const res = await apiFetch<{ url: string }>(`/media/${mediaId}/url`);
  return resolveAssetUrl(res.url) ?? res.url;
}
