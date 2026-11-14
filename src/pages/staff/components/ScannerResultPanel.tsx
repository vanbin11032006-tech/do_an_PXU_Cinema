import type { ReactNode } from 'react';
import {
  AlertOctagon, AlertTriangle, Building2, CalendarClock, CheckCircle2, Clock3, CreditCard,
  MapPin, ShieldAlert, Ticket, TicketX, UserCheck, XCircle,
} from 'lucide-react';
import type { CheckinResult } from '@/types/domain';
import type { CheckinResponse } from '@/api';
import { explainResult } from '@/api';
import { cn, formatDate, formatDateTime } from '@/lib/format';
import { Badge, Button, Checkbox, InfoRow, Progress } from '@/components/ui';

interface ResultStyle {
  wrapper: string;
  icon: ReactNode;
  headline: string;
}

const RESULT_STYLES: Record<CheckinResult, ResultStyle> = {
  OK: {
    wrapper: 'border-success/50 bg-success/10 text-success',
    icon: <CheckCircle2 className="h-9 w-9" />,
    headline: 'Cho khách vào phòng',
  },
  ALREADY_USED: {
    wrapper: 'border-warning/50 bg-warning/10 text-warning',
    icon: <TicketX className="h-9 w-9" />,
    headline: 'Vé đã được soát trước đó',
  },
  TOO_EARLY: {
    wrapper: 'border-warning/50 bg-warning/10 text-warning',
    icon: <Clock3 className="h-9 w-9" />,
    headline: 'Chưa đến giờ mở phòng',
  },
  TOO_LATE: {
    wrapper: 'border-danger/50 bg-danger/10 text-danger',
    icon: <Clock3 className="h-9 w-9" />,
    headline: 'Đã quá giờ vào phòng',
  },
  NOT_FOUND: {
    wrapper: 'border-danger/50 bg-danger/10 text-danger',
    icon: <XCircle className="h-9 w-9" />,
    headline: 'Mã vé không tồn tại',
  },
  NOT_PAID: {
    wrapper: 'border-warning/50 bg-warning/10 text-warning',
    icon: <CreditCard className="h-9 w-9" />,
    headline: 'Đơn chưa thanh toán',
  },
  CANCELLED: {
    wrapper: 'border-danger/50 bg-danger/10 text-danger',
    icon: <AlertOctagon className="h-9 w-9" />,
    headline: 'Vé đã bị hủy',
  },
  WRONG_CINEMA: {
    wrapper: 'border-danger/50 bg-danger/10 text-danger',
    icon: <Building2 className="h-9 w-9" />,
    headline: 'Sai rạp hoặc sai suất chiếu',
  },
  ID_CHECK_REQUIRED: {
    wrapper: 'border-info/50 bg-info/10 text-sky-300',
    icon: <ShieldAlert className="h-9 w-9" />,
    headline: 'Cần kiểm tra giấy tờ',
  },
};

export function ScannerResultPanel({ result, idVerified, onIdVerifiedChange, onRetry, onCheckinBooking, onOverride, onDismiss, canOverride, retryPending, bookingPending }: {
  result: CheckinResponse;
  idVerified: boolean;
  onIdVerifiedChange: (value: boolean) => void;
  onRetry: () => void;
  onCheckinBooking: () => void;
  onOverride: () => void;
  onDismiss: () => void;
  canOverride: boolean;
  retryPending?: boolean;
  bookingPending?: boolean;
}) {
  const style = RESULT_STYLES[result.result];
  const requiresId = result.result === 'ID_CHECK_REQUIRED';
  const canOverrideResult = canOverride && (result.result === 'TOO_EARLY' || result.result === 'TOO_LATE');
  const remaining = result.ticketsRemaining;
  const total = result.ticketsTotal;

  return (
    <div className="animate-fade-up" role="status" aria-live="assertive">
      <div className={cn('rounded-xl border-2 p-4 sm:p-5', style.wrapper)}>
        <div className="flex items-start gap-3">
          <span className="shrink-0">{style.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-current px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em]">
                {explainResult(result.result)}
              </span>
              <span className="font-display text-sm font-bold uppercase tracking-wide">{style.headline}</span>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{result.message}</p>
            {result.ageWarning && (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300">Phim nhãn {result.ageWarning} – bắt buộc kiểm tra CCCD/Hộ chiếu</p>
            )}
          </div>
        </div>

        {result.movie && (
          <div className="mt-4 rounded-lg border border-line/60 bg-base/60 p-3">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">{result.movie.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink2">
              {result.showtime && (
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3 w-3 text-muted" />
                  {formatDate(result.showtime.showDate)} · {result.showtime.startTime}
                </span>
              )}
              {(result.cinemaName || result.roomName) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted" />
                  {[result.cinemaName, result.roomName].filter(Boolean).join(' · ')}
                </span>
              )}
              {result.seatCodes.length > 0 && (
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3 text-muted" />
                  Ghế {result.seatCodes.join(', ')}
                </span>
              )}
            </div>

            {total > 0 && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <Progress value={((total - remaining) / total) * 100} tone={remaining === 0 ? 'success' : 'brand'} />
                <span className="text-[11px] font-semibold text-ink2">{total - remaining}/{total} vé đã soát{remaining > 0 ? ` · còn ${remaining}` : ' · đủ đơn'}</span>
              </div>
            )}

            {result.checkedInAt && (
              <div className="mt-2 border-t border-line/60 pt-2 text-[11px] text-muted">
                <InfoRow label="Giờ soát" value={formatDateTime(result.checkedInAt)} className="py-1" />
                {result.checkedInBy && <InfoRow label="Nhân viên" value={result.checkedInBy} className="py-1" />}
              </div>
            )}
          </div>
        )}

        {(requiresId || canOverrideResult) && (
          <div className="mt-3 space-y-2.5">
            {requiresId && (
              <>
                <Checkbox
                  checked={idVerified}
                  onChange={(event) => onIdVerifiedChange(event.target.checked)}
                  label={<span className="text-xs">Tôi đã kiểm tra giấy tờ của khách và đủ điều kiện độ tuổi.</span>}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!idVerified}
                  loading={retryPending}
                  onClick={onRetry}
                  icon={<UserCheck className="h-4 w-4" />}
                >
                  Xác nhận & soát lại vé
                </Button>
              </>
            )}
            {canOverrideResult && (
              <Button size="sm" variant="danger" onClick={onOverride} icon={<AlertTriangle className="h-4 w-4" />}>
                Ghi đè bằng PIN quản lý
              </Button>
            )}
          </div>
        )}

        {result.booking && remaining > 0 && result.result !== 'TOO_EARLY' && result.result !== 'TOO_LATE' && result.result !== 'ID_CHECK_REQUIRED' && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            loading={bookingPending}
            onClick={onCheckinBooking}
            icon={<Ticket className="h-4 w-4" />}
          >
            Soát cả đơn {result.booking.code} ({remaining} vé còn lại)
          </Button>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge tone="neutral">{result.booking ? `Đơn ${result.booking.code}` : 'Không có đơn'}</Badge>
          <button type="button" onClick={onDismiss} className="text-[11px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
            Xóa kết quả
          </button>
        </div>
      </div>
    </div>
  );
}
