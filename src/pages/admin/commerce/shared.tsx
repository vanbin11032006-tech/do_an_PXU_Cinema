import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { listCinemasAdmin, refundStatusLabel } from '@/api';
import { cn } from '@/lib/format';
import { Badge, Card, Select, Skeleton, StatusBadge } from '@/components/ui';
import type { Refund } from '@/types/domain';

/* ------------------------------- Labels ------------------------------- */

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_qr: 'Chuyển khoản QR',
  cash: 'Tiền mặt',
  card: 'Thẻ',
  mixed: 'Kết hợp',
};

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—';
  return PAYMENT_METHOD_LABEL[method] ?? method;
}

const REFUND_SCOPE_LABEL: Record<Refund['scope'], string> = {
  full: 'Toàn phần',
  partial: 'Một phần',
};

export function refundScopeLabel(scope: Refund['scope']): string {
  return REFUND_SCOPE_LABEL[scope];
}

export function ChannelBadge({ channel }: { channel: 'online' | 'pos' }) {
  return <Badge tone={channel === 'online' ? 'info' : 'neutral'}>{channel === 'online' ? 'Trực tuyến' : 'Tại quầy'}</Badge>;
}

export function PaymentMethodBadge({ method }: { method?: string | null }) {
  if (!method) return <span className="text-xs text-muted">—</span>;
  return <Badge tone={method === 'bank_qr' ? 'brand' : 'neutral'}>{paymentMethodLabel(method)}</Badge>;
}

export function RefundStatusBadge({ status }: { status: Refund['status'] }) {
  return <StatusBadge status={status} label={refundStatusLabel(status)} />;
}

/* ------------------------------- KPI ------------------------------- */

export type KpiTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

const KPI_TONE: Record<KpiTone, { icon: string; value: string }> = {
  brand: { icon: 'border-brand/25 bg-brand/10 text-brand', value: 'text-ink' },
  success: { icon: 'border-success/25 bg-success/10 text-success', value: 'text-success' },
  warning: { icon: 'border-warning/25 bg-warning/10 text-warning', value: 'text-warning' },
  danger: { icon: 'border-danger/25 bg-danger/10 text-danger', value: 'text-danger' },
  info: { icon: 'border-info/25 bg-info/10 text-info', value: 'text-ink' },
  gold: { icon: 'border-gold/25 bg-gold/10 text-gold', value: 'text-gold' },
};

export function KpiCard({ label, value, hint, icon: Icon, tone = 'brand', loading }: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: KpiTone;
  loading?: boolean;
}) {
  const styles = KPI_TONE[tone];
  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-full space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-4 transition duration-300 hover:border-brand/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
          <p className={cn('mt-1.5 truncate font-display text-2xl font-bold tracking-wide sm:text-[28px]', styles.value)}>{value}</p>
          {hint && <div className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</div>}
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', styles.icon)}>
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
    </Card>
  );
}

export function RevenueDelta({ current, previous, loading }: { current: number; previous: number; loading?: boolean }) {
  if (loading) return <Skeleton className="h-3 w-28" />;
  if (!previous) return <span>Chưa có dữ liệu hôm qua</span>;
  const delta = Math.round(((current - previous) / previous) * 100);
  const up = delta >= 0;
  return (
    <span className={up ? 'font-semibold text-success' : 'font-semibold text-danger'}>
      {up ? '▲' : '▼'} {Math.abs(delta)}% so với hôm qua
    </span>
  );
}

/* ------------------------------- Panel ------------------------------- */

export function Panel({ title, description, action, children, className, bodyClassName }: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn('min-w-0 flex-1 p-4 sm:p-5', bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ------------------------------- Cinema filter ------------------------------- */

export function CinemaSelect({ value, onChange, id, className }: {
  value: number | null;
  onChange: (id: number | null) => void;
  id?: string;
  className?: string;
}) {
  const { data: cinemas } = useQuery({
    queryKey: ['admin', 'cinemas'],
    queryFn: listCinemasAdmin,
    staleTime: 120_000,
  });
  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={className}
      aria-label="Lọc theo rạp"
    >
      <option value="">Tất cả rạp</option>
      {(cinemas ?? []).map((cinema) => (
        <option key={cinema.id} value={cinema.id}>{cinema.name}</option>
      ))}
    </Select>
  );
}

/* ------------------------------- Notice ------------------------------- */

const NOTICE_TONE = {
  info: { wrap: 'border-info/30 bg-info/5', icon: 'text-info', Icon: Info },
  warning: { wrap: 'border-warning/35 bg-warning/5', icon: 'text-warning', Icon: AlertTriangle },
  danger: { wrap: 'border-danger/35 bg-danger/5', icon: 'text-danger', Icon: ShieldAlert },
  success: { wrap: 'border-success/35 bg-success/5', icon: 'text-success', Icon: CheckCircle2 },
} as const;

export function Notice({ tone = 'info', title, children, action, className }: {
  tone?: keyof typeof NOTICE_TONE;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = NOTICE_TONE[tone];
  const NoticeIcon = styles.Icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-card border px-3.5 py-3', styles.wrap, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <NoticeIcon className={cn('mt-0.5 h-4 w-4 shrink-0', styles.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-ink">{title}</p>}
        {children && <div className={cn('text-xs leading-relaxed text-ink2', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
