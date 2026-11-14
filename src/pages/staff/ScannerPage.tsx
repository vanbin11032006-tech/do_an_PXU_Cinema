import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock, CheckCheck, History, KeyRound, RefreshCw, ScanLine, ShieldCheck, Ticket, XCircle,
} from 'lucide-react';
import { checkin, checkinBooking, checkinStats, explainResult, recentCheckins, staffCurrentShowtimes } from '@/api';
import type { CheckinResponse } from '@/api';
import type { CheckinResult } from '@/types/domain';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { relativeTime } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import {
  Badge, Button, Card, Checkbox, ErrorState, Field, Input, Modal, PageHeader, Progress, Select,
  Skeleton, toast,
} from '@/components/ui';
import type { BadgeProps } from '@/components/ui';
import { CameraScanner } from './components/CameraScanner';
import { ScannerResultPanel } from './components/ScannerResultPanel';

const RESULT_TONE: Record<CheckinResult, NonNullable<BadgeProps['tone']>> = {
  OK: 'success',
  ALREADY_USED: 'warning',
  TOO_EARLY: 'warning',
  TOO_LATE: 'danger',
  NOT_FOUND: 'danger',
  NOT_PAID: 'warning',
  CANCELLED: 'danger',
  WRONG_CINEMA: 'danger',
  ID_CHECK_REQUIRED: 'info',
};

function startMs(showDate: string, startTime: string): number {
  return new Date(`${showDate}T${startTime}:00`).getTime();
}

function playFeedback(ok: boolean): void {
  try {
    const AudioCtor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) {
      const context = new AudioCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = ok ? 920 : 220;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (ok ? 0.22 : 0.45));
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (ok ? 0.24 : 0.48));
      oscillator.onended = () => { void context.close(); };
    }
  } catch {
    /* trình duyệt chặn âm thanh – vẫn hiển thị kết quả bằng màu và chữ */
  }
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(ok ? 70 : [90, 60, 90]);
  }
}

