import { apiFetch } from '../../core/api/client';
import { UserProfile } from './types';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export const authApi = {
  sendOtp: (phone: string) => apiFetch<{ success: boolean }>('/auth/otp/send', { method: 'POST', body: { phone } }),
  verifyOtp: (payload: { phone?: string; code?: string; idToken?: string; deviceId?: string; platform?: string }) =>
    apiFetch<AuthSession>('/auth/otp/verify', { method: 'POST', body: payload }),
  devLogin: (phone: string) => apiFetch<AuthSession>('/auth/dev-login', { method: 'POST', body: { phone } }),
  logout: (all = false) => apiFetch<void>('/auth/logout', { method: 'POST', body: { all } }),
};
