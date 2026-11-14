import type { ReactNode } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/format';

const TONES = {
  brand: 'border-brand/25 bg-brand/10 text-brand',
  gold: 'border-gold/25 bg-gold/10 text-gold',
  success: 'border-success/25 bg-success/10 text-success',
  info: 'border-info/25 bg-info/10 text-info',
  danger: 'border-danger/25 bg-danger/10 text-danger',
  neutral: 'border-line bg-elevated text-ink2',
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({ label, value, hint, icon, tone = 'brand', className }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className="mt-1.5 break-words font-display text-xl font-semibold leading-tight text-ink sm:text-2xl">{value}</p>
          {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
        </div>
        {icon && (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', TONES[tone])}>
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}
