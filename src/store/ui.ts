import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  adminCinemaId: number | null;
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setAdminCinemaId: (id: number | null) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      adminCinemaId: null,
      sidebarCollapsed: false,
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme;
        set({ theme });
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
      setAdminCinemaId: (adminCinemaId) => set({ adminCinemaId }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    {
      name: 'pxu.ui',
      partialize: (state) => ({ theme: state.theme, adminCinemaId: state.adminCinemaId, sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);

export function applyStoredTheme(): void {
  const theme = useUiStore.getState().theme;
  document.documentElement.dataset.theme = theme;
}
