import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Check, Crown, Gift, Sparkles, TrendingUp } from 'lucide-react';
import type { PointTransaction } from '@/types/domain';
import { getPointsSummary } from '@/api';
import { errorMessage } from '@/lib/errors';
import { money, relativeTime } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import {
  Badge, Card, EmptyState, ErrorState, PageHeader, Progress, Skeleton, TierBadge,
} from '@/components/ui';
import { cn } from '@/lib/format';

const TYPE_LABEL: Record<PointTransaction['type'], string> = {
  earn: 'Tích điểm',
  redeem: 'Đổi điểm',
  adjust: 'Điều chỉnh',
  refund_revert: 'Hoàn điểm',
  expire: 'Hết hạn',
};

function transactionTone(type: PointTransaction['type'], points: number): { icon: ReactNode; className: string } {
  if (points >= 0) {
    return { icon: <ArrowUpRight className="h-4 w-4" />, className: 'text-success' };
  }
  if (type === 'expire') return { icon: <ArrowDownRight className="h-4 w-4" />, className: 'text-danger' };
  return { icon: <ArrowDownRight className="h-4 w-4" />, className: 'text-warning' };
}

export default function PointsPage() {
  useDocumentTitle('Điểm thưởng');
  const query = useQuery({ queryKey: ['account', 'points-summary'], queryFn: getPointsSummary, refetchOnMount: 'always' });

  if (query.isLoading) {
    return (
      <div>
        <Skeleton className="h-9 w-52" />
        <Skeleton className="mt-4 h-44 w-full rounded-card" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-56 w-full rounded-card" />)}
        </div>
        <Skeleton className="mt-4 h-64 w-full rounded-card" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Không tải được điểm thưởng"
        message={query.isError ? errorMessage(query.error) : 'Dữ liệu điểm thưởng chưa sẵn sàng.'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const summary = query.data;
  const remainingToNext = summary.nextTier ? Math.max(0, summary.nextTier.minSpend - summary.twelveMonthSpend) : 0;

  return (
    <div>
      <PageHeader
        title="Điểm thưởng"
        description="Tích điểm từ mỗi đơn vé, đổi quà bắp nước và tận hưởng đặc quyền theo hạng thành viên."
      />

      <section className="relative overflow-hidden rounded-card border border-brand/30 bg-gradient-to-br from-brand/20 via-surface to-surface p-5 shadow-card sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-brand/20 blur-3xl" aria-hidden />

        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Ví điểm PXU</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-money font-display text-5xl font-extrabold leading-none text-ink sm:text-6xl">
                {summary.points.toLocaleString('vi-VN')}
              </span>
              <span className="pb-1 text-sm font-semibold uppercase tracking-wide text-muted">điểm khả dụng</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TierBadge tier={summary.tier.key} label={`Hạng ${summary.tier.label}`} />
              <Badge tone="gold">Chi tiêu 12 tháng {money(summary.twelveMonthSpend)}</Badge>
            </div>
            <div className="mt-5 max-w-xl">
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
                <span className="font-semibold text-ink2">
                  {summary.nextTier ? `Tiến trình đến ${summary.nextTier.label}` : 'Bạn đã ở hạng cao nhất'}
                </span>
                <span>{summary.progress}%</span>
              </div>
              <Progress value={summary.progress} tone="gold" className="mt-1.5" />
              <p className="mt-2 text-xs text-muted">
                {summary.nextTier
                  ? `Còn ${money(remainingToNext)} chi tiêu để nâng hạng ${summary.nextTier.label}.`
                  : 'Tiếp tục tích điểm để duy trì đặc quyền Diamond.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-line/70 bg-base/50 p-4 sm:flex-col sm:gap-2 sm:p-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-gold">
              <Crown className="h-7 w-7" />
            </span>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Hạng hiện tại</p>
              <p className="font-display text-lg font-bold uppercase tracking-wide text-ink">{summary.tier.label}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Các hạng thành viên</h2>
          <span className="text-[11px] text-muted">Xét theo chi tiêu 12 tháng gần nhất</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.tiers.map((tier) => {
            const current = tier.key === summary.tier.key;
            const reached = summary.twelveMonthSpend >= tier.minSpend;
            return (
              <Card
                key={tier.key}
                className={cn(
                  'relative flex flex-col p-4 transition',
                  current && 'border-brand/60 bg-brand/[0.06] ring-1 ring-brand/30',
                )}
              >
                {current && (
                  <span className="absolute right-3 top-3 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand">
                    Hiện tại
                  </span>
                )}
                <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${tier.color}22`, color: tier.color }}>
                  <Gift className="h-4 w-4" />
                </span>
                <h3 className="mt-2 font-display text-base font-bold uppercase tracking-wide text-ink">{tier.label}</h3>
                <p className="text-[11px] text-muted">
                  {tier.minSpend === 0 ? 'Thành viên mới' : `Từ ${money(tier.minSpend)}`}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[11px] leading-snug text-ink2">
                      <Check className={cn('mt-0.5 h-3 w-3 shrink-0', reached ? 'text-success' : 'text-muted')} strokeWidth={3} />
                      {perk}
                    </li>
                  ))}
                </ul>
                {!reached && (
                  <p className="mt-3 border-t border-line/60 pt-2 text-[10px] text-muted">
                    Cần thêm {money(tier.minSpend - summary.twelveMonthSpend)}
                  </p>
                )}
                {reached && !current && (
                  <p className="mt-3 border-t border-line/60 pt-2 text-[10px] font-semibold text-success">Đã đạt hạng này</p>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand" />
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Lịch sử điểm</h2>
          <Badge tone="neutral">{summary.transactions.length} giao dịch</Badge>
        </div>

        {summary.transactions.length === 0 ? (
          <EmptyState
            icon={<Gift className="h-6 w-6" />}
            title="Chưa có giao dịch điểm"
            description="Điểm sẽ được cộng tự động sau khi đơn vé của bạn được xác nhận thanh toán."
          />
        ) : (
          <Card className="divide-y divide-line/60 overflow-hidden">
            {summary.transactions.map((transaction) => {
              const tone = transactionTone(transaction.type, transaction.points);
              const positive = transaction.points >= 0;
              return (
                <div key={transaction.id} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-elevated/30">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line/70 bg-base/60', tone.className)}>
                    {tone.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{transaction.reason}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                      <span>{TYPE_LABEL[transaction.type]}</span>
                      <span aria-hidden>·</span>
                      <span>{relativeTime(transaction.at)}</span>
                      {transaction.bookingCode && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-mono text-ink2">{transaction.bookingCode}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className={cn('text-money shrink-0 text-sm font-bold', positive ? 'text-success' : 'text-danger')}>
                    {positive ? '+' : '−'}{Math.abs(transaction.points).toLocaleString('vi-VN')}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
