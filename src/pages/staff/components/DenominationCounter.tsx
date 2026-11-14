import { money } from '@/lib/format';
import { Input } from '@/components/ui';

const DENOMINATIONS = [500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000];

export function DenominationCounter({ counts, onChange }: {
  counts: Record<number, number>;
  onChange: (denomination: number, value: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DENOMINATIONS.map((denomination) => {
          const count = counts[denomination] ?? 0;
          return (
            <div key={denomination} className="flex items-center gap-2 rounded-lg border border-line/70 bg-base/40 px-2.5 py-2">
              <span className="w-20 shrink-0 text-money text-[11px] font-semibold text-ink2">{money(denomination)}</span>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={count === 0 ? '' : count}
                placeholder="0"
                onChange={(event) => onChange(denomination, Math.max(0, Math.floor(Number(event.target.value || 0))))}
                className="h-8 text-center"
                aria-label={`Số tờ mệnh giá ${money(denomination)}`}
              />
              <span className="w-20 shrink-0 text-right text-money text-[11px] text-muted">{money(count * denomination)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-right text-xs text-muted">
        Tổng tiền mặt kiểm đếm:{' '}
        <span className="text-money text-base font-bold text-ink">
          {money(DENOMINATIONS.reduce((sum, denomination) => sum + denomination * (counts[denomination] ?? 0), 0))}
        </span>
      </p>
    </div>
  );
}
