import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Minus, Plus, Popcorn, ShoppingBag } from 'lucide-react';
import { cn, formatDate, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { getBooking, listCombos, updateBookingCombos } from '@/api';
import { Badge, Button, Card, ErrorState, HoldCountdown, Skeleton, Tabs, toast } from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';

const CATEGORIES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'combo', label: 'Combo' },
  { value: 'popcorn', label: 'Bắp' },
  { value: 'drink', label: 'Nước' },
  { value: 'snack', label: 'Snack' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

export default function CombosPage() {
  const { bookingCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category>('all');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const initialized = useRef(false);

  const bookingQuery = useQuery({
    queryKey: ['booking', bookingCode],
    queryFn: () => getBooking(bookingCode!),
    enabled: Boolean(bookingCode),
    retry: false,
  });
  const combosQuery = useQuery({ queryKey: ['combos'], queryFn: listCombos, staleTime: 120_000 });

  const booking = bookingQuery.data;
  const combos = combosQuery.data ?? [];

  useEffect(() => {
    if (!booking || initialized.current) return;
    initialized.current = true;
    setQuantities(Object.fromEntries(booking.combos.map((item) => [item.comboId, item.quantity])));
  }, [booking]);

  useEffect(() => {
    if (!booking || booking.status === 'holding') return;
    const latest = booking.payments[0];
    if (booking.status === 'confirmed' || booking.status === 'completed') navigate(`/ve/${booking.code}`, { replace: true });
    else if (latest?.status === 'proof_submitted' || latest?.status === 'rejected' || latest?.status === 'pending') navigate(`/thanh-toan/${booking.code}`, { replace: true });
    else navigate(`/phim/${booking.movie.slug}#lich-chieu`, { replace: true });
  }, [booking, navigate]);

  const items = useMemo(
    () => combos.filter((combo) => quantities[combo.id] > 0).map((combo) => ({ comboId: combo.id, quantity: quantities[combo.id] })),
    [combos, quantities],
  );
  const combosTotal = useMemo(
    () => items.reduce((sum, item) => {
      const combo = combos.find((c) => c.id === item.comboId);
      return sum + (combo ? combo.price * item.quantity : 0);
    }, 0),
    [items, combos],
  );

  const mutation = useMutation({
    mutationFn: (payload: { comboId: number; quantity: number }[]) => updateBookingCombos(bookingCode!, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['booking', bookingCode], updated);
      void queryClient.invalidateQueries({ queryKey: ['booking', bookingCode] });
      navigate(`/dat-ve/${bookingCode}/xac-nhan`);
    },
    onError: (error: unknown) => toast.error('Không thể cập nhật combo', errorMessage(error)),
  });

  function updateQuantity(comboId: number, delta: number, max: number, stock: number) {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(prev[comboId] ?? 0, max, stock) + delta);
      return { ...prev, [comboId]: Math.max(0, Math.min(next, max)) };
    });
  }

  if (bookingQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (bookingQuery.isError || !booking) {
    return <ErrorState message={errorMessage(bookingQuery.error)} onRetry={() => void bookingQuery.refetch()} />;
  }

  const filtered = category === 'all' ? combos : combos.filter((combo) => combo.category === category);
  const latestPayment = booking.payments[0];
  const canEdit = booking.status === 'holding' && (!latestPayment || latestPayment.status === 'rejected');

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Bước 2 · Bắp nước</p>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">Thêm combo cho buổi xem</h1>
          <p className="mt-1 text-xs text-muted">Combo nhận tại quầy bắp nước bằng mã đơn, không cần check-in như vé.</p>
        </div>
        <Link to={`/dat-ve/${booking.showtime.id}/ghe`} className="text-xs font-medium text-muted hover:text-brand">← Đổi ghế</Link>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="h-16 w-11 shrink-0 overflow-hidden rounded"><PosterArt movie={booking.movie} variant="thumb" /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{booking.movie.title}</p>
          <p className="text-[11px] text-muted">{formatDate(booking.showtime.showDate)} · {booking.showtime.startTime} · {booking.cinema.name} · {booking.room.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="outline">Ghế {booking.seats.map((s) => s.code).join(', ')}</Badge>
          <HoldCountdown expiresAt={booking.holdDeadline} serverTime={booking.serverTime} compact onExpire={() => void bookingQuery.refetch()} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Tabs items={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={category} onChange={setCategory} className="mb-4" />

          {combosQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : combosQuery.isError ? (
            <ErrorState message={errorMessage(combosQuery.error)} onRetry={() => void combosQuery.refetch()} />
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-line py-12 text-center text-sm text-muted">Chưa có sản phẩm trong danh mục này.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((combo) => {
                const qty = quantities[combo.id] ?? 0;
                const soldOut = combo.stock <= 0;
                return (
                  <Card key={combo.id} className={cn('overflow-hidden transition', soldOut && 'opacity-70')} hover={!soldOut}>
                    <div className="flex gap-3 p-3">
                      <div
                        className="relative flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg text-3xl"
                        style={{ background: `linear-gradient(145deg, ${combo.art.from}, ${combo.art.to})` }}
                        aria-hidden
                      >
                        {combo.art.imageUrl
                          ? <img src={combo.art.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                          : <span>{combo.art.emoji}</span>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-tight text-ink">{combo.name}</h3>
                          {soldOut ? <Badge tone="danger">Hết hàng</Badge> : combo.stock < 20 ? <Badge tone="warning">Còn {combo.stock}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{combo.description}</p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <span className="text-money text-sm font-bold text-brand">{money(combo.price)}</span>
                          {soldOut ? (
                            <span className="text-[10px] text-muted">Tạm ngừng bán</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(combo.id, -1, combo.maxPerOrder, combo.stock)}
                                disabled={qty === 0}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink2 transition hover:border-brand hover:text-brand disabled:opacity-40"
                                aria-label={`Giảm ${combo.name}`}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold text-ink">{qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(combo.id, 1, combo.maxPerOrder, combo.stock)}
                                disabled={qty >= Math.min(combo.maxPerOrder, combo.stock)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink2 transition hover:border-brand hover:text-brand disabled:opacity-40"
                                aria-label={`Tăng ${combo.name}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-info/20 bg-info/5 p-3 text-[11px] leading-relaxed text-ink2">
            <Popcorn className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p>Combo chỉ nhận tại quầy bắp nước trong ngày chiếu. Xuất trình mã QR đơn hàng trong mục “Vé của tôi”. Combo đã mua không hoàn tiền sau khi nhận.</p>
          </div>
        </div>

        <aside>
          <div className="sticky top-36 space-y-3">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line/70 bg-brand/5 px-4 py-3">
                <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-ink"><ShoppingBag className="h-4 w-4 text-brand" /> Giỏ của bạn</h2>
                <Badge tone="brand">{items.reduce((sum, i) => sum + i.quantity, 0)} món</Badge>
              </div>
              <div className="space-y-2 p-4 text-xs">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-muted">Chưa chọn combo nào.</p>
                ) : items.map((item) => {
                  const combo = combos.find((c) => c.id === item.comboId);
                  if (!combo) return null;
                  return (
                    <div key={item.comboId} className="flex justify-between gap-2 text-ink2">
                      <span className="min-w-0 truncate">{item.quantity}× {combo.name}</span>
                      <span className="text-money shrink-0">{money(combo.price * item.quantity)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between border-t border-line/60 pt-2 text-ink2">
                  <span>Tiền vé</span><span className="text-money">{money(booking.ticketsSubtotal)}</span>
                </div>
                <div className="flex justify-between text-ink2">
                  <span>Bắp nước</span><span className="text-money">{money(combosTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line/60 pt-2 text-sm">
                  <span className="text-muted">Tạm tính</span>
                  <span className="text-money text-lg font-bold text-brand">{money(booking.ticketsSubtotal + combosTotal)}</span>
                </div>
                <p className="text-[10px] text-muted">Voucher và điểm thưởng áp dụng ở bước xác nhận.</p>
                <Button full size="lg" className="mt-2" loading={mutation.isPending} disabled={!canEdit} onClick={() => mutation.mutate(items)} icon={<ArrowRight className="h-4 w-4" />}>
                  Tiếp tục
                </Button>
                <Button full variant="ghost" size="sm" disabled={!canEdit || mutation.isPending} onClick={() => mutation.mutate([])}>
                  Bỏ qua bắp nước
                </Button>
              </div>
            </Card>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-base/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 backdrop-blur lg:hidden no-print">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-muted">{items.reduce((sum, i) => sum + i.quantity, 0)} món · Tạm tính</p>
            <p className="text-money text-base font-bold text-brand">{money(booking.ticketsSubtotal + combosTotal)}</p>
          </div>
          <Button loading={mutation.isPending} disabled={!canEdit} onClick={() => mutation.mutate(items)}>Tiếp tục</Button>
        </div>
      </div>
    </div>
  );
}
