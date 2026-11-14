import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import { cn, formatDate } from '@/lib/format';
import type { News } from '@/types/domain';
import { Badge } from '@/components/ui';

export function NewsCard({ news, featured = false, className }: {
  news: News;
  featured?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={`/khuyen-mai/${news.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line/70 bg-surface/80 shadow-card transition duration-300 ease-cinema hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift',
        featured && 'md:grid md:grid-cols-[1.15fr_1fr]',
        className,
      )}
    >
      <div
        className={cn('relative overflow-hidden', featured ? 'h-48 md:h-full md:min-h-[240px]' : 'h-40')}
        style={{ background: `linear-gradient(135deg, ${news.imageTone} 0%, #0b0f19 92%)` }}
      >
        {news.imageUrl && (
          <img
            src={news.imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-cinema group-hover:scale-[1.03]"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )}
        <div className="poster-grain absolute inset-0" aria-hidden />
        {news.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" aria-hidden />}
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-white/15" aria-hidden />
        <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-black/20 blur-2xl" aria-hidden />
        {!news.imageUrl && <Newspaper className="absolute bottom-4 right-4 h-10 w-10 text-white/25" strokeWidth={1.25} aria-hidden />}
        <div className="absolute left-4 top-4"><Badge tone="brand">{news.tag}</Badge></div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(news.publishedAt)}</span>
          <span className="text-line">·</span>
          <span>Tin PXU</span>
        </div>
        <h3 className={cn(
          'mt-2 font-display font-semibold uppercase leading-tight tracking-wide text-ink transition group-hover:text-brand',
          featured ? 'text-xl sm:text-2xl' : 'line-clamp-2 text-base',
        )}>
          {news.title}
        </h3>
        <p className={cn('mt-2 text-sm leading-relaxed text-muted', featured ? 'line-clamp-3' : 'line-clamp-2')}>{news.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold uppercase tracking-wide text-brand">
          Đọc tiếp <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
