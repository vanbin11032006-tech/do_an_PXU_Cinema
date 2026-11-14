import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, Clock, CreditCard, Mail, MapPin, Popcorn, Ticket, XCircle,
} from 'lucide-react';
import type { BookingDetail } from '@/types/domain';
import { formatDate, money } from '@/lib/format';
import { PosterArt } from '@/components/common';
import { Badge, Button, Card, HoldCountdown, PaymentStatusBadge, StatusBadge } from '@/components/ui';

export function BookingCard({ detail, onCancel, onResend, onExpire, cancelPending, resendPending }: {
  detail: BookingDetail;
  onCancel: (code: string) => void;
  onResend: (code: string) => void;
  onExpire?: () => void;
  cancelPending?: boolean;
  resendPending?: boolean;
}) {
  const navigate = useNavigate();
  const { movie, showtime, cinema, room, payments } = detail;
  const latestPayment = payments[0];
  const isHolding = detail.status === 'holding';
  const canViewTicket = detail.status === 'confirmed' || detail.status === 'completed';
  const canResend = canViewTicket && detail.tickets.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative hidden w-24 shrink-0 overflow-hidden sm:block lg:w-28">
          <PosterArt movie={movie} variant="poster" showTitle={false} />
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                Mã đơn <span className="font-mono text-ink2">{detail.code}</span>
              </p>
              <Link
                to={`/phim/${movie.slug}`}
                className="mt-1 block truncate font-display text-lg font-bold uppercase tracking-wide text-ink transition hover:text-brand"
              >
                {movie.title}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">{showtime.format}</Badge>
              <StatusBadge status={detail.status} />
              <PaymentStatusBadge status={latestPayment?.status ?? 'pending'} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 text-xs sm:grid-cols-2">
            <p className="flex items-center gap-1.5 text-ink2">
              <CalendarDays className="h-3.5 w-3.5 text-muted" />
              {formatDate(showtime.showDate)}
              <span className="text-muted">·</span>
              <Clock className="h-3.5 w-3.5 text-muted" />
              {showtime.startTime}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-ink2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="truncate">{cinema.name} · {room.name}</span>
            </p>
            <p className="flex items-center gap-1.5 text-ink2">
              <Ticket className="h-3.5 w-3.5 text-muted" />
              <span className="truncate">{detail.seats.map((seat) => seat.code).join(', ')}</span>
              <span className="shrink-0 text-muted">({detail.seats.length} ghế)</span>
            </p>
            {detail.combos.length > 0 && (
              <p className="flex min-w-0 items-center gap-1.5 text-ink2">
                <Popcorn className="h-3.5 w-3.5 shrink-0 text-brand" />
                <span className="truncate">{detail.combos.map((combo) => `${combo.quantity}× ${combo.name}`).join(', ')}</span>
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/60 pt-3">
            <span className="text-[11px] text-muted">Tổng thanh toán</span>
            <span className="text-money text-base font-bold text-brand">{money(detail.finalAmount)}</span>
            {detail.discount > 0 && <Badge tone="success">Đã giảm {money(detail.discount)}</Badge>}
            {isHolding && (
              <HoldCountdown
                expiresAt={detail.holdDeadline ?? detail.holdExpiresAt}
                serverTime={detail.serverTime}
                compact
                className="ml-auto"
                onExpire={onExpire}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-line/60 p-4 sm:w-48 sm:border-l">
          {isHolding && (
            <Button
              size="sm"
              full
              onClick={() => navigate(`/thanh-toan/${detail.code}`)}
              icon={<CreditCard className="h-3.5 w-3.5" />}
            >
              Tiếp tục thanh toán
            </Button>
          )}
          {canViewTicket && (
            <Button
              size="sm"
              full
              onClick={() => navigate(`/ve/${detail.code}`)}
              icon={<Ticket className="h-3.5 w-3.5" />}
            >
              Xem vé <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {canResend && (
            <Button
              size="sm"
              full
              variant="secondary"
              disabled={resendPending}
              loading={resendPending}
              onClick={() => onResend(detail.code)}
              icon={<Mail className="h-3.5 w-3.5" />}
            >
              Gửi lại email
            </Button>
          )}
          {isHolding && (
            <Button
              size="sm"
              full
              variant="ghost"
              className="text-danger hover:bg-danger/10 hover:text-danger"
              disabled={cancelPending}
              onClick={() => onCancel(detail.code)}
              icon={<XCircle className="h-3.5 w-3.5" />}
            >
              Hủy đơn
            </Button>
          )}
          {!isHolding && !canViewTicket && (
            <Button size="sm" full variant="secondary" onClick={() => navigate('/phim')}>
              Đặt vé mới
            </Button>
          )}
          {detail.status === 'expired' && <p className="text-center text-[10px] text-muted">Đơn đã hết hạn giữ ghế.</p>}
          {detail.status === 'cancelled' && (
            <p className="text-center text-[10px] text-muted">Đơn đã hủy{detail.cancelReason ? ` · ${detail.cancelReason}` : '.'}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
