import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { listMovies, listShowtimes } from '@/api';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, money, weekdayShort } from '@/lib/format';
import { Button, ErrorState, Field, Select, Skeleton } from '@/components/ui';
import { nextDates } from './DateStrip';
import { AuthPromptModal } from './AuthPromptModal';

export function QuickBooking({ className }: { className?: string }) {
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const dates = nextDates(14);

  const [movieId, setMovieId] = useState('');
  const [cinemaId, setCinemaId] = useState('');
  const [date, setDate] = useState('');
  const [showtimeId, setShowtimeId] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  const moviesQuery = useQuery({
    queryKey: ['public', 'quick-booking', 'movies'],
    queryFn: () => listMovies({ status: 'now_showing', perPage: 100, sort: 'newest' }),
  });

  const showtimesQuery = useQuery({
    queryKey: ['public', 'quick-booking', 'showtimes', movieId],
    queryFn: () => listShowtimes({ movieId: Number(movieId) }),
    enabled: Boolean(movieId),
  });

  const movies = moviesQuery.data?.items ?? [];
  const showtimes = (showtimesQuery.data ?? []).filter((showtime) => dates.includes(showtime.showDate));

  const cinemaMap = new Map<number, string>();
  for (const showtime of showtimes) cinemaMap.set(showtime.cinemaId, showtime.cinema.name);
  const cinemas = Array.from(cinemaMap, ([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const availableDates = new Set(
    showtimes
      .filter((showtime) => (!cinemaId || String(showtime.cinemaId) === cinemaId) && showtime.saleState === 'selling' && showtime.availableSeats > 0)
      .map((showtime) => showtime.showDate),
  );
  const times = showtimes.filter((showtime) => (
    (!cinemaId || String(showtime.cinemaId) === cinemaId) && (!date || showtime.showDate === date)
  ));
  const selected = showtimes.find((showtime) => String(showtime.id) === showtimeId);
  const canSubmit = Boolean(selected && selected.saleState === 'selling' && selected.availableSeats > 0);
  const bookingPath = selected ? `/dat-ve/${selected.id}/ghe` : '/phim';

  const resetAfterMovie = (value: string) => {
    setMovieId(value);
    setCinemaId('');
    setDate('');
    setShowtimeId('');
  };

  const chooseCinema = (value: string) => {
    setCinemaId(value);
    setShowtimeId('');
    const firstAvailable = dates.find((candidate) => showtimes.some((showtime) => (
      String(showtime.cinemaId) === value && showtime.showDate === candidate && showtime.saleState === 'selling' && showtime.availableSeats > 0
    )));
    setDate(firstAvailable ?? '');
  };

  const submit = () => {
    if (!canSubmit) return;
    if (authStatus === 'authenticated') {
      navigate(bookingPath);
      return;
    }
    setAuthOpen(true);
  };

  return (
    <>
      <form
        className={cn('card-surface overflow-hidden', className)}
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-gradient-to-r from-brand/10 via-transparent to-transparent px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand"><Ticket className="h-4 w-4" /></span>
            <div>
              <h2 className="font-display text-lg font-semibold uppercase leading-none tracking-wide text-ink">Đặt vé nhanh</h2>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">Chọn phim · rạp · ngày · suất</p>
            </div>
          </div>
          <p className="hidden text-[11px] text-muted sm:block">Giữ ghế an toàn trong vài bước</p>
        </div>

        <div className="p-4 sm:p-5">
          {moviesQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : moviesQuery.isError ? (
            <ErrorState
              title="Không tải được danh sách phim"
              message={errorMessage(moviesQuery.error)}
              onRetry={() => void moviesQuery.refetch()}
              className="py-6"
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Phim" htmlFor="quick-movie">
                  <Select
                    id="quick-movie"
                    value={movieId}
                    onChange={(event) => resetAfterMovie(event.target.value)}
                  >
                    <option value="">Chọn phim</option>
                    {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
                  </Select>
                </Field>

                <Field label="Rạp" htmlFor="quick-cinema">
                  <Select
                    id="quick-cinema"
                    value={cinemaId}
                    disabled={!movieId || showtimesQuery.isLoading || cinemas.length === 0}
                    onChange={(event) => chooseCinema(event.target.value)}
                  >
                    <option value="">{showtimesQuery.isLoading ? 'Đang tải rạp…' : 'Chọn rạp'}</option>
                    {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
                  </Select>
                </Field>

                <Field label="Ngày (14 ngày tới)" htmlFor="quick-date">
                  <Select
                    id="quick-date"
                    value={date}
                    disabled={!cinemaId}
                    onChange={(event) => { setDate(event.target.value); setShowtimeId(''); }}
                  >
                    <option value="">Chọn ngày</option>
                    {dates.map((candidate, index) => (
                      <option key={candidate} value={candidate} disabled={!availableDates.has(candidate)}>
                        {index === 0 ? 'Hôm nay · ' : `${weekdayShort(candidate)} · `}{formatDate(candidate)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Suất chiếu" htmlFor="quick-showtime">
                  <Select
                    id="quick-showtime"
                    value={showtimeId}
                    disabled={!date || times.length === 0}
                    onChange={(event) => setShowtimeId(event.target.value)}
                  >
                    <option value="">{times.length ? 'Chọn suất' : 'Chưa có suất'}</option>
                    {times.map((showtime) => {
                      const unavailable = showtime.saleState !== 'selling' || showtime.availableSeats <= 0;
                      const suffix = showtime.saleState !== 'selling' ? ' · Đã đóng' : showtime.availableSeats <= 0 ? ' · Hết ghế' : '';
                      return (
                        <option key={showtime.id} value={showtime.id} disabled={unavailable}>
                          {showtime.startTime} · {showtime.format} · {showtime.room.name} · {money(showtime.minPrice)}{suffix}
                        </option>
                      );
                    })}
                  </Select>
                </Field>
              </div>

              {showtimesQuery.isError && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  <span>Không tải được suất chiếu cho phim này.</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void showtimesQuery.refetch()}>Thử lại</Button>
                </div>
              )}

              {movieId && showtimesQuery.isSuccess && showtimes.length === 0 && (
                <p className="mt-3 rounded-lg border border-line/60 bg-base/40 px-3 py-2 text-xs text-muted">
                  Phim này chưa có suất chiếu trong 14 ngày tới. Vui lòng chọn phim khác.
                </p>
              )}

              {cinemaId && showtimesQuery.isSuccess && showtimes.length > 0 && availableDates.size === 0 && (
                <p className="mt-3 rounded-lg border border-line/60 bg-base/40 px-3 py-2 text-xs text-muted">
                  Rạp đã chọn chưa có suất khả dụng trong 14 ngày tới. Vui lòng chọn rạp khác.
                </p>
              )}

              {selected && (
                <p className="mt-3 text-xs text-muted">
                  {formatDate(selected.showDate)} · {selected.startTime} · {selected.cinema.name} · {selected.room.name}
                </p>
              )}

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-relaxed text-muted">
                  Ghế được giữ tạm trong thời gian thanh toán. Bạn có thể chọn combo bắp nước ở bước tiếp theo.
                </p>
                <Button type="submit" size="lg" disabled={!canSubmit} className="w-full sm:w-auto">
                  Đặt vé
                </Button>
              </div>
            </>
          )}
        </div>
      </form>

      <AuthPromptModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        returnTo={bookingPath}
        title="Đăng nhập để đặt vé"
        description="Đăng nhập tài khoản PXU Cinema để giữ ghế, thanh toán và nhận vé QR điện tử."
      />
    </>
  );
}
