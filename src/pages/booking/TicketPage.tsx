import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, CalendarPlus, CheckCircle2, Clock, Download, Mail, MapPin, Popcorn, RefreshCw,
  Share2, ShieldCheck, Sparkles, Ticket as TicketIcon, XCircle,
} from 'lucide-react';
import type { BookingDetail } from '@/types/domain';
import { downloadBlob, formatDate, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { getBooking, resendTicketsEmail } from '@/api';
import { showtimeEnd, showtimeStart } from '@/lib/datetime';
import {
  Badge, Button, Card, ErrorState, QRImage, Skeleton, StatusBadge, toast,
} from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';
import { TicketCard } from '@/components/common/TicketCard';

function icsContent(booking: BookingDetail): string {
  const start = showtimeStart(booking.showtime);
  const end = showtimeEnd(booking.showtime);
  const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PXU Cinema//Booking//VI',
    'BEGIN:VEVENT',
    `UID:${booking.code}@pxucinema.vn`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${booking.movie.title} – PXU Cinema`,
    `LOCATION:${booking.cinema.name}, ${booking.cinema.address}`,
    `DESCRIPTION:Ghế ${booking.seats.map((s) => s.code).join(', ')} · ${booking.room.name} · Mã đơn ${booking.code}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function TicketPage() {
  const { bookingCode } = useParams();
  const queryClient = useQueryClient();
  const celebratory = useRef(false);

  const bookingQuery = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: () => getBooking(bookingCode!),
    enabled: Boolean(bookingCode),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && (data.status === 'holding' || data.payments[0]?.status === 'proof_submitted') ? 10_000 : false;
    },
  });
  const booking = bookingQuery.data;

  useEffect(() => {
    if (!booking || celebratory.current) return;
    if (booking.status !== 'confirmed' && booking.status !== 'completed') return;
    celebratory.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors: ['#ff6600', '#fbbf24', '#f8fafc'], disableForReducedMotion: true });
  }, [booking]);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    navigator.wakeLock.request('screen').then((lock) => { sentinel = lock; }).catch(() => undefined);
    return () => { void sentinel?.release().catch(() => undefined); };
  }, []);

  const resendMutation = useMutation({
    mutationFn: () => resendTicketsEmail(bookingCode!),
    onSuccess: (result) => toast.success('Đã gửi lại vé', result.message),
    onError: (error: unknown) => toast.error('Không gửi được vé', errorMessage(error)),
  });

  if (bookingQuery.isLoading) {
    return <div className="container-page space-y-4 py-6"><Skeleton className="h-32" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;
  }
  if (bookingQuery.isError || !booking) {
    return <ErrorState message={errorMessage(bookingQuery.error)} onRetry={() => void bookingQuery.refetch()} />;
  }

  const latestPayment = booking.payments[0];
  const paid = booking.status === 'confirmed' || booking.status === 'completed';

  if (!paid) {
    const proofSubmitted = latestPayment?.status === 'proof_submitted';
    const rejected = latestPayment?.status === 'rejected';
    const expired = booking.status === 'expired' || booking.status === 'cancelled';
    return (
      <div className="container-page py-10">
        <div className="mx-auto max-w-xl text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${expired ? 'bg-elevated text-muted' : rejected ? 'bg-danger/10 text-danger' : 'bg-info/10 text-info'}`}>
            {expired ? <XCircle className="h-7 w-7" /> : rejected ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
            {expired ? 'Đơn đã hết hạn' : rejected ? 'Biên lai bị từ chối' : proofSubmitted ? 'Đang chờ xác nhận' : 'Đơn chưa thanh toán'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {expired ? 'Thời gian giữ ghế đã kết thúc. Vui lòng chọn lại ghế nếu còn trống.' : rejected ? latestPayment.rejectNote ?? 'Vui lòng gửi lại biên lai hợp lệ.' : proofSubmitted ? 'PXU Cinema đang đối chiếu thanh toán của bạn. Vé sẽ xuất hiện ngay khi được duyệt.' : 'Hoàn tất thanh toán để nhận vé điện tử.'}
          </p>
          <p className="mt-2 font-mono text-xs text-muted">{booking.code}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {!expired && (
              <Link to={`/thanh-toan/${booking.code}`}>
                <Button>{proofSubmitted ? 'Xem trạng thái' : 'Tiếp tục thanh toán'}</Button>
              </Link>
            )}
            <Link to={expired ? `/dat-ve/${booking.showtime.id}/ghe` : `/phim/${booking.movie.slug}#lich-chieu`}>
              <Button variant="secondary">{expired ? 'Chọn lại ghế' : 'Về lịch chiếu'}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tickets = booking.tickets;

  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center no-print">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <p className="eyebrow mb-1">Đặt vé thành công</p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink sm:text-4xl">Vé của bạn đã sẵn sàng</h1>
          <p className="mt-2 text-sm text-muted">Xuất trình mã QR tại cửa phòng chiếu. Vé đã được gửi tới <strong className="text-ink">{booking.customerEmail || 'email của bạn'}</strong>.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="brand">{tickets.length} vé</Badge>
            <Badge tone="outline">Mã đơn {booking.code}</Badge>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-r from-brand/10 via-surface to-surface p-5 print-ticket">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg"><PosterArt movie={booking.movie} variant="thumb" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">{booking.movie.title}</h2>
              <p className="mt-1 text-xs text-ink2">{formatDate(booking.showtime.showDate)} · {booking.showtime.startTime} – {booking.showtime.endTime}</p>
              <p className="mt-0.5 text-xs text-muted">{booking.cinema.name} · {booking.room.name} · {booking.showtime.format}</p>
              <p className="mt-1 text-xs text-muted">Ghế {booking.seats.map((s) => s.code).join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted">Đã thanh toán</p>
              <p className="text-money text-xl font-bold text-brand">{money(booking.finalAmount)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {tickets.map((ticket, index) => (
            <TicketCard key={ticket.id} detail={booking} ticket={ticket} number={index + 1} />
          ))}
        </div>

        {booking.combos.length > 0 && (
          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/70 px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-ink"><Popcorn className="h-4 w-4 text-brand" /> Nhận bắp nước tại quầy</h2>
              {booking.comboPickedUpAt ? <Badge tone="success">Đã nhận</Badge> : <Badge tone="warning">Chưa nhận</Badge>}
            </div>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <QRImage value={booking.code} size={112} label="Quét mã đơn tại quầy" fileName={`pxu-combo-${booking.code}`} />
              <div className="flex-1">
                <div className="space-y-1 text-sm">
                  {booking.combos.map((combo) => (
                    <div key={combo.comboId} className="flex justify-between text-ink2">
                      <span>{combo.quantity}× {combo.name}</span>
                      <span className="text-money">{money(combo.price * combo.quantity)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Xuất trình mã QR đơn tại quầy bắp nước. Combo chỉ nhận một lần trong ngày chiếu.</p>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2 no-print">
          <Button variant="secondary" onClick={() => window.print()} icon={<Download className="h-4 w-4" />}>In / Lưu vé PDF</Button>
          <Button variant="secondary" loading={resendMutation.isPending} onClick={() => resendMutation.mutate()} icon={<Mail className="h-4 w-4" />}>Gửi lại email</Button>
          <Button
            variant="secondary"
            icon={<CalendarPlus className="h-4 w-4" />}
            onClick={() => downloadBlob(icsContent(booking), `pxu-${booking.code}.ics`, 'text/calendar;charset=utf-8')}
          >
            Thêm vào lịch
          </Button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.cinema.name} ${booking.cinema.address}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" full icon={<MapPin className="h-4 w-4" />}>Chỉ đường</Button>
          </a>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface/50 p-3 text-[10px] text-muted no-print">
          <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Vé điện tử có mã QR duy nhất. Không chia sẻ mã vé cho người khác.</p>
          <div className="flex items-center gap-3">
            <button type="button" className="inline-flex items-center gap-1 hover:text-brand" onClick={() => { void navigator.clipboard.writeText(`${booking.code} · ${booking.movie.title} · ${tickets.length} vé`); toast.success('Đã sao chép thông tin vé'); }}>
              <Share2 className="h-3 w-3" /> Sao chép
            </button>
            <button type="button" className="inline-flex items-center gap-1 hover:text-brand" onClick={() => void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] })}>
              <RefreshCw className="h-3 w-3" /> Làm mới
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 no-print">
          <Link to="/tai-khoan/ve-cua-toi" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><TicketIcon className="h-3.5 w-3.5" /> Vé của tôi</Link>
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" /> Về trang chủ</Link>
          <Link to="/phim" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><Sparkles className="h-3.5 w-3.5" /> Khám phá phim khác</Link>
        </div>
      </div>
    </div>
  );
}
