import { memo, useCallback, useRef, type KeyboardEvent } from 'react';
import { Check, Lock, X } from 'lucide-react';
import type { SeatLiveStatus, SeatType } from '@/types/domain';
import { cn, money } from '@/lib/format';

export interface SeatLike {
  id: number;
  code: string;
  row: string;
  col: number;
  x: number;
  y: number;
  span: number;
  type: SeatType;
  price?: number;
  status?: SeatLiveStatus;
  mine?: boolean;
}

const CELL_W = 33;
const CELL_H = 37;
const SEAT_H = 28;
const LABEL_W = 26;

const TYPE_LABEL: Record<SeatType, string> = {
  standard: 'Ghế thường', vip: 'Ghế VIP', couple: 'Ghế đôi', aisle: 'Lối đi', blank: 'Trống', disabled: 'Không bán',
};

function seatClasses(seat: SeatLike, selected: boolean): string {
  if (seat.status === 'disabled' || seat.type === 'disabled') return 'cursor-not-allowed border-slate-700/60 bg-slate-900/60 text-slate-600';
  if (seat.status === 'sold') return 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-600';
  if (seat.status === 'held' && !seat.mine) return 'cursor-not-allowed border-slate-600/60 bg-slate-700/40 text-slate-500';
  if (selected) return 'border-sky-100 bg-info text-slate-950 shadow-[0_0_16px_rgba(56,189,248,.55)]';
  if (seat.type === 'vip') return 'border-gold/70 bg-brand/85 text-white hover:bg-brand';
  if (seat.type === 'couple') return 'border-pink-200/70 bg-couple/85 text-white hover:bg-couple';
  return 'border-slate-500/80 bg-slate-600/80 text-slate-200 hover:border-sky-300/60 hover:bg-slate-500';
}

const SeatCell = memo(function SeatCell({ seat, selected, disabled, onToggle, tabIndex, onKeyDown }: {
  seat: SeatLike; selected: boolean; disabled: boolean; onToggle?: (seat: SeatLike) => void; tabIndex: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
}) {
  const isBlocked = seat.status === 'sold' || seat.status === 'held' || seat.status === 'disabled' || seat.type === 'disabled';
  const typeLabel = TYPE_LABEL[seat.type];
  const priceLabel = seat.price !== undefined ? ` · ${money(seat.price)}` : '';
  const statusLabel = selected ? 'đang chọn' : seat.status === 'sold' ? 'đã bán' : seat.status === 'held' ? 'đang được giữ' : seat.status === 'disabled' ? 'không khả dụng' : 'còn trống';
  return (
    <button
      type="button"
      data-seat
      data-x={seat.x}
      data-y={seat.y}
      tabIndex={isBlocked ? -1 : tabIndex}
      disabled={isBlocked || disabled}
      aria-pressed={selected}
      aria-label={`Ghế ${seat.code}, ${typeLabel}${priceLabel}, ${statusLabel}`}
      title={`Ghế ${seat.code} · ${typeLabel}${priceLabel}`}
      onClick={() => onToggle?.(seat)}
      onKeyDown={onKeyDown}
      className={cn(
        'seat-focusable absolute flex items-center justify-center rounded-md border text-[9px] font-bold transition-all duration-150',
        seat.span >= 2 ? 'rounded-lg' : '',
        seatClasses(seat, selected),
        seat.status === 'held' && !seat.mine && 'bg-[repeating-linear-gradient(45deg,rgba(148,163,184,.25)_0px,rgba(148,163,184,.25)_3px,transparent_3px,transparent_7px)]',
      )}
      style={{
        left: LABEL_W + seat.x * CELL_W + 2,
        top: 18 + seat.y * CELL_H + 5,
        width: seat.span * CELL_W - 4,
        height: SEAT_H,
      }}
    >
      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} />
        : seat.status === 'sold' ? <X className="h-3.5 w-3.5" />
          : seat.status === 'disabled' || seat.type === 'disabled' ? <span className="text-[10px]">—</span>
            : seat.status === 'held' && !seat.mine ? <Lock className="h-3 w-3" />
              : seat.span >= 2 ? <span className="text-[8px] tracking-tight">{seat.code.replace('-', '–')}</span> : null}
    </button>
  );
});

