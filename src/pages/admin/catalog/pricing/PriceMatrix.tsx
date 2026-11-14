import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import type { PriceRule, RoomType } from '@/types/domain';
import { cn, money } from '@/lib/format';
import { Badge, Card, Input } from '@/components/ui';
import { DAY_TYPE_LABELS, PRICE_SLOTS, ROOM_TYPES, SLOT_LABELS } from '../shared';

export function PriceMatrix({ rules, onChange, roomType, onRoomTypeChange }: {
  rules: PriceRule[];
  onChange: (rules: PriceRule[]) => void;
  roomType: RoomType;
  onRoomTypeChange: (type: RoomType) => void;
}) {
  const [rawPrices, setRawPrices] = useState<Record<string, string>>({});

  useEffect(() => { setRawPrices({}); }, [roomType]);

  useEffect(() => {
    setRawPrices((current) => {
      let changed = false;
      const next = { ...current };
      for (const key of Object.keys(current)) {
        const [dayType, slot] = key.split('-') as ['weekday' | 'weekend', PriceRule['slot']];
        const rule = rules.find((item) => item.dayType === dayType && item.slot === slot && item.roomType === roomType);
        const numeric = Number(current[key]);
        if (!rule || rule.price !== (current[key].trim() === '' ? 0 : numeric)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [rules, roomType]);

  const setRule = (dayType: 'weekday' | 'weekend', slot: PriceRule['slot'], patch: Partial<PriceRule>) => {
    const existing = rules.find((rule) => rule.dayType === dayType && rule.slot === slot && rule.roomType === roomType);
    if (existing) {
      onChange(rules.map((rule) => (rule === existing ? { ...rule, ...patch } : rule)));
      return;
    }
    onChange([...rules, {
      id: 0,
      dayType,
      slot,
      roomType,
      price: patch.price ?? 0,
      active: patch.active ?? true,
    }]);
  };

  const isBase = roomType === '2D';

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 p-4">
        <div>
          <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Ma trận giá vé</p>
          <p className="mt-0.5 text-xs text-muted">Ngày thường / cuối tuần × 4 khung giờ. Giá đã bao gồm phụ thu loại phòng khi tính vé.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={roomType === type}
              onClick={() => onRoomTypeChange(type)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition',
                roomType === type ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-surface/60 text-ink2 hover:border-brand/40',
              )}
            >
              {roomType === type && <Check className="h-3 w-3" />}
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] p-4">
          <div className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))] gap-2">
            <div />
            {PRICE_SLOTS.map((slot) => (
              <div key={slot} className="rounded-lg border border-line/60 bg-base/40 px-2.5 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink2">{slot === 'early' ? 'Sáng sớm' : slot === 'day' ? 'Ban ngày' : slot === 'prime' ? 'Giờ vàng' : 'Khuya'}</p>
                <p className="text-[9px] text-muted">{SLOT_LABELS[slot].replace(/^[^(]+/, '').trim() || SLOT_LABELS[slot]}</p>
              </div>
            ))}

            {(['weekday', 'weekend'] as const).map((dayType) => (
              <div key={dayType} className="contents">
                <div className="flex items-center rounded-lg border border-line/60 bg-surface/70 px-2.5 py-2">
                  <p className="text-xs font-semibold text-ink">{DAY_TYPE_LABELS[dayType]}</p>
                </div>
                {PRICE_SLOTS.map((slot) => {
                  const rule = rules.find((item) => item.dayType === dayType && item.slot === slot && item.roomType === roomType);
                  const cellKey = `${dayType}-${slot}`;
                  const rawValue = rawPrices[cellKey];
                  return (
                    <div key={`${dayType}-${slot}`} className={cn('rounded-lg border p-2', rule ? 'border-line bg-base/40' : 'border-dashed border-line/70 bg-transparent')}>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          inputMode="numeric"
                          aria-label={`Giá ${DAY_TYPE_LABELS[dayType]} ${SLOT_LABELS[slot]} phòng ${roomType}`}
                          value={rawValue ?? (rule ? String(rule.price) : '')}
                          placeholder={isBase ? 'Nhập giá' : 'Kế thừa 2D'}
                          onChange={(event) => {
                            const value = event.target.value;
                            const numeric = Number(value);
                            setRawPrices((current) => ({ ...current, [cellKey]: value }));
                            setRule(dayType, slot, { price: value.trim() === '' || !Number.isFinite(numeric) ? 0 : numeric });
                          }}
                          className="h-9 min-w-0 text-right text-xs"
                        />
                        {rule && (
                          <button
                            type="button"
                            aria-label={rule.active ? 'Tắt khung giá' : 'Bật khung giá'}
                            aria-pressed={rule.active}
                            onClick={() => setRule(dayType, slot, { active: !rule.active })}
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition',
                              rule.active ? 'border-success/40 bg-success/10 text-success' : 'border-line bg-elevated text-muted',
                            )}
                          >
                            {rule.active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-right text-[10px] text-muted">
                        {rule ? (rule.active ? money(rule.price) : 'Tạm tắt') : isBase ? 'Chưa có giá' : 'Dùng giá 2D + phụ thu'}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 bg-base/30 px-4 py-3">
        <p className="text-[11px] text-muted">
          {isBase ? 'Đây là bảng giá gốc cho phòng 2D.' : `Phòng ${roomType} chưa có giá riêng sẽ dùng giá 2D cộng phụ thu loại phòng.`}
        </p>
        <Badge tone="outline">8 khung giá / loại phòng</Badge>
      </div>
    </Card>
  );
}
