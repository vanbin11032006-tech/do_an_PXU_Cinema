import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock, CheckCircle2, Clapperboard, CreditCard, Mail, MapPin,
  Printer, RefreshCw, RotateCcw, Send, Ticket as TicketIcon, Undo2, UserRound, XCircle,
} from 'lucide-react';
import {
  addOrderNote, approvePayment, cancelOrder, changeOrderSeats, createRefund, getOrderDetail,
  getSettings, getShowtimeSeats, rejectionReasons, rejectPayment, resendTicketsEmail, undoCheckin,
} from '@/api';
import type { BookingSeat, Ticket } from '@/types/domain';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, formatDateTime, money, number } from '@/lib/format';
import {
  AgeBadge, Avatar, BackLink, Badge, Button, Card, Checkbox, ConfirmDialog, CopyField, ErrorState, Field,
  HoldCountdown, InfoRow, Modal, PageHeader, PriceBreakdown, Select, Skeleton, StatusBadge,
  Textarea, TierBadge, toast,
} from '@/components/ui';
import { PosterArt, ScreenBar, SeatLegend, SeatMap } from '@/components/common';
import {
  ChannelBadge, Notice, Panel, PaymentMethodBadge, paymentMethodLabel,
} from './commerce/shared';

const REJECT_REASON_LABEL: Record<string, string> = {
  unclear_proof: 'Ảnh biên lai không rõ ràng',
  wrong_amount: 'Số tiền chuyển không khớp',
  wrong_content: 'Nội dung chuyển khoản không đúng',
  not_received: 'Chưa nhận được tiền',
  other: 'Lý do khác',
};

const SEAT_TYPE_LABEL: Record<BookingSeat['type'], string> = {
  standard: 'Thường',
  vip: 'VIP',
  couple: 'Đôi',
  aisle: 'Lối đi',
  blank: 'Trống',
  disabled: 'Không bán',
};

