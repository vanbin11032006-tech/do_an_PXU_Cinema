import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Film, Play, ShoppingBag } from 'lucide-react';
import type { Movie } from '@/types/domain';
import { cn } from '@/lib/format';
import { AgeBadge, Rating } from '@/components/ui';
import { PosterArt } from './PosterArt';
import { TrailerModal } from './TrailerModal';

export function MovieCard({ movie, className }: { movie: Movie; className?: string }) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const comingSoon = movie.status === 'coming_soon';

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-card border border-line/70 bg-surface shadow-card transition duration-300 ease-cinema group-hover:-translate-y-1 group-hover:border-brand/40 group-hover:shadow-lift">
        <Link
          to={`/phim/${movie.slug}`}
          className="absolute inset-0 z-10 block"
          aria-label={`Xem chi tiết phim ${movie.title}`}
        >
          <PosterArt movie={movie} />
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-30"><AgeBadge age={movie.age} /></div>
        {comingSoon && (
          <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-full bg-info/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-950">Sắp chiếu</span>
        )}
        <div className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center gap-2 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 sm:flex">
          <Link
            to={comingSoon ? `/phim/${movie.slug}` : `/phim/${movie.slug}#lich-chieu`}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-white shadow-glow"
          >
            {comingSoon ? <Film className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}
            {comingSoon ? 'Chi tiết' : 'Mua vé'}
          </Link>
          <button
            type="button"
            onClick={() => setTrailerOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/60"
          >
            <Play className="h-3 w-3" /> Trailer
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <Link to={`/phim/${movie.slug}`} className="line-clamp-2 font-display text-base font-semibold uppercase leading-tight tracking-wide text-ink transition group-hover:text-brand">
          {movie.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span className="line-clamp-1">{movie.genres.slice(0, 2).join(' · ')}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{movie.duration}p</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {movie.rating > 0
            ? <Rating value={movie.rating} />
            : <span className="text-[10px] uppercase tracking-wide text-muted">Chưa có đánh giá</span>}
          {comingSoon ? (
            <button
              type="button"
              onClick={() => setTrailerOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-brand/40 bg-brand/10 px-2 text-[10px] font-bold uppercase tracking-wide text-brand transition hover:bg-brand hover:text-white"
            >
              <Play className="h-3 w-3" /> Xem trailer
            </button>
          ) : (
            <Link
              to={`/phim/${movie.slug}#lich-chieu`}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-brand/40 bg-brand/10 px-2 text-[10px] font-bold uppercase tracking-wide text-brand transition hover:bg-brand hover:text-white"
            >
              Mua vé
            </Link>
          )}
        </div>
      </div>
      <TrailerModal movie={movie} open={trailerOpen} onClose={() => setTrailerOpen(false)} />
    </article>
  );
}

export function MovieRowCard({ movie, className }: { movie: Movie; className?: string }) {
  return (
    <Link
      to={`/phim/${movie.slug}`}
      className={cn('group flex gap-4 rounded-card border border-line/70 bg-surface/70 p-3 transition hover:border-brand/40 hover:bg-elevated/60', className)}
    >
      <div className="w-20 shrink-0 overflow-hidden rounded-md">
        <div className="aspect-[2/3]"><PosterArt movie={movie} variant="thumb" /></div>
      </div>
      <div className="min-w-0 flex-1 py-1">
        <h4 className="line-clamp-2 font-display text-sm font-semibold uppercase tracking-wide text-ink group-hover:text-brand">{movie.title}</h4>
        <p className="mt-1 line-clamp-1 text-[11px] text-muted">{movie.genres.join(' · ')}</p>
        <div className="mt-2 flex items-center gap-2"><AgeBadge age={movie.age} /><Rating value={movie.rating} /></div>
      </div>
    </Link>
  );
}
