import { apiFetch } from '../../core/api/client';

export interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  caption: string | null;
  bgColor: string;
  mediaUrl: string | null;
  createdAt: number;
  viewCount: number;
  viewedByMe: boolean;
}

export const statusApi = {
  list: async (): Promise<StatusItem[]> => {
    const res = await apiFetch<{ statuses: StatusItem[] }>('/status');
    return res.statuses;
  },

  create: async (input: { caption?: string; bgColor?: string; mediaId?: string }): Promise<{ id: string }> => {
    return apiFetch<{ id: string }>('/status', {
      method: 'POST',
      body: input,
    });
  },

  markViewed: async (statusId: string): Promise<void> => {
    await apiFetch(`/status/${statusId}/view`, { method: 'POST' }).catch(() => undefined);
  },
};
