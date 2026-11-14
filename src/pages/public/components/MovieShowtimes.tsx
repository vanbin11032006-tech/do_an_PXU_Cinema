import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { listShowtimes, type ShowtimePublic } from '@/api';
import { formatDate, weekdayShort } from '@/lib/format';
import type { Movie } from '@/types/domain';
import { Badge, Button, EmptyState, Field, Select } from '@/components/ui';
import { DateStrip, nextDates } from './DateStrip';
import { ShowtimeButton } from './ShowtimeButton';
import { RowsSkeleton, SectionError } from './States';
import { ActionLink } from './ActionLink';

export function MovieShowtimes({ movie }: { movie: Movie }) {
  const dates = nextDates(14);
  const [date, setDate] = useState(dates[0]);
  const [cinemaId, setCinemaId] = useState('');

  const showtimesQuery = useQuery({
    queryKey: ['public', 'movie-showtimes', movie.id, date],
    queryFn: () => listShowtimes({ movieId: movie.id, date }),
  });

  const showtimes = showtimesQuery.data ?? [];
  const cinemaMap = new Map<number, string>();
  for (const showtime of showtimes) cinemaMap.set(showtime.cinemaId, showtime.cinema.name);
  const cinemas = Array.from(cinemaMap, ([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  useEffect(() => {
    if (!cinemaId || !showtimesQuery.data) return;
    if (!showtimesQuery.data.some((showtime) => String(showtime.cinemaId) === cinemaId)) setCinemaId('');
  }, [cinemaId, showtimesQuery.data]);

  const visible = showtimes.filter((showtime) => !cinemaId || String(showtime.cinemaId) === cinemaId);
  const formats = new Map<string, ShowtimePublic[]>();
  for (const showtime of visible) {
    const rows = formats.get(showtime.format) ?? [];
    rows.push(showtime);
    formats.set(showtime.format, rows);
  }
  const formatRows = Array.from(formats.entries()).sort(([a], [b]) => a.localeCompare(b, 'vi'));
  const showCinema = !cinemaId && cinemas.length > 1;
  const isToday = date === dates[0];

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 -mx-4 border-y border-line/60 bg-base/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <DateStrip dates={dates} value={date} onChange={setDate} />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <CalendarDays className="h-3.5 w-3.5 text-brand" />
            <span className="font-semibold text-ink2">{isToday ? 'Hôm nay' : weekdayShort(date)} · {formatDate(date)}</span>
            <span aria-hidden>·</span>
            <span>{visible.length} suất chiếu</span>
          </div>
          <Field label="Rạp" htmlFor="detail-cinema" className="sm:w-64">
            <Select
              id="detail-cinema"
              value={cinemaId}
              disabled={cinemas.length === 0}
              onChange={(event) => setCinemaId(event.target.value)}
            >
              <option value="">{cinemas.length ? 'Tất cả rạp' : 'Chưa có rạp'}</option>
              {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {showtimesQuery.isLoading ? (
        <RowsSkeleton count={4} />
      ) : showtimesQuery.isError ? (
        <SectionError error={showtimesQuery.error} onRetry={() => void showtimesQuery.refetch()} title="Không tải được lịch chiếu" />
      ) : formatRows.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="Chưa có suất chiếu trong ngày này"
          description="Chọn ngày khác trong 14 ngày tới hoặc xem toàn bộ lịch chiếu tại các cụm rạp PXU."
          action={cinemaId
            ? <Button variant="outline" onClick={() => setCinemaId('')}>Xem tất cả rạp</Button>
            : <ActionLink to="/lich-chieu" variant="outline">Xem lịch chiếu đầy đủ</ActionLink>}
        />
      ) : (
        formatRows.map(([format, rows]) => (
          <section key={format} className="rounded-card border border-line/60 bg-surface/40 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="brand">{format}</Badge>
                <span className="text-[11px] text-muted">{rows.length} suất · {movie.language}</span>
              </div>
              <span className="text-[11px] text-muted">Chọn suất để chọn ghế</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {rows.map((showtime) => (
                <ShowtimeButton key={showtime.id} showtime={showtime} movie={movie} showCinema={showCinema} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
