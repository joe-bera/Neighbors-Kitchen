import { create } from 'zustand';
import type { User } from '../types/user.types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: User | null;
  /** Kept in memory only. The long-lived refresh token is an httpOnly cookie. */
  accessToken: string | null;
  /** 'loading' until the app has checked for an existing session on startup. */
  status: AuthStatus;
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));
