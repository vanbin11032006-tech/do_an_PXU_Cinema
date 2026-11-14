import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, Headphones, Info, QrCode, RefreshCw, ShieldCheck, TimerReset, ArrowLeft,
} from 'lucide-react';
import { formatDate, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { cancelHolding, completePayment, extendHold, getPaymentInfo } from '@/api';
import {
  Accordion, Badge, Button, Card, ConfirmDialog, CopyField, ErrorState, Modal, QRImage, Skeleton,
  StatusBadge, toast, useCountdown,
} from '@/components/ui';

export default function PaymentPage() {
  const { bookingCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [zoomOpen, setZoomOpen] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const paymentQuery = useQuery({
    queryKey: ['payment', bookingCode],
    queryFn: () => getPaymentInfo(bookingCode!),
    enabled: Boolean(bookingCode),
    refetchInterval: 5_000,
    retry: false,
  });
  const info = paymentQuery.data;

  const countdown = useCountdown(info?.deadline, info?.serverTime);

  useEffect(() => {
    if (!info) return;
    if (info.status === 'paid' || info.booking.status === 'confirmed' || info.booking.status === 'completed') {
      navigate(`/ve/${info.booking.code}`, { replace: true });
    }
  }, [info, navigate]);

  const { refetch: refetchPayment } = paymentQuery;

  useEffect(() => {
    if (!countdown.expired) return;
    void refetchPayment();
    void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] });
  }, [countdown.expired, refetchPayment, queryClient, bookingCode]);

  const payMutation = useMutation({
    mutationFn: () => completePayment(bookingCode!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['payment', bookingCode], updated);
      void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] });
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Thanh toán thành công', 'Vé điện tử của bạn đã sẵn sàng.');
      navigate(`/ve/${updated.booking.code}`, { replace: true });
    },
    onError: (error: unknown) => {
      toast.error('Chưa thể xác nhận thanh toán', errorMessage(error));
      void paymentQuery.refetch();
    },
  });

  const extendMutation = useMutation({
    mutationFn: () => extendHold(bookingCode!),
    onSuccess: () => {
      toast.success('Đã gia hạn giữ ghế thêm 5 phút');
      void paymentQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] });
    },
    onError: (error: unknown) => toast.warning('Không thể gia hạn', errorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelHolding(bookingCode!),
    onSuccess: () => {
      toast.success('Đã hủy đơn giữ ghế');
      queryClient.removeQueries({ queryKey: ['booking', bookingCode] });
      navigate(`/dat-ve/${info!.booking.showtime.id}/ghe`, { replace: true });
    },
    onError: (error: unknown) => toast.error('Không thể hủy đơn', errorMessage(error)),
  });

  if (paymentQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    );
  }
  if (paymentQuery.isError || !info) {
    return <ErrorState message={errorMessage(paymentQuery.error)} onRetry={() => void paymentQuery.refetch()} />;
  }

  const booking = info.booking;
  const expired = booking.status === 'expired' || info.status === 'expired' || booking.status === 'cancelled' || info.status === 'cancelled';
  const canCancel = booking.status === 'holding';

  if (expired) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-muted"><TimerReset className="h-7 w-7" /></div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">Đơn đã hết hạn</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Thời gian giữ ghế cho đơn <strong className="text-ink">{booking.code}</strong> đã kết thúc. Ghế đã được nhả cho khách khác.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate(`/dat-ve/${booking.showtime.id}/ghe`)}>Chọn lại ghế</Button>
          <Link to="/"><Button variant="secondary">Về trang chủ</Button></Link>
        </div>
        <p className="mt-4 text-xs text-muted">Nếu bạn đã chuyển khoản, vui lòng liên hệ <strong className="text-ink">1900 6363</strong> kèm mã đơn để được hỗ trợ.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-6">
      <div className="mb-5 text-center">
        <p className="eyebrow mb-1">Bước 4 · Thanh toán</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink sm:text-3xl">Quét QR & nhận vé ngay</h1>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">Mở app ngân hàng, quét mã bên dưới và chuyển đúng số tiền. Vé điện tử phát hành ngay khi bạn xác nhận.</p>
      </div>

      <Card className="mb-3">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"><TimerReset className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Ghế được giữ trong</p>
              <p className={cnCountdown(countdown.critical)}>{countdown.text}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">Mã đơn {booking.code}</Badge>
            <StatusBadge status={info.status} />
          </div>
        </div>
        {booking.status === 'holding' && !booking.holdExtended && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-4 py-2.5">
            <p className="text-[11px] text-muted">Cần thêm thời gian? Bạn chỉ được gia hạn một lần.</p>
            <Button size="sm" variant="secondary" onClick={() => extendMutation.mutate()} loading={extendMutation.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />}>Gia hạn +5′</Button>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl border border-line/60 bg-base/40 p-3">
            {info.useCustomQr && info.qrImageUrl ? (
              <button type="button" onClick={() => setZoomOpen(true)} className="rounded-xl bg-white p-2" aria-label="Phóng to ảnh QR">
                <img src={info.qrImageUrl} alt="QR chuyển khoản của rạp" className="h-60 w-60 object-contain sm:h-72 sm:w-72" />
              </button>
            ) : info.qrImageUrl && !qrFailed ? (
              <button type="button" onClick={() => setZoomOpen(true)} className="rounded-xl bg-white p-2" aria-label="Phóng to mã VietQR">
                <img
                  src={info.qrImageUrl}
                  alt={`Mã VietQR chuyển ${money(info.amount)} tới ${info.bank.accountNumber}`}
                  className="h-60 w-60 object-contain sm:h-72 sm:w-72"
                  loading="eager"
                  onError={() => setQrFailed(true)}
                />
              </button>
            ) : (
              <QRImage value={info.qrValue} size={260} label="Quét bằng app ngân hàng" fileName={`pxu-${booking.code}`} />
            )}
          </div>
          <button type="button" onClick={() => setZoomOpen(true)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted hover:text-brand"><QrCode className="h-3 w-3" /> Phóng to QR</button>

          <p className="eyebrow mt-5">Số tiền cần chuyển</p>
          <p className="text-money mt-1 text-3xl font-bold tracking-tight text-brand sm:text-4xl">{money(info.amount)}</p>
          <p className="mt-1 text-[11px] text-muted">Nội dung: <span className="font-mono font-semibold text-ink2">{info.transferContent}</span></p>

          <Button
            full
            size="lg"
            variant="success"
            className="mt-5 h-14 text-base"
            loading={payMutation.isPending}
            onClick={() => payMutation.mutate()}
            icon={<CheckCircle2 className="h-5 w-5" />}
          >
            Thanh toán thành công
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] leading-relaxed text-muted">
            <Info className="h-3 w-3 shrink-0" /> Bấm sau khi đã chuyển khoản. Hệ thống phát hành vé ngay, không cần chờ duyệt.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <CopyField label="Ngân hàng" value={info.bank.name} />
            <CopyField label="Số tài khoản" value={info.bank.accountNumber} />
          </div>
          <CopyField label="Chủ tài khoản" value={info.bank.accountName} />
          <CopyField label="Nội dung chuyển khoản" value={info.transferContent} emphasis />
        </div>

        <div className="mt-3">
          <Accordion
            items={[{
              id: 'guide',
              title: 'Hướng dẫn thanh toán',
              content: (
                <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-ink2">
                  <li>Mở ứng dụng ngân hàng và quét mã QR ở trên.</li>
                  <li>Giữ nguyên nội dung <strong className="text-ink">{info.transferContent}</strong> để hệ thống khớp đơn.</li>
                  <li>Chuyển đúng <strong className="text-ink">{money(info.amount)}</strong>, sau đó bấm “Thanh toán thành công” để nhận vé.</li>
                </ol>
              ),
            }]}
          />
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Đơn hàng</p>
          <Link to={`/dat-ve/${booking.code}/xac-nhan`} className="text-[11px] text-brand hover:underline">Xem chi tiết đơn</Link>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{booking.movie.title}</p>
            <p className="mt-0.5 text-[11px] text-muted">{formatDate(booking.showtime.showDate)} · {booking.showtime.startTime} · {booking.cinema.name} · {booking.room.name}</p>
            <p className="mt-0.5 text-[11px] text-muted">Ghế {booking.seats.map((s) => s.code).join(', ')}</p>
            {booking.combos.length > 0 && (
              <p className="mt-0.5 text-[11px] text-muted">Combo: {booking.combos.map((c) => `${c.name} ×${c.quantity}`).join(', ')}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">Tổng tiền</p>
            <p className="text-money text-lg font-bold text-brand">{money(info.amount)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/60 pt-3 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted"><ShieldCheck className="h-3.5 w-3.5 text-success" /> Vé xuất trình QR tại cửa phòng chiếu</span>
          {canCancel && <button type="button" onClick={() => setCancelOpen(true)} className="ml-auto text-muted hover:text-danger">Hủy đơn & chọn lại ghế</button>}
        </div>
      </Card>

      <Card className="mt-3 p-4">
        <div className="flex items-start gap-2 text-xs text-ink2">
          <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="font-semibold text-ink">Cần hỗ trợ?</p>
            <p className="mt-0.5 text-[11px] text-muted">Hotline <a href="tel:19006363" className="text-brand">1900 6363</a> · 8:00–23:00 · Mã đơn <strong className="text-ink">{booking.code}</strong></p>
          </div>
        </div>
      </Card>

      <button type="button" onClick={() => navigate(-1)} className="mt-4 inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" /> Quay lại</button>

      <Modal open={zoomOpen} onClose={() => setZoomOpen(false)} title="Mã QR chuyển khoản" size="md">
        <div className="flex flex-col items-center gap-3">
          {info.qrImageUrl && !qrFailed ? (
            <img src={info.qrImageUrl} alt="Mã QR chuyển khoản" className="w-full max-w-sm rounded-lg bg-white object-contain p-3" />
          ) : (
            <QRImage value={info.qrValue} size={280} fileName={`pxu-${booking.code}`} />
          )}
          <div className="w-full space-y-2">
            <CopyField label="Số tiền" value={`${info.amount}`} emphasis />
            <CopyField label="Nội dung" value={info.transferContent} emphasis />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Hủy đơn giữ ghế?"
        description="Ghế sẽ được nhả ngay. Nếu bạn đã chuyển khoản, giao dịch sẽ được xử lý thủ công bởi bộ phận hỗ trợ."
        confirmText="Hủy đơn"
        danger
        loading={cancelMutation.isPending}
      />
    </div>
  );
}

function cnCountdown(critical: boolean): string {
  return `text-money text-2xl font-bold tabular-nums ${critical ? 'text-warning' : 'text-ink'}`;
}
