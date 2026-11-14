import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

const TONES = {
  brand: 'border-brand/25 bg-brand/10 text-brand',
  success: 'border-success/25 bg-success/10 text-success',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
} as const;

export function AuthStatusPanel({
  icon,
  tone = 'brand',
  title,
  description,
  children,
}: {
  icon: ReactNode;
  tone?: keyof typeof TONES;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="text-center">
      <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border', TONES[tone])} aria-hidden>
        {icon}
      </div>
      <h2 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-ink">{title}</h2>
      {description && <div className="mt-2.5 text-sm leading-relaxed text-muted">{description}</div>}
      {children && <div className="mt-6 space-y-2.5">{children}</div>}
    </div>
  );
}