export function SeatMap({ seats, selectedIds = [], onToggle, readOnly, maxSeats, className, highlightIds = [] }: {
  seats: SeatLike[]; selectedIds?: number[]; onToggle?: (seat: SeatLike) => void; readOnly?: boolean;
  maxSeats?: number; className?: string; highlightIds?: number[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rows = Math.max(...seats.map((s) => s.y), 0) + 1;
  const cols = Math.max(...seats.map((s) => s.x + s.span), 0);
  const width = LABEL_W + cols * CELL_W;
  const height = rows * CELL_H + 18;
  const atLimit = maxSeats !== undefined && selectedIds.length >= maxSeats;
  const firstFocusId = seats.find((s) => s.status !== 'sold' && s.status !== 'disabled' && s.type !== 'disabled')?.id;
  const rowLabels = [...new Map(seats.map((s) => [s.y, s.row])).entries()].sort((a, b) => a[0] - b[0]);

  const handleKey = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-seat]'))
      .filter((b) => !b.disabled);
    const current = event.currentTarget;
    const index = buttons.indexOf(current);
    if (index < 0) return;
    const x = Number(current.dataset.x);
    const y = Number(current.dataset.y);
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowRight') next = buttons[index + 1];
    else if (event.key === 'ArrowLeft') next = buttons[index - 1];
    else {
      const targetY = event.key === 'ArrowUp' ? y - 1 : y + 1;
      next = buttons
        .filter((b) => Number(b.dataset.y) === targetY)
        .sort((a, b) => Math.abs(Number(a.dataset.x) - x) - Math.abs(Number(b.dataset.x) - x))[0];
    }
    next?.focus();
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="overflow-x-auto pb-2">
        <div className="relative mx-auto" style={{ width, minWidth: width }}>
          {rowLabels.map(([y, label]) => (
            <span
              key={y}
              className="absolute flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-muted"
              style={{ left: 0, top: 18 + y * CELL_H + 5, width: LABEL_W - 6, height: SEAT_H }}
              aria-hidden
            >
              {label}
            </span>
          ))}
          {seats.filter((seat) => seat.y === 0 && seat.type !== 'aisle' && seat.type !== 'blank').map((seat) => (
            <span
              key={`col-${seat.id}`}
              className="absolute text-center text-[8px] font-semibold tabular-nums text-muted/60"
              style={{ left: LABEL_W + seat.x * CELL_W, top: 0, width: seat.span * CELL_W }}
              aria-hidden
            >
              {seat.col}
            </span>
          ))}
          <div className="relative" style={{ width, height }}>
            {seats.map((seat) => (
              <SeatCell
                key={seat.id}
                seat={seat}
                selected={selectedIds.includes(seat.id)}
                disabled={readOnly || (atLimit && !selectedIds.includes(seat.id)) || Boolean(seat.type === 'disabled')}
                onToggle={onToggle}
                onKeyDown={handleKey}
                tabIndex={seat.id === firstFocusId || selectedIds.includes(seat.id) ? 0 : -1}
              />
            ))}
            {highlightIds.map((id) => {
              const seat = seats.find((s) => s.id === id);
              if (!seat) return null;
              return (
                <span
                  key={`hl-${id}`}
                  className="pointer-events-none absolute animate-pulse rounded-md ring-2 ring-danger"
                  style={{ left: LABEL_W + seat.x * CELL_W, top: 18 + seat.y * CELL_H + 3, width: seat.span * CELL_W, height: SEAT_H + 4 }}
                  aria-hidden
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScreenBar({ label = 'MÀN HÌNH' }: { label?: string }) {
  return (
    <div className="mb-6 flex flex-col items-center" aria-hidden>
      <div className="relative h-8 w-[82%] max-w-lg overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-16 rounded-[50%] border-t-2 border-brand/70 bg-gradient-to-b from-brand/25 to-transparent" />
        <div className="absolute inset-x-8 top-1 h-10 rounded-[50%] bg-brand/10 blur-xl" />
      </div>
      <span className="mt-1 font-display text-[10px] font-bold uppercase tracking-[0.5em] text-brand/80">{label}</span>
    </div>
  );
}

export function SeatLegend({ className }: { className?: string }) {
  const items = [
    { label: 'Thường', cls: 'border-slate-500/80 bg-slate-600/80' },
    { label: 'VIP', cls: 'border-gold/70 bg-brand/85' },
    { label: 'Đôi', cls: 'border-pink-200/70 bg-couple/85' },
    { label: 'Đang chọn', cls: 'border-sky-100 bg-info' },
    { label: 'Đã bán', cls: 'border-slate-700 bg-slate-800' },
    { label: 'Đang giữ', cls: 'border-slate-600/60 bg-slate-700/40' },
    { label: 'Không khả dụng', cls: 'border-slate-700/60 bg-slate-900/60' },
  ];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className={cn('h-3.5 w-3.5 rounded-sm border', item.cls)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
