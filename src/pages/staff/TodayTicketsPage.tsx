import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Armchair, CheckCheck, Clock, Popcorn, Printer, RefreshCw, RotateCcw, Search, Ticket, Users,
} from 'lucide-react';
import {
  confirmComboPickup, reprintTicket, staffTodayBookings,
} from '@/api';
import type { BookingDetail, BookingStatus } from '@/types/domain';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, formatDateTime, money } from '@/lib/format';
import { useDebounce, useDocumentTitle } from '@/hooks';
import {
  Badge, Button, Card, Chip, ConfirmDialog, DataTable, Drawer, EmptyState, ErrorState, Input, PageHeader,
  PaymentStatusBadge, QRImage, Select, Skeleton, StatusBadge, toast,
} from '@/components/ui';
import type { Column } from '@/components/ui';

const STATUS_FILTERS: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'holding', label: 'Đang giữ ghế' },
  { value: 'confirmed', label: 'Đã thanh toán' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'expired', label: 'Hết hạn' },
];

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  bank_qr: 'Chuyển khoản QR',
  mixed: 'Kết hợp',
};

export default function TodayTicketsPage() {
  useDocumentTitle('Vé trong ngày');
  const user = useAuthStore((state) => state.user);
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [showtimeFilter, setShowtimeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [printBooking, setPrintBooking] = useState<BookingDetail | null>(null);
  const [comboBooking, setComboBooking] = useState<BookingDetail | null>(null);

  const cinemaScope = user?.role === 'admin' ? adminCinemaId ?? undefined : undefined;

  const bookingsQuery = useQuery({
    queryKey: ['staff', 'today-bookings', cinemaScope ?? 'scope'],
    queryFn: () => staffTodayBookings(cinemaScope),
    refetchInterval: 60_000,
  });

  const bookings = bookingsQuery.data ?? [];
  const selected = bookings.find((item) => item.id === selectedId) ?? null;

  const showtimeOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const booking of bookings) {
      if (map.has(booking.showtimeId)) continue;
      map.set(booking.showtimeId, `${booking.showtime.startTime} · ${booking.movie.title} · ${booking.room.name}`);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [bookings]);

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: bookings.length };
    for (const booking of bookings) {
      next[booking.status] = (next[booking.status] ?? 0) + 1;
    }
    return next;
  }, [bookings]);

  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (status !== 'all' && booking.status !== status) return false;
      if (showtimeFilter !== 'all' && booking.showtimeId !== Number(showtimeFilter)) return false;
      if (!needle) return true;
      return [
        booking.code,
        booking.customerName,
        booking.customerPhone,
        booking.movie.title,
        booking.seats.map((seat) => seat.code).join(' '),
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [bookings, status, showtimeFilter, debouncedSearch]);

  const revenue = filtered.reduce(
    (sum, booking) => (booking.status === 'confirmed' || booking.status === 'completed' ? sum + booking.finalAmount : sum),
    0,
  );
  const comboPending = bookings.filter((booking) => booking.combos.length > 0 && !booking.comboPickedUpAt && (booking.status === 'confirmed' || booking.status === 'completed')).length;
  const filteredComboPending = filtered.filter((booking) => booking.combos.length > 0 && !booking.comboPickedUpAt && (booking.status === 'confirmed' || booking.status === 'completed')).length;

  const reprintMutation = useMutation({
    mutationFn: (code: string) => reprintTicket(code),
    onSuccess: (result, code) => {
      toast.success('Đã gửi lệnh in lại', result.message);
      const target = bookings.find((booking) => booking.code === code);
      if (target) {
        setPrintBooking(target);
        setSelectedId(null);
        window.setTimeout(() => window.print(), 150);
      }
      queryClient.invalidateQueries({ queryKey: ['staff', 'today-bookings'] });
    },
    onError: (error) => toast.error('Không in lại được vé', errorMessage(error)),
  });

  const comboMutation = useMutation({
    mutationFn: (code: string) => confirmComboPickup(code),
    onSuccess: (result) => {
      toast.success('Đã xác nhận combo', result.message);
      setComboBooking(null);
      queryClient.invalidateQueries({ queryKey: ['staff', 'today-bookings'] });
    },
    onError: (error) => toast.error('Không xác nhận được combo', errorMessage(error)),
  });

  const printTickets = (booking: BookingDetail) => {
    setPrintBooking(booking);
    setSelectedId(null);
    window.setTimeout(() => window.print(), 150);
  };

  const columns: Column<BookingDetail>[] = [
    {
      key: 'code',
      header: 'Mã đơn',
      sortValue: (row) => row.code,
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-ink">{row.code}</p>
          <p className="text-[10px] text-muted">{formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'movie',
      header: 'Phim / suất chiếu',
      sortValue: (row) => row.movie.title,
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate text-sm font-medium text-ink">{row.movie.title}</p>
          <p className="text-[10px] text-muted">{row.showtime.startTime} · {row.room.name} · {formatDate(row.showtime.showDate)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Khách',
      hideOnMobile: true,
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-[160px] truncate text-sm text-ink">{row.customerName || 'Khách lẻ'}</p>
          {row.customerPhone && <p className="text-[10px] text-muted">{row.customerPhone}</p>}
        </div>
      ),
    },
    {
      key: 'seats',
      header: 'Ghế',
      sortValue: (row) => row.seats.length,
      render: (row) => <span className="text-xs text-ink2">{row.seats.map((seat) => seat.code).join(', ')}</span>,
    },
    {
      key: 'total',
      header: 'Tổng tiền',
      align: 'right',
      sortValue: (row) => row.finalAmount,
      render: (row) => <span className="text-money text-sm font-semibold text-brand">{money(row.finalAmount)}</span>,
    },
    {
      key: 'payment',
      header: 'Thanh toán',
      align: 'center',
      hideOnMobile: true,
      render: (row) => {
        const payment = row.payments[0];
        return payment ? <PaymentStatusBadge status={payment.status} /> : <Badge tone="neutral">Chưa tạo</Badge>;
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setSelectedId(row.id); }}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="container-page py-6">
      <div className="print:hidden">
        <PageHeader
          title="Vé trong ngày"
          description="Tra cứu đơn vé hôm nay, in lại vé và xác nhận khách đã nhận combo bắp nước."
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void bookingsQuery.refetch()}
              loading={bookingsQuery.isFetching}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Làm mới
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Card className="p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted"><Ticket className="h-3 w-3" /> Đơn hôm nay</p>
            <p className="mt-1 text-money text-xl font-bold text-ink">{bookings.length}</p>
          </Card>
          <Card className="p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted"><CheckCheck className="h-3 w-3" /> Đã thanh toán</p>
            <p className="mt-1 text-money text-xl font-bold text-success">{(counts.confirmed ?? 0) + (counts.completed ?? 0)}</p>
          </Card>
          <Card className="p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted"><Popcorn className="h-3 w-3" /> Combo chờ nhận</p>
            <p className="mt-1 text-money text-xl font-bold text-gold">{comboPending}</p>
          </Card>
          <Card className="p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted"><Clock className="h-3 w-3" /> Doanh thu (lọc)</p>
            <p className="mt-1 text-money text-xl font-bold text-brand">{money(revenue)}</p>
          </Card>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <Chip key={filter.value} active={status === filter.value} onClick={() => setStatus(filter.value)}>
                {filter.label}
                <span className="text-[10px] opacity-70">{counts[filter.value === 'all' ? 'all' : filter.value] ?? 0}</span>
              </Chip>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm mã đơn, khách, phim, số ghế…"
                className="pl-9"
                aria-label="Tìm đơn vé trong ngày"
              />
            </div>
            <Select
              value={showtimeFilter}
              onChange={(event) => setShowtimeFilter(event.target.value)}
              aria-label="Lọc theo suất chiếu"
            >
              <option value="all">Tất cả suất chiếu</option>
              {showtimeOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4">
          {bookingsQuery.isError ? (
            <ErrorState
              title="Không tải được vé trong ngày"
              message={errorMessage(bookingsQuery.error)}
              onRetry={() => void bookingsQuery.refetch()}
            />
          ) : !bookingsQuery.isLoading && filtered.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title={bookings.length === 0 ? 'Chưa có đơn vé hôm nay' : 'Không có đơn phù hợp'}
              description={
                bookings.length === 0
                  ? 'Đơn bán tại quầy và đơn đặt online hôm nay sẽ xuất hiện tại đây ngay khi được tạo.'
                  : 'Thử đổi trạng thái, suất chiếu hoặc từ khóa tìm kiếm.'
              }
              action={
                (status !== 'all' || showtimeFilter !== 'all' || search.trim()) ? (
                  <Button
                    variant="secondary"
                    onClick={() => { setStatus('all'); setShowtimeFilter('all'); setSearch(''); }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void bookingsQuery.refetch()}>Tải lại</Button>
                )
              }
            />
          ) : (
            <DataTable
              key={`${status}-${showtimeFilter}-${debouncedSearch}`}
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
              loading={bookingsQuery.isLoading}
              onRowClick={(row) => setSelectedId(row.id)}
              pageSize={12}
              mobileCard={(row) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">{row.code}</span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-sm font-medium text-ink">{row.movie.title}</p>
                  <p className="text-[11px] text-muted">{formatDate(row.showtime.showDate)} · {row.showtime.startTime} · {row.room.name}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="flex items-center gap-1 text-ink2"><Armchair className="h-3 w-3 text-muted" /> {row.seats.map((seat) => seat.code).join(', ')}</span>
                    <span className="text-money font-bold text-brand">{money(row.finalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-2 text-[11px] text-muted">
                    <span className="truncate">{row.customerName || 'Khách lẻ'}{row.customerPhone ? ` · ${row.customerPhone}` : ''}</span>
                    <span className="text-brand">Chi tiết →</span>
                  </div>
                </div>
              )}
            />
          )}
          {!bookingsQuery.isLoading && !bookingsQuery.isError && filtered.length > 0 && (
            <p className="mt-3 text-[11px] text-muted">{filtered.length} đơn phù hợp · {filteredComboPending} combo chờ nhận</p>
          )}
        </div>
      </div>

      {printBooking && <BookingPrintout booking={printBooking} />}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Đơn ${selected.code}` : 'Chi tiết đơn'}
        width="lg"
        footer={
          selected && (
            <div className="flex flex-wrap justify-end gap-2">
              {selected.combos.length > 0 && !selected.comboPickedUpAt && (selected.status === 'confirmed' || selected.status === 'completed') && (
                <Button
                  variant="secondary"
                  onClick={() => { comboMutation.reset(); setComboBooking(selected); }}
                  icon={<Popcorn className="h-4 w-4" />}
                >
                  Xác nhận nhận combo
                </Button>
              )}
              {selected.tickets.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    loading={reprintMutation.isPending && reprintMutation.variables === selected.code}
                    onClick={() => reprintMutation.mutate(selected.code)}
                    icon={<RotateCcw className="h-4 w-4" />}
                  >
                    In lại vé
                  </Button>
                  <Button onClick={() => printTickets(selected)} icon={<Printer className="h-4 w-4" />}>
                    In vé
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              {selected.payments[0] && <PaymentStatusBadge status={selected.payments[0].status} />}
              <Badge tone="outline">{selected.channel === 'pos' ? 'Tại quầy' : 'Online'}</Badge>
              {selected.comboPickedUpAt && <Badge tone="success">Đã nhận combo</Badge>}
            </div>

            <div className="rounded-lg border border-line/70 bg-base/40 p-3">
              <p className="font-display text-base font-bold uppercase tracking-wide text-ink">{selected.movie.title}</p>
              <p className="mt-1 text-xs text-ink2">
                {selected.showtime.startTime} · {formatDate(selected.showtime.showDate)} · {selected.showtime.format}
              </p>
              <p className="mt-0.5 text-xs text-muted">{selected.cinema.name} · {selected.room.name}</p>
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-line/70 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted"><Users className="h-3 w-3" /> Khách hàng</p>
                <p className="mt-1 font-semibold text-ink">{selected.customerName || 'Khách lẻ'}</p>
                {selected.customerPhone && <p className="text-muted">{selected.customerPhone}</p>}
                {selected.customerEmail && <p className="truncate text-muted">{selected.customerEmail}</p>}
              </div>
              <div className="rounded-lg border border-line/70 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted"><Armchair className="h-3 w-3" /> Ghế</p>
                <p className="mt-1 font-semibold text-ink">{selected.seats.map((seat) => seat.code).join(', ')}</p>
                <p className="text-muted">{selected.seats.length} ghế · {money(selected.ticketsSubtotal)}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted">
                <span>Vé đã phát hành</span>
                <span>{selected.tickets.length} vé</span>
              </p>
              <div className="space-y-1.5">
                {selected.tickets.map((ticket) => (
                  <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line/60 bg-surface/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">Ghế {ticket.seatCode}</span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <span className="font-mono text-[10px] text-muted">{ticket.code}</span>
                    {ticket.checkedInAt && <span className="w-full text-[10px] text-muted">Soát lúc {formatDateTime(ticket.checkedInAt)} · {ticket.checkedInBy}</span>}
                  </div>
                ))}
                {selected.tickets.length === 0 && <p className="text-xs text-muted">Đơn chưa phát hành vé (chưa thanh toán).</p>}
              </div>
            </div>

            {selected.combos.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Bắp nước</p>
                <div className="space-y-1 rounded-lg border border-line/60 p-3 text-xs">
                  {selected.combos.map((combo) => (
                    <div key={combo.comboId} className="flex justify-between">
                      <span className="text-ink2">{combo.quantity}× {combo.name}</span>
                      <span className="text-money text-ink">{money(combo.price * combo.quantity)}</span>
                    </div>
                  ))}
                  <p className={cn('border-t border-line/60 pt-1.5 text-[11px]', selected.comboPickedUpAt ? 'text-success' : 'text-warning')}>
                    {selected.comboPickedUpAt ? `Đã nhận lúc ${formatDateTime(selected.comboPickedUpAt)}` : 'Chưa nhận tại quầy bắp nước'}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-line/70 bg-base/40 p-3 text-xs">
              <div className="flex justify-between py-0.5"><span className="text-muted">Tiền vé</span><span className="text-money text-ink">{money(selected.ticketsSubtotal)}</span></div>
              {selected.combosSubtotal > 0 && <div className="flex justify-between py-0.5"><span className="text-muted">Bắp nước</span><span className="text-money text-ink">{money(selected.combosSubtotal)}</span></div>}
              {selected.discount > 0 && <div className="flex justify-between py-0.5"><span className="text-muted">Giảm giá</span><span className="text-money text-success">−{money(selected.discount)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-line/60 pt-1.5 text-sm font-bold"><span className="text-ink">Tổng thu</span><span className="text-money text-brand">{money(selected.finalAmount)}</span></div>
              {selected.payments[0] && (
                <p className="mt-1.5 text-[11px] text-muted">
                  {METHOD_LABEL[selected.payments[0].method] ?? selected.payments[0].method}
                  {selected.payments[0].paidAt ? ` · ${formatDateTime(selected.payments[0].paidAt)}` : ''}
                  {selected.payments[0].reference ? ` · ${selected.payments[0].reference}` : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {selected.tickets.length > 0 && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => reprintMutation.mutate(selected.code)} loading={reprintMutation.isPending}>
                    In lại
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => printTickets(selected)}>
                    In vé giấy
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => void bookingsQuery.refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Cập nhật
              </Button>
            </div>
          </div>
        ) : (
          <Skeleton className="h-40 w-full" />
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(comboBooking)}
        onClose={() => setComboBooking(null)}
        onConfirm={() => {
          if (comboBooking) comboMutation.mutate(comboBooking.code);
        }}
        title="Xác nhận khách đã nhận combo?"
        description={
          comboBooking && (
            <span>
              Đơn <span className="font-mono text-ink">{comboBooking.code}</span> gồm{' '}
              {comboBooking.combos.map((combo) => `${combo.quantity}× ${combo.name}`).join(', ')}.
              Thao tác này chỉ xác nhận một lần và không thể hoàn tác.
            </span>
          )
        }
        confirmText="Đã giao combo"
        loading={comboMutation.isPending}
      />
    </div>
  );
}

function BookingPrintout({ booking }: { booking: BookingDetail }) {
  return (
    <div className="hidden print:block print:text-black">
      <div className="mx-auto max-w-xl space-y-3 font-mono text-xs leading-relaxed">
        <div className="text-center">
          <h1 className="text-xl font-bold">PXU CINEMA</h1>
          <p>Vé điện tử · Đơn {booking.code}</p>
        </div>
        {booking.tickets.map((ticket) => (
          <div key={ticket.id} className="flex items-start justify-between gap-4 border border-black p-3">
            <div>
              <p className="font-bold">Phim: {booking.movie.title}</p>
              <p>Suất: {booking.showtime.startTime} · {formatDate(booking.showtime.showDate)}</p>
              <p>Rạp: {booking.cinema.name} · {booking.room.name}</p>
              <p className="mt-1 text-sm font-bold">Ghế {ticket.seatCode}</p>
              <p className="break-all">Mã vé: {ticket.code}</p>
              <p>Trạng thái: {ticket.status === 'valid' ? 'Chưa sử dụng' : ticket.status === 'used' ? 'Đã sử dụng' : ticket.status === 'cancelled' ? 'Đã hủy' : 'Hết hạn'}</p>
              {booking.combos.length > 0 && (
                <p>Combo: {booking.combos.map((combo) => `${combo.quantity}× ${combo.name}`).join(', ')}</p>
              )}
              <p>Tổng đơn: {money(booking.finalAmount)}</p>
            </div>
            <div className="[&_button]:hidden">
              <QRImage value={ticket.code} size={84} fileName={`pxu-${ticket.code}`} />
            </div>
          </div>
        ))}
        <p className="text-center">Vui lòng xuất trình vé và giấy tờ (phim T16/T18) tại cửa phòng.</p>
      </div>
    </div>
  );
}
