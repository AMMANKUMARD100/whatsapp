import { create } from 'zustand';
import { storage } from '../../core/storage/secureStorage';
import { authApi } from './authApi';
import { UserProfile } from './types';

interface AuthStore {
  user: UserProfile | null;
  status: 'loading' | 'signedIn' | 'signedOut';
  init: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  signIn: (session: { accessToken: string; refreshToken: string; user: UserProfile }) => Promise<void>;
  signOut: (all?: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  status: 'loading',

  init: async () => {
    try {
      const storedUser = await storage.get('user');
      const token = await storage.get('accessToken');
      if (storedUser && token) {
        set({ user: JSON.parse(storedUser), status: 'signedIn' });
      } else {
        set({ user: null, status: 'signedOut' });
      }
    } catch {
      set({ user: null, status: 'signedOut' });
    }
  },

  setUser: (user) => {
    if (user) {
      void storage.set('user', JSON.stringify(user));
    } else {
      void storage.delete('user');
    }
    set({ user });
  },

  signIn: async ({ accessToken, refreshToken, user }) => {
    await storage.set('accessToken', accessToken);
    await storage.set('refreshToken', refreshToken);
    await storage.set('user', JSON.stringify(user));
    set({ user, status: 'signedIn' });
  },

  signOut: async (all = false) => {
    await authApi.logout(all).catch(() => undefined);
    await storage.delete('accessToken');
    await storage.delete('refreshToken');
    await storage.delete('user');
    set({ user: null, status: 'signedOut' });
  },
}));
