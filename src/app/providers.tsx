import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/types/domain';
import { bindQueryClient, useAuthStore } from '@/store/auth';
import { applyStoredTheme, useUiStore } from '@/store/ui';
import { ToastViewport } from '@/components/ui';

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.status === 401 || error.status === 403 || error.status === 404) return false;
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 1;
        },
      },
      mutations: { retry: 0 },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createClient);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    bindQueryClient(queryClient);
  }, [queryClient]);

  useEffect(() => {
    applyStoredTheme();
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0f19' : '#f4f6fa');
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
