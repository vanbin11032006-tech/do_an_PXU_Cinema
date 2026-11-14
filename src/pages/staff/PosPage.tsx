import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, CalendarClock, CreditCard, Minus, Popcorn, Plus, Printer, QrCode, ReceiptText,
  RefreshCw, RotateCcw, ShoppingBag, Ticket, Wallet,
} from 'lucide-react';
import {
  currentShift, getPaymentInfo, getShowtimeSeats, listCombos, listShowtimes, posCreateBooking,
  posPay, reprintTicket, staffCurrentShowtimes,
} from '@/api';
import type { BookingDetail, Combo } from '@/types/domain';
import type { ShowtimePublic } from '@/api';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { errorCode, errorMessage } from '@/lib/errors';
import { detectOrphanSeat } from '@/lib/seatMath';
import { formatDate, formatTime, money, todayISO } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import { ScreenBar, SeatLegend, SeatMap } from '@/components/common';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, Input, PageHeader, QRImage, Skeleton, Stepper, toast,
} from '@/components/ui';
import { OpenShiftModal } from './components/OpenShiftModal';

type Stage = 'build' | 'payment' | 'done';
type PayMethod = 'cash' | 'card' | 'bank_qr';
type MobileStep = 1 | 2 | 3;

const METHOD_LABEL: Record<PayMethod, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ ngân hàng',
  bank_qr: 'Chuyển khoản QR',
};

const CASH_PRESETS = [50_000, 100_000, 200_000, 500_000];

function startMs(showtime: Pick<ShowtimePublic, 'showDate' | 'startTime'>): number {
  return new Date(`${showtime.showDate}T${showtime.startTime}:00`).getTime();
}

