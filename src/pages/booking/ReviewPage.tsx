import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BadgePercent, CheckCircle2, Mail, Phone, ShieldCheck, Sparkles, Tag, User, X } from 'lucide-react';
import type { BookingDetail } from '@/types/domain';
import { ApiError } from '@/types/domain';
import { money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import {
  applyVoucher, confirmBooking, getBooking, listAvailableVouchers, redeemPoints, removeVoucher, updateContact,
} from '@/api';
import { useAuthStore } from '@/store/auth';
import {
  Badge, Button, Card, Checkbox, ErrorState, Field, HoldCountdown, Input, PriceBreakdown,
  SectionHeading, Skeleton, Switch, toast,
} from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';

interface ContactState { name: string; email: string; phone: string }

function validateContact(contact: ContactState): Partial<Record<keyof ContactState, string>> {
  const errors: Partial<Record<keyof ContactState, string>> = {};
  if (!contact.name.trim()) errors.name = 'Vui lòng nhập họ tên';
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(contact.email.trim())) errors.email = 'Email không hợp lệ';
  if (!/^(0|\+84)\d{9}$/.test(contact.phone.replace(/\s/g, ''))) errors.phone = 'Số điện thoại không hợp lệ';
  return errors;
}

export default function ReviewPage() {
  const { bookingCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [contact, setContact] = useState<ContactState>({ name: '', email: '', phone: '' });
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [pointsOn, setPointsOn] = useState(false);
  const [touched, setTouched] = useState(false);
  const initialized = useRef(false);

  const bookingQuery = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: () => getBooking(bookingCode!),
    enabled: Boolean(bookingCode),
    retry: false,
  });
  const vouchersQuery = useQuery({ queryKey: ['vouchers', 'available'], queryFn: listAvailableVouchers, staleTime: 120_000 });
  const booking = bookingQuery.data;

  useEffect(() => {
    if (!booking || initialized.current) return;
    initialized.current = true;
    setContact({ name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone });
    setVoucherInput(booking.voucherCode ?? '');
  }, [booking]);

  useEffect(() => {
    if (!booking) return;
    const payment = booking.payments[0];
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      navigate(`/ve/${booking.code}`, { replace: true });
    } else if (booking.status !== 'holding') {
      navigate(`/phim/${booking.movie.slug}#lich-chieu`, { replace: true });
    } else if (payment && ['pending', 'proof_submitted', 'rejected'].includes(payment.status)) {
      navigate(`/thanh-toan/${booking.code}`, { replace: true });
    }
  }, [booking, navigate]);

  const voucherMutation = useMutation({
    mutationFn: (code: string) => applyVoucher(bookingCode!, code),
    onSuccess: (updated) => {
      setVoucherInput(updated.voucherCode ?? '');
      setVoucherError(null);
      queryClient.setQueryData(['booking', bookingCode], updated);
      toast.success('Đã áp dụng voucher', `Giảm ${money(updated.discount)} cho đơn hàng.`);
    },
    onError: (error: unknown) => {
      setVoucherError(errorMessage(error));
      if (error instanceof ApiError) toast.error('Voucher không hợp lệ', error.message);
    },
  });

  const removeVoucherMutation = useMutation({
    mutationFn: () => removeVoucher(bookingCode!),
    onSuccess: (updated) => {
      setVoucherInput('');
      setVoucherError(null);
      queryClient.setQueryData(['booking', bookingCode], updated);
      toast.info('Đã gỡ voucher');
    },
    onError: (error: unknown) => toast.error('Không thể gỡ voucher', errorMessage(error)),
  });

  const pointsMutation = useMutation({
    mutationFn: (points: number) => redeemPoints(bookingCode!, points),
    onSuccess: (updated) => queryClient.setQueryData(['booking', bookingCode], updated),
    onError: (error: unknown) => {
      setPointsOn(false);
      toast.error('Không thể dùng điểm', errorMessage(error));
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      await updateContact(bookingCode!, contact);
      return confirmBooking(bookingCode!);
    },
    onSuccess: (updated: BookingDetail) => {
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      if (updated.finalAmount === 0) {
        toast.success('Đặt vé thành công', 'Đơn 0đ đã được xác nhận, vé điện tử đã phát hành.');
        navigate(`/ve/${updated.code}`, { replace: true });
      } else {
        navigate(`/thanh-toan/${updated.code}`);
      }
    },
    onError: (error: unknown) => toast.error('Không thể chốt đơn', errorMessage(error)),
  });

  if (bookingQuery.isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-48" /><Skeleton className="h-40" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (bookingQuery.isError || !booking) {
    return <ErrorState message={errorMessage(bookingQuery.error)} onRetry={() => void bookingQuery.refetch()} />;
  }

  const errors = validateContact(contact);
  const contactValid = Object.keys(errors).length === 0;
  const afterVoucher = Math.max(0, booking.ticketsSubtotal + booking.combosSubtotal - booking.discount);
  const maxPointsDiscount = Math.floor(afterVoucher * 0.2);
  const maxUsefulPoints = Math.min(user?.points ?? 0, Math.floor(maxPointsDiscount / 1000));
  const canPay = contactValid && terms && !payMutation.isPending;

  function applyCode(code: string) {
    if (!code.trim()) {
      setVoucherError('Vui lòng nhập mã giảm giá.');
      return;
    }
    voucherMutation.mutate(code.trim().toUpperCase());
  }

  function togglePoints(next: boolean) {
    setPointsOn(next);
    pointsMutation.mutate(next ? maxUsefulPoints : 0);
  }

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-5">
        <p className="eyebrow mb-1">Bước 3 · Xác nhận</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">Xem lại và hoàn tất đơn</h1>
        <p className="mt-1 text-xs text-muted">Kiểm tra kỹ thông tin trước khi thanh toán. Ghế chỉ được giữ đến khi hết thời gian đếm ngược.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="h-32 w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
                <PosterArt movie={booking.movie} variant="poster" showTitle={false} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">{booking.movie.title}</h2>
                  <Badge tone="outline">{booking.showtime.format}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink2">{booking.cinema.name} · {booking.room.name}</p>
                <p className="mt-0.5 text-xs text-muted">{booking.showtime.showDate.split('-').reverse().join('/')} · {booking.showtime.startTime} – {booking.showtime.endTime}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="info">Ghế {booking.seats.map((s) => s.code).join(', ')}</Badge>
                  {booking.combos.length > 0 && <Badge tone="warning">{booking.combos.reduce((sum, c) => sum + c.quantity, 0)} combo</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                  <Link to={`/dat-ve/${booking.showtime.id}/ghe`} className="text-brand hover:underline">Đổi ghế</Link>
                  <Link to={`/dat-ve/${booking.code}/bap-nuoc`} className="text-brand hover:underline">Đổi combo</Link>
                </div>
              </div>
              <HoldCountdown expiresAt={booking.holdDeadline} serverTime={booking.serverTime} onExpire={() => void bookingQuery.refetch()} />
            </div>

            <div className="border-t border-line/70 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Ghế đã chọn</p>
                  <div className="space-y-1 text-xs">
                    {booking.seats.map((seat) => (
                      <div key={seat.seatId} className="flex justify-between text-ink2">
                        <span>Ghế {seat.code} · {seat.type === 'couple' ? 'Đôi' : seat.type === 'vip' ? 'VIP' : 'Thường'}</span>
                        <span className="text-money">{money(seat.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Bắp nước</p>
                  {booking.combos.length ? (
                    <div className="space-y-1 text-xs">
                      {booking.combos.map((combo) => (
                        <div key={combo.comboId} className="flex justify-between text-ink2">
                          <span>{combo.quantity}× {combo.name}</span>
                          <span className="text-money">{money(combo.price * combo.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted">Không kèm combo.</p>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="border-b border-line/70 p-4">
              <SectionHeading eyebrow="Thông tin liên hệ" title="Người nhận vé" className="mb-0" description="Vé điện tử và thông báo sẽ gửi tới email/SĐT này." />
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Họ và tên" htmlFor="contact-name" required error={touched ? errors.name : undefined}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input id="contact-name" className="pl-9" value={contact.name} onBlur={() => setTouched(true)} onChange={(e) => setContact({ ...contact, name: e.target.value })} autoComplete="name" />
                </div>
              </Field>
              <Field label="Số điện thoại" htmlFor="contact-phone" required error={touched ? errors.phone : undefined}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input id="contact-phone" className="pl-9" value={contact.phone} onBlur={() => setTouched(true)} onChange={(e) => setContact({ ...contact, phone: e.target.value })} inputMode="tel" autoComplete="tel" />
                </div>
              </Field>
              <Field label="Email" htmlFor="contact-email" required error={touched ? errors.email : undefined} className="sm:col-span-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input id="contact-email" className="pl-9" type="email" value={contact.email} onBlur={() => setTouched(true)} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" />
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <h3 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-ink"><Tag className="h-4 w-4 text-brand" /> Voucher & điểm thưởng</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={voucherInput}
                  onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(null); }}
                  placeholder="Nhập mã giảm giá, vd PXU10"
                  aria-label="Mã giảm giá"
                  className="uppercase"
                  error={Boolean(voucherError)}
                  disabled={Boolean(booking.voucherCode)}
                />
                {booking.voucherCode ? (
                  <Button variant="secondary" onClick={() => removeVoucherMutation.mutate()} loading={removeVoucherMutation.isPending} icon={<X className="h-4 w-4" />}>Gỡ mã</Button>
                ) : (
                  <Button variant="secondary" onClick={() => applyCode(voucherInput)} loading={voucherMutation.isPending} icon={<BadgePercent className="h-4 w-4" />}>Áp dụng</Button>
                )}
              </div>
              {voucherError && <p className="mt-1.5 text-xs text-danger" role="alert">{voucherError}</p>}
              {booking.voucherCode && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Đã áp dụng <strong>{booking.voucherCode}</strong> · giảm {money(booking.discount)}</p>
              )}
              {!booking.voucherCode && Boolean(vouchersQuery.data?.length) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {vouchersQuery.data!.slice(0, 4).map((voucher) => (
                    <button
                      key={voucher.code}
                      type="button"
                      onClick={() => { setVoucherInput(voucher.code); applyCode(voucher.code); }}
                      className="rounded-full border border-dashed border-brand/40 bg-brand/5 px-2.5 py-1 text-[10px] font-semibold text-brand transition hover:bg-brand/15"
                    >
                      {voucher.code} · {voucher.label}
                    </button>
                  ))}
                </div>
              )}

              {(user?.points ?? 0) > 0 && (
                <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-line/60 bg-base/40 p-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Sparkles className="h-3.5 w-3.5 text-gold" /> Dùng điểm thưởng</p>
                    <p className="mt-0.5 text-[11px] text-muted">Bạn có {user!.points.toLocaleString('vi-VN')} điểm · dùng tối đa {maxUsefulPoints} điểm cho đơn này (giảm {money(Math.min(maxUsefulPoints * 1000, maxPointsDiscount))}).</p>
                  </div>
                  <Switch checked={pointsOn} onChange={togglePoints} disabled={pointsMutation.isPending || maxUsefulPoints === 0} label="Dùng điểm" />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
              <Checkbox
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                label={<span className="text-[11px] leading-relaxed text-ink2">Tôi đã đọc và đồng ý với <Link to="/trang/dieu-khoan" className="text-brand hover:underline">điều khoản sử dụng</Link>, <Link to="/trang/chinh-sach-hoan-huy" className="text-brand hover:underline">chính sách hoàn hủy</Link> và quy chế rạp. Tôi xác nhận thông tin liên hệ là chính xác.</span>}
              />
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
              Vé đã thanh toán không tự hủy/hoàn theo chính sách rạp. Phim nhãn T16/T18 yêu cầu xuất trình giấy tờ khi vào phòng chiếu.
            </p>
          </Card>
        </div>

        <aside>
          <div className="sticky top-36 space-y-3">
            <Card className="overflow-hidden">
              <div className="border-b border-line/70 bg-brand/5 px-4 py-3">
                <p className="font-display text-base font-bold uppercase tracking-wide text-ink">Tổng thanh toán</p>
              </div>
              <div className="p-4">
                <PriceBreakdown totals={booking} />
                <Button full size="lg" className="mt-4" disabled={!canPay} loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
                  {booking.finalAmount === 0 ? 'Xác nhận đặt vé' : 'Thanh toán'} <ArrowRight className="h-4 w-4" />
                </Button>
                {!terms && <p className="mt-2 text-center text-[10px] text-warning">Vui lòng đồng ý điều khoản để tiếp tục.</p>}
                <div className="mt-3 space-y-1.5 text-[10px] text-muted">
                  <p className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-success" /> Thanh toán qua QR ngân hàng, duyệt thủ công</p>
                  <p className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-info" /> Vé điện tử gửi ngay sau khi thanh toán được xác nhận</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Mã đơn hàng</p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">{booking.code}</p>
              <p className="mt-2 text-[10px] text-muted">Đơn {booking.seats.length} vé · {booking.combos.length} combo</p>
            </Card>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-base/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 backdrop-blur lg:hidden no-print">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] text-muted">Tổng thanh toán</span>
          <span className="text-money text-lg font-bold text-brand">{money(booking.finalAmount)}</span>
        </div>
        <Button full size="lg" disabled={!canPay} loading={payMutation.isPending} onClick={() => payMutation.mutate()}>
          {booking.finalAmount === 0 ? 'Xác nhận đặt vé' : 'Thanh toán'}
        </Button>
      </div>
    </div>
  );
}
