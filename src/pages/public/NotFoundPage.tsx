import { Film, Home, Ticket } from 'lucide-react';
import { useDocumentTitle } from '@/hooks';
import { ActionLink } from './components/ActionLink';

export default function NotFoundPage() {
  useDocumentTitle('Không tìm thấy trang');

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(90% 120% at 50% 0%, rgba(255,102,0,.16), transparent 60%)' }}
        aria-hidden
      />
      <div className="container-page relative flex min-h-[70dvh] flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <span className="absolute inset-0 -z-10 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line/70 bg-surface/80 text-brand shadow-card">
            <Film className="h-7 w-7" />
          </div>
        </div>

        <p
          className="font-display text-[88px] font-bold leading-none tracking-wide text-transparent sm:text-[132px]"
          style={{ backgroundImage: 'linear-gradient(180deg, #ff9d5c 0%, #ff6600 45%, #7c2d12 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
        >
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">Trang này không tồn tại</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Trang bạn tìm có thể đã được di chuyển, hết thời gian chiếu hoặc đường dẫn không đúng. Hãy quay về trang chủ để tiếp tục khám phá PXU Cinema.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <ActionLink to="/" size="lg" icon={<Home className="h-4 w-4" />}>Về trang chủ</ActionLink>
          <ActionLink to="/phim" variant="secondary" size="lg">Xem phim đang chiếu</ActionLink>
          <ActionLink to="/lich-chieu" variant="ghost" size="lg" icon={<Ticket className="h-4 w-4" />}>Xem lịch chiếu</ActionLink>
        </div>

        <div className="mt-10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
          <span className="h-px w-8 bg-line" aria-hidden /> PXU Cinema <span className="h-px w-8 bg-line" aria-hidden />
        </div>
      </div>
    </div>
  );
}
