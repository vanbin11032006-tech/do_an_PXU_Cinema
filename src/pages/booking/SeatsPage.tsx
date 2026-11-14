import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CalendarDays, Clock, Info, Lock, MapPin, Ticket } from 'lucide-react';
import { ApiError } from '@/types/domain';
import { formatDate, money } from '@/lib/format';
import { detectOrphanSeat, seatsSummary } from '@/lib/seatMath';
import { errorMessage } from '@/lib/errors';
import { cancelHolding, createBooking, getMyHolding, getShowtimeSeats } from '@/api';
import { useBookingDraft } from '@/store/booking';
import { AgeBadge, Badge, Button, Card, Checkbox, ConfirmDialog, ErrorState, HoldCountdown, Skeleton, toast } from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';
import { SeatLegend, SeatMap, ScreenBar, type SeatLike } from '@/components/common/SeatMap';

const TYPE_LABEL = { standard: 'Thường', vip: 'VIP', couple: 'Đôi', aisle: 'Lối đi', blank: 'Trống', disabled: 'Hỏng' } as const;

export default function SeatsPage() {
  const { showtimeId: showtimeParam } = useParams();
  const showtimeId = Number(showtimeParam);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useBookingDraft();

  const [selected, setSelected] = useState<number[]>([]);
  const [ackAge, setAckAge] = useState(false);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const initialized = useRef(false);

  const seatsQuery = useQuery({
    queryKey: ['showtime', showtimeId, 'seats'],
    queryFn: () => getShowtimeSeats(showtimeId),
    enabled: Number.isFinite(showtimeId),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const holdingQuery = useQuery({
    queryKey: ['booking', 'holding', showtimeId],
    queryFn: () => getMyHolding(showtimeId),
    enabled: Number.isFinite(showtimeId),
    refetchInterval: 15_000,
  });

  const data = seatsQuery.data;
  const holding = holdingQuery.data;

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    if (draft.showtimeId === showtimeId && draft.selectedSeatIds.length) {
      const valid = draft.selectedSeatIds.filter((id) => data.seats.some((s) => s.id === id && s.status === 'available'));
      setSelected(valid);
    }
    setAckAge(draft.showtimeId === showtimeId ? draft.ackAge : false);
  }, [data, draft, showtimeId]);

  useEffect(() => {
    if (!data) return;
    const lost = selected.filter((id) => {
      const seat = data.seats.find((s) => s.id === id);
      return !seat || (seat.status !== 'available' && !seat.mine);
    });
    if (!lost.length) return;
    const codes = lost.map((id) => data.seats.find((s) => s.id === id)?.code ?? `#${id}`);
    setSelected((prev) => prev.filter((id) => !lost.includes(id)));
    setHighlight(lost);
    toast.warning('Ghế vừa được người khác chọn', `${codes.join(', ')} không còn trống. Vui lòng chọn ghế khác.`);
    window.setTimeout(() => setHighlight([]), 4000);
  }, [data, selected]);

  useEffect(() => {
    if (!holding) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [holding]);

  const createMutation = useMutation({
    mutationFn: () => createBooking({
      showtimeId,
      seatIds: selected,
      acceptAgeNotice: ackAge,
      idempotencyKey: draft.ensureIdempotencyKey(),
    }),
    onSuccess: (booking) => {
      draft.reset();
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
      navigate(`/dat-ve/${booking.code}/bap-nuoc`);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'SEAT_UNAVAILABLE') {
        const ids = Array.isArray(error.details?.seat_ids) ? (error.details.seat_ids as number[]) : [];
        setSelected((prev) => prev.filter((id) => !ids.includes(id)));
        setHighlight(ids);
        window.setTimeout(() => setHighlight([]), 5000);
        toast.error('Ghế không còn trống', error.message);
        void seatsQuery.refetch();
        return;
      }
      if (error instanceof ApiError && (error.code === 'HOLD_LIMIT_EXCEEDED' || error.code === 'HOLD_EXPIRED')) {
        toast.warning('Không thể giữ ghế', error.message);
        void holdingQuery.refetch();
        return;
      }
      toast.error('Không thể giữ ghế', errorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelHolding(holding!.code),
    onSuccess: () => {
      toast.success('Đã hủy đơn giữ ghế');
      setCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['booking'] });
    },
    onError: (error: unknown) => toast.error('Không thể hủy đơn', errorMessage(error)),
  });

  if (!Number.isFinite(showtimeId)) {
    return <ErrorState title="Suất chiếu không hợp lệ" message="Đường dẫn không đúng. Vui lòng chọn lại suất chiếu." onRetry={() => navigate('/lich-chieu')} />;
  }

  if (seatsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[440px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (seatsQuery.isError || !data) {
    return <ErrorState message={errorMessage(seatsQuery.error)} onRetry={() => void seatsQuery.refetch()} />;
  }

  const movie = data.movie;
  const showtime = data.showtime;
  const maxSeats = data.maxSeats;
  const sellable = data.seats.filter((seat) => seat.type === 'standard' || seat.type === 'vip' || seat.type === 'couple');
  const totalSeats = sellable.length;
  const availableSeats = data.seats.filter((seat) => seat.status === 'available').length;
  const minSeatPrice = sellable.length ? Math.min(...sellable.map((seat) => seat.price)) : showtime.basePrice;
  const selectedSeats = data.seats.filter((seat) => selected.includes(seat.id));
  const groups = seatsSummary(data.seats, selected);
  const subtotal = groups.reduce((sum, group) => sum + group.total, 0);
  const orphan = detectOrphanSeat(data.seats, selected);
  const requiresAgeAck = movie.age === 'T16' || movie.age === 'T18';
  const canContinue = selected.length > 0 && (!requiresAgeAck || ackAge) && !createMutation.isPending;

  function toggleSeat(seat: SeatLike) {
    if (seat.status !== 'available' && !seat.mine) return;
    setSelected((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      if (prev.length >= maxSeats) {
        toast.warning('Đã đạt giới hạn', `Mỗi đơn chỉ được chọn tối đa ${maxSeats} ghế.`);
        return prev;
      }
      return [...prev, seat.id];
    });
  }

  function continueBooking() {
    if (!selected.length) {
      toast.warning('Chưa chọn ghế', 'Vui lòng chọn ít nhất một ghế để tiếp tục.');
      return;
    }
    if (requiresAgeAck && !ackAge) {
      toast.warning('Cần xác nhận độ tuổi', `Phim có nhãn ${movie.age}. Vui lòng xác nhận bạn đủ độ tuổi.`);
      return;
    }
    draft.setSelection(showtimeId, selected, ackAge);
    createMutation.mutate();
  }

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to={`/phim/${movie.slug}#lich-chieu`} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> Đổi suất chiếu
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
          Sơ đồ cập nhật trực tiếp
        </span>
      </div>

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-20">
            <PosterArt movie={movie} variant="poster" showTitle={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-2xl">{movie.title}</h1>
              <AgeBadge age={movie.age} />
              <Badge tone="outline">{showtime.format}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-brand" />{data.cinema.name} · {data.room.name}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-brand" />{formatDate(showtime.showDate)}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-brand" />{showtime.startTime} – {showtime.endTime}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted">Từ</p>
              <p className="text-money text-lg font-bold text-brand">{money(minSeatPrice)}</p>
            </div>
            <Badge tone={availableSeats < 20 ? 'warning' : 'success'}>Còn {availableSeats}/{totalSeats} ghế</Badge>
          </div>
        </div>
      </Card>

      {holding && (
        <div className="mb-4 flex flex-col gap-3 rounded-card border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning"><Ticket className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Bạn đang giữ ghế cho đơn {holding.code}</p>
            <p className="mt-0.5 text-xs text-warning">Ghế {holding.seats.map((s) => s.code).join(', ')} · {money(holding.finalAmount)}</p>
          </div>
          <HoldCountdown expiresAt={holding.holdDeadline} serverTime={holding.serverTime} compact onExpire={() => void holdingQuery.refetch()} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate(`/dat-ve/${holding.code}/bap-nuoc`)}>Tiếp tục đơn</Button>
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>Hủy</Button>
          </div>
        </div>
      )}

      {orphan && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Bạn đang để lại ghế <strong>{orphan}</strong> đơn lẻ giữa hai ghế đã chọn/đã bán. Hệ thống vẫn cho tiếp tục nhưng hãy cân nhắc chọn thêm hoặc bỏ bớt.</p>
        </div>
      )}

      {requiresAgeAck && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-ink2">
          <p className="flex items-center gap-2 font-semibold text-danger"><Info className="h-4 w-4" /> Phim nhãn {movie.age}</p>
          <p className="mt-1">Khán giả phải đủ độ tuổi theo quy định và xuất trình giấy tờ khi vào phòng chiếu.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Card className="p-4 sm:p-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Sơ đồ ghế</h2>
                <p className="mt-0.5 text-[11px] text-muted">Chạm hoặc dùng phím mũi tên để chọn · Tối đa {maxSeats} ghế</p>
              </div>
              <SeatLegend className="justify-end" />
            </div>
            <div className="mt-4 rounded-xl border border-line/50 bg-base/60 p-2 sm:p-4">
              <ScreenBar />
              <SeatMap
                seats={data.seats}
                selectedIds={selected}
                onToggle={toggleSeat}
                maxSeats={maxSeats}
                highlightIds={highlight}
                readOnly={createMutation.isPending}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
              <p className="flex items-center gap-1"><Lock className="h-3 w-3" /> Ghế đang giữ/đã bán không thể chọn.</p>
              <p>Ghế đôi được bán nguyên cặp (2 chỗ).</p>
            </div>
          </Card>

          <div className="mt-4 hidden sm:block">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Thường', value: data.seats.filter((s) => s.type === 'standard').length },
                { label: 'VIP', value: data.seats.filter((s) => s.type === 'vip').length },
                { label: 'Đôi', value: data.seats.filter((s) => s.type === 'couple').length },
                { label: 'Đã bán/giữ', value: data.seats.filter((s) => s.status === 'sold' || s.status === 'held').length },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-line/60 bg-surface/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{stat.label}</p>
                  <p className="text-money text-sm font-semibold text-ink">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-36 space-y-3">
            <Card className="overflow-hidden">
              <div className="border-b border-line/70 bg-brand/5 px-4 py-3">
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">Ghế đã chọn ({selected.length})</h2>
                <p className="text-[10px] text-muted">Tối đa {maxSeats} ghế mỗi đơn</p>
              </div>
              <div className="p-4">
                {selected.length === 0 ? (
                  <div className="py-6 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-muted"><Ticket className="h-4 w-4" /></div>
                    <p className="text-xs text-muted">Chưa chọn ghế. Hãy chạm vào ghế trống trên sơ đồ.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSeats.map((seat) => (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => toggleSeat(seat)}
                          className="inline-flex items-center gap-1 rounded-md border border-info/40 bg-info/10 px-2 py-1 text-[11px] font-semibold text-info transition hover:border-danger/40 hover:text-danger"
                          aria-label={`Bỏ chọn ghế ${seat.code}`}
                        >
                          {seat.code} <span aria-hidden>×</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5 border-t border-line/60 pt-3 text-xs">
                      {groups.map((group) => (
                        <div key={group.type} className="flex items-center justify-between text-ink2">
                          <span>{TYPE_LABEL[group.type]} × {group.count}</span>
                          <span className="text-money">{money(group.total)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-line/60 pt-3">
                      <span className="text-xs text-muted">Tạm tính</span>
                      <span className="text-money text-lg font-bold text-brand">{money(subtotal)}</span>
                    </div>
                  </div>
                )}

                {requiresAgeAck && (
                  <div className="mt-4 border-t border-line/60 pt-3">
                    <Checkbox checked={ackAge} onChange={(e) => setAckAge(e.target.checked)} label={<span className="text-[11px]">Tôi xác nhận đủ độ tuổi theo nhãn <strong>{movie.age}</strong> và sẽ xuất trình giấy tờ khi cần.</span>} />
                  </div>
                )}

                <Button className="mt-4" full size="lg" disabled={!canContinue} loading={createMutation.isPending} onClick={continueBooking}>
                  Tiếp tục
                </Button>
                <p className="mt-2 text-center text-[10px] text-muted">Ghế được giữ 10 phút sau khi tiếp tục</p>
              </div>
            </Card>

            <div className="rounded-lg border border-line/50 bg-surface/40 p-3 text-[10px] leading-relaxed text-muted">
              <p className="font-semibold text-ink2">Lưu ý khi chọn ghế</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-3.5">
                <li>Ghế VIP nằm ở hàng E–F, có phụ thu.</li>
                <li>Ghế đôi H là cặp ghế dành cho 2 người, tính giá cho cả cặp.</li>
                <li>Vé đã mua không hoàn/hủy sau khi thanh toán theo chính sách rạp.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile summary */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-base/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 backdrop-blur lg:hidden no-print">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted">{selected.length} ghế · {selectedSeats.map((s) => s.code).join(', ') || 'Chưa chọn'}</span>
          <span className="text-money font-bold text-brand">{money(subtotal)}</span>
        </div>
        {requiresAgeAck && <div className="mb-2"><Checkbox checked={ackAge} onChange={(e) => setAckAge(e.target.checked)} label={<span className="text-[10px]">Tôi xác nhận đủ tuổi ({movie.age}) và sẽ xuất trình giấy tờ.</span>} /></div>}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)} aria-label="Quay lại">Quay lại</Button>
          <Button className="flex-1" disabled={!canContinue} loading={createMutation.isPending} onClick={continueBooking}>Tiếp tục</Button>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Hủy đơn giữ ghế?"
        description="Ghế sẽ được nhả ngay cho khách khác. Bạn có thể chọn lại ghế nếu còn trống."
        confirmText="Hủy đơn"
        danger
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