const TIMELINE_DOT = {
  neutral: 'bg-slate-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);
  const qc = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const user = useAuthStore((state) => state.user);

  const orderQuery = useQuery({
    queryKey: ['admin', 'order', bookingId],
    queryFn: () => getOrderDetail(bookingId),
    enabled: Number.isFinite(bookingId) && bookingId > 0,
  });
  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings', 'order-vat'],
    queryFn: getSettings,
    enabled: can('setting.read'),
    staleTime: 120_000,
  });
  const [approveMismatchOpen, setApproveMismatchOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCode, setRejectCode] = useState<string>(rejectionReasons[0]);
  const [rejectNote, setRejectNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelWithRefund, setCancelWithRefund] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundScope, setRefundScope] = useState<'full' | 'partial'>('full');
  const [refundSeatIds, setRefundSeatIds] = useState<number[]>([]);
  const [refundReason, setRefundReason] = useState('');
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [newSeatIds, setNewSeatIds] = useState<number[]>([]);
  const [seatReason, setSeatReason] = useState('');
  const [undoTicket, setUndoTicket] = useState<Ticket | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const seatMapQuery = useQuery({
    queryKey: ['admin', 'order', bookingId, 'seat-map'],
    queryFn: async () => {
      if (!orderQuery.data) throw new Error('Chưa tải được thông tin đơn hàng.');
      return getShowtimeSeats(orderQuery.data.detail.showtime.id);
    },
    enabled: seatsOpen && Number.isFinite(bookingId) && bookingId > 0,
  });

  const data = orderQuery.data;
  const detail = data?.detail;
  const customer = data?.customer ?? null;
  const staffName = data?.staffName;
  const payment = detail?.payments[0];
  const activeSeats = detail?.seats.filter((seat) => seat.active) ?? [];
  const payable = detail ? detail.status === 'confirmed' || detail.status === 'completed' : false;
  const declared = payment?.paidAmount;
  const mismatch = detail ? declared !== undefined && declared !== detail.finalAmount : false;
  const managerLike = user?.role === 'manager' || user?.role === 'admin';
  const canUndoCheckin = can('checkin.undo') && managerLike;

  useEffect(() => {
    if (detail) setNote(detail.note ?? '');
  }, [detail?.id]);

  function invalidateAll() {
    const keys: (string | number)[][] = [
      ['admin', 'order', bookingId],
      ['admin', 'orders'],
      ['admin', 'dashboard'],
      ['admin', 'receipts'],
      ['admin', 'refunds'],
      ['admin', 'badges'],
    ];
    for (const key of keys) void qc.invalidateQueries({ queryKey: key });
  }

  const approveMutation = useMutation({
    mutationFn: (allowMismatch: boolean) => approvePayment(bookingId, { allowMismatch }),
    onSuccess: (result) => {
      toast.success(result.idempotent ? 'Đơn đã được duyệt trước đó' : 'Đã duyệt biên lai', result.message);
      setApproveMismatchOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error('Không duyệt được biên lai', errorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectPayment(bookingId, rejectCode, rejectNote.trim()),
    onSuccess: () => {
      toast.success('Đã từ chối biên lai', 'Khách sẽ nhận thông báo và có thời gian gửi lại biên lai.');
      setRejectOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error('Không từ chối được biên lai', errorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelOrder(bookingId, reason, cancelWithRefund),
    onSuccess: (result) => {
      toast.success('Đã hủy đơn hàng', result.message);
      setCancelOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error('Không hủy được đơn hàng', errorMessage(error)),
  });

  const refundMutation = useMutation({
    mutationFn: () => createRefund({
      bookingId,
      scope: refundScope,
      seatIds: refundScope === 'partial' ? refundSeatIds : undefined,
      reason: refundReason.trim(),
    }),
    onSuccess: (refund) => {
      toast.success('Đã tạo yêu cầu hoàn tiền', `Mã ${refund.code} · ${money(refund.amount)}`);
      setRefundOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error('Không tạo được yêu cầu hoàn tiền', errorMessage(error)),
  });

  const seatsMutation = useMutation({
    mutationFn: () => changeOrderSeats(bookingId, newSeatIds, seatReason.trim()),
    onSuccess: (result) => {
      toast.success('Đã đổi ghế', `${result.message} Chênh lệch: ${money(result.difference)}.`);
      setSeatsOpen(false);
      invalidateAll();
    },
    onError: (error) => toast.error('Không đổi được ghế', errorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendTicketsEmail(detail?.code ?? ''),
    onSuccess: (result) => {
      toast.success('Đã gửi lại vé', result.message);
      invalidateAll();
    },
    onError: (error) => toast.error('Không gửi lại được vé', errorMessage(error)),
  });

  const undoMutation = useMutation({
    mutationFn: (input: { ticketId: number; reason: string }) => undoCheckin(input.ticketId, input.reason),
    onSuccess: (result) => {
      toast.success('Đã hoàn tác check-in', result.message);
      setUndoTicket(null);
      invalidateAll();
    },
    onError: (error) => toast.error('Không hoàn tác được check-in', errorMessage(error)),
  });

  const noteMutation = useMutation({
    mutationFn: () => addOrderNote(bookingId, note.trim()),
    onSuccess: (result) => {
      toast.success('Đã lưu ghi chú', result.message);
      void qc.invalidateQueries({ queryKey: ['admin', 'order', bookingId] });
    },
    onError: (error) => toast.error('Không lưu được ghi chú', errorMessage(error)),
  });

  function handleApprove() {
    if (!payment) return;
    if (mismatch) setApproveMismatchOpen(true);
    else approveMutation.mutate(false);
  }

  function openReject() {
    setRejectCode(rejectionReasons[0]);
    setRejectNote('');
    setRejectOpen(true);
  }

  function openCancel() {
    setCancelWithRefund(false);
    setCancelOpen(true);
  }

  function openRefund() {
    setRefundScope('full');
    setRefundSeatIds([]);
    setRefundReason('');
    setRefundOpen(true);
  }

  function openSeats() {
    setNewSeatIds([]);
    setSeatReason('');
    setSeatsOpen(true);
  }

  function toggleNewSeat(seatId: number) {
    setNewSeatIds((previous) => (
      previous.includes(seatId) ? previous.filter((value) => value !== seatId) : [...previous, seatId]
    ));
  }

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Chi tiết đơn hàng" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (orderQuery.isError || !data || !detail) {
    return (
      <div className="space-y-5">
        <PageHeader title="Chi tiết đơn hàng" />
        <ErrorState
          title="Không tải được đơn hàng"
          message={errorMessage(orderQuery.error)}
          onRetry={() => void orderQuery.refetch()}
        />
        <Link to="/admin/don-hang" className="text-xs font-semibold text-brand hover:underline">← Về danh sách đơn hàng</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<BackLink href="/admin/don-hang" label="Danh sách đơn hàng" />}
        title={`Đơn ${detail.code}`}
          description={`Tạo lúc ${formatDateTime(detail.createdAt)} · cập nhật ${formatDateTime(detail.updatedAt)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {payment?.status === 'proof_submitted' && detail.status === 'holding' && (
                <>
                  <Button
                    variant="success"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    loading={approveMutation.isPending}
                    disabled={!can('payment.review')}
                    title={can('payment.review') ? 'Duyệt biên lai' : 'Bạn không có quyền duyệt biên lai'}
                    onClick={handleApprove}
                  >
                    Duyệt biên lai
                  </Button>
                  <Button variant="danger" icon={<XCircle className="h-4 w-4" />} disabled={!can('payment.review')} onClick={openReject}>
                    Từ chối
                  </Button>
                </>
              )}
              {detail.status === 'confirmed' && (
                <Button
                  variant="secondary"
                  icon={<TicketIcon className="h-4 w-4" />}
                  disabled={!can('booking.change')}
                  title={can('booking.change') ? 'Đổi ghế cho khách' : 'Bạn không có quyền đổi ghế'}
                  onClick={openSeats}
                >
                  Đổi ghế
                </Button>
              )}
              {payable && (
                <>
                  <Button
                    variant="secondary"
                    icon={<Send className="h-4 w-4" />}
                    loading={resendMutation.isPending}
                    disabled={!can('booking.resend')}
                    onClick={() => resendMutation.mutate()}
                  >
                    Gửi lại vé
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<RotateCcw className="h-4 w-4" />}
                    disabled={!can('refund.request')}
                    title={can('refund.request') ? 'Tạo yêu cầu hoàn tiền' : 'Bạn không có quyền tạo hoàn tiền'}
                    onClick={openRefund}
                  >
                    Hoàn tiền
                  </Button>
                  <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                    In lại vé
                  </Button>
                </>
              )}
              {(detail.status === 'holding' || detail.status === 'confirmed' || detail.status === 'completed') && (
                <Button
                  variant="danger"
                  disabled={!can('booking.cancel')}
                  title={can('booking.cancel') ? 'Hủy đơn hàng' : 'Bạn không có quyền hủy đơn'}
                  onClick={openCancel}
                >
                  Hủy đơn
                </Button>
              )}
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" className="font-mono">{detail.code}</Badge>
          <StatusBadge status={detail.status} />
          {payment && <StatusBadge status={payment.status} />}
          <ChannelBadge channel={detail.channel} />
          {detail.voucherCode && <Badge tone="gold">Voucher {detail.voucherCode}</Badge>}
          {data.refundedAmount > 0 && <Badge tone="purple">Đã hoàn {money(data.refundedAmount)}</Badge>}
        </div>

      {detail.status === 'holding' && (
        <Notice
          tone={payment?.status === 'proof_submitted' ? 'warning' : 'info'}
          title={payment?.status === 'proof_submitted' ? 'Biên lai đang chờ duyệt' : 'Đơn đang giữ ghế'}
          action={<HoldCountdown expiresAt={detail.holdDeadline} serverTime={detail.serverTime} compact />}
        >
          {payment?.status === 'proof_submitted'
            ? 'Khách đã gửi biên lai. Duyệt trước hạn giữ ghế để không mất chỗ.'
            : payment?.status === 'rejected'
              ? 'Biên lai trước đó bị từ chối. Khách có thêm thời gian gửi lại.'
              : 'Đơn chưa thanh toán; ghế sẽ tự giải phóng khi hết thời gian giữ.'}
        </Notice>
      )}

      {mismatch && detail.status === 'holding' && (
        <Notice tone="danger" title="Số tiền khách khai báo không khớp">
          Cần thu <strong className="text-ink">{money(detail.finalAmount)}</strong> nhưng khách khai báo{' '}
          <strong className="text-ink">{money(declared)}</strong>. Kiểm tra kỹ biên lai trước khi duyệt.
        </Notice>
      )}

      {detail.status === 'cancelled' && (
        <Notice tone="danger" title="Đơn hàng đã bị hủy">
          {detail.cancelReason ?? 'Không có lý do được ghi lại.'}
        </Notice>
      )}

      {detail.status === 'expired' && (
        <Notice tone="info" title="Đơn đã hết hạn giữ ghế">
          Ghế đã được giải phóng. Không thể duyệt hoặc đổi ghế cho đơn này.
        </Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel title="Khách hàng" description="Thông tin liên hệ dùng để gửi vé và hỗ trợ.">
            <div className="flex flex-wrap items-start gap-3">
              <Avatar name={detail.customerName} seed={customer?.avatarSeed ?? detail.id} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{detail.customerName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {customer && <TierBadge tier={customer.tier} />}
                  {customer && <span>{number(customer.points)} điểm</span>}
                  {!customer && <Badge tone="outline">Khách vãng lai</Badge>}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <a href={`tel:${detail.customerPhone}`} className="flex items-center gap-2 rounded-lg border border-line/70 bg-base/40 px-3 py-2.5 text-sm text-ink2 transition hover:border-brand/40 hover:text-ink">
                <UserRound className="h-4 w-4 text-muted" /> {detail.customerPhone}
              </a>
              <a href={`mailto:${detail.customerEmail}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-line/70 bg-base/40 px-3 py-2.5 text-sm text-ink2 transition hover:border-brand/40 hover:text-ink">
                <Mail className="h-4 w-4 shrink-0 text-muted" /> <span className="truncate">{detail.customerEmail}</span>
              </a>
            </div>
            <div className="mt-3 divide-y divide-line/60">
              <InfoRow label="Kênh tạo đơn" value={<ChannelBadge channel={detail.channel} />} />
              {staffName && <InfoRow label="Nhân viên bán" value={staffName} />}
              {detail.shiftId && <InfoRow label="Mã ca" value={<span className="font-mono text-xs">{detail.shiftId}</span>} />}
              <InfoRow label="Ghi chú trên đơn" value={detail.note || '—'} />
            </div>
          </Panel>

          <Panel title="Suất chiếu" description={`${detail.cinema.name} · ${detail.room.name}`}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative mx-auto aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-card border border-line/70 sm:mx-0">
                <PosterArt movie={detail.movie} showTitle={false} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink">{detail.movie.title}</h3>
                  <AgeBadge age={detail.movie.age} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{detail.movie.tagline}</p>
                <div className="mt-3 divide-y divide-line/60">
                  <InfoRow
                    label="Ngày chiếu"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-brand" /> {formatDate(detail.showtime.showDate)}
                      </span>
                    }
                  />
                  <InfoRow label="Giờ chiếu" value={<span className="font-mono">{detail.showtime.startTime} – {detail.showtime.endTime}</span>} />
                  <InfoRow label="Định dạng" value={detail.showtime.format} />
                  <InfoRow label="Phòng" value={detail.room.name} />
                  <InfoRow
                    label="Rạp"
                    value={<span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted" />{detail.cinema.name}</span>}
                  />
                  <InfoRow label="Thời lượng" value={`${detail.movie.duration} phút`} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Ghế & bắp nước" description={`${activeSeats.length} ghế đang hoạt động`}>
            <div className="flex flex-wrap gap-2">
              {detail.seats.map((seat) => (
                <div
                  key={seat.seatId}
                  className={cn(
                    'rounded-lg border px-2.5 py-2 text-xs',
                    seat.active ? 'border-line bg-base/50' : 'border-line/50 bg-base/20 opacity-55',
                  )}
                >
                  <p className={cn('font-mono font-semibold', seat.active ? 'text-ink' : 'text-muted line-through')}>{seat.code}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {SEAT_TYPE_LABEL[seat.type]} · {money(seat.price)}
                  </p>
                  {!seat.active && <p className="mt-0.5 text-[10px] font-semibold text-danger">Không còn hiệu lực</p>}
                </div>
              ))}
            </div>
            {detail.combos.length > 0 && (
              <div className="mt-4 border-t border-line/60 pt-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Bắp nước</p>
                <ul className="space-y-1.5">
                  {detail.combos.map((combo) => (
                    <li key={combo.comboId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink2">{combo.name} <span className="text-muted">×{combo.quantity}</span></span>
                      <span className="text-money font-medium text-ink">{money(combo.price * combo.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.comboPickedUpAt && (
              <p className="mt-3 text-xs text-success">Đã nhận bắp nước lúc {formatDateTime(detail.comboPickedUpAt)}.</p>
            )}
          </Panel>

          <Panel title="Thanh toán" description={`${detail.payments.length} giao dịch ghi nhận cho đơn này.`}>
            {detail.payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Chưa có giao dịch thanh toán.</p>
            ) : (
              <ul className="space-y-3">
                {detail.payments.map((item) => (
                  <li key={item.id} className="rounded-card border border-line/70 bg-base/35 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PaymentMethodBadge method={item.method} />
                        <StatusBadge status={item.status} />
                        <Badge tone="outline">{item.provider}</Badge>
                      </div>
                      <span className="text-money font-semibold text-ink">{money(item.amount)}</span>
                    </div>
                    <div className="mt-2 grid gap-x-4 gap-y-1 text-[11px] text-muted sm:grid-cols-2">
                      <p>Tạo: {formatDateTime(item.createdAt)}</p>
                      <p>Gửi biên lai: {formatDateTime(item.submittedAt)}</p>
                      <p>Duyệt lúc: {formatDateTime(item.reviewedAt)}</p>
                      <p>Nội dung: <span className="font-mono text-ink2">{item.transferContent}</span></p>
                      {item.paidAt && <p>Đã thanh toán: {formatDateTime(item.paidAt)}</p>}
                      {item.reference && <p>Mã giao dịch: <span className="font-mono text-ink2">{item.reference}</span></p>}
                    </div>
                    {item.paidAmount !== undefined && item.paidAmount !== detail.finalAmount && (
                      <p className="mt-2 rounded-md border border-warning/30 bg-warning/5 px-2 py-1 text-[11px] font-medium text-warning">
                        Khách khai báo {money(item.paidAmount)} — lệch so với số tiền cần thu {money(detail.finalAmount)}.
                      </p>
                    )}
                    {item.rejectNote && (
                      <p className="mt-2 rounded-md border border-danger/30 bg-danger/5 px-2 py-1 text-[11px] text-danger">
                        Từ chối: {item.rejectNote} {item.rejectReasonCode ? `(${REJECT_REASON_LABEL[item.rejectReasonCode] ?? item.rejectReasonCode})` : ''}
                      </p>
                    )}
                    {item.proofUrl && (
                      <button
                        type="button"
                        onClick={() => setProofUrl(item.proofUrl ?? null)}
                        className="mt-2 flex items-center gap-2 rounded-lg border border-line/70 bg-surface/60 p-1.5 text-left transition hover:border-brand/40"
                      >
                        <img src={item.proofUrl} alt={`Biên lai giao dịch ${item.id}`} className="h-16 w-12 rounded object-cover" />
                        <span className="text-[11px] font-semibold text-brand">Xem ảnh biên lai</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Vé điện tử" description="Mỗi ghế phát hành một vé QR riêng.">
            {detail.tickets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Đơn chưa phát hành vé.</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {detail.tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-card border border-line/70 bg-base/35 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-brand">{ticket.code}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">Ghế {ticket.seatCode}</p>
                    {ticket.checkedInAt && (
                      <p className="mt-1 text-[11px] text-muted">
                        Check-in {formatDateTime(ticket.checkedInAt)}{ticket.checkedInBy ? ` · ${ticket.checkedInBy}` : ''}
                      </p>
                    )}
                    {ticket.status === 'used' && canUndoCheckin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        icon={<Undo2 className="h-3.5 w-3.5" />}
                        onClick={() => setUndoTicket(ticket)}
                      >
                        Hoàn tác check-in
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!canUndoCheckin && detail.tickets.some((ticket) => ticket.status === 'used') && (
              <p className="mt-3 text-[11px] text-muted">Hoàn tác check-in chỉ dành cho quản lý hoặc quản trị viên có quyền.</p>
            )}
          </Panel>

          <Panel title="Dòng thời gian" description="Các mốc xử lý của đơn hàng.">
            {data.timeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Chưa có sự kiện.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line/70 pl-5">
                {data.timeline.map((event, index) => (
                  <li key={`${event.at}-${index}`} className="relative">
                    <span className={cn('absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface', TIMELINE_DOT[event.tone])} aria-hidden />
                    <p className="text-xs font-semibold text-ink">{event.label}</p>
                    {event.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{event.detail}</p>}
                    <p className="mt-0.5 text-[10px] text-muted/80">{formatDateTime(event.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Tóm tắt đơn" description="Số liệu do hệ thống tính, không chỉnh sửa trực tiếp.">
            <PriceBreakdown
              totals={{
                ticketsSubtotal: detail.ticketsSubtotal,
                combosSubtotal: detail.combosSubtotal,
                discount: detail.discount,
                pointsDiscount: detail.pointsDiscount,
                taxAmount: detail.taxAmount,
                finalAmount: detail.finalAmount,
              }}
              vatPercent={settingsQuery.data?.vatPercent ?? 8}
            />
            <div className="mt-4">
              <CopyField label="Mã đơn" value={detail.code} />
            </div>
            <div className="mt-4 divide-y divide-line/60 border-t border-line/60">
              <InfoRow label="Trạng thái" value={<StatusBadge status={detail.status} />} />
              <InfoRow label="Thanh toán" value={payment ? <StatusBadge status={payment.status} /> : <span className="text-muted">Chưa có</span>} />
              <InfoRow label="Phương thức" value={payment ? paymentMethodLabel(payment.method) : '—'} />
              <InfoRow label="Đã hoàn" value={<span className={data.refundedAmount > 0 ? 'text-danger' : ''}>{money(data.refundedAmount)}</span>} />
              <InfoRow label="Voucher" value={detail.voucherCode ?? '—'} />
              <InfoRow label="Điểm sử dụng" value={number(detail.pointsUsed)} />
              <InfoRow label="Giữ ghế đến" value={detail.holdExpiresAt ? formatDateTime(detail.holdExpiresAt) : '—'} />
            </div>
          </Panel>

          <Panel title="Ghi chú nội bộ" description="Chỉ nhân viên quản trị nhìn thấy ghi chú này.">
            <Field label="Ghi chú" htmlFor="order-note" hint="Tối đa nên dùng cho thông tin xử lý, không chứa dữ liệu nhạy cảm.">
              <Textarea
                id="order-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Khách gọi xác nhận đổi ghế, đã báo quản lý…"
                maxLength={2000}
              />
            </Field>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted">{note.length}/2000 ký tự</span>
              <Button
                size="sm"
                variant="secondary"
                loading={noteMutation.isPending}
                disabled={note === (detail.note ?? '')}
                onClick={() => noteMutation.mutate()}
              >
                Lưu ghi chú
              </Button>
            </div>
          </Panel>

          <Card className="p-4">
            <p className="font-display text-base font-semibold uppercase tracking-wide text-ink">Quy trình xử lý</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li className="flex gap-2"><CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> Duyệt biên lai chỉ khi số tiền và nội dung chuyển khoản khớp.</li>
              <li className="flex gap-2"><Clapperboard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> Đổi ghế tối thiểu 30 phút trước giờ chiếu và cần lý do.</li>
              <li className="flex gap-2"><RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> Mọi thao tác đều được ghi vào nhật ký hệ thống.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={approveMismatchOpen}
        onClose={() => setApproveMismatchOpen(false)}
        onConfirm={() => approveMutation.mutate(true)}
        title="Xác nhận duyệt lệch tiền"
        danger
        confirmText="Vẫn duyệt"
        loading={approveMutation.isPending}
        description={
          <div className="space-y-2">
            <p>Khách khai báo <strong className="text-ink">{money(declared)}</strong> nhưng đơn cần thu <strong className="text-ink">{money(detail.finalAmount)}</strong>.</p>
            <p className="text-xs text-muted">Chỉ duyệt khi đã đối chiếu sao kê ngân hàng và xác nhận với khách. Thao tác được ghi nhật ký.</p>
          </div>
        }
      />

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Từ chối biên lai"
        description={`Đơn ${detail.code} · khách ${detail.customerName}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Hủy</Button>
            <Button variant="danger" loading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              Từ chối biên lai
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Lý do từ chối" htmlFor="reject-reason" required>
            <Select id="reject-reason" value={rejectCode} onChange={(event) => setRejectCode(event.target.value)}>
              {rejectionReasons.map((reason) => (
                <option key={reason} value={reason}>{REJECT_REASON_LABEL[reason] ?? reason}</option>
              ))}
            </Select>
          </Field>
          <Field label="Ghi chú gửi khách" htmlFor="reject-note" hint="Nêu rõ vấn đề để khách gửi lại biên lai đúng.">
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Ví dụ: Số tiền chuyển thấp hơn giá trị đơn 85.000đ…"
            />
          </Field>
          <Notice tone="warning">
            Từ chối sẽ mở lại thời gian giữ ghế cho khách (tối đa 15 phút, không vượt quá giờ chiếu).
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => cancelMutation.mutate(reason)}
        title="Hủy đơn hàng"
        danger
        requireReason
        confirmText="Hủy đơn"
        loading={cancelMutation.isPending}
        description={`Đơn ${detail.code} sẽ bị hủy, ghế được giải phóng và vé bị vô hiệu.`}
        extraField={
          <Checkbox
            checked={cancelWithRefund}
            onChange={(event) => setCancelWithRefund(event.target.checked)}
            disabled={!payable}
            label={payable
              ? 'Tạo yêu cầu hoàn tiền toàn phần sau khi hủy'
              : 'Đơn chưa thanh toán nên không thể tạo hoàn tiền'}
          />
        }
      />

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Tạo yêu cầu hoàn tiền"
        description={`Đơn ${detail.code} · ${detail.customerName}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRefundOpen(false)}>Hủy</Button>
            <Button
              variant="primary"
              loading={refundMutation.isPending}
              disabled={refundReason.trim().length < 5 || (refundScope === 'partial' && refundSeatIds.length === 0)}
              onClick={() => refundMutation.mutate()}
            >
              Tạo yêu cầu
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-card border border-line/70 bg-base/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-semibold text-brand">{detail.code}</p>
                <p className="mt-0.5 text-sm text-ink">{detail.movie.title}</p>
                <p className="text-[11px] text-muted">{formatDate(detail.showtime.showDate)} · {detail.showtime.startTime} · {detail.room.name}</p>
              </div>
              <span className="text-money text-base font-semibold text-ink">{money(detail.finalAmount)}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {activeSeats.length} ghế đang hoạt động · {formatDateTime(detail.createdAt)}
            </p>
          </div>
          <Field label="Phạm vi hoàn" htmlFor="refund-scope" required>
            <Select id="refund-scope" value={refundScope} onChange={(event) => setRefundScope(event.target.value as 'full' | 'partial')}>
              <option value="full">Toàn phần — {money(detail.finalAmount)}</option>
              <option value="partial">Một phần — chọn từng ghế</option>
            </Select>
          </Field>
          {refundScope === 'partial' && (
            <div>
              <p className="label">Ghế cần hoàn <span className="text-brand">*</span></p>
              {activeSeats.length === 0 ? (
                <p className="text-xs text-muted">Không còn ghế đang hoạt động để hoàn.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeSeats.map((seat) => (
                    <label
                      key={seat.seatId}
                      className={cn(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition',
                        refundSeatIds.includes(seat.seatId) ? 'border-brand/60 bg-brand/10 text-ink' : 'border-line bg-base/40 text-ink2',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-line bg-base text-brand"
                          checked={refundSeatIds.includes(seat.seatId)}
                          onChange={(event) => {
                            setRefundSeatIds((previous) => (
                              event.target.checked
                                ? [...previous, seat.seatId]
                                : previous.filter((value) => value !== seat.seatId)
                            ));
                          }}
                        />
                        <span className="font-mono font-semibold">{seat.code}</span>
                        <span className="text-[10px] text-muted">{SEAT_TYPE_LABEL[seat.type]}</span>
                      </span>
                      <span className="text-money text-xs text-ink">{money(seat.price)}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">Số tiền hoàn do hệ thống tính theo ghế và dữ liệu thanh toán của đơn.</p>
            </div>
          )}
          <Field label="Lý do hoàn tiền" htmlFor="refund-reason" required hint="Tối thiểu 5 ký tự, lưu cùng yêu cầu hoàn.">
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              placeholder="Ví dụ: Khách báo trùng lịch, yêu cầu hoàn theo chính sách…"
            />
          </Field>
          <Notice tone="info" title="Yêu cầu chỉ được tạo, chưa hoàn tiền ngay">
            Yêu cầu sẽ chuyển sang trạng thái chờ duyệt tại trang Hoàn tiền. Quản lý duyệt và nhập mã giao dịch sau khi chuyển khoản.
          </Notice>
        </div>
      </Modal>

      <Modal
        open={seatsOpen}
        onClose={() => setSeatsOpen(false)}
        title="Đổi ghế"
        description={`Đơn ${detail.code} · ${detail.movie.title}`}
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">Ghế hiện tại được đánh dấu viền đỏ. Chọn ghế mới còn trống.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSeatsOpen(false)}>Hủy</Button>
              <Button
                variant="primary"
                loading={seatsMutation.isPending}
                disabled={newSeatIds.length === 0 || seatReason.trim().length < 5}
                onClick={() => seatsMutation.mutate()}
              >
                Xác nhận đổi ghế
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Notice tone="warning">
            Toàn bộ ghế hiện tại sẽ được giải phóng và thay bằng các ghế bạn chọn. Hệ thống tính lại tiền vé theo giá ghế mới và có thể phát sinh chênh lệch. Chỉ áp dụng trước giờ chiếu tối thiểu 30 phút.
          </Notice>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Đã chọn <strong className="text-brand">{newSeatIds.length}</strong> ghế mới · hiện tại {activeSeats.length} ghế</span>
            <SeatLegend />
          </div>
          {seatMapQuery.isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : seatMapQuery.isError ? (
            <ErrorState
              title="Không tải được sơ đồ ghế"
              message={errorMessage(seatMapQuery.error)}
              onRetry={() => void seatMapQuery.refetch()}
            />
          ) : seatMapQuery.data ? (
            <div className="rounded-card border border-line/70 bg-base/30 p-3">
              <ScreenBar label={detail.room.name} />
              <SeatMap
                seats={seatMapQuery.data.seats}
                selectedIds={newSeatIds}
                maxSeats={seatMapQuery.data.maxSeats}
                highlightIds={activeSeats.map((seat) => seat.seatId)}
                onToggle={(seat) => toggleNewSeat(seat.id)}
              />
            </div>
          ) : null}
          {newSeatIds.length > 0 && seatMapQuery.data && (
            <div className="flex flex-wrap gap-1.5">
              {seatMapQuery.data.seats
                .filter((seat) => newSeatIds.includes(seat.id))
                .map((seat) => (
                  <Badge key={seat.id} tone="info" className="font-mono">
                    {seat.code} · {money(seat.price ?? 0)}
                  </Badge>
                ))}
            </div>
          )}
          <Field label="Lý do đổi ghế" htmlFor="seat-reason" required hint="Tối thiểu 5 ký tự, lưu vào nhật ký.">
            <Textarea
              id="seat-reason"
              value={seatReason}
              onChange={(event) => setSeatReason(event.target.value)}
              placeholder="Ví dụ: Khách đổi sang ghế gần lối đi…"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(undoTicket)}
        onClose={() => setUndoTicket(null)}
        onConfirm={(reason) => {
          if (undoTicket) undoMutation.mutate({ ticketId: undoTicket.id, reason });
        }}
        title="Hoàn tác check-in"
        danger
        requireReason
        confirmText="Hoàn tác"
        loading={undoMutation.isPending}
        description={undoTicket
          ? `Vé ${undoTicket.code} · ghế ${undoTicket.seatCode} sẽ trở lại trạng thái chưa sử dụng để soát lại.`
          : undefined}
      />

      <Modal open={Boolean(proofUrl)} onClose={() => setProofUrl(null)} title="Ảnh biên lai" size="lg">
        {proofUrl && <img src={proofUrl} alt="Ảnh biên lai chuyển khoản" className="mx-auto max-h-[70vh] w-auto rounded-lg border border-line" />}
      </Modal>
    </div>
  );
}
