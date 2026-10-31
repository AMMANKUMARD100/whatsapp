import { apiFetch } from '../../core/api/client';

export interface GroupMember {
  userId: string;
  name: string;
  about: string;
  avatarUrl: string | null;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface GroupDetails {
  id: string;
  name: string;
  iconUrl: string | null;
  createdBy: string | null;
  myRole: 'admin' | 'member';
  members: GroupMember[];
}

export const groupsApi = {
  getDetails: (chatId: string) => apiFetch<GroupDetails>(`/groups/${chatId}`),
  rename: (chatId: string, name: string) => apiFetch<GroupDetails>(`/groups/${chatId}`, { method: 'PATCH', body: { name } }),
  uploadIcon: (chatId: string, image: string) =>
    apiFetch<{ iconUrl: string }>(`/groups/${chatId}/icon`, { method: 'POST', body: { image } }),
  addMembers: (chatId: string, userIds: string[]) =>
    apiFetch<GroupDetails>(`/groups/${chatId}/members`, { method: 'POST', body: { userIds } }),
  setRole: (chatId: string, userId: string, role: 'admin' | 'member') =>
    apiFetch<GroupDetails>(`/groups/${chatId}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeOrLeave: (chatId: string, userId: string) =>
    apiFetch<void>(`/groups/${chatId}/members/${userId}`, { method: 'DELETE' }),
};
