import { create } from 'zustand';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@/types/domain';
import { login as apiLogin, register as apiRegister, logout as apiLogout, me as apiMe } from '@/api';
import { can as checkPermission } from '@/api';
import { clearSessionToken, getSessionToken } from '@/api/rpc';

let activeQueryClient: QueryClient | null = null;

export function bindQueryClient(client: QueryClient): void {
  activeQueryClient = client;
}

interface AuthState {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: { name: string; email: string; phone: string; password: string; acceptTerms: boolean }) => Promise<SessionUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (user: SessionUser) => void;
  can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  bootstrap: async () => {
    if (!getSessionToken()) {
      set({ user: null, status: 'anonymous' });
      return;
    }
    try {
      const user = await apiMe();
      set({ user, status: 'authenticated' });
    } catch {
      clearSessionToken();
      set({ user: null, status: 'anonymous' });
    }
  },

  login: async (email, password) => {
    const user = await apiLogin(email, password);
    activeQueryClient?.clear();
    set({ user, status: 'authenticated' });
    return user;
  },

  register: async (payload) => {
    const user = await apiRegister(payload);
    activeQueryClient?.clear();
    set({ user, status: 'authenticated' });
    return user;
  },

  logout: () => {
    void apiLogout();
    activeQueryClient?.clear();
    set({ user: null, status: 'anonymous' });
  },

  refresh: async () => {
    if (!get().user) return;
    const user = await apiMe();
    set({ user });
  },

  setUser: (user) => {
    set({ user, status: 'authenticated' });
  },

  can: (permission) => checkPermission(get().user, permission),
}));

export function homeRouteFor(user: SessionUser | null): string {
  if (!user) return '/';
  if (user.role === 'admin' || user.role === 'manager') return '/admin';
  if (user.role === 'staff') return '/staff/quet-ve';
  return '/';
}