export default function ScannerPage() {
  useDocumentTitle('Soát vé');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const canOverride = user?.role === 'manager' || user?.role === 'admin';

  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [activeCode, setActiveCode] = useState('');
  const [activeIsBooking, setActiveIsBooking] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const showtimesQuery = useQuery({ queryKey: ['staff', 'current-showtimes'], queryFn: staffCurrentShowtimes });
  const showtimes = showtimesQuery.data ?? [];
  const defaultShowtimeApplied = useRef(false);

  useEffect(() => {
    if (defaultShowtimeApplied.current || showtimes.length === 0) return;
    defaultShowtimeApplied.current = true;
    const now = Date.now();
    const nearest = [...showtimes].sort(
      (a, b) => Math.abs(startMs(a.showDate, a.startTime) - now) - Math.abs(startMs(b.showDate, b.startTime) - now),
    )[0];
    setShowtimeId(nearest.id);
  }, [showtimes]);

  const statsQuery = useQuery({
    queryKey: ['staff', 'checkin-stats', showtimeId],
    queryFn: () => checkinStats(showtimeId ?? undefined),
  });

  const recentQuery = useQuery({
    queryKey: ['staff', 'recent-checkins'],
    queryFn: () => recentCheckins(10),
    refetchInterval: 30_000,
  });

  const invalidateAfterScan = () => {
    queryClient.invalidateQueries({ queryKey: ['staff', 'checkin-stats'] });
    queryClient.invalidateQueries({ queryKey: ['staff', 'recent-checkins'] });
    queryClient.invalidateQueries({ queryKey: ['staff', 'today-bookings'] });
  };

  const applyResult = (response: CheckinResponse, ticketCode: string, isBooking = false) => {
    setResult(response);
    setActiveCode(ticketCode);
    setActiveIsBooking(isBooking);
    playFeedback(response.result === 'OK');
    invalidateAfterScan();
  };

  const scanMutation = useMutation({
    mutationFn: (input: { code: string; idVerified: boolean; override?: boolean; pin?: string }) =>
      checkin({
        ticketCode: input.code,
        showtimeId: showtimeId ?? undefined,
        override: input.override,
        idVerified: input.idVerified,
        pin: input.pin,
      }),
    onSuccess: (response, variables) => {
      applyResult(response, variables.code);
      setCode('');
      setPin('');
      setPinError(null);
      setOverrideOpen(false);
    },
    onError: (error, variables) => {
      if (variables.override) {
        setPinError(errorMessage(error));
      } else {
        toast.error('Không soát được vé', errorMessage(error));
      }
    },
  });

  const bookingMutation = useMutation({
    mutationFn: (bookingCode: string) => checkinBooking(bookingCode, { idVerified }),
    onSuccess: (response, bookingCode) => {
      applyResult(response, bookingCode, true);
      if (response.result === 'OK') toast.success('Đã soát cả đơn', response.message);
      else toast.warning('Cần xử lý thêm', response.message);
    },
    onError: (error) => toast.error('Không soát được đơn', errorMessage(error)),
  });

  const submit = (raw?: string) => {
    const value = (raw ?? code).trim().toUpperCase();
    if (!value) {
      toast.warning('Thiếu mã vé', 'Vui lòng nhập hoặc quét mã vé trước khi soát.');
      return;
    }
    setActiveCode(value);
    setActiveIsBooking(false);
    setResult(null);
    scanMutation.mutate({ code: value, idVerified });
  };

  const actionable = useMemo(() => {
    if (!result) return false;
    if (result.result === 'ID_CHECK_REQUIRED') return true;
    return !activeIsBooking && canOverride && (result.result === 'TOO_EARLY' || result.result === 'TOO_LATE');
  }, [result, canOverride, activeIsBooking]);

  useEffect(() => {
    if (!result || actionable) return;
    const timer = window.setTimeout(() => setResult(null), 4000);
    return () => window.clearTimeout(timer);
  }, [result, actionable]);

  const selectedShowtime = showtimes.find((item) => item.id === showtimeId);
  const stats = statsQuery.data;

  const confirmOverride = () => {
    if (!/^\d{4}$/.test(pin)) {
      setPinError('PIN gồm 4 chữ số.');
      return;
    }
    if (!activeCode) {
      setPinError('Không xác định được mã vé cần ghi đè.');
      return;
    }
    setPinError(null);
    scanMutation.mutate({ code: activeCode, idVerified, override: true, pin });
  };

  return (
    <div className="container-page py-6">
      <PageHeader
        title="Soát vé"
        description="Quét mã QR hoặc nhập mã vé để kiểm soát vào phòng. Kết quả hiển thị tức thì cùng âm thanh và rung."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={showtimeId ? 'brand' : 'neutral'}>
              <CalendarClock className="h-3 w-3" />
              {selectedShowtime ? `${selectedShowtime.startTime} · ${selectedShowtime.movie.title}` : 'Tất cả suất đang mở'}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { void showtimesQuery.refetch(); void statsQuery.refetch(); void recentQuery.refetch(); }}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <Field label="Mã vé" htmlFor="ticket-code" className="flex-1" hint="Ví dụ: PXU-XXXX-XXXX. Không phân biệt hoa thường.">
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" aria-hidden />
                  <Input
                    id="ticket-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="Nhập mã vé…"
                    className="pl-9 font-mono text-sm tracking-wider"
                    autoComplete="off"
                    autoFocus
                    spellCheck={false}
                  />
                </div>
              </Field>
              <Button type="submit" loading={scanMutation.isPending} icon={<Ticket className="h-4 w-4" />}>
                Soát vé
              </Button>
            </form>

            <div className="mt-3 flex flex-col gap-2 border-t border-line/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <Checkbox
                checked={idVerified}
                onChange={(event) => setIdVerified(event.target.checked)}
                label={<span className="text-xs">Đã kiểm tra giấy tờ (áp dụng phim T16/T18)</span>}
              />
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <ShieldCheck className="h-3 w-3 text-success" /> Chỉ nhân viên được soát vé
              </span>
            </div>

            <div className="mt-3">
              <CameraScanner onDetected={(value) => submit(value)} disabled={scanMutation.isPending} />
            </div>
          </Card>

          {result && (
            <ScannerResultPanel
              result={result}
              idVerified={idVerified}
              onIdVerifiedChange={setIdVerified}
              onRetry={() => {
                if (activeIsBooking) bookingMutation.mutate(activeCode);
                else submit(activeCode);
              }}
              onCheckinBooking={() => {
                if (result.booking) bookingMutation.mutate(result.booking.code);
              }}
              onOverride={() => {
                setPin('');
                setPinError(null);
                setOverrideOpen(true);
              }}
              onDismiss={() => { setResult(null); setActiveCode(''); setActiveIsBooking(false); }}
              canOverride={canOverride && !activeIsBooking}
              retryPending={scanMutation.isPending}
              bookingPending={bookingMutation.isPending}
            />
          )}

          {!result && (
            <Card className="flex flex-col items-center justify-center border-dashed px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-brand">
                <ScanLine className="h-7 w-7" />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold uppercase tracking-wide text-ink">Sẵn sàng soát vé</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                Nhập mã vé hoặc bật camera để quét. Kết quả hợp lệ có màu xanh; các trường hợp cần xử lý sẽ hiển thị hướng dẫn cụ thể.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">Suất chiếu</h2>
              <Badge tone="neutral">{showtimes.length} đang mở</Badge>
            </div>

            {showtimesQuery.isLoading ? (
              <Skeleton className="mt-3 h-10 w-full" />
            ) : showtimesQuery.isError ? (
              <div className="mt-3">
                <ErrorState
                  title="Không tải được suất chiếu"
                  message={errorMessage(showtimesQuery.error)}
                  onRetry={() => void showtimesQuery.refetch()}
                  className="px-4 py-6"
                />
              </div>
            ) : (
              <>
                <Select
                  className="mt-3"
                  value={showtimeId ?? ''}
                  onChange={(event) => {
                    setShowtimeId(event.target.value ? Number(event.target.value) : null);
                    setResult(null);
                  }}
                  aria-label="Chọn suất chiếu đang soát"
                >
                  <option value="">Tất cả suất đang mở</option>
                  {showtimes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.startTime} · {item.movie.title} · {item.room.name}
                    </option>
                  ))}
                </Select>
                {selectedShowtime && (
                  <div className="mt-3 rounded-lg border border-line/70 bg-base/40 p-3 text-[11px] text-ink2">
                    <p className="font-display text-sm font-bold uppercase tracking-wide text-ink">{selectedShowtime.movie.title}</p>
                    <p className="mt-1">{selectedShowtime.cinema.name} · {selectedShowtime.room.name} · {selectedShowtime.format}</p>
                    <p className="mt-0.5 text-muted">
                      {selectedShowtime.showDate.split('-').reverse().join('/')} · {selectedShowtime.startTime}–{selectedShowtime.endTime} · còn {selectedShowtime.availableSeats} ghế
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">Tiến độ soát vé</h2>
              <span className="text-[10px] text-muted">{showtimeId ? 'Theo suất đã chọn' : 'Toàn rạp hôm nay'}</span>
            </div>
            {statsQuery.isLoading ? (
              <Skeleton className="mt-3 h-20 w-full" />
            ) : statsQuery.isError ? (
              <p className="mt-3 text-xs text-muted">Không tải được thống kê. <button type="button" className="text-brand underline" onClick={() => void statsQuery.refetch()}>Thử lại</button></p>
            ) : stats ? (
              <div className="mt-3">
                <div className="flex items-end justify-between gap-2">
                  <p className="text-money text-2xl font-bold text-ink">
                    {stats.checkedIn}<span className="text-base font-medium text-muted">/{stats.total}</span>
                  </p>
                  <Badge tone={stats.failed > 0 ? 'warning' : 'success'}>{stats.failed} lượt lỗi</Badge>
                </div>
                <Progress
                  value={stats.total ? (stats.checkedIn / stats.total) * 100 : 0}
                  tone={stats.total > 0 && stats.checkedIn >= stats.total ? 'success' : 'brand'}
                  className="mt-2"
                />
                <p className="mt-2 text-[11px] text-muted">Số vé đã soát thành công trên tổng vé của suất đang chọn.</p>
              </div>
            ) : null}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
                <History className="h-4 w-4 text-brand" /> Lượt gần đây
              </h2>
              <button
                type="button"
                onClick={() => void recentQuery.refetch()}
                className="text-[11px] font-semibold text-muted hover:text-brand"
              >
                Làm mới
              </button>
            </div>

            {recentQuery.isLoading && (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            )}

            {recentQuery.isError && (
              <p className="mt-3 text-xs text-muted">
                Không tải được lịch sử.{' '}
                <button type="button" className="text-brand underline" onClick={() => void recentQuery.refetch()}>Thử lại</button>
              </p>
            )}

            {!recentQuery.isLoading && !recentQuery.isError && (recentQuery.data?.length ?? 0) === 0 && (
              <p className="mt-3 rounded-lg border border-dashed border-line/70 p-4 text-center text-xs text-muted">
                Chưa có lượt soát vé nào trong ca này.
              </p>
            )}

            <ul className="mt-3 divide-y divide-line/60">
              {(recentQuery.data ?? []).map((log) => (
                <li key={log.id} className="flex items-center gap-2 py-2.5">
                  <span className={log.result === 'OK' ? 'text-success' : 'text-danger'}>
                    {log.result === 'OK' ? <CheckCheck className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-semibold text-ink">{log.ticketCode}</p>
                    <p className="text-[10px] text-muted">{relativeTime(log.at)} · {log.staffName}</p>
                  </div>
                  <Badge tone={RESULT_TONE[log.result]}>{explainResult(log.result)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={overrideOpen}
        onClose={() => { setOverrideOpen(false); setPinError(null); }}
        title="Ghi đè giờ vào phòng"
        description="Chỉ quản lý hoặc quản trị được phép ghi đè khi khách đến quá sớm hoặc quá muộn."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setOverrideOpen(false); setPinError(null); }}>Hủy</Button>
            <Button variant="danger" onClick={confirmOverride} loading={scanMutation.isPending} icon={<KeyRound className="h-4 w-4" />}>
              Xác nhận ghi đè
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="rounded-md border border-line/70 bg-base/40 p-3 text-xs text-ink2">
            Mã vé <span className="font-mono font-semibold text-ink">{activeCode}</span> · {result ? explainResult(result.result) : ''}
          </p>
          <Field label="PIN quản lý" htmlFor="override-pin" required error={pinError ?? undefined} hint="Liên hệ quản lý ca để lấy PIN.">
            <Input
              id="override-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              error={Boolean(pinError)}
              autoFocus
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
