import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, Film, Globe2, Heart, Play, Ticket, Users } from 'lucide-react';
import { getMovie, isFavorite, listMovies, toggleFavorite } from '@/api';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate } from '@/lib/format';
import {
  AgeBadge, Badge, Button, ErrorState, InfoRow, Rating, Skeleton, StatusBadge, Tabs, toast,
} from '@/components/ui';
import { PosterArt, MovieCard, TrailerModal } from '@/components/common';
import { MovieShowtimes } from './components/MovieShowtimes';
import { MovieReviews } from './components/MovieReviews';
import { AuthPromptModal } from './components/AuthPromptModal';
import { ActionLink } from './components/ActionLink';
import { MovieGridSkeleton, SectionError } from './components/States';

type DetailTab = 'content' | 'showtimes' | 'reviews';

export default function MovieDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const [tab, setTab] = useState<DetailTab>('content');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const movieQuery = useQuery({
    queryKey: ['public', 'movie', slug],
    queryFn: () => getMovie(slug),
    enabled: Boolean(slug),
  });
  const movie = movieQuery.data;
  useDocumentTitle(movie?.title);

  const favoriteQuery = useQuery({
    queryKey: ['public', 'favorite', movie?.id, user?.id],
    queryFn: () => isFavorite(movie!.id),
    enabled: Boolean(movie) && authStatus === 'authenticated',
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleFavorite(movie!.id),
    onSuccess: (result) => {
      toast.success(result.favorited ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích', result.message);
      void queryClient.invalidateQueries({ queryKey: ['public', 'favorite', movie?.id] });
    },
    onError: (error) => toast.error('Không cập nhật được yêu thích', errorMessage(error)),
  });

  const relatedQuery = useQuery({
    queryKey: ['public', 'movies', 'related', movie?.id],
    queryFn: () => listMovies({ status: 'now_showing', perPage: 100, sort: 'rating' }),
    enabled: Boolean(movie),
  });

  useEffect(() => {
    if (!movie || !location.hash) return;
    const target = location.hash === '#lich-chieu' ? 'lich-chieu' : location.hash === '#danh-gia' ? 'danh-gia' : null;
    if (!target) return;
    setTab(target === 'lich-chieu' ? 'showtimes' : 'reviews');
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [movie, location.hash]);

  const scrollTo = (target: DetailTab) => {
    setTab(target);
    if (target === 'content') return;
    const id = target === 'showtimes' ? 'lich-chieu' : 'danh-gia';
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const toggleFavoriteClick = () => {
    if (!movie) return;
    if (authStatus !== 'authenticated') {
      setAuthOpen(true);
      return;
    }
    favoriteMutation.mutate();
  };

  const related = (relatedQuery.data?.items ?? [])
    .filter((candidate) => candidate.id !== movie?.id)
    .sort((a, b) => {
      const overlapA = movie ? a.genres.filter((genre) => movie.genres.includes(genre)).length : 0;
      const overlapB = movie ? b.genres.filter((genre) => movie.genres.includes(genre)).length : 0;
      return overlapB - overlapA || b.rating - a.rating;
    })
    .slice(0, 5);

  if (movieQuery.isLoading) {
    return (
      <div className="container-page py-10">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton className="mx-auto aspect-[2/3] w-full max-w-[220px] rounded-card lg:max-w-none" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-64" />
          </div>
        </div>
      </div>
    );
  }

  if (movieQuery.isError || !movie) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Không tải được thông tin phim"
          message={movieQuery.error ? errorMessage(movieQuery.error) : 'Phim không tồn tại hoặc đã ngừng chiếu.'}
          onRetry={() => void movieQuery.refetch()}
        />
        <div className="mt-5 text-center"><ActionLink to="/phim" variant="secondary">Về danh sách phim</ActionLink></div>
      </div>
    );
  }

  const favorited = authStatus === 'authenticated' && favoriteQuery.data === true;
  const returnTo = `${location.pathname}${location.hash}`;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line/60">
        <div className="absolute inset-0 scale-110 blur-2xl" style={{ opacity: 0.55 }} aria-hidden>
          <PosterArt movie={movie} variant="banner" showTitle={false} />
        </div>
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `linear-gradient(140deg, ${movie.art.from}33 0%, rgba(11,15,25,.88) 48%, #0b0f19 100%)` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-base/30" aria-hidden />

        <div className="container-page relative grid gap-8 py-9 sm:py-12 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-10">
          <div className="mx-auto w-full max-w-[210px] lg:mx-0 lg:max-w-none">
            <div className="relative aspect-[2/3] overflow-hidden rounded-card border border-white/10 shadow-lift">
              <PosterArt movie={movie} />
              <div className="absolute left-2.5 top-2.5 z-30"><AgeBadge age={movie.age} /></div>
            </div>
          </div>

          <div className="min-w-0">
            <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Link to="/" className="transition hover:text-ink">Trang chủ</Link>
              <span aria-hidden>›</span>
              <Link to="/phim" className="transition hover:text-ink">Phim</Link>
              <span aria-hidden>›</span>
              <span className="line-clamp-1 text-ink2">{movie.title}</span>
            </nav>

            <p className="eyebrow mt-4">Khởi chiếu {formatDate(movie.releaseDate)}</p>
            <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-[0.98] tracking-wide text-ink sm:text-5xl">
              {movie.title}
            </h1>
            {movie.tagline && <p className="mt-2 max-w-2xl text-sm italic text-ink2 sm:text-base">{movie.tagline}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <StatusBadge status={movie.status} />
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{movie.duration} phút</span>
              <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />{movie.language}</span>
              {movie.rating > 0
                ? <Rating value={movie.rating} showValue />
                : <span className="font-medium">Chưa có đánh giá</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {movie.genres.map((genre) => <Badge key={genre} tone="neutral">{genre}</Badge>)}
            </div>

            <p className="mt-4 line-clamp-3 max-w-3xl text-sm leading-relaxed text-ink2">{movie.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" icon={<Ticket className="h-4 w-4" />} onClick={() => scrollTo('showtimes')}>
                Mua vé
              </Button>
              <Button size="lg" variant="secondary" icon={<Play className="h-4 w-4" />} onClick={() => setTrailerOpen(true)}>
                Xem trailer
              </Button>
              <Button
                size="lg"
                variant="ghost"
                loading={favoriteMutation.isPending}
                onClick={toggleFavoriteClick}
                icon={<Heart className={cn('h-4 w-4', favorited && 'fill-brand text-brand')} />}
                className={cn(favorited && 'text-brand')}
              >
                {favorited ? 'Đã yêu thích' : 'Yêu thích'}
              </Button>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
              <div><dt className="text-muted">Đạo diễn</dt><dd className="mt-0.5 font-medium text-ink">{movie.director}</dd></div>
              <div><dt className="text-muted">Diễn viên</dt><dd className="mt-0.5 line-clamp-1 font-medium text-ink">{movie.cast.join(', ')}</dd></div>
              <div><dt className="text-muted">Ngôn ngữ</dt><dd className="mt-0.5 font-medium text-ink">{movie.language}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <div className="container-page py-8 sm:py-10">
        <Tabs
          items={[
            { value: 'content', label: 'Nội dung' },
            { value: 'showtimes', label: 'Lịch chiếu', icon: <CalendarDays className="h-3.5 w-3.5" /> },
            { value: 'reviews', label: 'Đánh giá', icon: <Users className="h-3.5 w-3.5" /> },
          ]}
          value={tab}
          onChange={scrollTo}
          className="mb-6"
        />

        {tab === 'content' && (
          <div id="noi-dung" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article>
              <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">Nội dung phim</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-8 text-ink2">{movie.description}</p>

              <h3 className="mt-7 font-display text-lg font-semibold uppercase tracking-wide text-ink">Diễn viên</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {movie.cast.map((actor) => <Badge key={actor} tone="outline">{actor}</Badge>)}
              </div>

              <div className="mt-7 flex items-start gap-3 rounded-card border border-line/60 bg-surface/40 p-4 text-xs leading-relaxed text-muted">
                <Film className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p>
                  Phim được trình chiếu tại các cụm rạp PXU Cinema với định dạng 2D, 3D và IMAX tùy phòng. Vui lòng đến trước giờ chiếu 15 phút
                  để ổn định chỗ ngồi và kiểm tra độ tuổi đối với phim T16/T18.
                </p>
              </div>
            </article>

            <aside className="card-surface h-fit p-5">
              <p className="eyebrow">Thông tin chiếu</p>
              <div className="mt-2 divide-y divide-line/50">
                <InfoRow label="Khởi chiếu" value={formatDate(movie.releaseDate)} />
                <InfoRow label="Thời lượng" value={`${movie.duration} phút`} />
                <InfoRow label="Ngôn ngữ" value={movie.language} />
                <InfoRow label="Độ tuổi" value={<AgeBadge age={movie.age} />} />
                <InfoRow label="Thể loại" value={movie.genres.join(' · ')} />
              </div>
              <div className="mt-5 space-y-2">
                <ActionLink to={`/phim/${movie.slug}#lich-chieu`} className="w-full" icon={<Ticket className="h-4 w-4" />}>
                  Chọn suất chiếu
                </ActionLink>
                <Button variant="secondary" full icon={<Play className="h-4 w-4" />} onClick={() => setTrailerOpen(true)}>
                  Xem trailer
                </Button>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-muted">
                Giá vé hiển thị tại bước chọn suất đã bao gồm phụ thu phòng chiếu. Thanh toán trực tuyến an toàn, vé QR nhận ngay sau khi đơn được xác nhận.
              </p>
            </aside>
          </div>
        )}

        {tab === 'showtimes' && (
          <div id="lich-chieu" className="scroll-mt-24">
            <MovieShowtimes movie={movie} />
          </div>
        )}

        {tab === 'reviews' && (
          <div id="danh-gia" className="scroll-mt-24">
            <MovieReviews movieId={movie.id} movieTitle={movie.title} movieSlug={movie.slug} />
          </div>
        )}
      </div>

      <section className="container-page pb-16">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Gợi ý cho bạn</p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-ink">Có thể bạn cũng thích</h2>
          </div>
          <ActionLink to="/phim" variant="ghost" size="sm">Xem tất cả phim</ActionLink>
        </div>
        {relatedQuery.isLoading ? (
          <MovieGridSkeleton count={5} />
        ) : relatedQuery.isError ? (
          <SectionError error={relatedQuery.error} onRetry={() => void relatedQuery.refetch()} title="Không tải được phim gợi ý" />
        ) : related.length === 0 ? (
          <p className="rounded-card border border-dashed border-line/70 bg-surface/40 px-4 py-8 text-center text-sm text-muted">
            Chưa có phim tương tự đang chiếu tại PXU Cinema. Hãy xem toàn bộ danh mục phim.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {related.map((item) => <MovieCard key={item.id} movie={item} />)}
          </div>
        )}
      </section>

      <TrailerModal movie={movie} open={trailerOpen} onClose={() => setTrailerOpen(false)} />
      <AuthPromptModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        returnTo={returnTo}
        title="Đăng nhập để lưu phim yêu thích"
        description="Lưu phim để nhận thông báo suất chiếu mới và ưu đãi dành riêng cho thành viên PXU."
      />
    </div>
  );
}
