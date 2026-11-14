import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Armchair, Film, ShieldCheck, Sparkles, Ticket } from 'lucide-react';
import { AgeBadge, Badge, Button, Card, LogoMark, Rating, Skeleton } from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';
import { Logo } from '@/components/common/Logo';
import { listMovies } from '@/api';
import { errorMessage } from '@/lib/errors';

const TRUST_POINTS = [
  {
    icon: Ticket,
    title: 'Giữ ghế 10 phút',
    description: 'Chọn ghế, giữ chỗ và thanh toán theo nhịp của bạn.',
  },
  {
    icon: Armchair,
    title: 'Sơ đồ ghế thời gian thực',
    description: 'Cập nhật tức thì để bạn luôn chọn được chỗ ưng ý.',
  },
  {
    icon: ShieldCheck,
    title: 'Thanh toán QR minh bạch',
    description: 'Biên lai rõ ràng, trạng thái vé được xác nhận tự động.',
  },
] as const;

export function AuthShell({
  title,
  subtitle,
  eyebrow = 'Tài khoản PXU',
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const featuredQuery = useQuery({
    queryKey: ['auth', 'featured-movie'],
    queryFn: () => listMovies({ status: 'now_showing', sort: 'rating', perPage: 6 }),
    staleTime: 5 * 60_000,
  });
  const movie = featuredQuery.data?.items.find((item) => item.featured) ?? featuredQuery.data?.items[0];

  return (
    <div className="grid min-h-[100dvh] w-full bg-base lg:grid-cols-[1.05fr_0.95fr]">
      {/* ---------------- Cinematic poster panel (desktop) ---------------- */}
      <aside className="relative hidden overflow-hidden lg:block" aria-label="Giới thiệu PXU Cinema">
        {movie ? (
          <div className="absolute inset-0">
            <PosterArt movie={movie} variant="hero" showTitle={false} className="scale-105" />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(120% 100% at 18% 8%, #331b06 0%, #0b0f19 55%, #05070d 100%)' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070d] via-[#05070d]/75 to-[#05070d]/35" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070d]/95 via-[#05070d]/55 to-transparent" aria-hidden />
        <div className="poster-grain absolute inset-0" aria-hidden />

        <div className="relative z-10 flex h-full min-h-[100dvh] flex-col justify-between gap-10 p-8 xl:p-12">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="PXU Cinema – về trang chủ">
              <LogoMark className="h-9 w-9" />
              <span className="leading-none">
                <span className="block font-display text-xl font-extrabold uppercase tracking-[0.14em] text-white">PXU</span>
                <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.34em] text-brand">Cinema</span>
              </span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/75 backdrop-blur transition hover:border-white/30 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Về trang chủ
            </Link>
          </div>

          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand">PXU Cinema · Điện ảnh đỉnh cao</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[1.04] tracking-wide text-white xl:text-5xl">
              Mỗi suất chiếu,
              <br />
              <span className="text-brand">một trải nghiệm đáng nhớ</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
              Đăng nhập để đặt vé nhanh hơn, tích điểm thành viên và nhận ưu đãi riêng từ hệ thống rạp PXU Cinema.
            </p>
            <ul className="mt-7 space-y-3.5">
              {TRUST_POINTS.map(({ icon: Icon, title: pointTitle, description }) => (
                <li key={pointTitle} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{pointTitle}</p>
                    <p className="text-xs leading-relaxed text-white/50">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Featured movie */}
          <div className="rounded-card border border-white/10 bg-black/35 p-3 backdrop-blur-md">
            {featuredQuery.isLoading && (
              <div className="flex items-center gap-3.5" aria-label="Đang tải phim nổi bật">
                <Skeleton className="h-24 w-[68px] shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}

            {featuredQuery.isError && (
              <div className="flex items-center gap-3" role="alert">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50">
                  <Film className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">Không tải được phim nổi bật</p>
                  <p className="truncate text-[11px] text-white/50">{errorMessage(featuredQuery.error)}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void featuredQuery.refetch()}
                  disabled={featuredQuery.isFetching}
                >
                  Thử lại
                </Button>
              </div>
            )}

            {!featuredQuery.isLoading && !featuredQuery.isError && movie && (
              <Link to={`/phim/${movie.slug}`} className="group flex items-center gap-3.5">
                <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <PosterArt movie={movie} variant="thumb" showTitle={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">Đang chiếu</Badge>
                    <AgeBadge age={movie.age} />
                  </div>
                  <p className="mt-1.5 truncate font-display text-lg font-bold uppercase tracking-wide text-white">
                    {movie.title}
                  </p>
                  <p className="truncate text-[11px] text-white/55">
                    {movie.genres.slice(0, 2).join(' · ')} · {movie.duration} phút
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <Rating value={movie.rating} size="xs" />
                    <span className="text-[11px] font-semibold text-brand transition group-hover:text-brand-300">
                      Đặt vé →
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {!featuredQuery.isLoading && !featuredQuery.isError && !movie && (
              <div className="flex items-center gap-3 py-2 text-sm text-white/60">
                <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                Suất chiếu mới đang được cập nhật.
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ---------------- Form panel ---------------- */}
      <main className="relative flex min-h-[100dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-6 lg:hidden">
          <Logo compact />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Trang chủ
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <div className="w-full max-w-[440px] animate-fade-up">
            <Card className="relative overflow-hidden p-5 sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/10 blur-3xl" aria-hidden />
              <header className="relative">
                <p className="eyebrow">{eyebrow}</p>
                <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-tight tracking-wide text-ink">
                  {title}
                </h1>
                {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
              </header>
              <div className="relative mt-6">{children}</div>
            </Card>

            {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}

            <p className="mt-6 text-center text-[11px] text-muted/80">
              © {new Date().getFullYear()} PXU Cinema · Trải nghiệm điện ảnh trọn vẹn
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
