import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';
import { listCombos, listGenres, listMovies, listNews } from '@/api';
import { useAuthStore } from '@/store/auth';
import { useDocumentTitle } from '@/hooks';
import { Button, CheckMark, Chip, EmptyState, SectionHeading, Tabs } from '@/components/ui';
import { BannerCarousel } from './components/BannerCarousel';
import { QuickBooking } from './components/QuickBooking';
import { MovieGrid } from './components/MovieGrid';
import { ComboCard } from './components/ComboCard';
import { NewsCard } from './components/NewsCard';
import { ActionLink } from './components/ActionLink';
import { CardGridSkeleton, MovieGridSkeleton, SectionError } from './components/States';

export default function HomePage() {
  useDocumentTitle();
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<'now_showing' | 'coming_soon'>('now_showing');
  const [genre, setGenre] = useState('');

  const genresQuery = useQuery({ queryKey: ['public', 'genres'], queryFn: listGenres });
  const moviesQuery = useQuery({
    queryKey: ['public', 'home', 'movies', status, genre],
    queryFn: () => listMovies({ status, genre: genre || undefined, perPage: 10, sort: 'newest' }),
  });
  const combosQuery = useQuery({ queryKey: ['public', 'combos'], queryFn: listCombos });
  const newsQuery = useQuery({ queryKey: ['public', 'news'], queryFn: listNews });

  const genres = genresQuery.data ?? [];
  const movies = moviesQuery.data?.items ?? [];
  const combos = combosQuery.data?.slice(0, 3) ?? [];
  const news = newsQuery.data?.slice(0, 3) ?? [];

  const allMoviesTo = (() => {
    const params = new URLSearchParams();
    params.set('status', status);
    if (genre) params.set('genre', genre);
    return `/phim?${params.toString()}`;
  })();

  return (
    <div>
      <BannerCarousel />
      <div className="container-page relative z-30 mt-4 lg:-mt-12">
        <QuickBooking />
      </div>

      <section className="container-page py-12 sm:py-16">
        <SectionHeading
          eyebrow="Phim tại PXU"
          title="Đang chiếu & sắp chiếu"
          description="Chọn phim theo thể loại yêu thích, xem thông tin và đặt vé cho suất chiếu phù hợp."
          action={(
            <ActionLink to={allMoviesTo} variant="ghost" size="sm">
              <span className="inline-flex items-center gap-1">Xem tất cả <ArrowRight className="h-3.5 w-3.5" /></span>
            </ActionLink>
          )}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            variant="pill"
            items={[
              { value: 'now_showing', label: 'Đang chiếu' },
              { value: 'coming_soon', label: 'Sắp chiếu' },
            ]}
            value={status}
            onChange={setStatus}
            className="w-fit"
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!genre} onClick={() => setGenre('')}>Tất cả thể loại</Chip>
            {genres.map((item) => (
              <Chip key={item} active={genre === item} onClick={() => setGenre(item)}>{item}</Chip>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {moviesQuery.isLoading ? (
            <MovieGridSkeleton count={10} />
          ) : moviesQuery.isError ? (
            <SectionError error={moviesQuery.error} onRetry={() => void moviesQuery.refetch()} title="Không tải được danh sách phim" />
          ) : movies.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Chưa có phim phù hợp"
              description="Thử chọn thể loại khác hoặc xem toàn bộ phim đang chiếu tại PXU Cinema."
              action={<Button variant="outline" onClick={() => { setGenre(''); setStatus('now_showing'); }}>Xóa bộ lọc</Button>}
            />
          ) : (
            <MovieGrid movies={movies} />
          )}
        </div>
      </section>

      <section className="container-page pb-12 sm:pb-16">
        <SectionHeading
          eyebrow="Bắp nước"
          title="Combo xem phim trọn vị"
          description="Đặt trước combo yêu thích để nhận nhanh tại quầy, không phải xếp hàng."
          action={(
            <ActionLink to="/bap-nuoc" variant="ghost" size="sm">
              <span className="inline-flex items-center gap-1">Xem tất cả <ArrowRight className="h-3.5 w-3.5" /></span>
            </ActionLink>
          )}
        />
        {combosQuery.isLoading ? (
          <CardGridSkeleton count={3} />
        ) : combosQuery.isError ? (
          <SectionError error={combosQuery.error} onRetry={() => void combosQuery.refetch()} title="Không tải được combo" />
        ) : combos.length === 0 ? (
          <EmptyState title="Chưa có combo nào" description="Các combo bắp nước sẽ sớm được cập nhật tại PXU Cinema." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {combos.map((combo) => (
              <ComboCard
                key={combo.id}
                combo={combo}
                action={<ActionLink to="/bap-nuoc" size="sm" variant="outline">Chọn combo</ActionLink>}
              />
            ))}
          </div>
        )}
      </section>

      <section className="container-page pb-12 sm:pb-16">
        <div className="relative overflow-hidden rounded-modal border border-brand/30 bg-surface/80 shadow-card">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(100% 160% at 100% 0%, rgba(255,102,0,.22), transparent 55%)' }}
            aria-hidden
          />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand/10 blur-3xl" aria-hidden />
          <div className="relative grid gap-7 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> PXU Member</p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-3xl">
                Mỗi tấm vé là một bước tiến hạng
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Tích điểm từ mỗi đơn hàng, nhận ưu đãi vé và combo, cùng nhiều quyền lợi riêng cho thành viên thân thiết của PXU Cinema.
              </p>
              <ul className="mt-4 grid gap-2 text-xs text-ink2 sm:grid-cols-3">
                {['Tích điểm theo giá trị đơn', 'Ưu đãi vé và combo', 'Quà tặng dịp đặc biệt'].map((item) => (
                  <li key={item} className="flex items-center gap-2 rounded-lg border border-line/60 bg-base/40 px-3 py-2">
                    <CheckMark className="h-3.5 w-3.5 shrink-0 text-success" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <ActionLink to={user ? '/tai-khoan/diem-thuong' : '/dang-ky'} size="lg">
                {user ? 'Xem điểm thưởng' : 'Tham gia miễn phí'}
              </ActionLink>
              <ActionLink to={user ? '/tai-khoan' : '/dang-nhap'} variant="secondary" size="lg">
                {user ? 'Tài khoản của tôi' : 'Đăng nhập'}
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-16">
        <SectionHeading
          eyebrow="Tin tức"
          title="Chuyện rạp & ưu đãi"
          description="Cập nhật phòng chiếu mới, hướng dẫn đặt vé và các chương trình khuyến mãi đang diễn ra."
          action={(
            <ActionLink to="/khuyen-mai" variant="ghost" size="sm">
              <span className="inline-flex items-center gap-1">Xem tất cả <ArrowRight className="h-3.5 w-3.5" /></span>
            </ActionLink>
          )}
        />
        {newsQuery.isLoading ? (
          <CardGridSkeleton count={3} />
        ) : newsQuery.isError ? (
          <SectionError error={newsQuery.error} onRetry={() => void newsQuery.refetch()} title="Không tải được tin tức" />
        ) : news.length === 0 ? (
          <EmptyState title="Chưa có bài viết" description="Tin tức và khuyến mãi mới sẽ được cập nhật tại đây." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => <NewsCard key={item.id} news={item} />)}
          </div>
        )}
      </section>

      <div className="container-page pb-16">
        <div className="flex flex-col items-center gap-2 rounded-card border border-line/60 bg-surface/50 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Cần chọn phim theo lịch rảnh?</p>
            <p className="mt-1 text-sm text-muted">Xem toàn bộ suất chiếu trong 14 ngày tới tại các cụm rạp PXU.</p>
          </div>
          <ActionLink to="/lich-chieu" variant="outline" size="md">
            Xem lịch chiếu <ArrowRight className="h-4 w-4" />
          </ActionLink>
        </div>
      </div>
    </div>
  );
}
