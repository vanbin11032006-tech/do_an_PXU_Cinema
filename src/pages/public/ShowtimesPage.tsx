import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Film, Ticket } from 'lucide-react';
import { listCinemas, listShowtimes, type ShowtimePublic } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { formatDate, weekdayShort } from '@/lib/format';
import { AgeBadge, Badge, Button, EmptyState, Field, Rating, Select } from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';
import { PageHero } from './components/PageHero';
import { DateStrip, nextDates } from './components/DateStrip';
import { ShowtimeButton } from './components/ShowtimeButton';
import { RowsSkeleton, SectionError } from './components/States';

interface MovieShowtimeGroup {
  movie: ShowtimePublic['movie'];
  rows: ShowtimePublic[];
}

export default function ShowtimesPage() {
  useDocumentTitle('Lịch chiếu');
  const dates = nextDates(14);
  const [params, setParams] = useSearchParams();

  const dateParam = params.get('date');
  const date = dateParam && dates.includes(dateParam) ? dateParam : dates[0];
  const cinemaParam = params.get('cinemaId') ?? '';
  const formatParam = params.get('format') ?? '';

  const cinemasQuery = useQuery({ queryKey: ['public', 'cinemas'], queryFn: listCinemas });
  const showtimesQuery = useQuery({
    queryKey: ['public', 'showtimes-by-date', date],
    queryFn: () => listShowtimes({ date }),
  });

  const cinemas = cinemasQuery.data ?? [];
  const allShowtimes = showtimesQuery.data ?? [];
  const formats = Array.from(new Set(allShowtimes.map((showtime) => showtime.format))).sort((a, b) => a.localeCompare(b, 'vi'));

  const cinemaId = cinemas.some((cinema) => String(cinema.id) === cinemaParam) ? cinemaParam : '';
  const format = formats.includes(formatParam) ? formatParam : '';

  const filtered = allShowtimes.filter((showtime) => (
    (!cinemaId || String(showtime.cinemaId) === cinemaId) && (!format || showtime.format === format)
  ));

  const movieMap = new Map<number, MovieShowtimeGroup>();
  for (const showtime of filtered) {
    const existing = movieMap.get(showtime.movieId);
    if (existing) existing.rows.push(showtime);
    else movieMap.set(showtime.movieId, { movie: showtime.movie, rows: [showtime] });
  }
  const groups = Array.from(movieMap.values()).sort((a, b) => (
    (a.rows[0]?.startTime ?? '').localeCompare(b.rows[0]?.startTime ?? '')
  ));

  const updateParam = (key: string, value: string | null) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });
  const hasFilters = Boolean(cinemaId || format);
  const isToday = date === dates[0];

  return (
    <div>
      <PageHero
        eyebrow="Lịch chiếu 14 ngày"
        title="Chọn suất chiếu phù hợp"
        description="Toàn bộ suất chiếu tại các cụm rạp PXU Cinema trong 14 ngày tới, cập nhật liên tục theo thời gian thực."
        breadcrumb={<nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted"><Link to="/" className="hover:text-ink">Trang chủ</Link><span aria-hidden>›</span><span className="text-ink2">Lịch chiếu</span></nav>}
      />

      <div className="container-page py-8 sm:py-10">
        <div className="card-surface p-4 sm:p-5">
          <div className="sticky top-16 z-20 -mx-4 border-b border-line/60 bg-base/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
            <DateStrip dates={dates} value={date} onChange={(nextDate) => updateParam('date', nextDate === dates[0] ? null : nextDate)} />
          </div>

          <div className="mt-4 grid gap-3 border-t border-line/60 pt-4 sm:grid-cols-2 lg:grid-cols-[220px_200px_minmax(0,1fr)] lg:items-end">
            <Field label="Rạp" htmlFor="showtime-cinema">
              <Select
                id="showtime-cinema"
                value={cinemaId}
                disabled={cinemasQuery.isLoading || cinemas.length === 0}
                onChange={(event) => updateParam('cinemaId', event.target.value || null)}
              >
                <option value="">{cinemasQuery.isLoading ? 'Đang tải rạp…' : 'Tất cả rạp'}</option>
                {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
              </Select>
            </Field>

            <Field label="Định dạng" htmlFor="showtime-format">
              <Select
                id="showtime-format"
                value={format}
                disabled={formats.length === 0}
                onChange={(event) => updateParam('format', event.target.value || null)}
              >
                <option value="">{formats.length ? 'Tất cả định dạng' : 'Chưa có dữ liệu'}</option>
                {formats.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted lg:justify-end">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-brand" />
                <span className="font-semibold text-ink2">{isToday ? 'Hôm nay' : weekdayShort(date)} · {formatDate(date)}</span>
              </span>
              <span aria-hidden>·</span>
              <span>{filtered.length} suất chiếu</span>
              {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Xóa bộ lọc</Button>}
            </div>
          </div>
        </div>

        <div className="mt-6">
          {cinemasQuery.isError ? (
            <SectionError error={cinemasQuery.error} onRetry={() => void cinemasQuery.refetch()} title="Không tải được danh sách rạp" />
          ) : showtimesQuery.isLoading ? (
            <RowsSkeleton count={5} />
          ) : showtimesQuery.isError ? (
            <SectionError error={showtimesQuery.error} onRetry={() => void showtimesQuery.refetch()} title="Không tải được lịch chiếu" />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<Film className="h-6 w-6" />}
              title="Chưa có suất chiếu phù hợp"
              description="Thử chọn ngày khác, bỏ lọc rạp/định dạng hoặc xem toàn bộ lịch chiếu trong 14 ngày tới."
              action={<Button variant="outline" onClick={clearFilters}>Xóa bộ lọc</Button>}
            />
          ) : (
            <div className="space-y-4">
              {groups.map(({ movie, rows }) => {
                const formatMap = new Map<string, ShowtimePublic[]>();
                for (const showtime of rows) {
                  const bucket = formatMap.get(showtime.format) ?? [];
                  bucket.push(showtime);
                  formatMap.set(showtime.format, bucket);
                }
                const formatBuckets = Array.from(formatMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'vi'));

                return (
                  <article key={movie.id} className="overflow-hidden rounded-card border border-line/70 bg-surface/60 shadow-card">
                    <div className="flex gap-4 border-b border-line/60 p-4 sm:p-5">
                      <Link to={`/phim/${movie.slug}`} className="relative w-20 shrink-0 overflow-hidden rounded-md border border-line/60 sm:w-24" aria-label={`Xem chi tiết ${movie.title}`}>
                        <div className="aspect-[2/3]"><PosterArt movie={movie} variant="thumb" showTitle={false} /></div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/phim/${movie.slug}`} className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-ink transition hover:text-brand">
                            {movie.title}
                          </Link>
                          <AgeBadge age={movie.age} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                          <span>{movie.duration} phút</span>
                          <span aria-hidden>·</span>
                          <span className="line-clamp-1">{movie.genres.join(' · ')}</span>
                          <Rating value={movie.rating} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Link to={`/phim/${movie.slug}#lich-chieu`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
                            <Ticket className="h-3.5 w-3.5" /> Thông tin & lịch chiếu
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-line/50">
                      {formatBuckets.map(([itemFormat, buckets]) => (
                        <div key={itemFormat} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
                          <div className="flex items-center gap-2 sm:w-32 sm:shrink-0">
                            <Badge tone="brand">{itemFormat}</Badge>
                            <span className="text-[10px] text-muted">{buckets.length} suất</span>
                          </div>
                          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {buckets.map((showtime) => (
                              <ShowtimeButton key={showtime.id} showtime={showtime} movie={movie} showCinema={!cinemaId} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
