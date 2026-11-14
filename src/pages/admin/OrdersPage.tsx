import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight, Download, FilterX, ReceiptText, RotateCcw, Search, SlidersHorizontal,
} from 'lucide-react';
import { listOrders } from '@/api';
import type { BookingStatus, PaymentStatus } from '@/types/domain';
import { useDebounce } from '@/hooks';
import { useUiStore } from '@/store/ui';
import { errorMessage } from '@/lib/errors';
import { cn, money, relativeTime, toCsv, downloadBlob, formatDate, todayISO } from '@/lib/format';
import {
  Badge, Button, Card, DataTable, ErrorState, Field, Input, PageHeader, Pagination, Select, Skeleton, StatusBadge, toast,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import type { OrderRow } from '@/api';
import {
  ChannelBadge, CinemaSelect, PaymentMethodBadge, paymentMethodLabel,
} from './commerce/shared';

const STATUS_OPTIONS: { value: BookingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'holding', label: 'Đang giữ ghế' },
  { value: 'confirmed', label: 'Đã thanh toán' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'cancelled', label: 'Đã hủy' },
];

const PAYMENT_OPTIONS: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả thanh toán' },
  { value: 'pending', label: 'Chờ thanh toán' },
  { value: 'proof_submitted', label: 'Chờ duyệt biên lai' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'partially_refunded', label: 'Hoàn một phần' },
  { value: 'refunded', label: 'Đã hoàn tiền' },
  { value: 'rejected', label: 'Biên lai bị từ chối' },
  { value: 'failed', label: 'Thất bại' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'expired', label: 'Hết hạn' },
];

const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Tất cả kênh' },
  { value: 'online', label: 'Trực tuyến' },
  { value: 'pos', label: 'Tại quầy' },
] as const;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'amount', label: 'Giá trị cao' },
] as const;

type Channel = (typeof CHANNEL_OPTIONS)[number]['value'];
type Sort = (typeof SORT_OPTIONS)[number]['value'];

const PER_PAGE = 12;

