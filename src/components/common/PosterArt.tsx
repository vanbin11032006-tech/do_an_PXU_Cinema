import type { Movie } from '@/types/domain';
import { cn } from '@/lib/format';

export function PosterArt({ movie, variant = 'poster', className, showTitle = true }: {
  movie: Pick<Movie, 'title' | 'art' | 'tagline' | 'genres' | 'duration' | 'age' | 'rating' | 'id' | 'status' | 'posterUrl' | 'backdropUrl'>;
  variant?: 'poster' | 'banner' | 'hero' | 'thumb';
  className?: string;
  showTitle?: boolean;
}) {
  const { from, via, to, accent } = movie.art;
  const imageUrl = variant === 'hero' || variant === 'banner'
    ? (movie.backdropUrl ?? movie.posterUrl)
    : movie.posterUrl;

  return (
    <div
      className={cn('relative isolate h-full w-full overflow-hidden', className)}
      style={{ background: `linear-gradient(155deg, ${from} 0%, ${via} 52%, ${to} 100%)` }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            loading={variant === 'hero' ? 'eager' : 'lazy'}
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25" aria-hidden />
        </>
      ) : (
        <>
          <div
            className="absolute -right-1/4 -top-1/4 h-[85%] w-[85%] rounded-full opacity-45 blur-2xl"
            style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 65%)` }}
            aria-hidden
          />
          <svg className="absolute inset-0 h-full w-full opacity-[0.22]" viewBox="0 0 300 450" preserveAspectRatio="none" aria-hidden>
            <circle cx="248" cy="86" r="74" fill="none" stroke={accent} strokeWidth="1" />
            <circle cx="248" cy="86" r="104" fill="none" stroke={accent} strokeWidth="0.6" />
            <path d="M-40 330 Q 120 210 340 300" fill="none" stroke={accent} strokeWidth="0.8" />
            <path d="M-40 352 Q 120 232 340 322" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.7" />
            <line x1="18" y1="0" x2="18" y2="450" stroke={accent} strokeWidth="0.6" opacity="0.5" />
            <line x1="282" y1="0" x2="282" y2="450" stroke={accent} strokeWidth="0.6" opacity="0.35" />
          </svg>
          <span
            className="pointer-events-none absolute -top-6 right-1 select-none font-display text-[120px] font-extrabold leading-none text-white/10 sm:text-[150px]"
            aria-hidden
          >
            {String(movie.id).padStart(2, '0')}
          </span>
        </>
      )}
      <div className="poster-grain absolute inset-0 z-10" aria-hidden />

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <span className="rounded-sm border border-white/25 bg-black/25 px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
          PXU Cinema
        </span>
        {variant === 'poster' && movie.rating > 0 && (
          <span className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-bold text-gold backdrop-blur-sm">
            ★ {movie.rating.toFixed(1)}
          </span>
        )}
      </div>

      {showTitle && (
        <div className={cn(
          'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent',
          variant === 'thumb' ? 'p-2' : variant === 'hero' ? 'p-6 sm:p-10' : 'p-3.5',
        )}>
          {variant !== 'thumb' && (
            <p className="mb-1.5 font-display text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: accent }}>
              {variant === 'hero' ? 'Suất chiếu đặc biệt' : movie.status === 'coming_soon' ? 'Sắp chiếu tại PXU' : movie.status === 'ended' ? 'Đã chiếu tại PXU' : 'Đang chiếu tại PXU'}
            </p>
          )}
          <h3 className={cn(
            'font-display font-bold uppercase leading-[1.02] tracking-wide text-white drop-shadow-[0_2px_16px_rgba(0,0,0,.6)]',
            variant === 'thumb' ? 'line-clamp-2 text-[11px]' : variant === 'hero' ? 'line-clamp-2 max-w-2xl text-3xl sm:text-5xl' : 'line-clamp-3 text-lg',
          )}>
            {movie.title}
          </h3>
          {variant === 'hero' && movie.tagline && (
            <p className="mt-2 max-w-xl text-sm text-white/75">{movie.tagline}</p>
          )}
          {variant !== 'thumb' && (
            <p className="mt-1.5 line-clamp-1 text-[10px] font-medium uppercase tracking-wider text-white/60">
              {movie.genres.slice(0, 2).join(' · ')} · {movie.duration} phút
            </p>
          )}
        </div>
      )}
    </div>
  );
}