export default function PosPage() {
  useDocumentTitle('Bán vé tại quầy');
  const user = useAuthStore((state) => state.user);
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [stage, setStage] = useState<Stage>('build');
  const [mobileStep, setMobileStep] = useState<MobileStep>(1);
  const [method, setMethod] = useState<PayMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [cashError, setCashError] = useState<string | null>(null);
  const [paidResult, setPaidResult] = useState<{ booking: BookingDetail; change: number } | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const autoPrompted = useRef(false);

  const shiftQuery = useQuery({ queryKey: ['staff', 'current-shift'], queryFn: currentShift, refetchInterval: 60_000 });

  useEffect(() => {
    if (shiftQuery.isLoading) return;
    if (!shiftQuery.data?.shift && !autoPrompted.current) {
      autoPrompted.current = true;
      setShiftModalOpen(true);
    }
  }, [shiftQuery.isLoading, shiftQuery.data]);

  const showtimesQuery = useQuery({
    queryKey: ['staff', 'pos', 'showtimes'],
    queryFn: async () => {
      const [near, today] = await Promise.all([
        staffCurrentShowtimes(),
        listShowtimes({ date: todayISO() }),
      ]);
      const map = new Map<number, ShowtimePublic>();
      for (const item of [...near, ...today]) map.set(item.id, item);
      return [...map.values()].sort((a, b) => startMs(a) - startMs(b));
    },
  });

  const scopedShowtimes = useMemo(() => {
    const list = showtimesQuery.data ?? [];
    const now = Date.now();
    return list.filter((item) => {
      if (item.status === 'cancelled' || item.status === 'finished') return false;
      if (startMs(item) < now) return false;
      if (!user) return true;
      if (user.role === 'admin') return adminCinemaId ? item.cinemaId === adminCinemaId : true;
      if (user.cinemaIds.length > 0) return user.cinemaIds.includes(item.cinemaId);
      return adminCinemaId ? item.cinemaId === adminCinemaId : true;
    });
  }, [showtimesQuery.data, user, adminCinemaId]);

  useEffect(() => {
    if (showtimeId !== null || scopedShowtimes.length === 0) return;
    setShowtimeId(scopedShowtimes[0].id);
  }, [scopedShowtimes, showtimeId]);

  const seatsQuery = useQuery({
    queryKey: ['staff', 'pos', 'seats', showtimeId],
    queryFn: () => getShowtimeSeats(showtimeId as number),
    enabled: showtimeId !== null,
    refetchInterval: 20_000,
  });

  const combosQuery = useQuery({ queryKey: ['combos'], queryFn: listCombos });

  const paymentInfoQuery = useQuery({
    queryKey: ['staff', 'pos', 'payment-info', booking?.code],
    queryFn: () => getPaymentInfo(booking!.code),
    enabled: Boolean(booking) && method === 'bank_qr' && stage === 'payment',
  });

  const selectedShowtime = scopedShowtimes.find((item) => item.id === showtimeId);
  const seatMap = seatsQuery.data;
  const combos = combosQuery.data ?? [];

  useEffect(() => {
    setSelectedSeats([]);
    setQuantities({});
    setCashError(null);
  }, [showtimeId]);

  const ticketsSubtotal = useMemo(
    () => (seatMap?.seats ?? []).filter((seat) => selectedSeats.includes(seat.id)).reduce((sum, seat) => sum + seat.price, 0),
    [seatMap, selectedSeats],
  );
  const combosSubtotal = useMemo(
    () => combos.reduce((sum, combo) => sum + combo.price * (quantities[combo.id] ?? 0), 0),
    [combos, quantities],
  );
  const estimatedTotal = ticketsSubtotal + combosSubtotal;
  const orphanSeat = useMemo(
    () => (seatMap ? detectOrphanSeat(seatMap.seats, selectedSeats) : null),
    [seatMap, selectedSeats],
  );

  const resetTransaction = () => {
    setSelectedSeats([]);
    setQuantities({});
    setCustomerName('');
    setCustomerPhone('');
    setBooking(null);
    setStage('build');
    setMethod('cash');
    setAmountReceived('');
    setReference('');
    setCashError(null);
    setPaidResult(null);
    setMobileStep(1);
    void seatsQuery.refetch();
  };

  const shiftInvalid = () => {
    queryClient.invalidateQueries({ queryKey: ['staff', 'current-shift'] });
    setShiftModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      posCreateBooking({
        showtimeId: showtimeId as number,
        seatIds: selectedSeats,
        comboItems: Object.entries(quantities)
          .map(([id, quantity]) => ({ comboId: Number(id), quantity }))
          .filter((item) => item.quantity > 0),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      }),
    onSuccess: (detail) => {
      setBooking(detail);
      setStage('payment');
      setAmountReceived(String(detail.finalAmount));
      setMobileStep(3);
      toast.success('Đã tạo đơn tại quầy', `Đơn ${detail.code} đang giữ ghế 3 phút. Vui lòng hoàn tất thanh toán.`);
      queryClient.invalidateQueries({ queryKey: ['staff', 'pos', 'seats'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'pos', 'showtimes'] });
    },
    onError: (error) => {
      const code = errorCode(error);
      toast.error('Không tạo được đơn', errorMessage(error));
      if (code === 'SEAT_UNAVAILABLE' || code === 'SEAT_LIMIT_EXCEEDED') {
        setSelectedSeats([]);
        void seatsQuery.refetch();
      }
      if (code === 'BOOKING_INVALID_STATE') shiftInvalid();
      if (code === 'SHOWTIME_CLOSED') void showtimesQuery.refetch();
    },
  });

  const payMutation = useMutation({
    mutationFn: () =>
      posPay(booking!.code, {
        method,
        amountReceived: method === 'cash' ? Number(amountReceived || 0) : undefined,
        reference: reference.trim() || undefined,
      }),
    onSuccess: (result) => {
      setPaidResult({ booking: result.booking, change: result.change });
      setBooking(result.booking);
      setStage('done');
      toast.success('Thanh toán thành công', result.message);
      queryClient.invalidateQueries({ queryKey: ['staff', 'current-shift'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'pos', 'seats'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'today-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'checkin-stats'] });
    },
    onError: (error) => {
      toast.error('Không thanh toán được', errorMessage(error));
      if (errorCode(error) === 'BOOKING_INVALID_STATE') shiftInvalid();
    },
  });

  const reprintMutation = useMutation({
    mutationFn: (code: string) => reprintTicket(code),
    onSuccess: (result) => {
      toast.success('Đã in lại vé', result.message);
      window.print();
    },
    onError: (error) => toast.error('Không in lại được vé', errorMessage(error)),
  });

  const receiptSuggestions = useMemo(() => {
    if (!booking) return [];
    const amount = booking.finalAmount;
    const values = new Set<number>([amount]);
    for (const step of CASH_PRESETS) {
      const rounded = Math.ceil(amount / step) * step;
      if (rounded >= amount) values.add(rounded);
    }
    return [...values].sort((a, b) => a - b);
  }, [booking]);

  const amountNumber = Number(amountReceived || 0);
  const change = booking ? amountNumber - booking.finalAmount : 0;

  const toggleSeat = (seat: { id: number }) => {
    setSelectedSeats((current) => current.includes(seat.id)
      ? current.filter((id) => id !== seat.id)
      : [...current, seat.id]);
  };

  const setComboQuantity = (combo: Combo, next: number) => {
    const limit = Math.min(combo.stock, combo.maxPerOrder);
    const value = Math.max(0, Math.min(limit, next));
    setQuantities((current) => ({ ...current, [combo.id]: value }));
  };

  const startTransaction = () => {
    if (!shiftQuery.data?.shift) {
      toast.error('Chưa mở ca', 'Bạn cần mở ca làm việc trước khi bán vé.');
      setShiftModalOpen(true);
      return;
    }
    if (!showtimeId) {
      toast.warning('Chưa chọn suất chiếu', 'Vui lòng chọn suất chiếu trước khi tạo đơn.');
      setMobileStep(1);
      return;
    }
    if (selectedSeats.length === 0) {
      toast.warning('Chưa chọn ghế', 'Vui lòng chọn ít nhất một ghế.');
      setMobileStep(2);
      return;
    }
    createMutation.mutate();
  };

  const confirmPayment = () => {
    if (!booking) return;
    if (method === 'cash' && amountNumber < booking.finalAmount) {
      setCashError('Tiền khách đưa chưa đủ để thanh toán đơn này.');
      return;
    }
    setCashError(null);
    payMutation.mutate();
  };

  /* ------------------------------- Sections ------------------------------- */

  const showtimeSection = (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
          <CalendarClock className="h-4 w-4 text-brand" /> Suất chiếu
        </h2>
        <button type="button" onClick={() => void showtimesQuery.refetch()} className="text-muted transition hover:text-brand" aria-label="Tải lại suất chiếu">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {showtimesQuery.isLoading ? (
        <Skeleton className="mt-3 h-28 w-full" />
      ) : showtimesQuery.isError ? (
        <ErrorState title="Không tải được suất chiếu" message={errorMessage(showtimesQuery.error)} onRetry={() => void showtimesQuery.refetch()} className="mt-3 px-3 py-6" />
      ) : scopedShowtimes.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Hết suất khả dụng"
          description="Không còn suất chiếu nào có thể bán tại quầy trong hôm nay."
          className="mt-3 px-4 py-8"
          action={<Button size="sm" variant="secondary" onClick={() => void showtimesQuery.refetch()}>Tải lại</Button>}
        />
      ) : (
        <>
          <div className="mt-3 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {scopedShowtimes.map((item) => {
              const active = item.id === showtimeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setShowtimeId(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${active ? 'border-brand/60 bg-brand/10' : 'border-line/70 bg-base/40 hover:border-brand/40'}`}
                  aria-pressed={active}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-money text-sm font-bold text-ink">{item.startTime}</span>
                    <span className={`text-[10px] font-semibold ${item.availableSeats === 0 ? 'text-danger' : 'text-muted'}`}>
                      {item.availableSeats === 0 ? 'Hết ghế' : `còn ${item.availableSeats} ghế`}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-ink2">{item.movie.title}</p>
                  <p className="truncate text-[10px] text-muted">{item.room.name} · {item.format} · {formatDate(item.showDate)}</p>
                </button>
              );
            })}
          </div>
          {selectedShowtime && (
            <p className="mt-2 rounded-md bg-elevated/60 px-2.5 py-1.5 text-[10px] text-muted">
              Đang bán: <span className="font-semibold text-ink2">{selectedShowtime.movie.title}</span> · {selectedShowtime.startTime} · {selectedShowtime.room.name}
            </p>
          )}
        </>
      )}
    </Card>
  );

  const seatSection = (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
          <Ticket className="h-4 w-4 text-brand" /> Chọn ghế
        </h2>
        {seatMap && (
          <Badge tone={selectedSeats.length ? 'brand' : 'neutral'}>
            {selectedSeats.length}/{seatMap.maxSeats} ghế
          </Badge>
        )}
      </div>

      {seatsQuery.isLoading && <Skeleton className="mt-3 h-72 w-full" />}

      {seatsQuery.isError && (
        <ErrorState title="Không tải được sơ đồ ghế" message={errorMessage(seatsQuery.error)} onRetry={() => void seatsQuery.refetch()} className="mt-3 px-4 py-8" />
      )}

      {!seatsQuery.isLoading && !seatsQuery.isError && seatMap && (
        <>
          <div className="mt-3">
            <ScreenBar />
            <SeatMap
              seats={seatMap.seats}
              selectedIds={selectedSeats}
              maxSeats={seatMap.maxSeats}
              onToggle={toggleSeat}
            />
            <SeatLegend className="mt-2 justify-center" />
          </div>
          {orphanSeat && (
            <p className="mt-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] text-warning" role="status">
              Ghế {orphanSeat} sẽ bị lẻ nếu giữ lựa chọn hiện tại. Cân nhắc chọn thêm ghế bên cạnh.
            </p>
          )}
          {selectedSeats.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {selectedSeats.map((id) => {
                const seat = seatMap.seats.find((item) => item.id === id);
                if (!seat) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleSeat(seat)}
                    className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/20"
                    aria-label={`Bỏ chọn ghế ${seat.code}`}
                  >
                    {seat.code} · {money(seat.price)}
                    <Minus className="h-3 w-3" />
                  </button>
                );
              })}
              <span className="ml-auto text-money text-sm font-bold text-brand">{money(ticketsSubtotal)}</span>
            </div>
          )}
        </>
      )}
    </Card>
  );

  const cartSection = (
    <Card className="p-4">
      {stage === 'build' && (
        <>
          <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
            <Popcorn className="h-4 w-4 text-brand" /> Bắp nước & khách hàng
          </h2>

          {combosQuery.isLoading && <Skeleton className="mt-3 h-24 w-full" />}
          {combosQuery.isError && (
            <p className="mt-3 text-xs text-danger">
              Không tải được combo. <button type="button" className="underline" onClick={() => void combosQuery.refetch()}>Thử lại</button>
            </p>
          )}
          {!combosQuery.isLoading && !combosQuery.isError && (
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {combos.filter((combo) => combo.status === 'active').map((combo) => {
                const quantity = quantities[combo.id] ?? 0;
                const limit = Math.min(combo.stock, combo.maxPerOrder);
                const disabled = combo.stock === 0;
                return (
                  <div key={combo.id} className={`flex items-center gap-2 rounded-lg border border-line/70 bg-base/40 px-2.5 py-2 ${disabled ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{combo.name}</p>
                      <p className="text-[10px] text-muted">
                        {money(combo.price)}
                        {disabled ? ' · Hết hàng' : ` · còn ${combo.stock}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setComboQuantity(combo, quantity - 1)}
                        disabled={quantity === 0}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink2 transition hover:border-brand/50 hover:text-brand disabled:opacity-35"
                        aria-label={`Giảm ${combo.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-money text-xs font-bold text-ink">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setComboQuantity(combo, quantity + 1)}
                        disabled={disabled || quantity >= limit}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink2 transition hover:border-brand/50 hover:text-brand disabled:opacity-35"
                        aria-label={`Tăng ${combo.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2">
            <Field label="Tên khách (tùy chọn)" htmlFor="pos-customer">
              <Input id="pos-customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Khách lẻ" maxLength={60} />
            </Field>
            <Field label="Số điện thoại" htmlFor="pos-phone">
              <Input id="pos-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="0901234567" inputMode="tel" maxLength={12} />
            </Field>
          </div>

          <dl className="mt-3 space-y-1.5 border-t border-line/60 pt-3 text-xs">
            <div className="flex justify-between text-ink2"><dt>Tiền vé ({selectedSeats.length})</dt><dd className="text-money">{money(ticketsSubtotal)}</dd></div>
            <div className="flex justify-between text-ink2"><dt>Bắp nước</dt><dd className="text-money">{money(combosSubtotal)}</dd></div>
            <div className="flex justify-between border-t border-line/60 pt-2 text-base font-bold text-ink">
              <dt>Tạm tính</dt><dd className="text-money text-brand">{money(estimatedTotal)}</dd>
            </div>
          </dl>

          <Button
            full
            className="mt-3"
            size="lg"
            onClick={startTransaction}
            loading={createMutation.isPending}
            disabled={selectedSeats.length === 0 || !showtimeId}
            icon={<ShoppingBag className="h-4 w-4" />}
          >
            Tạo đơn & thanh toán
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted">Đơn tại quầy giữ ghế 3 phút để hoàn tất thanh toán.</p>
        </>
      )}

      {stage === 'payment' && booking && (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wide text-ink">
              <Wallet className="h-4 w-4 text-brand" /> Thanh toán
            </h2>
            <Badge tone="warning">Giữ ghế 3 phút</Badge>
          </div>

          <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Mã đơn {booking.code}</p>
            <p className="mt-1 text-money text-2xl font-bold text-brand">{money(booking.finalAmount)}</p>
            <p className="mt-1 text-[11px] text-ink2">
              {booking.seats.length} ghế {booking.seats.map((seat) => seat.code).join(', ')}
              {booking.combos.length > 0 && ` · ${booking.combos.reduce((sum, combo) => sum + combo.quantity, 0)} combo`}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Phương thức thanh toán">
            {([
              { value: 'cash' as const, label: 'Tiền mặt', icon: <Banknote className="h-4 w-4" /> },
              { value: 'card' as const, label: 'Thẻ', icon: <CreditCard className="h-4 w-4" /> },
              { value: 'bank_qr' as const, label: 'QR', icon: <QrCode className="h-4 w-4" /> },
            ]).map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={method === item.value}
                onClick={() => { setMethod(item.value); setCashError(null); }}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-semibold transition ${method === item.value ? 'border-brand bg-brand/10 text-brand' : 'border-line/70 bg-base/40 text-ink2 hover:border-brand/40'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          {method === 'cash' ? (
            <div className="mt-3">
              <Field label="Tiền khách đưa" htmlFor="pos-cash" error={cashError ?? undefined}>
                <Input
                  id="pos-cash"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={amountReceived}
                  onChange={(event) => { setAmountReceived(event.target.value); setCashError(null); }}
                  error={Boolean(cashError)}
                />
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {receiptSuggestions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setAmountReceived(String(value)); setCashError(null); }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${amountNumber === value ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-surface/60 text-ink2 hover:border-brand/40'}`}
                  >
                    {value === booking.finalAmount ? 'Đủ tiền' : money(value)}
                  </button>
                ))}
              </div>
              <div className={`mt-2 flex items-center justify-between rounded-md px-2.5 py-2 text-xs ${change < 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                <span>{change < 0 ? 'Còn thiếu' : 'Tiền thừa trả khách'}</span>
                <span className="text-money font-bold">{money(Math.abs(change))}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <Field label="Mã tham chiếu giao dịch" htmlFor="pos-reference" hint="Nhập mã giao dịch trên máy POS/ứng dụng ngân hàng nếu có.">
                <Input id="pos-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="VD: 123456789" />
              </Field>
              <div className="mt-2 rounded-md border border-info/25 bg-info/10 p-2.5 text-[11px] text-sky-300">
                <p>
                  Xác nhận sau khi khách đã thanh toán thành công bằng {METHOD_LABEL[method].toLowerCase()}.
                </p>
                {method === 'bank_qr' && paymentInfoQuery.data && (
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <QRImage value={paymentInfoQuery.data.qrValue} size={128} fileName={`pxu-pos-${booking.code}`} />
                    <p className="text-center font-mono text-[10px] text-slate-700">{paymentInfoQuery.data.transferContent}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            full
            className="mt-3"
            size="lg"
            variant="success"
            onClick={confirmPayment}
            loading={payMutation.isPending}
            disabled={method === 'cash' && amountNumber < booking.finalAmount}
            icon={<ReceiptText className="h-4 w-4" />}
          >
            Xác nhận đã thu tiền
          </Button>
          <button
            type="button"
            onClick={resetTransaction}
            className="mt-2 w-full text-center text-[11px] font-semibold text-muted hover:text-danger"
          >
            Hủy giao dịch và quay lại chọn ghế
          </button>
          <p className="mt-1 text-center text-[10px] text-muted">Đơn chưa thanh toán sẽ tự hủy và nhả ghế sau 3 phút.</p>
        </>
      )}

      {stage === 'done' && paidResult && (
        <>
          <div className="flex flex-col items-center py-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <ReceiptText className="h-7 w-7" />
            </span>
            <h2 className="mt-2 font-display text-lg font-bold uppercase tracking-wide text-ink">Thanh toán thành công</h2>
            <p className="mt-0.5 text-xs text-muted">Đơn {paidResult.booking.code} · {METHOD_LABEL[method]}</p>
            <p className="mt-1 text-money text-2xl font-bold text-brand">{money(paidResult.booking.finalAmount)}</p>
            {method === 'cash' && paidResult.change > 0 && (
              <p className="mt-1 text-xs font-semibold text-success">Tiền thừa đã trả: {money(paidResult.change)}</p>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-line/70 bg-base/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Vé đã phát hành</p>
            <ul className="mt-1.5 space-y-1">
              {paidResult.booking.tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-ink">Ghế {ticket.seatCode}</span>
                  <span className="font-mono text-muted">{ticket.code}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid gap-2">
            <Button full variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>
              In vé & biên lai
            </Button>
            <Button full onClick={resetTransaction} icon={<Plus className="h-4 w-4" />}>
              Giao dịch mới
            </Button>
            <Button
              full
              variant="ghost"
              loading={reprintMutation.isPending}
              onClick={() => reprintMutation.mutate(paidResult.booking.code)}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              In lại vé
            </Button>
            <Button
              full
              variant="ghost"
              onClick={() => navigate('/staff/ve-trong-ngay')}
              icon={<Ticket className="h-4 w-4" />}
            >
              Xem vé trong ngày
            </Button>
          </div>
        </>
      )}
    </Card>
  );

  /* -------------------------------- Render -------------------------------- */

  const interactive = (
    <div className="print:hidden">
      <PageHeader
        title="Bán vé tại quầy"
        description="Chọn suất chiếu, ghế và bắp nước, sau đó thu tiền và in vé cho khách."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {shiftQuery.data?.shift ? (
              <Badge tone="success">
                <Wallet className="h-3 w-3" /> Ca mở · {shiftQuery.data.shift.transactions} giao dịch
              </Badge>
            ) : (
              <Badge tone="warning">Chưa mở ca</Badge>
            )}
            {shiftQuery.data?.shift ? (
              <Button size="sm" variant="secondary" onClick={() => navigate('/staff/ca-lam-viec')} icon={<Wallet className="h-3.5 w-3.5" />}>
                Quản lý ca
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setShiftModalOpen(true)} icon={<Wallet className="h-3.5 w-3.5" />}>
                Mở ca
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetTransaction} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Làm mới
            </Button>
          </div>
        }
      />

      {shiftQuery.isLoading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : shiftQuery.isError ? (
        <ErrorState title="Không tải được ca làm việc" message={errorMessage(shiftQuery.error)} onRetry={() => void shiftQuery.refetch()} />
      ) : !shiftQuery.data?.shift ? (
        <Card className="border-warning/30 bg-warning/[0.04] p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning">
            <Wallet className="h-7 w-7" />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold uppercase tracking-wide text-ink">Cần mở ca làm việc</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Hệ thống chỉ cho phép bán vé khi ca đang mở, nhằm đối soát doanh thu và tiền mặt cuối ca.
          </p>
          <Button className="mt-4" onClick={() => setShiftModalOpen(true)} icon={<Wallet className="h-4 w-4" />}>
            Mở ca ngay
          </Button>
          <p className="mt-3 text-[11px] text-muted">
            Đã mở ca ở thiết bị khác? <button type="button" className="text-brand underline" onClick={() => void shiftQuery.refetch()}>Tải lại trạng thái ca</button>
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-line/70 bg-surface/60 px-3 py-2 text-[11px] text-muted">
            <span>Mở ca lúc <span className="font-semibold text-ink2">{shiftQuery.data.shift.openedAt ? formatTime(shiftQuery.data.shift.openedAt) : '—'}</span></span>
            <span>Tiền đầu ca <span className="text-money font-semibold text-ink2">{money(shiftQuery.data.shift.openingCash)}</span></span>
            <span>Doanh thu tiền mặt <span className="text-money font-semibold text-success">{money(shiftQuery.data.shift.totalSales)}</span></span>
            <span>Tiền mặt dự kiến <span className="text-money font-semibold text-ink2">{money(shiftQuery.data.shift.expectedCash ?? shiftQuery.data.shift.openingCash)}</span></span>
          </div>

          <div className="hidden gap-4 xl:grid xl:grid-cols-[290px_minmax(0,1fr)_360px]">
            <div>{showtimeSection}</div>
            <div>{seatSection}</div>
            <div>{cartSection}</div>
          </div>

          <div className="xl:hidden">
            <Stepper steps={['Suất chiếu', 'Chọn ghế', 'Thanh toán']} current={mobileStep - 1} className="mb-3" />
            <div className="space-y-3">
              {mobileStep === 1 && showtimeSection}
              {mobileStep === 2 && seatSection}
              {mobileStep === 3 && cartSection}
            </div>
            {stage === 'build' && (
              <div className="mt-3 flex gap-2">
                {mobileStep > 1 && (
                  <Button variant="secondary" full onClick={() => setMobileStep((mobileStep - 1) as MobileStep)}>
                    Quay lại
                  </Button>
                )}
                {mobileStep === 1 && (
                  <Button full disabled={!showtimeId} onClick={() => setMobileStep(2)}>
                    Chọn ghế
                  </Button>
                )}
                {mobileStep === 2 && (
                  <Button full disabled={selectedSeats.length === 0} onClick={() => setMobileStep(3)}>
                    Bắp nước & thanh toán
                  </Button>
                )}
              </div>
            )}
            {stage === 'payment' && mobileStep !== 3 && (
              <Button className="mt-3" full onClick={() => setMobileStep(3)}>Đến thanh toán</Button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="container-page py-6">
      {interactive}
      {paidResult && <PosReceipt booking={paidResult.booking} change={paidResult.change} method={method} staffName={user?.name ?? ''} />}
      <OpenShiftModal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} />
    </div>
  );
}

function PosReceipt({ booking, change, method, staffName }: {
  booking: BookingDetail;
  change: number;
  method: PayMethod;
  staffName: string;
}) {
  return (
    <div className="hidden print:block print:text-black">
      <div className="mx-auto max-w-md font-mono text-xs leading-relaxed">
        <h1 className="text-center text-xl font-bold">PXU CINEMA</h1>
        <p className="text-center">Biên lai bán vé tại quầy</p>
        <p className="mt-2 border-t border-dashed border-black pt-2">Mã đơn: {booking.code}</p>
        <p>Thời gian: {new Date().toLocaleString('vi-VN')}</p>
        <p>Nhân viên: {staffName}</p>
        <p className="mt-1">Phim: {booking.movie.title}</p>
        <p>Suất: {booking.showtime.startTime} · {formatDate(booking.showtime.showDate)} · {booking.room.name}</p>
        <p>Rạp: {booking.cinema.name}</p>
        <p className="mt-2 border-t border-dashed border-black pt-2">Ghế: {booking.seats.map((seat) => seat.code).join(', ')}</p>
        <p>Tiền vé: {money(booking.ticketsSubtotal)}</p>
        {booking.combos.map((combo) => (
          <p key={combo.comboId}>{combo.quantity}× {combo.name}: {money(combo.price * combo.quantity)}</p>
        ))}
        <p className="mt-1 font-bold">Tổng thu: {money(booking.finalAmount)}</p>
        <p>Hình thức: {METHOD_LABEL[method]}</p>
        {method === 'cash' && <p>Tiền thừa: {money(change)}</p>}
        <p className="mt-2">Mã vé: {booking.tickets.map((ticket) => ticket.code).join(', ')}</p>
        <p className="mt-3 border-t border-dashed border-black pt-2 text-center">Cảm ơn quý khách · {booking.customerName}</p>
      </div>
    </div>
  );
}
