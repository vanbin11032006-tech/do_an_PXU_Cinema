import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, RotateCcw } from 'lucide-react';
import type { ShowtimePublic } from '@/api';
import { cancelShowtime, listShowtimesAdmin, showtimeImpact } from '@/api';
import { errorMessage } from '@/lib/errors';
import { cinemaNow, dateISO } from '@/lib/datetime';
import { formatDate, money } from '@/lib/format';
import { Button, EmptyState, Modal, Select, Spinner, StatusBadge, Textarea, toast } from '@/components/ui';

type CancelAction = 'refund' | 'reschedule';

export function CancelShowtimeModal({ open, onClose, onDone, showtime }: {
  open: boolean; onClose: () => void; onDone: () => void; showtime: ShowtimePublic | null;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<CancelAction>('refund');
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setAction('refund');
    setTargetId('');
    setError(null);
  }, [open, showtime?.id]);

  const impactQuery = useQuery({
    queryKey: ['admin', 'showtime-impact', showtime?.id],
    queryFn: () => showtimeImpact(showtime!.id),
    enabled: open && Boolean(showtime),
    retry: false,
  });

  const targetsQuery = useQuery({
    queryKey: ['admin', 'showtimes', 'reschedule-targets', showtime?.cinemaId, showtime?.movieId],
    queryFn: () => listShowtimesAdmin({
      cinemaId: showtime!.cinemaId,
      movieId: showtime!.movieId,
      from: dateISO(cinemaNow()),
      status: 'all',
    }),
    enabled: open && Boolean(showtime),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () => cancelShowtime(showtime!.id, {
      reason: reason.trim(),
      action,
      targetShowtimeId: action === 'reschedule' ? Number(targetId) : undefined,
    }),
    onSuccess: (result) => {
      toast.success(
        action === 'reschedule' ? 'Đã dời suất chiếu' : 'Đã hủy suất chiếu',
        `${result.cancelledBookings} đơn bị ảnh hưởng · ${result.refundsCreated} yêu cầu hoàn tiền được tạo.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtimes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtime-impact'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'refunds'] });
      onDone();
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không xử lý được suất chiếu', errorMessage(mutationError));
    },
  });

  const impact = impactQuery.data;
  const targets = (targetsQuery.data ?? []).filter(
    (item) => item.id !== showtime?.id && item.status !== 'cancelled' && item.status !== 'finished',
  );
  const reasonValid = reason.trim().length >= 5;
  const canSubmit = Boolean(showtime) && reasonValid && (action === 'refund' || Boolean(targetId)) && !mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hủy hoặc dời suất chiếu"
      description={showtime ? `${showtime.movie.title} · ${formatDate(showtime.showDate)} · ${showtime.startTime}` : undefined}
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted" aria-live="polite">
            {impact ? `${impact.bookings.length} đơn bị ảnh hưởng · ${money(impact.totalAmount)}` : impactQuery.isLoading ? 'Đang tải đơn bị ảnh hưởng…' : '—'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
            <Button variant="danger" disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {action === 'reschedule' ? 'Xác nhận dời suất' : 'Xác nhận hủy suất'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="label mb-1.5">Phương án xử lý <span className="text-danger">*</span></p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={action === 'refund'}
              onClick={() => setAction('refund')}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${action === 'refund' ? 'border-danger/60 bg-danger/10' : 'border-line bg-base/40 hover:border-brand/40'}`}
            >
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>
                <span className="block text-sm font-semibold text-ink">Hủy và hoàn tiền</span>
                <span className="mt-0.5 block text-[11px] text-muted">Hủy toàn bộ đơn, tạo yêu cầu hoàn tiền cho các đơn đã thanh toán.</span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={action === 'reschedule'}
              onClick={() => setAction('reschedule')}
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${action === 'reschedule' ? 'border-brand bg-brand/10' : 'border-line bg-base/40 hover:border-brand/40'}`}
            >
              <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                <span className="block text-sm font-semibold text-ink">Dời sang suất khác</span>
                <span className="mt-0.5 block text-[11px] text-muted">Đơn đủ ghế ở suất mới được chuyển; các đơn còn lại tự động hoàn tiền.</span>
              </span>
            </button>
          </div>
        </div>

        {action === 'reschedule' && (
          <div>
            <label className="label" htmlFor="cancel-target">Suất chiếu thay thế <span className="text-danger">*</span></label>
            <Select id="cancel-target" value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Chọn suất chiếu cùng phim</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {formatDate(target.showDate)} · {target.startTime}–{target.endTime} · {target.room.name} · còn {target.availableSeats}/{target.totalSeats} ghế
                </option>
              ))}
            </Select>
            {targetsQuery.isLoading && <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted"><Spinner className="h-3 w-3" /> Đang tìm suất thay thế…</p>}
            {targetsQuery.isError && <p className="mt-1.5 text-[11px] text-danger">{errorMessage(targetsQuery.error)}</p>}
            {!targetsQuery.isLoading && !targets.length && <p className="mt-1.5 text-[11px] text-warning">Không có suất chiếu thay thế phù hợp trong thời gian tới.</p>}
          </div>
        )}

        <div>
          <label className="label" htmlFor="cancel-reason">Lý do <span className="text-danger">*</span></label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(event) => { setReason(event.target.value); setError(null); }}
            rows={3}
            placeholder="Ví dụ: Rạp gặp sự cố kỹ thuật, cần bảo trì phòng chiếu…"
            error={reason.length > 0 && !reasonValid}
          />
          <p className="mt-1 text-[11px] text-muted">Tối thiểu 5 ký tự. Lý do được ghi nhận và gửi thông báo cho khách hàng.</p>
        </div>

        <div className="rounded-lg border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 bg-base/40 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink"><AlertTriangle className="h-3.5 w-3.5 text-warning" />Đơn bị ảnh hưởng</p>
            <span className="text-[11px] text-muted">{impact ? money(impact.totalAmount) : '—'}</span>
          </div>
          {impactQuery.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : impactQuery.isError ? (
            <p className="p-3 text-xs text-danger">{errorMessage(impactQuery.error)}</p>
          ) : impact?.bookings.length ? (
            <ul className="max-h-52 divide-y divide-line/50 overflow-y-auto">
              {impact.bookings.map((booking) => (
                <li key={booking.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-ink">{booking.code}</p>
                    <p className="truncate text-[11px] text-muted">{booking.customerName} · ghế {booking.seats.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={booking.status} />
                    <span className="text-money text-ink2">{money(booking.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-2">
              <EmptyState title="Không có đơn bị ảnh hưởng" description="Suất chiếu chưa có vé đã bán hoặc đang giữ." className="border-0 bg-transparent px-4 py-6" />
            </div>
          )}
        </div>

        {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
