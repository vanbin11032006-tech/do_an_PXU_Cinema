import { useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Play, Ticket } from 'lucide-react';
import { listBanners, listMovies } from '@/api';
import { useMediaQuery } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate } from '@/lib/format';
import { AgeBadge, ErrorState, IconButton, Rating, Skeleton } from '@/components/ui';
import { ActionLink } from './ActionLink';
import { TrailerModal } from '@/components/common';
import type { Movie } from '@/types/domain';

export function BannerCarousel() {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const touchStart = useRef<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public', 'banners'],
    queryFn: async () => {
      const [banners, moviePage] = await Promise.all([
        listBanners(),
        listMovies({ perPage: 100, status: 'all' }),
      ]);
      return { banners, movies: moviePage.items };
    },
  });

  const banners = data?.banners ?? [];
  const movies = data?.movies ?? [];

  useEffect(() => {
    if (index >= banners.length && banners.length > 0) setIndex(0);
  }, [banners.length, index]);

  useEffect(() => {
    if (paused || trailerMovie || reducedMotion || banners.length < 2) return;
    const timer = window.setInterval(() => setIndex((prev) => (prev + 1) % banners.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused, trailerMovie, reducedMotion, banners.length]);

  if (isLoading) {
    return (
      <section className="border-b border-line/60" aria-label="Phim nổi bật">
        <Skeleton className="aspect-[4/5] w-full rounded-none sm:aspect-[21/9]" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="border-b border-line/60 bg-surface/40" aria-label="Phim nổi bật">
        <div className="container-page py-10">
          <ErrorState title="Không tải được ảnh nổi bật" message={errorMessage(error)} onRetry={() => void refetch()} />
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden border-b border-line/60" aria-label="Giới thiệu PXU Cinema">
        <div className="relative flex aspect-[4/5] items-end sm:aspect-[21/9]">
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'linear-gradient(120deg, #7c2d12 0%, #0b0f19 58%, #082f49 100%)' }}
            aria-hidden
          />
          <div className="poster-grain absolute inset-0" aria-hidden />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" aria-hidden />
          <div className="container-page relative pb-24 sm:pb-28 lg:pb-32">
            <p className="eyebrow mb-2">PXU Cinema</p>
            <h1 className="max-w-2xl font-display text-4xl font-bold uppercase leading-[0.98] tracking-wide text-white sm:text-6xl">
              Điện ảnh đúng chuẩn, cảm xúc trọn vẹn
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Khám phá phim đang chiếu, chọn suất phù hợp và giữ ghế chỉ trong vài bước.
            </p>
            <div className="mt-6"><ActionLink to="/phim" size="lg" icon={<Ticket className="h-4 w-4" />}>Khám phá phim</ActionLink></div>
          </div>
        </div>
      </section>
    );
  }

  const banner = banners[Math.min(index, banners.length - 1)];
  const movie = banner.movieId ? movies.find((item) => item.id === banner.movieId) : undefined;
  const accent = movie?.art.accent ?? banner.tone.accent;
  const background = movie
    ? `linear-gradient(120deg, ${movie.art.from} 0%, ${movie.art.via} 46%, ${movie.art.to} 100%)`
    : `linear-gradient(120deg, ${banner.tone.from} 0%, ${banner.tone.to} 100%)`;
  const primaryTo = movie ? `/phim/${movie.slug}#lich-chieu` : '/phim';

  const onTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    if (touchStart.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    if (Math.abs(delta) > 48) {
      setIndex((prev) => (prev + (delta < 0 ? 1 : -1) + banners.length) % banners.length);
    }
    touchStart.current = null;
  };

  return (
    <section
      className="relative overflow-hidden border-b border-line/60"
      aria-roledescription="băng chuyền"
      aria-label="Phim nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative isolate aspect-[4/5] w-full sm:aspect-[21/9]">
        <div key={banner.id} className="absolute inset-0 animate-fade-in" style={{ backgroundImage: background }} aria-hidden>
          {movie?.backdropUrl && (
            <img
              src={movie.backdropUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover object-center"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="poster-grain absolute inset-0" />
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(120% 120% at 80% 10%, rgba(0,0,0,0) 0%, rgba(0,0,0,.35) 100%)' }} />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/65 to-slate-950/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/10" />
          <svg className="absolute right-0 top-0 h-full w-2/3 opacity-20" viewBox="0 0 400 240" preserveAspectRatio="none">
            <circle cx="330" cy="60" r="110" fill="none" stroke={accent} strokeWidth="1" />
            <circle cx="330" cy="60" r="78" fill="none" stroke={accent} strokeWidth="0.6" />
            <path d="M0 240 L400 40" stroke={accent} strokeWidth="0.5" opacity="0.5" />
          </svg>
        </div>

        <div className="relative z-10 flex h-full flex-col justify-end">
          <div className="container-page pb-24 sm:pb-28 lg:pb-32">
            <div key={`content-${banner.id}`} className="max-w-3xl animate-fade-up">
              <div className="flex flex-wrap items-center gap-2.5">
                {movie && <AgeBadge age={movie.age} />}
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
                  {banner.order === 1 ? 'Đang chiếu' : 'Nổi bật'}
                </span>
                {movie && <Rating value={movie.rating} />}
              </div>

              <h1 className="mt-3 line-clamp-3 font-display text-3xl font-bold uppercase leading-[0.98] tracking-wide text-white drop-shadow-[0_4px_24px_rgba(0,0,0,.55)] sm:text-5xl lg:text-6xl">
                {banner.title}
              </h1>
              <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{banner.subtitle}</p>

              {movie && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
                  <span>{movie.genres.slice(0, 3).join(' · ')}</span>
                  <span aria-hidden>·</span>
                  <span>{movie.duration} phút</span>
                  <span aria-hidden>·</span>
                  <span>Khởi chiếu {formatDate(movie.releaseDate)}</span>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <ActionLink to={primaryTo} size="lg" icon={<Ticket className="h-4 w-4" />}>
                  {banner.ctaLabel || 'Mua vé'}
                </ActionLink>
                {movie && (
                  <button
                    type="button"
                    onClick={() => setTrailerMovie(movie)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-slate-950/60 px-5 text-[15px] font-semibold text-white backdrop-blur transition hover:border-white/40 hover:bg-slate-950/80"
                  >
                    <Play className="h-4 w-4" /> Xem trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 lg:bottom-20">
          <div className="container-page flex items-center justify-between">
            <div className="pointer-events-auto flex items-center gap-1.5" role="tablist" aria-label="Chọn ảnh nổi bật">
              {banners.map((item, itemIndex) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={itemIndex === index}
                  aria-label={`Ảnh ${itemIndex + 1}: ${item.title}`}
                  onClick={() => setIndex(itemIndex)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    itemIndex === index ? 'w-8 bg-brand' : 'w-2.5 bg-white/40 hover:bg-white/70',
                  )}
                />
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <IconButton
                label="Ảnh trước"
                size="sm"
                onClick={() => setIndex((prev) => (prev - 1 + banners.length) % banners.length)}
                className="border-white/25 bg-slate-950/50 text-white hover:border-white/50 hover:bg-slate-950/80 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Ảnh sau"
                size="sm"
                onClick={() => setIndex((prev) => (prev + 1) % banners.length)}
                className="border-white/25 bg-slate-950/50 text-white hover:border-white/50 hover:bg-slate-950/80 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      <TrailerModal movie={trailerMovie} open={Boolean(trailerMovie)} onClose={() => setTrailerMovie(null)} />
    </section>
  );
}
