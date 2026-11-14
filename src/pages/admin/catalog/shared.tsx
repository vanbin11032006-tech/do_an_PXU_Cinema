import type { ReactNode } from 'react';
import { cn } from '@/lib/format';
import { Card, Skeleton } from '@/components/ui';
import type { AgeRating, Combo, MovieStatus, PriceRule, RoomType, SeatType } from '@/types/domain';

export const ROOM_TYPES: RoomType[] = ['2D', '3D', 'IMAX', '4DX', 'Gold Class'];

export const ROOM_TYPE_OPTIONS = ROOM_TYPES.map((value) => ({ value, label: value }));

export const AGE_OPTIONS: AgeRating[] = ['P', 'K', 'T13', 'T16', 'T18'];

export const MOVIE_STATUS_OPTIONS: { value: MovieStatus; label: string; hint: string }[] = [
  { value: 'now_showing', label: 'Đang chiếu', hint: 'Hiển thị trên trang chủ và cho phép đặt vé.' },
  { value: 'coming_soon', label: 'Sắp chiếu', hint: 'Hiển thị trong danh sách sắp chiếu, chưa mở bán.' },
  { value: 'ended', label: 'Đã kết thúc', hint: 'Ẩn khỏi lịch chiếu, chỉ giữ lại lịch sử.' },
];

export const MOVIE_STATUS_LABELS: Record<MovieStatus, string> = {
  now_showing: 'Đang chiếu',
  coming_soon: 'Sắp chiếu',
  ended: 'Đã kết thúc',
};

export const COMBO_CATEGORY_LABELS: Record<Combo['category'], string> = {
  combo: 'Combo',
  popcorn: 'Bắp',
  drink: 'Nước',
  snack: 'Snack',
};

export const SEAT_TYPE_LABELS: Record<SeatType, string> = {
  standard: 'Ghế thường',
  vip: 'Ghế VIP',
  couple: 'Ghế đôi',
  disabled: 'Không bán',
  aisle: 'Lối đi',
  blank: 'Ô trống',
};

export const SLOT_LABELS: Record<PriceRule['slot'], string> = {
  early: 'Sáng sớm (trước 11:00)',
  day: 'Ban ngày (11:00–17:00)',
  prime: 'Giờ vàng (17:00–23:00)',
  late: 'Khuya (sau 23:00)',
};

export const DAY_TYPE_LABELS: Record<'weekday' | 'weekend', string> = {
  weekday: 'Ngày thường',
  weekend: 'Cuối tuần',
};

export const PRICE_SLOTS: PriceRule['slot'][] = ['early', 'day', 'prime', 'late'];

export const LOW_STOCK_THRESHOLD = 20;

export function StatTile({ label, value, hint, icon, tone = 'brand', className }: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'info' | 'muted'; className?: string;
}) {
  const toneClass = {
    brand: 'text-brand bg-brand/10 border-brand/25',
    success: 'text-success bg-success/10 border-success/25',
    warning: 'text-warning bg-warning/10 border-warning/25',
    info: 'text-info bg-info/10 border-info/25',
    muted: 'text-ink2 bg-elevated border-line',
  }[tone];
  return (
    <Card className={cn('flex items-center gap-3.5 p-4', className)}>
      {icon && <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClass)}>{icon}</span>}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-0.5 truncate font-display text-xl font-bold text-ink">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted">{hint}</p>}
      </div>
    </Card>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-busy>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-64 w-full" />)}
    </div>
  );
}

export function FormSection({ title, description, children, className }: {
  title: string; description?: string; children: ReactNode; className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 border-b border-line/60 pb-3">
        <h2 className="font-display text-base font-semibold uppercase tracking-wide text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}
