import { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Headphones, ShieldCheck } from 'lucide-react';
import { cn, formatDate, money } from '@/lib/format';
import { getBooking } from '@/api';
import { useToastStore } from '@/components/ui';
import { HoldCountdown, Stepper } from '@/components/ui';
import { Logo } from '@/components/common/Logo';

const STEPS = ['Chọn ghế', 'Bắp nước', 'Xác nhận', 'Thanh toán', 'Nhận vé'];

export function BookingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);
  const codeMatch = location.pathname.match(/\/(?:dat-ve|thanh-toan|ve)\/([^/]+)/);
  const rawCode = codeMatch?.[1];
  const bookingCode = rawCode && rawCode.toUpperCase().startsWith('PXU-') ? rawCode.toUpperCase() : undefined;

  const current = location.pathname.endsWith('/ghe') ? 0
    : location.pathname.includes('/bap-nuoc') ? 1
      : location.pathname.includes('/xac-nhan') ? 2
        : location.pathname.startsWith('/thanh-toan') ? 3
          : location.pathname.startsWith('/ve') ? 4 : 0;

  const { data: booking } = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: () => getBooking(bookingCode!),
    enabled: Boolean(bookingCode),
    refetchInterval: bookingCode ? 20_000 : false,
    retry: false,
  });

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  const holding = booking?.status === 'holding';

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-50 border-b border-line/60 glass no-print">
        <div className="container-page flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:text-ink"
              aria-label="Quay lại bước trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Logo compact />
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-muted sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Thanh toán bảo mật
            <span className="text-line">|</span>
            <Headphones className="h-3.5 w-3.5 text-brand" /> Hỗ trợ 1900 6363
          </div>
          <Link to="/" className="text-[11px] font-medium text-muted transition hover:text-brand">Thoát</Link>
        </div>
        <div className="border-t border-line/40 bg-base/40">
          <div className="container-page flex items-center gap-4 py-2.5">
            <Stepper steps={STEPS} current={current} className="flex-1" />
            {holding && booking?.holdDeadline && (
              <HoldCountdown
                expiresAt={booking.holdDeadline}
                serverTime={booking.serverTime}
                className="hidden sm:inline-flex"
                onExpire={() => {
                  pushToast({ title: 'Đã hết thời gian giữ ghế', message: 'Ghế đã được nhả. Vui lòng chọn lại ghế.', tone: 'warning' });
                  void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] });
                }}
              />
            )}
          </div>
        </div>
        {holding && booking && (
          <div className="border-t border-line/40 bg-surface/60">
            <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[11px]">
              <span className="font-semibold text-ink">{booking.movie.title}</span>
              <span className="text-muted">{formatDate(booking.showtime.showDate)} · {booking.showtime.startTime}</span>
              <span className="text-muted">{booking.room.name} · {booking.seats.map((s) => s.code).join(', ')}</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="text-money font-semibold text-brand">{money(booking.finalAmount)}</span>
                <HoldCountdown
                  expiresAt={booking.holdDeadline}
                  serverTime={booking.serverTime}
                  className={cn('sm:hidden')}
                  compact
                  onExpire={() => void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] })}
                />
              </span>
            </div>
          </div>
        )}
      </header>

      <main id="main" className={cn('flex-1', current === 4 ? '' : 'container-page py-6 sm:py-8')}>
        <Outlet />
      </main>

      <footer className="border-t border-line/50 py-4 no-print">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
          <p>© {new Date().getFullYear()} PXU Cinema · Giá đã bao gồm thuế</p>
          <p>Bằng việc đặt vé, bạn đồng ý với <Link to="/trang/dieu-khoan" className="text-brand hover:underline">điều khoản sử dụng</Link>.</p>
        </div>
      </footer>
    </div>
  );
}
