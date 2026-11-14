import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, CircleDollarSign, Eye, Plus, RefreshCw, Search,
} from 'lucide-react';
import {
  approveRefund, completeRefund, createRefund, listOrders, listRefunds, rejectRefund,
} from '@/api';
import type { OrderRow, RefundRow } from '@/api';
import type { Refund } from '@/types/domain';
import { useDebounce } from '@/hooks';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, formatDateTime, money } from '@/lib/format';
import {
  Badge, Button, Card, Checkbox, ConfirmDialog, DataTable, Drawer, ErrorState, Field, InfoRow,
  Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, toast,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import {
  Notice, Panel, RefundStatusBadge, refundScopeLabel,
} from './commerce/shared';

type RefundTab = 'all' | Refund['status'];

const TABS: { value: RefundTab; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'requested', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'failed', label: 'Thất bại' },
];

export default function RefundsPage() {
  const qc = useQueryClient();
  const can = useAuthStore((state) => state.can);
  const [tab, setTab] = useState<RefundTab>('all');
  const [selected, setSelected] = useState<RefundRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');
  const debouncedSearch = useDebounce(bookingSearch, 320);
  const [selectedBooking, setSelectedBooking] = useState<OrderRow | null>(null);
  const [scope, setScope] = useState<'full' | 'partial'>('full');
  const [seatIds, setSeatIds] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<RefundRow | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState<RefundRow | null>(null);
  const [completeTarget, setCompleteTarget] = useState<RefundRow | null>(null);
  const [completeReference, setCompleteReference] = useState('');
  const [completeNote, setCompleteNote] = useState('');

  const refundsQuery = useQuery({
    queryKey: ['admin', 'refunds', 'all'],
    queryFn: () => listRefunds('all'),
  });
  const rows = refundsQuery.data ?? [];
  const filtered = tab === 'all' ? rows : rows.filter((row) => row.status === tab);
  const activeRefund = selected ? rows.find((row) => row.id === selected.id) ?? selected : null;

  const searchQuery = useQuery({
    queryKey: ['admin', 'refunds', 'order-search', debouncedSearch.trim()],
    queryFn: () => listOrders({ q: debouncedSearch.trim(), page: 1, perPage: 8, sort: 'newest' }),
    enabled: createOpen && debouncedSearch.trim().length >= 2,
  });
  const recentQuery = useQuery({
    queryKey: ['admin', 'refunds', 'eligible-orders'],
    queryFn: () => listOrders({ status: 'confirmed', page: 1, perPage: 6, sort: 'newest' }),
    enabled: createOpen && debouncedSearch.trim().length < 2,
  });
  const candidates = (debouncedSearch.trim().length >= 2
    ? searchQuery.data?.rows ?? []
    : recentQuery.data?.rows ?? []
  ).filter((row) => row.booking.status === 'confirmed' || row.booking.status === 'completed');

  function invalidateRefunds() {
    void qc.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'order'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'badges'] });
  }

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedBooking) throw new Error('Chưa chọn đơn hàng cần hoàn tiền.');
      return createRefund({
        bookingId: selectedBooking.booking.id,
        scope,
        seatIds: scope === 'partial' ? seatIds : undefined,
        reason: reason.trim(),
      });
    },
    onSuccess: (refund) => {
      toast.success('Đã tạo yêu cầu hoàn tiền', `${refund.code} · ${money(refund.amount)}`);
      setCreateOpen(false);
      setSelectedBooking(null);
      setBookingSearch('');
      setSeatIds([]);
      setReason('');
      setScope('full');
      setSelected(refund);
      invalidateRefunds();
    },
    onError: (error) => toast.error('Không tạo được yêu cầu hoàn tiền', errorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!approveTarget) throw new Error('Chưa chọn yêu cầu.');
      return approveRefund(approveTarget.id, approveNote.trim() || undefined);
    },
    onSuccess: (result) => {
      toast.success('Đã duyệt yêu cầu', result.message);
      setApproveTarget(null);
      setApproveNote('');
      invalidateRefunds();
    },
    onError: (error) => toast.error('Không duyệt được yêu cầu', errorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: (rejectReason: string) => {
      if (!rejectTarget) throw new Error('Chưa chọn yêu cầu.');
      return rejectRefund(rejectTarget.id, rejectReason);
    },
    onSuccess: (result) => {
      toast.success('Đã từ chối yêu cầu', result.message);
      setRejectTarget(null);
      invalidateRefunds();
    },
    onError: (error) => toast.error('Không từ chối được yêu cầu', errorMessage(error)),
  });

  const completeMutation = useMutation({
    mutationFn: () => {
      if (!completeTarget) throw new Error('Chưa chọn yêu cầu.');
      return completeRefund(completeTarget.id, completeReference.trim(), completeNote.trim() || undefined);
    },
    onSuccess: (result) => {
      toast.success('Đã hoàn tất hoàn tiền', result.message);
      setCompleteTarget(null);
      setCompleteReference('');
      setCompleteNote('');
      invalidateRefunds();
    },
    onError: (error) => toast.error('Không hoàn tất được hoàn tiền', errorMessage(error)),
  });

  function openCreate() {
    setSelectedBooking(null);
    setBookingSearch('');
    setScope('full');
    setSeatIds([]);
    setReason('');
    setCreateOpen(true);
  }

  function chooseBooking(row: OrderRow) {
    setSelectedBooking(row);
    setScope('full');
    setSeatIds([]);
    setReason('');
  }

  const seatChoices = selectedBooking?.booking.seats.filter((seat) => seat.active) ?? [];

  const columns: Column<RefundRow>[] = [
    {
      key: 'code',
      header: 'Mã hoàn',
      sortValue: (row) => row.code,
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-brand">{row.code}</p>
          <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Đơn / khách',
      sortValue: (row) => row.bookingCode,
      render: (row) => (
        <div className="min-w-[140px]">
          <Link
            to={`/admin/don-hang/${row.bookingId}`}
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-xs font-semibold text-brand hover:underline"
          >
            {row.bookingCode}
          </Link>
          <p className="mt-0.5 text-sm font-medium text-ink">{row.customerName}</p>
        </div>
      ),
    },
    {
      key: 'movie',
      header: 'Phim',
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-ink2">{row.movieTitle}</span>,
    },
    {
      key: 'seats',
      header: 'Ghế',
      hideOnMobile: true,
      render: (row) => (
        <div className="space-y-1">
          <span className="text-xs text-ink2">{refundScopeLabel(row.scope)}</span>
          <p className="font-mono text-[11px] text-muted">{row.seats.join(', ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Số tiền',
      align: 'right',
      sortValue: (row) => row.amount,
      render: (row) => <span className="text-money font-semibold text-ink">{money(row.amount)}</span>,
    },
    {
      key: 'reason',
      header: 'Lý do',
      hideOnMobile: true,
      render: (row) => <p className="line-clamp-2 max-w-[220px] text-xs text-muted">{row.reason}</p>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => <RefundStatusBadge status={row.status} />,
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Xem yêu cầu ${row.code}`}
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hoàn tiền"
        description="Tạo và theo dõi yêu cầu hoàn tiền cho đơn đã thanh toán. Duyệt, từ chối và nhập mã giao dịch hoàn tất."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className={refundsQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={() => void refundsQuery.refetch()}
              disabled={refundsQuery.isFetching}
            >
              Làm mới
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} disabled={!can('refund.request')} onClick={openCreate}>
              Tạo yêu cầu
            </Button>
          </div>
        }
      />

      <Tabs
        items={TABS.map((item) => ({
          value: item.value,
          label: item.label,
          count: item.value === 'all' ? rows.length : rows.filter((row) => row.status === item.value).length,
        }))}
        value={tab}
        onChange={setTab}
      />

      {refundsQuery.isError ? (
        <ErrorState
          title="Không tải được danh sách hoàn tiền"
          message={errorMessage(refundsQuery.error)}
          onRetry={() => void refundsQuery.refetch()}
        />
      ) : (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-wide text-ink">
              <CircleDollarSign className="h-4 w-4 text-gold" /> Yêu cầu hoàn tiền
            </p>
            <p className="text-xs text-muted">{filtered.length} yêu cầu</p>
          </div>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            loading={refundsQuery.isLoading}
            onRowClick={(row) => setSelected(row)}
            empty={rows.length === 0 ? 'Chưa có yêu cầu hoàn tiền nào' : 'Không có yêu cầu ở trạng thái này'}
            emptyAction={rows.length === 0 ? <Button variant="secondary" size="sm" onClick={openCreate}>Tạo yêu cầu đầu tiên</Button> : undefined}
            mobileCard={(row) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-brand">{row.code}</p>
                    <p className="mt-0.5 text-sm font-medium text-ink">{row.customerName}</p>
                    <p className="text-[11px] text-muted">Đơn {row.bookingCode} · {row.movieTitle}</p>
                  </div>
                  <RefundStatusBadge status={row.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted">{refundScopeLabel(row.scope)} · {row.seats.join(', ') || '—'}</span>
                  <span className="text-money font-semibold text-ink">{money(row.amount)}</span>
                </div>
                <p className="line-clamp-2 text-[11px] text-muted">{row.reason}</p>
              </div>
            )}
          />
        </Card>
      )}

      <Drawer
        open={Boolean(activeRefund)}
        onClose={() => setSelected(null)}
        title={activeRefund ? `Hoàn tiền ${activeRefund.code}` : 'Chi tiết hoàn tiền'}
        width="lg"
        footer={
          activeRefund ? (
            <div className="flex flex-wrap justify-end gap-2">
              {activeRefund.status === 'requested' && (
                <>
                  <Button
                    variant="danger"
                    disabled={!can('refund.approve')}
                    onClick={() => setRejectTarget(activeRefund)}
                  >
                    Từ chối
                  </Button>
                  <Button
                    variant="primary"
                    disabled={!can('refund.approve')}
                    onClick={() => { setApproveNote(''); setApproveTarget(activeRefund); }}
                  >
                    Duyệt yêu cầu
                  </Button>
                </>
              )}
              {(activeRefund.status === 'approved' || activeRefund.status === 'processing') && (
                <Button
                  variant="primary"
                  disabled={!can('refund.process')}
                  onClick={() => { setCompleteReference(''); setCompleteNote(''); setCompleteTarget(activeRefund); }}
                >
                  Hoàn tất hoàn tiền
                </Button>
              )}
              <Button variant="ghost" onClick={() => setSelected(null)}>Đóng</Button>
            </div>
          ) : undefined
        }
      >
        {activeRefund && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <RefundStatusBadge status={activeRefund.status} />
              <Badge tone="outline">{refundScopeLabel(activeRefund.scope)}</Badge>
              <Badge tone="neutral">{activeRefund.code}</Badge>
            </div>

            <Panel title="Thông tin yêu cầu" bodyClassName="p-0">
              <div className="divide-y divide-line/60 px-4">
                <InfoRow label="Đơn hàng" value={
                  <Link to={`/admin/don-hang/${activeRefund.bookingId}`} className="font-mono text-xs font-semibold text-brand hover:underline">
                    {activeRefund.bookingCode}
                  </Link>
                } />
                <InfoRow label="Khách hàng" value={activeRefund.customerName} />
                <InfoRow label="Phim" value={activeRefund.movieTitle} />
                <InfoRow label="Ghế hoàn" value={<span className="font-mono">{activeRefund.seats.join(', ') || '—'}</span>} />
                <InfoRow label="Số tiền" value={<span className="text-money font-semibold text-brand">{money(activeRefund.amount)}</span>} />
                <InfoRow label="Lý do" value={<span className="max-w-[260px] text-left">{activeRefund.reason}</span>} />
                <InfoRow label="Tạo lúc" value={formatDateTime(activeRefund.createdAt)} />
                {activeRefund.approvedBy && <InfoRow label="Duyệt bởi" value={<span className="font-mono text-xs">{activeRefund.approvedBy}</span>} />}
                {activeRefund.reference && <InfoRow label="Mã giao dịch hoàn" value={<span className="font-mono text-xs">{activeRefund.reference}</span>} />}
                {activeRefund.completedAt && <InfoRow label="Hoàn tất lúc" value={formatDateTime(activeRefund.completedAt)} />}
                {activeRefund.note && <InfoRow label="Ghi chú" value={<span className="max-w-[260px] text-left">{activeRefund.note}</span>} />}
              </div>
            </Panel>

            <Notice tone="info" title="Tác động khi hoàn tất">
              <ul className="mt-1 space-y-1">
                {(activeRefund.scope === 'full' ? [
                  'Hủy toàn bộ ghế và vé của đơn hàng.',
                  'Đánh dấu thanh toán là đã hoàn tiền và cập nhật doanh thu.',
                  'Thu hồi voucher đã dùng và điểm thưởng đã tích.',
                  'Hoàn lại tồn kho combo cho đơn.',
                ] : [
                  'Vô hiệu các ghế được chọn và vé tương ứng.',
                  'Đánh dấu thanh toán là hoàn một phần.',
                  'Đơn giữ trạng thái đã thanh toán cho các ghế còn lại.',
                  'Không thu hồi toàn bộ điểm/voucher của đơn.',
                ]).map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                    {line}
                  </li>
                ))}
              </ul>
            </Notice>

            {activeRefund.status === 'requested' && !can('refund.approve') && (
              <p className="text-xs text-muted">Bạn không có quyền duyệt yêu cầu hoàn tiền. Liên hệ quản lý hoặc quản trị viên.</p>
            )}
            {activeRefund.status === 'approved' && (
              <Notice tone="warning" title="Đã duyệt, chưa chuyển tiền">
                Thực hiện chuyển khoản cho khách, sau đó nhập mã giao dịch hoàn tiền để hoàn tất.
              </Notice>
            )}
            <p className="text-[11px] text-muted">
              Mã yêu cầu được tạo tự động từ mã đơn. Mọi thao tác đều được ghi vào nhật ký hệ thống.
            </p>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo yêu cầu hoàn tiền"
        description="Tìm đơn đã thanh toán, chọn phạm vi hoàn và nhập lý do."
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted">Số tiền hoàn do hệ thống tính từ dữ liệu đơn.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button
                variant="primary"
                loading={createMutation.isPending}
                disabled={!selectedBooking || reason.trim().length < 5 || (scope === 'partial' && seatIds.length === 0)}
                onClick={() => createMutation.mutate()}
              >
                Tạo yêu cầu
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="refund-booking-search" className="label">Tìm đơn hàng</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                id="refund-booking-search"
                value={bookingSearch}
                onChange={(event) => setBookingSearch(event.target.value)}
                placeholder="Mã đơn, tên khách, SĐT hoặc email (tối thiểu 2 ký tự)…"
                className="pl-9"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {debouncedSearch.trim().length < 2
                ? 'Hiển thị các đơn đã thanh toán gần đây.'
                : 'Kết quả tìm kiếm chỉ gồm đơn đã thanh toán.'}
            </p>
          </div>

          {!selectedBooking && (
            <div className="rounded-card border border-line/70">
              {(searchQuery.isFetching || recentQuery.isFetching) ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted">
                  {debouncedSearch.trim().length >= 2
                    ? 'Không tìm thấy đơn đã thanh toán phù hợp.'
                    : 'Chưa có đơn đã thanh toán gần đây.'}
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-line/60 overflow-y-auto">
                  {candidates.map((row) => (
                    <li key={row.booking.id}>
                      <button
                        type="button"
                        onClick={() => chooseBooking(row)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-elevated/40"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-brand">{row.booking.code}</p>
                          <p className="mt-0.5 text-sm text-ink">{row.customerName}</p>
                          <p className="text-[11px] text-muted">{row.movieTitle} · {formatDate(row.showtime.showDate)} {row.showtime.startTime}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-money text-xs font-semibold text-ink">{money(row.booking.finalAmount)}</p>
                          <p className="text-[10px] text-muted">{row.ticketCount} ghế</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {selectedBooking && (
            <div className="rounded-card border border-brand/30 bg-brand/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-brand">{selectedBooking.booking.code}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{selectedBooking.customerName}</p>
                  <p className="text-[11px] text-muted">
                    {selectedBooking.movieTitle} · {formatDate(selectedBooking.showtime.showDate)} {selectedBooking.showtime.startTime} · {selectedBooking.roomName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-money text-sm font-semibold text-ink">{money(selectedBooking.booking.finalAmount)}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(null)}>Đổi đơn</Button>
                </div>
              </div>
            </div>
          )}

          {selectedBooking && (
            <>
              <Field label="Phạm vi hoàn" htmlFor="refund-create-scope" required>
                <Select id="refund-create-scope" value={scope} onChange={(event) => setScope(event.target.value as 'full' | 'partial')}>
                  <option value="full">Toàn phần — {money(selectedBooking.booking.finalAmount)}</option>
                  <option value="partial">Một phần — chọn từng ghế</option>
                </Select>
              </Field>

              {scope === 'partial' && (
                <div>
                  <p className="label">Ghế cần hoàn <span className="text-brand">*</span></p>
                  {seatChoices.length === 0 ? (
                    <p className="text-xs text-muted">Không còn ghế đang hoạt động trên đơn này.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {seatChoices.map((seat) => (
                        <Checkbox
                          key={seat.seatId}
                          checked={seatIds.includes(seat.seatId)}
                          onChange={(event) => setSeatIds((previous) => (
                            event.target.checked
                              ? [...previous, seat.seatId]
                              : previous.filter((value) => value !== seat.seatId)
                          ))}
                          className={cn(
                            'w-full items-center rounded-lg border px-3 py-2',
                            seatIds.includes(seat.seatId) ? 'border-brand/60 bg-brand/10' : 'border-line bg-base/40',
                          )}
                          label={
                            <span className="flex w-full items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-ink">{seat.code}</span>
                              <span className="text-money text-xs text-ink2">{money(seat.price)}</span>
                            </span>
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Field label="Lý do hoàn tiền" htmlFor="refund-create-reason" required hint="Tối thiểu 5 ký tự, lưu cùng yêu cầu và nhật ký.">
                <Textarea
                  id="refund-create-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Khách báo trùng lịch, hoàn theo chính sách…"
                />
              </Field>
            </>
          )}

          <Notice tone="info" title="Tạo yêu cầu chưa chuyển tiền">
            Yêu cầu sẽ ở trạng thái chờ duyệt. Quản lý duyệt và nhập mã giao dịch sau khi thực hiện chuyển khoản.
          </Notice>
        </div>
      </Modal>

      <Modal
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Duyệt yêu cầu hoàn tiền"
        description={approveTarget ? `${approveTarget.code} · ${money(approveTarget.amount)}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setApproveTarget(null)}>Hủy</Button>
            <Button variant="primary" loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>
              Duyệt
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Ghi chú duyệt" htmlFor="approve-note" hint="Không bắt buộc, hiển thị trong chi tiết yêu cầu.">
            <Textarea id="approve-note" value={approveNote} onChange={(event) => setApproveNote(event.target.value)} />
          </Field>
          <Notice tone="warning">Sau khi duyệt, bạn cần chuyển tiền và nhập mã giao dịch để hoàn tất.</Notice>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={(rejectReason) => rejectMutation.mutate(rejectReason)}
        title="Từ chối yêu cầu hoàn tiền"
        danger
        requireReason
        confirmText="Từ chối"
        loading={rejectMutation.isPending}
        description={rejectTarget ? `Yêu cầu ${rejectTarget.code} cho đơn ${rejectTarget.bookingCode} sẽ bị từ chối.` : undefined}
      />

      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Hoàn tất hoàn tiền"
        description={completeTarget ? `${completeTarget.code} · ${money(completeTarget.amount)}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleteTarget(null)}>Hủy</Button>
            <Button
              variant="success"
              loading={completeMutation.isPending}
              disabled={!completeReference.trim()}
              onClick={() => completeMutation.mutate()}
            >
              Hoàn tất
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Mã giao dịch hoàn tiền" htmlFor="complete-reference" required hint="Mã tham chiếu chuyển khoản hoàn tiền cho khách.">
            <Input
              id="complete-reference"
              value={completeReference}
              onChange={(event) => setCompleteReference(event.target.value)}
              placeholder="Ví dụ: FT26102600123"
            />
          </Field>
          <Field label="Ghi chú" htmlFor="complete-note">
            <Textarea id="complete-note" value={completeNote} onChange={(event) => setCompleteNote(event.target.value)} />
          </Field>
          <Notice tone="info">
            Hệ thống sẽ cập nhật vé, thanh toán và thông báo cho khách sau khi hoàn tất.
          </Notice>
        </div>
      </Modal>
    </div>
  );
}
