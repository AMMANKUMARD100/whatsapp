import { apiFetch } from '../../core/api/client';
import { UserProfile } from '../auth/types';

export const profileApi = {
  updateProfile: (data: { name?: string; about?: string }) =>
    apiFetch<UserProfile>('/users/profile', { method: 'PATCH', body: data }),
  uploadAvatar: (image: string) =>
    apiFetch<{ avatarUrl: string }>('/users/avatar', { method: 'POST', body: { image } }),
};
