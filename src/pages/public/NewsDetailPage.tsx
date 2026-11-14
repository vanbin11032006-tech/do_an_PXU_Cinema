import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Newspaper } from 'lucide-react';
import { getNews, listNews } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Badge, ErrorState, Skeleton } from '@/components/ui';
import { NewsCard } from './components/NewsCard';
import { ActionLink } from './components/ActionLink';
import { SectionError } from './components/States';

export default function NewsDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const newsQuery = useQuery({
    queryKey: ['public', 'news', slug],
    queryFn: () => getNews(slug),
    enabled: Boolean(slug),
  });
  const relatedQuery = useQuery({ queryKey: ['public', 'news'], queryFn: listNews });

  const news = newsQuery.data;
  useDocumentTitle(news?.title);

  const paragraphs = news ? news.body.split(/\n{2,}/).filter((paragraph) => paragraph.trim()) : [];
  const related = (relatedQuery.data ?? []).filter((item) => item.id !== news?.id).slice(0, 3);

  if (newsQuery.isLoading) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-64 w-full rounded-card" />
        <div className="mx-auto mt-6 max-w-3xl space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (newsQuery.isError || !news) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Không tìm thấy bài viết"
          message={newsQuery.error ? errorMessage(newsQuery.error) : 'Bài viết không tồn tại hoặc đã được gỡ.'}
          onRetry={() => void newsQuery.refetch()}
        />
        <div className="mt-5 text-center"><ActionLink to="/khuyen-mai" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>Về danh sách tin tức</ActionLink></div>
      </div>
    );
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line/60">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(130deg, ${news.imageTone} 0%, #0b0f19 82%)` }}
          aria-hidden
        />
        {news.imageUrl && (
          <img
            src={news.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover object-center"
            fetchPriority="high"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )}
        <div className="poster-grain absolute inset-0" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/45 to-slate-950/10" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/45 to-transparent" aria-hidden />
        <div className="container-page relative py-9 sm:py-14">
          <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1.5 text-xs text-white/60">
            <Link to="/" className="transition hover:text-white">Trang chủ</Link>
            <span aria-hidden>›</span>
            <Link to="/khuyen-mai" className="transition hover:text-white">Tin tức</Link>
            <span aria-hidden>›</span>
            <span className="line-clamp-1 text-white/85">{news.tag}</span>
          </nav>
          <div className="mt-5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{news.tag}</Badge>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-white/70"><CalendarDays className="h-3.5 w-3.5" />{formatDate(news.publishedAt)}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase leading-[1.02] tracking-wide text-white sm:text-5xl">{news.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{news.excerpt}</p>
          </div>
        </div>
      </section>

      <div className="container-page py-8 sm:py-10">
        <article className="mx-auto max-w-4xl rounded-card border border-line/70 bg-surface/80 p-5 shadow-card sm:p-8">
          <p className="eyebrow">Nội dung bài viết</p>
          <div className="mt-4 space-y-4 text-[15px] leading-8 text-ink2">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/khuyen-mai" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-brand">
              <ArrowLeft className="h-3.5 w-3.5" /> Tất cả tin tức
            </Link>
            <ActionLink to="/phim" variant="outline" size="sm">Khám phá phim đang chiếu</ActionLink>
          </div>
        </article>

        <section className="mx-auto mt-10 max-w-4xl">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Đọc tiếp</p>
              <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-ink">Bài viết khác</h2>
            </div>
            <Link to="/khuyen-mai" className="text-xs font-semibold text-brand hover:underline">Xem tất cả</Link>
          </div>

          {relatedQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-64 w-full rounded-card" />)}
            </div>
          ) : relatedQuery.isError ? (
            <SectionError error={relatedQuery.error} onRetry={() => void relatedQuery.refetch()} title="Không tải được bài viết khác" />
          ) : related.length === 0 ? (
            <div className="flex items-center gap-3 rounded-card border border-dashed border-line/70 bg-surface/40 p-5 text-sm text-muted">
              <Newspaper className="h-5 w-5 shrink-0 text-brand" /> Chưa có bài viết khác. Hãy quay lại sau để cập nhật tin mới.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => <NewsCard key={item.id} news={item} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
