import { useEffect } from 'react';
import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/format';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; title: string; message?: string; tone: ToastTone }

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = ++counter;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }));
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().push({ title, message, tone: 'success' }),
  error: (title: string, message?: string) => useToastStore.getState().push({ title, message, tone: 'error' }),
  info: (title: string, message?: string) => useToastStore.getState().push({ title, message, tone: 'info' }),
  warning: (title: string, message?: string) => useToastStore.getState().push({ title, message, tone: 'warning' }),
};

const TONE = {
  success: { icon: CheckCircle2, cls: 'border-success/40 text-success' },
  error: { icon: XCircle, cls: 'border-danger/40 text-danger' },
  warning: { icon: AlertTriangle, cls: 'border-warning/40 text-warning' },
  info: { icon: Info, cls: 'border-info/40 text-info' },
};

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  useEffect(() => {
    if (!toasts.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(toasts[toasts.length - 1].id); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, dismiss]);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite" aria-atomic="true">
      {toasts.map((item) => {
        const Icon = TONE[item.tone].icon;
        return (
          <div key={item.id} className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-card border border-line bg-surface/95 p-3.5 shadow-lift backdrop-blur">
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', TONE[item.tone].cls)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              {item.message && <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.message}</p>}
            </div>
            <button onClick={() => dismiss(item.id)} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Đóng thông báo">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
