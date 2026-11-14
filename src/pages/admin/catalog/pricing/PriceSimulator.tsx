import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Sparkles } from 'lucide-react';
import type { Cinema, Room, SeatType } from '@/types/domain';
import { simulatePrice } from '@/api';
import { errorMessage } from '@/lib/errors';
import { cinemaNow, dateISO } from '@/lib/datetime';
import { money } from '@/lib/format';
import { Badge, Card, ErrorState, Field, Input, Select, Skeleton } from '@/components/ui';
import { SEAT_TYPE_LABELS, SLOT_LABELS } from '../shared';

const SEAT_OPTIONS: SeatType[] = ['standard', 'vip', 'couple'];

export function PriceSimulator({ rooms, cinemas }: { rooms: Room[]; cinemas: Cinema[] }) {
  const [date, setDate] = useState(dateISO(cinemaNow()));
  const [time, setTime] = useState('19:00');
  const [roomId, setRoomId] = useState('');
  const [seatType, setSeatType] = useState<SeatType>('standard');

  useEffect(() => {
    if (roomId || !rooms.length) return;
    const active = rooms.find((room) => room.status === 'active') ?? rooms[0];
    setRoomId(String(active.id));
  }, [rooms, roomId]);

  const query = useQuery({
    queryKey: ['admin', 'price-simulation', date, time, roomId, seatType],
    queryFn: () => simulatePrice({ showDate: date, startTime: time, roomId: Number(roomId), seatType }),
    enabled: Boolean(date && time && roomId),
    retry: false,
  });

  const cinemaById = cinemas.reduce<Record<number, string>>((acc, cinema) => { acc[cinema.id] = cinema.name; return acc; }, {});
  const room = rooms.find((item) => String(item.id) === roomId);
  const result = query.data;
  const surcharge = result ? Math.max(0, result.seatPrice - result.basePrice) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line/70 bg-gradient-to-br from-brand/10 to-transparent p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand"><Calculator className="h-4 w-4" /></span>
          <div>
            <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Mô phỏng giá vé</p>
            <p className="text-[11px] text-muted">Kiểm tra giá cuối cùng theo phòng, thời điểm và loại ghế.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <Field label="Ngày chiếu" htmlFor="sim-date">
          <Input id="sim-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giờ bắt đầu" htmlFor="sim-time">
            <Input id="sim-time" type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} />
          </Field>
          <Field label="Loại ghế" htmlFor="sim-seat">
            <Select id="sim-seat" value={seatType} onChange={(event) => setSeatType(event.target.value as SeatType)}>
              {SEAT_OPTIONS.map((option) => <option key={option} value={option}>{SEAT_TYPE_LABELS[option]}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Phòng chiếu" htmlFor="sim-room" hint={room ? `${cinemaById[room.cinemaId] ?? 'Rạp'} · ${room.type}` : undefined}>
          <Select id="sim-room" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((item) => (
              <option key={item.id} value={item.id}>
                {cinemaById[item.cinemaId] ? `${cinemaById[item.cinemaId]} · ` : ''}{item.name} ({item.type})
              </option>
            ))}
          </Select>
        </Field>

        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} className="py-5" />
        ) : result ? (
          <div className="rounded-xl border border-brand/25 bg-brand/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand"><Sparkles className="h-3 w-3" />Kết quả</span>
              <Badge tone="brand">{result.slot === 'early' ? 'Sáng sớm' : result.slot === 'day' ? 'Ban ngày' : result.slot === 'prime' ? 'Giờ vàng' : 'Khuya'}</Badge>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-ink2"><span>Giá cơ bản theo phòng</span><span className="text-money">{money(result.basePrice)}</span></div>
              <div className="flex justify-between text-ink2"><span>Phụ thu loại ghế ({SEAT_TYPE_LABELS[seatType]})</span><span className="text-money">+{money(surcharge)}</span></div>
              <div className="flex justify-between text-muted"><span>Phụ thu loại phòng ({room?.type ?? '—'})</span><span className="text-money">{money(result.roomSurcharge)}</span></div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2 border-t border-brand/20 pt-3">
              <span className="text-sm font-semibold text-ink">Giá ghế cuối</span>
              <span className="font-display text-2xl font-bold text-brand">{money(result.seatPrice)}</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Giá cơ bản đã gồm phụ thu loại phòng; dòng phụ thu loại phòng chỉ hiển thị để đối chiếu cấu hình.
            </p>
          </div>
        ) : null}

        {!rooms.length && <p className="text-xs text-warning">Chưa có phòng chiếu để mô phỏng.</p>}
        <p className="text-[10px] leading-relaxed text-muted">Khung giờ áp dụng: {SLOT_LABELS.early}, {SLOT_LABELS.day}, {SLOT_LABELS.prime}, {SLOT_LABELS.late}.</p>
        <p className="text-[10px] leading-relaxed text-warning">Mô phỏng dùng bảng giá đã lưu trên hệ thống. Hãy lưu thay đổi trước khi kiểm tra giá mới.</p>
      </div>
    </Card>
  );
}
