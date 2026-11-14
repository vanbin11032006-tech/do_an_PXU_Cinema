import { cinemaNow, dateISO } from '@/lib/datetime';
import { cn, formatDate, weekdayShort } from '@/lib/format';

/** Robust ISO date shift that does not depend on the machine timezone. */
export function shiftDateISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextDates(count = 14): string[] {
  const today = dateISO(cinemaNow());
  return Array.from({ length: count }, (_, index) => shiftDateISO(today, index));
}

export function DateStrip({ dates, value, onChange, className }: {
  dates: string[];
  value: string;
  onChange: (date: string) => void;
  className?: string;
}) {
  const today = dates[0];
  return (
    <div
      className={cn('flex gap-2 overflow-x-auto no-scrollbar', className)}
      role="group"
      aria-label="Chọn ngày chiếu"
    >
      {dates.map((date) => {
        const active = date === value;
        const [day, month] = formatDate(date).split('/');
        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(date)}
            className={cn(
              'flex min-w-[64px] shrink-0 flex-col items-center rounded-lg border px-2.5 py-2 transition duration-200 ease-cinema',
              active
                ? 'border-brand bg-brand text-white shadow-glow'
                : 'border-line/70 bg-surface/70 text-ink2 hover:border-brand/40 hover:bg-elevated hover:text-ink',
            )}
          >
            <span className={cn('text-[10px] font-bold uppercase tracking-[0.14em]', active ? 'text-white/80' : 'text-muted')}>
              {date === today ? 'Hôm nay' : weekdayShort(date)}
            </span>
            <span className="font-display text-lg font-bold leading-tight text-money">{day}/{month}</span>
          </button>
        );
      })}
    </div>
  );
}
