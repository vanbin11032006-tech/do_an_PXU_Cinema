import { Clock, Film } from 'lucide-react';
import type { Cinema, Room, ShowtimeStatus } from '@/types/domain';
import type { ShowtimePublic } from '@/api';
import { cinemaNow, dateISO, timeToMinutes } from '@/lib/datetime';
import { cn } from '@/lib/format';

const START = 6 * 60;
const END = 24 * 60;
const SPAN = END - START;

const STATUS_LABELS: Record<ShowtimeStatus, string> = {
  scheduled: 'Đã lên lịch',
  selling: 'Đang bán',
  closed: 'Đóng bán',
  finished: 'Đã chiếu',
  cancelled: 'Đã hủy',
};

const STATUS_RING: Record<ShowtimeStatus, string> = {
  scheduled: 'ring-info/60',
  selling: 'ring-success/60',
  closed: 'ring-slate-400/40',
  finished: 'ring-slate-500/30',
  cancelled: 'ring-danger/70',
};

export function ShowtimeTimeline({ showtimes, rooms, cinemas, date, onSelect }: {
  showtimes: ShowtimePublic[]; rooms: Room[]; cinemas: Cinema[]; date: string;
  onSelect: (showtime: ShowtimePublic) => void;
}) {
  const cinemaById = cinemas.reduce<Record<number, Cinema>>((acc, cinema) => { acc[cinema.id] = cinema; return acc; }, {});
  const byRoom = showtimes.reduce<Record<number, ShowtimePublic[]>>((acc, showtime) => {
    (acc[showtime.roomId] ??= []).push(showtime);
    return acc;
  }, {});
  const visibleRooms = rooms.length ? rooms : Array.from(new Map(showtimes.map((showtime) => [showtime.roomId, showtime.room])).values());
  const now = cinemaNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = date === dateISO(now) && nowMinutes >= START && nowMinutes <= END;
  const ticks = Array.from({ length: 10 }, (_, index) => START + index * 120);

  return (
    <div className="rounded-card border border-line bg-surface/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-ink2">
          <Clock className="h-3.5 w-3.5 text-brand" />
          <span className="font-semibold">Dòng thời gian 06:00 – 24:00</span>
          <span className="text-muted">· mỗi cột 30 phút</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {(['selling', 'closed', 'scheduled', 'cancelled'] as ShowtimeStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-[10px] text-muted">
              <span className={cn('h-2 w-2 rounded-full', status === 'selling' ? 'bg-success' : status === 'closed' ? 'bg-slate-400' : status === 'scheduled' ? 'bg-info' : 'bg-danger')} />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1040px]">
          <div className="flex border-b border-line/60">
            <div className="sticky left-0 z-20 w-44 shrink-0 border-r border-line/60 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              Phòng chiếu
            </div>
            <div className="relative h-8 min-w-[860px] flex-1">
              {ticks.map((minutes) => {
                const percent = ((minutes - START) / SPAN) * 100;
                return (
                  <span
                    key={minutes}
                    className="absolute top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted"
                    style={{ left: `${percent}%`, transform: percent === 0 ? 'translate(0, -50%)' : 'translate(-50%, -50%)' }}
                  >
                    {String(Math.floor(minutes / 60)).padStart(2, '0')}:00
                  </span>
                );
              })}
            </div>
          </div>

          {visibleRooms.map((room) => {
            const roomShowtimes = byRoom[room.id] ?? [];
            const cinema = cinemaById[room.cinemaId];
            return (
              <div key={room.id} className="flex border-b border-line/40 last:border-0">
                <div className="sticky left-0 z-20 flex w-44 shrink-0 flex-col justify-center border-r border-line/60 bg-surface px-3 py-2">
                  <p className="truncate text-xs font-semibold text-ink">{room.name}</p>
                  <p className="truncate text-[10px] text-muted">{cinema?.name ?? '—'} · {room.type}</p>
                  {room.status === 'maintenance' && <span className="mt-0.5 text-[10px] font-semibold text-warning">Đang bảo trì</span>}
                </div>
                <div
                  className="relative min-h-[64px] min-w-[860px] flex-1"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(to right, rgba(148,163,184,.09) 0 1px, transparent 1px 2.7778%)',
                  }}
                >
                  {roomShowtimes.length === 0 && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">Chưa có suất chiếu</span>
                  )}
                  {roomShowtimes.map((showtime) => {
                    const start = Math.max(START, timeToMinutes(showtime.startTime));
                    const end = Math.min(END, timeToMinutes(showtime.endTime));
                    return (
                    <button
                      key={showtime.id}
                      type="button"
                      onClick={() => onSelect(showtime)}
                      aria-label={`${showtime.movie.title}, ${showtime.startTime}–${showtime.endTime}, phòng ${room.name}, ${STATUS_LABELS[showtime.status]}`}
                      title={`${showtime.startTime}–${showtime.endTime} · ${showtime.movie.title} · ${STATUS_LABELS[showtime.status]}`}
                      className={cn(
                        'group absolute top-2.5 z-10 flex h-[46px] flex-col justify-center overflow-hidden rounded-md px-2 text-left shadow-card ring-1 transition hover:z-30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                        STATUS_RING[showtime.status],
                        showtime.status === 'cancelled' && 'opacity-55 grayscale',
                        showtime.status === 'finished' && 'opacity-45',
                      )}
                      style={{
                        left: `${((start - START) / SPAN) * 100}%`,
                        width: `${(Math.max(end - start, 10) / SPAN) * 100}%`,
                        background: `linear-gradient(120deg, ${showtime.movie.art.from} 0%, ${showtime.movie.art.via} 60%, ${showtime.movie.art.to} 100%)`,
                      }}
                    >
                      <span className="flex items-center gap-1 text-[10px] font-bold text-white/90">
                        {showtime.startTime}
                        <span className="text-white/50">–</span>
                        {showtime.endTime}
                      </span>
                      <span className="truncate text-[10px] font-medium text-white/75">{showtime.movie.title}</span>
                    </button>
                    );
                  })}
                  {showNow && (
                    <span
                      className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-brand"
                      style={{ left: `${((nowMinutes - START) / SPAN) * 100}%` }}
                      aria-hidden
                    >
                      <span className="absolute -left-[3px] top-0 h-1.5 w-1.5 rounded-full bg-brand" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {visibleRooms.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Film className="h-8 w-8 text-muted" />
              <p className="mt-2 text-sm text-muted">Chưa có phòng chiếu hoặc suất chiếu trong ngày này.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