export default function OrdersPage() {
  const navigate = useNavigate();
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q, 320);
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | 'all'>('all');
  const [channel, setChannel] = useState<Channel>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [cinemaId, setCinemaId] = useState<number | null>(adminCinemaId);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setCinemaId(adminCinemaId); }, [adminCinemaId]);
  useEffect(() => { setPage(1); }, [debouncedQ, status, paymentStatus, channel, from, to, sort, cinemaId]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'orders', { q: debouncedQ.trim(), status, paymentStatus, channel, from, to, sort, cinemaId, page }],
    queryFn: () => listOrders({
      q: debouncedQ.trim() || undefined,
      status,
      paymentStatus,
      channel,
      from: from || undefined,
      to: to || undefined,
      sort,
      cinemaId: cinemaId ?? undefined,
      page,
      perPage: PER_PAGE,
    }),
  });

  const filtersActive = Boolean(q.trim() || from || to)
    || status !== 'all' || paymentStatus !== 'all' || channel !== 'all'
    || sort !== 'newest' || cinemaId !== adminCinemaId;

  function resetFilters() {
    setQ('');
    setStatus('all');
    setPaymentStatus('all');
    setChannel('all');
    setFrom('');
    setTo('');
    setSort('newest');
    setCinemaId(adminCinemaId);
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const result = await listOrders({
        q: q.trim() || undefined,
        status,
        paymentStatus,
        channel,
        from: from || undefined,
        to: to || undefined,
        sort,
        cinemaId: cinemaId ?? undefined,
        page: 1,
        perPage: 5000,
      });
      const rows = result.rows.map((row) => ({
        'Mã đơn': row.booking.code,
        'Trạng thái': row.booking.status,
        'Thanh toán': row.paymentStatus,
        'Kênh': row.channel === 'online' ? 'Trực tuyến' : 'Tại quầy',
        'Khách hàng': row.customerName,
        'Điện thoại': row.customerPhone,
        'Email': row.customerEmail,
        'Phim': row.movieTitle,
        'Rạp': row.cinemaName,
        'Phòng': row.roomName,
        'Suất chiếu': `${formatDate(row.showtime.showDate)} ${row.showtime.startTime}`,
        'Số ghế': row.ticketCount,
        'Phương thức': paymentMethodLabel(row.method),
        'Tổng tiền': row.booking.finalAmount,
        'Tạo lúc': row.booking.createdAt,
      }));
      downloadBlob(toCsv(rows), `don-hang-${todayISO()}.csv`, 'text/csv;charset=utf-8');
      toast.success('Đã xuất CSV', `${result.rows.length} đơn hàng theo bộ lọc hiện tại.`);
    } catch (err) {
      toast.error('Không xuất được CSV', errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: 'code',
      header: 'Mã đơn',
      sortValue: (row) => row.booking.code,
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-semibold text-brand">{row.booking.code}</span>
          <p className="mt-0.5 text-[11px] text-muted">{relativeTime(row.booking.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      sortValue: (row) => row.customerName,
      render: (row) => (
        <div className="min-w-[150px]">
          <p className="font-medium text-ink">{row.customerName}</p>
          <p className="text-[11px] text-muted">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'movie',
      header: 'Phim & suất chiếu',
      hideOnMobile: true,
      render: (row) => (
        <div className="min-w-[190px]">
          <p className="line-clamp-1 font-medium text-ink">{row.movieTitle}</p>
          <p className="text-[11px] text-muted">
            {formatDate(row.showtime.showDate)} · {row.showtime.startTime} · {row.cinemaName}
          </p>
          <p className="text-[11px] text-muted">{row.roomName} · {row.showtime.format}</p>
        </div>
      ),
    },
    {
      key: 'seats',
      header: 'Ghế',
      align: 'center',
      hideOnMobile: true,
      sortValue: (row) => row.ticketCount,
      render: (row) => <span className="text-money text-sm text-ink2">{row.ticketCount}</span>,
    },
    {
      key: 'payment',
      header: 'Thanh toán',
      hideOnMobile: true,
      render: (row) => (
        <div className="space-y-1">
          <PaymentMethodBadge method={row.method} />
          <div><StatusBadge status={row.paymentStatus} /></div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Tổng tiền',
      align: 'right',
      sortValue: (row) => row.booking.finalAmount,
      render: (row) => <span className="text-money font-semibold text-ink">{money(row.booking.finalAmount)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      hideOnMobile: true,
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.booking.status} />
          <ChannelBadge channel={row.channel} />
        </div>
      ),
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (row) => (
        <Link
          to={`/admin/don-hang/${row.booking.id}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
        >
          Chi tiết <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Đơn hàng"
        description="Tra cứu toàn bộ đơn vé trực tuyến và tại quầy, theo dõi trạng thái thanh toán và mở chi tiết để xử lý."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={() => void exportCsv()}>
              Xuất CSV
            </Button>
            {filtersActive && (
              <Button variant="ghost" icon={<FilterX className="h-4 w-4" />} onClick={resetFilters}>
                Đặt lại lọc
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Bộ lọc
          </p>
          <p className="text-xs text-muted">
            {isFetching && !isLoading ? 'Đang cập nhật…' : `${data?.total ?? 0} đơn phù hợp`}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Tìm kiếm" htmlFor="orders-q" className="sm:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="orders-q"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Mã đơn, tên khách, SĐT hoặc email…"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Rạp" htmlFor="orders-cinema">
            <CinemaSelect id="orders-cinema" value={cinemaId} onChange={setCinemaId} />
          </Field>
          <Field label="Sắp xếp" htmlFor="orders-sort">
            <Select id="orders-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Trạng thái đơn" htmlFor="orders-status">
            <Select id="orders-status" value={status} onChange={(event) => setStatus(event.target.value as BookingStatus | 'all')}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Trạng thái thanh toán" htmlFor="orders-payment">
            <Select id="orders-payment" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | 'all')}>
              {PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Kênh bán" htmlFor="orders-channel">
            <Select id="orders-channel" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
              {CHANNEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Từ ngày" htmlFor="orders-from">
              <Input id="orders-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Đến ngày" htmlFor="orders-to">
              <Input id="orders-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {isError ? (
        <ErrorState
          title="Không tải được danh sách đơn hàng"
          message={errorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 hidden items-center justify-between md:flex">
            <p className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
              <ReceiptText className="h-4 w-4 text-brand" /> Danh sách đơn
            </p>
            <p className="text-xs text-muted">Nhấn vào dòng để mở chi tiết đơn</p>
          </div>
          <DataTable
            columns={columns}
            rows={data?.rows ?? []}
            rowKey={(row) => row.booking.id}
            loading={isLoading}
            onRowClick={(row) => navigate(`/admin/don-hang/${row.booking.id}`)}
            empty={data && data.total === 0 ? 'Không có đơn hàng phù hợp bộ lọc' : 'Chưa có đơn hàng'}
            emptyAction={filtersActive ? <Button variant="secondary" size="sm" onClick={resetFilters}>Xóa bộ lọc</Button> : undefined}
            mobileCard={(row) => (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-brand">{row.booking.code}</p>
                    <p className="mt-0.5 text-sm font-medium text-ink">{row.customerName}</p>
                    <p className="text-[11px] text-muted">{row.customerPhone}</p>
                  </div>
                  <StatusBadge status={row.booking.status} />
                </div>
                <div className="rounded-lg border border-line/60 bg-base/40 p-2.5 text-xs">
                  <p className="font-medium text-ink">{row.movieTitle}</p>
                  <p className="mt-0.5 text-muted">
                    {formatDate(row.showtime.showDate)} · {row.showtime.startTime} · {row.roomName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={row.paymentStatus} />
                    <ChannelBadge channel={row.channel} />
                  </div>
                  <span className="text-money font-semibold text-ink">{money(row.booking.finalAmount)}</span>
                </div>
              </div>
            )}
          />
          {data && data.total > 0 && (
            <Pagination
              page={data.page}
              perPage={data.perPage}
              total={data.total}
              onChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
          {isLoading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Skeleton className="h-3 w-32" /> Đang tải đơn hàng…
            </div>
          )}
          {filtersActive && !isLoading && !isError && (
            <button
              type="button"
              onClick={resetFilters}
              className={cn('mt-4 inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-brand')}
            >
              <RotateCcw className="h-3 w-3" /> Xóa toàn bộ bộ lọc
            </button>
          )}
          {data && data.total > 0 && (
            <p className="mt-4 flex items-center gap-1 text-[11px] text-muted">
              <Badge tone="outline">Trang {data.page}</Badge>
              Hiển thị {data.rows.length} / {data.total} đơn
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
