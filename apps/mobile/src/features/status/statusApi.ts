import { apiFetch } from '../../core/api/client';

export interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  caption: string | null;
  bgColor: string;
  mediaKind: 'image' | 'video' | null;
  mediaMimeType?: string | null;
  mediaUrl: string | null;
  createdAt: number;
  viewCount: number;
  viewedByMe: boolean;
}

export const statusApi = {
  list: () => apiFetch<{ statuses: StatusItem[] }>('/status'),
  create: (body: { caption?: string; bgColor?: string; mediaId?: string }) =>
    apiFetch<{ id: string }>('/status', { method: 'POST', body }),
  markViewed: (id: string) => apiFetch<void>(`/status/${id}/view`, { method: 'POST' }),
};
