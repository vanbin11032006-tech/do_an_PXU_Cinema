import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, TimerReset } from 'lucide-react';
import { cn, countdownText, money } from '@/lib/format';
import { toast } from './toast';

/* ------------------------------- Stepper ------------------------------- */

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar', className)} aria-label="Tiến trình đặt vé">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex min-w-0 items-center gap-1">
            {index > 0 && <span className={cn('h-px w-4 shrink-0 sm:w-7', done || active ? 'bg-brand/60' : 'bg-line')} aria-hidden />}
            <div
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 text-[11px] font-semibold sm:pr-3',
                active && 'bg-brand/10 text-brand',
                done && 'text-ink2',
                !active && !done && 'text-muted',
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]',
                done ? 'border-brand bg-brand text-white' : active ? 'border-brand text-brand' : 'border-line text-muted',
              )}>
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">{step}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------- Countdown ------------------------------- */

export function useCountdown(expiresAt: string | undefined, serverTime?: string) {
  const offsetRef = useRef(0);
  const [tick, setTick] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!serverTime) return;
    offsetRef.current = new Date(serverTime).getTime() - Date.now();
    setTick((n) => n + 1);
  }, [serverTime]);

  useEffect(() => {
    firedRef.current = false;
    const timer = window.setInterval(() => setTick((n) => n + 1), 250);
    const onVisible = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt]);

  const remaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - (Date.now() + offsetRef.current)) : 0;
  void tick;
  return {
    remaining,
    expired: Boolean(expiresAt) && remaining <= 0,
    text: countdownText(remaining),
    critical: remaining > 0 && remaining <= 120_000,
  };
}

export function HoldCountdown({ expiresAt, serverTime, onExpire, onWarn, className, compact }: {
  expiresAt?: string; serverTime?: string; onExpire?: () => void; onWarn?: () => void; className?: string; compact?: boolean;
}) {
  const { remaining, expired, text, critical } = useCountdown(expiresAt, serverTime);
  const warnedRef = useRef(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 120_000 && remaining > 0 && !warnedRef.current) {
      warnedRef.current = true;
      onWarn?.();
    }
    if (expired && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
  }, [remaining, expired, onExpire, onWarn]);

  if (!expiresAt) return null;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums',
        expired ? 'border-danger/40 bg-danger/10 text-danger' : critical ? 'animate-pulse-soft border-warning/50 bg-warning/10 text-warning' : 'border-line bg-elevated/70 text-ink2',
        className,
      )}
      role="timer"
      aria-live="off"
      aria-label={`Thời gian giữ ghế còn ${text}`}
    >
      <TimerReset className={cn('h-3.5 w-3.5', critical && 'text-warning')} />
      {compact ? <span>{text}</span> : <>
        <span className="font-normal text-muted">{expired ? 'Đã hết giờ giữ ghế' : 'Giữ ghế còn'}</span>
        <span className="text-sm">{text}</span>
      </>}
    </div>
  );
}

/* ------------------------------- Copy field ------------------------------- */

export function CopyField({ label, value, emphasis, className }: { label: string; value: string; emphasis?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    toast.success('Đã sao chép', `${label}: ${value}`);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border border-line/70 bg-base/50 px-3 py-2.5', emphasis && 'border-brand/30 bg-brand/5', className)}>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className={cn('truncate text-sm font-semibold text-ink', emphasis && 'text-brand')}>{value}</p>
      </div>
      <button type="button" onClick={copy} className="shrink-0 rounded-md p-1.5 text-muted transition hover:bg-elevated hover:text-ink" aria-label={`Sao chép ${label}`}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ------------------------------- Headings ------------------------------- */

export function SectionHeading({ eyebrow, title, description, action, className }: {
  eyebrow?: string; title: string; description?: string; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: {
  title: string; description?: string; actions?: React.ReactNode; breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumb}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------- Money summary ------------------------------- */

export interface TotalsShape {
  ticketsSubtotal: number;
  combosSubtotal: number;
  discount: number;
  pointsDiscount?: number;
  taxAmount?: number;
  finalAmount: number;
}

export function PriceBreakdown({ totals, vatPercent = 8, className }: {
  totals: TotalsShape; vatPercent?: number; className?: string;
}) {
  return (
    <div className={cn('space-y-2 text-sm', className)}>
      <div className="flex justify-between text-ink2"><span>Tiền vé</span><span className="text-money">{money(totals.ticketsSubtotal)}</span></div>
      {totals.combosSubtotal > 0 && <div className="flex justify-between text-ink2"><span>Bắp nước</span><span className="text-money">{money(totals.combosSubtotal)}</span></div>}
      {totals.discount > 0 && <div className="flex justify-between text-success"><span>Giảm giá voucher</span><span className="text-money">−{money(totals.discount)}</span></div>}
      {(totals.pointsDiscount ?? 0) > 0 && <div className="flex justify-between text-success"><span>Điểm thưởng</span><span className="text-money">−{money(totals.pointsDiscount)}</span></div>}
      <div className="flex justify-between border-t border-line/70 pt-2 text-base font-bold text-ink">
        <span>Tổng thanh toán</span>
        <span className="text-money text-brand">{money(totals.finalAmount)}</span>
      </div>
      <p className="text-right text-[10px] text-muted">Đã bao gồm VAT {vatPercent}%{totals.taxAmount ? ` (${money(totals.taxAmount)})` : ''}</p>
    </div>
  );
}

export function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2 text-sm', className)}>
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

export function BackLink({ href, label = 'Quay lại' }: { href: string; label?: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-xs font-medium text-muted transition hover:text-brand">
      <ChevronRight className="h-3.5 w-3.5 rotate-180" /> {label}
    </a>
  );
}
