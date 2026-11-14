import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX2, History, Search, Ticket } from 'lucide-react';
import { cancelHolding, myBookings, resendTicketsEmail } from '@/api';
import type { BookingDetail } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { useDebounce, useDocumentTitle } from '@/hooks';
import {
  Button, ConfirmDialog, EmptyState, ErrorState, Input, PageHeader, Pagination, Skeleton, Tabs, toast,
} from '@/components/ui';
import { BookingCard } from './components/BookingCard';

type TicketTab = 'upcoming' | 'past' | 'cancelled';

const TAB_ITEMS: { value: TicketTab; label: string; icon: ReactNode }[] = [
  { value: 'upcoming', label: 'Sắp tới', icon: <Ticket className="h-3.5 w-3.5" /> },
  { value: 'past', label: 'Đã xem', icon: <History className="h-3.5 w-3.5" /> },
  { value: 'cancelled', label: 'Đã hủy & hết hạn', icon: <CalendarX2 className="h-3.5 w-3.5" /> },
];

const PER_PAGE = 6;

export default function MyTicketsPage() {
  useDocumentTitle('Vé của tôi');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TicketTab>('upcoming');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [page, setPage] = useState(1);
  const [cancelCode, setCancelCode] = useState<string | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ['account', 'bookings', tab],
    queryFn: () => myBookings(tab, 1, 100),
    refetchOnMount: 'always',
  });

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedQuery]);

  useEffect(() => {
    setPage(1);
  }, [bookingsQuery.data?.total]);

  const cancelMutation = useMutation({
    mutationFn: (code: string) => cancelHolding(code),
    onSuccess: (result) => {
      toast.success('Đã hủy đơn', result.message);
      setCancelCode(null);
      queryClient.invalidateQueries({ queryKey: ['account', 'bookings'] });
    },
    onError: (error) => toast.error('Không hủy được đơn', errorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: (code: string) => resendTicketsEmail(code),
    onSuccess: (result) => {
      toast.success('Đã gửi lại vé', result.message);
      queryClient.invalidateQueries({ queryKey: ['account', 'bookings'] });
    },
    onError: (error) => toast.error('Không gửi được vé', errorMessage(error)),
  });

  const filtered = useMemo(() => {
    const rows = bookingsQuery.data?.items ?? [];
    const needle = debouncedQuery.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row: BookingDetail) => {
      const haystack = [
        row.code,
        row.movie.title,
        row.showtime.showDate,
        formatDate(row.showtime.showDate),
        row.cinema.name,
        row.room.name,
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [bookingsQuery.data, debouncedQuery]);

  const total = filtered.length;
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalSpend = filtered.reduce((sum, row) => (row.status === 'confirmed' || row.status === 'completed' ? sum + row.finalAmount : sum), 0);

  return (
    <div>
      <PageHeader
        title="Vé của tôi"
        description="Theo dõi đơn đặt vé, tiếp tục thanh toán và nhận vé điện tử ngay tại đây."
        actions={
          <span className="rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[11px] font-semibold text-ink2">
            {bookingsQuery.data ? `${bookingsQuery.data.total} đơn trong mục` : 'Đang tải…'}
          </span>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} className="lg:border-0" />
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã đơn, tên phim, ngày chiếu…"
            className="pl-9"
            aria-label="Tìm đơn vé"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted">
        <span>{total} đơn phù hợp</span>
        {tab !== 'cancelled' && (
          <span>
            Tổng giá trị vé đã thanh toán: <span className="text-money font-semibold text-ink2">{money(totalSpend)}</span>
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3.5">
        {bookingsQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-card" />
            ))}
          </div>
        )}

        {bookingsQuery.isError && (
          <ErrorState
            title="Không tải được danh sách vé"
            message={errorMessage(bookingsQuery.error)}
            onRetry={() => void bookingsQuery.refetch()}
          />
        )}

        {!bookingsQuery.isLoading && !bookingsQuery.isError && visible.length === 0 && (
          <EmptyState
            icon={<Ticket className="h-6 w-6" />}
            title={debouncedQuery.trim() ? 'Không tìm thấy đơn phù hợp' : tab === 'upcoming' ? 'Chưa có vé sắp tới' : tab === 'past' ? 'Chưa có vé đã xem' : 'Không có đơn đã hủy'}
            description={
              debouncedQuery.trim()
                ? 'Thử tìm bằng mã đơn, tên phim hoặc ngày chiếu khác.'
                : tab === 'upcoming'
                  ? 'Đặt vé cho suất chiếu sắp tới để nhận vé điện tử và combo bắp nước.'
                  : tab === 'past'
                    ? 'Các suất chiếu đã hoàn thành sẽ được lưu tại đây để bạn xem lại và đánh giá.'
                    : 'Các đơn đã hủy hoặc hết hạn giữ ghế sẽ xuất hiện tại đây.'
            }
            action={
              debouncedQuery.trim() ? (
                <Button variant="secondary" onClick={() => setQuery('')}>Xóa tìm kiếm</Button>
              ) : (
                <Button onClick={() => navigate('/phim')} icon={<Ticket className="h-4 w-4" />}>
                  Khám phá phim
                </Button>
              )
            }
          />
        )}

        {!bookingsQuery.isError &&
          visible.map((detail) => (
            <BookingCard
              key={detail.id}
              detail={detail}
              onCancel={(code) => { cancelMutation.reset(); setCancelCode(code); }}
              onResend={(code) => resendMutation.mutate(code)}
              onExpire={() => queryClient.invalidateQueries({ queryKey: ['account', 'bookings'] })}
              cancelPending={cancelMutation.isPending}
              resendPending={resendMutation.isPending && resendMutation.variables === detail.code}
            />
          ))}
      </div>

      {!bookingsQuery.isLoading && !bookingsQuery.isError && total > PER_PAGE && (
        <Pagination page={page} perPage={PER_PAGE} total={total} onChange={setPage} />
      )}

      <ConfirmDialog
        open={Boolean(cancelCode)}
        onClose={() => setCancelCode(null)}
        onConfirm={() => {
          if (cancelCode) cancelMutation.mutate(cancelCode);
        }}
        title="Hủy đơn giữ ghế?"
        description={
          <span>
            Đơn <span className="font-mono text-ink">{cancelCode}</span> sẽ bị hủy và ghế được nhả ngay, không thể khôi phục.
            {cancelMutation.isError && <span className="mt-2 block text-danger">{errorMessage(cancelMutation.error)}</span>}
          </span>
        }
        confirmText="Hủy đơn"
        cancelText="Giữ lại"
        danger
        loading={cancelMutation.isPending}
      />
    </div>
  );
}
