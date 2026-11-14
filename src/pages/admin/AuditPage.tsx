import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, RotateCcw, ScrollText, Search } from 'lucide-react';
import { listAuditLogs } from '@/api';
import type { AuditLog } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { useDebounce } from '@/hooks';
import {
  Badge, Button, Card, EmptyState, ErrorState, IconButton, Input, PageHeader, Pagination, Select,
  Skeleton,
} from '@/components/ui';
import { prettyMasked } from './system/mask';

const ACTION_OPTIONS = [
  { value: 'movie', label: 'Phim' },
  { value: 'showtime', label: 'Suất chiếu' },
  { value: 'order', label: 'Đơn hàng' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'refund', label: 'Hoàn tiền' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'member', label: 'Thành viên' },
  { value: 'user', label: 'Người dùng' },
  { value: 'banner', label: 'Banner' },
  { value: 'news', label: 'Tin tức' },
  { value: 'review', label: 'Đánh giá' },
  { value: 'settings', label: 'Cài đặt' },
  { value: 'cinema', label: 'Rạp' },
  { value: 'room', label: 'Phòng chiếu' },
  { value: 'combo', label: 'Bắp nước' },
  { value: 'pricing', label: 'Bảng giá' },
  { value: 'payment_settings', label: 'Cấu hình thanh toán' },
  { value: 'membership_tiers', label: 'Hạng thành viên' },
  { value: 'shift', label: 'Ca làm việc' },
  { value: 'ticket', label: 'Vé' },
  { value: 'checkin', label: 'Soát vé' },
  { value: 'seat_layout', label: 'Sơ đồ ghế' },
  { value: 'pos', label: 'Bán tại quầy' },
];

const ENTITY_LABEL: Record<string, string> = {
  order: 'Đơn hàng',
  booking: 'Đơn hàng',
  user: 'Người dùng',
  voucher: 'Voucher',
  movie: 'Phim',
  showtime: 'Suất chiếu',
  settings: 'Cài đặt',
  banner: 'Banner',
  news: 'Tin tức',
  review: 'Đánh giá',
  combo: 'Bắp nước',
  cinema: 'Rạp',
  room: 'Phòng chiếu',
  refund: 'Hoàn tiền',
  payment_exception: 'Giao dịch bất thường',
  pricing: 'Bảng giá',
  shift: 'Ca làm việc',
  ticket: 'Vé',
};

function entityPath(entity: string, entityId: string): string | null {
  switch (entity) {
    case 'order':
    case 'booking':
      return /^\d+$/.test(entityId) ? `/admin/don-hang/${entityId}` : '/admin/don-hang';
    case 'movie':
      return /^\d+$/.test(entityId) ? `/admin/phim/${entityId}` : '/admin/phim';
    case 'user':
      return '/admin/nguoi-dung';
    case 'voucher':
      return '/admin/voucher';
    case 'showtime':
      return '/admin/suat-chieu';
    case 'settings':
      return entityId === 'payment' ? '/admin/thanh-toan-qr' : entityId === 'tiers' ? '/admin/thanh-vien' : '/admin/cai-dat';
    case 'banner':
    case 'news':
      return '/admin/banner-tin-tuc';
    case 'review':
      return '/admin/danh-gia';
    case 'combo':
      return '/admin/combo';
    case 'cinema':
    case 'room':
      return '/admin/rap';
    case 'refund':
      return '/admin/hoan-tien';
    case 'payment_exception':
      return '/admin/giao-dich-bat-thuong';
    case 'pricing':
      return '/admin/bang-gia';
    default:
      return null;
  }
}

const PER_PAGE = 20;

export default function AuditPage() {
  const [q, setQ] = useState('');
  const debouncedSearch = useDebounce(q);
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number[]>([]);

  const query = useQuery({
    queryKey: ['admin', 'audit', { q: debouncedSearch, action, from, to }],
    queryFn: () => listAuditLogs({
      q: debouncedSearch.trim() || undefined,
      action: action === 'all' ? undefined : action,
      from: from || undefined,
      to: to || undefined,
      limit: 200,
    }),
  });

  useEffect(() => {
    setPage(1);
    setExpanded([]);
  }, [debouncedSearch, action, from, to]);

  const rows = query.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const filtersActive = Boolean(q || from || to || action !== 'all');
  const dateRangeInvalid = Boolean(from && to && from > to);

  const resetFilters = () => {
    setQ('');
    setAction('all');
    setFrom('');
    setTo('');
  };

  const toggleRow = (id: number) => setExpanded((prev) => (
    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
  ));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhật ký hệ thống"
        description="Bảng ghi chỉ đọc mọi thao tác quản trị. Dữ liệu nhạy cảm được che tự động khi xem chi tiết."
        actions={<Badge tone="neutral">{rows.length} bản ghi</Badge>}
      />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_160px_160px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm người thực hiện, hành động hoặc mã đối tượng…"
              className="pl-9"
              aria-label="Tìm nhật ký"
            />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Lọc theo hành động">
            <option value="all">Mọi hành động</option>
            {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Từ ngày"
            error={dateRangeInvalid}
          />
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Đến ngày"
            error={dateRangeInvalid}
          />
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={resetFilters} disabled={!filtersActive}>
            Xóa lọc
          </Button>
        </div>
        {dateRangeInvalid && <p className="mt-2 text-xs text-danger" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
        <p className="mt-2 text-xs text-muted">Nhật ký chỉ đọc, tối đa 200 bản ghi gần nhất theo bộ lọc.</p>
      </Card>

      {query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
      ) : query.isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title={filtersActive ? 'Không có bản ghi phù hợp' : 'Chưa có nhật ký'}
          description={filtersActive ? 'Thử mở rộng khoảng ngày hoặc bỏ bớt bộ lọc.' : 'Các thao tác quản trị sẽ xuất hiện tại đây.'}
          action={filtersActive ? <Button variant="outline" size="sm" onClick={resetFilters}>Xóa bộ lọc</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          <div className="hidden overflow-x-auto rounded-card border border-line md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-base/50 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3" aria-label="Mở rộng" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((log) => {
                  const open = expanded.includes(log.id);
                  const path = entityPath(log.entity, log.entityId);
                  return (
                    <Fragment key={log.id}>
                      <tr className="border-b border-line/50 align-top last:border-0 hover:bg-elevated/30">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink2">{formatDateTime(log.at)}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-ink">{log.actorName}</p>
                          <p className="text-[11px] text-muted">{log.actorId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-ink2">{log.action}</p>
                          <p className="text-[11px] text-muted">{ACTION_OPTIONS.find((option) => log.action.startsWith(option.value))?.label ?? 'Khác'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-ink">{ENTITY_LABEL[log.entity] ?? log.entity}</p>
                          <p className="max-w-[180px] truncate font-mono text-[11px] text-muted" title={log.entityId}>{log.entityId}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted">{log.ip}</td>
                        <td className="px-4 py-3 text-right">
                          <IconButton
                            label={open ? 'Thu gọn chi tiết' : 'Xem chi tiết'}
                            size="sm"
                            aria-expanded={open}
                            onClick={() => toggleRow(log.id)}
                          >
                            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                          </IconButton>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-line/50 last:border-0">
                          <td colSpan={6} className="bg-base/40 p-0">
                            <AuditDetail log={log} path={path} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 md:hidden">
            {pageRows.map((log) => {
              const open = expanded.includes(log.id);
              const path = entityPath(log.entity, log.entityId);
              return (
                <Card key={log.id} className="overflow-hidden">
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{log.actorName}</p>
                        <p className="text-[11px] text-muted">{formatDateTime(log.at)}</p>
                      </div>
                      <IconButton
                        label={open ? 'Thu gọn chi tiết' : 'Xem chi tiết'}
                        size="sm"
                        aria-expanded={open}
                        onClick={() => toggleRow(log.id)}
                      >
                        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                      </IconButton>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{ACTION_OPTIONS.find((option) => log.action.startsWith(option.value))?.label ?? 'Khác'}</Badge>
                      <span className="font-mono text-[11px] text-ink2">{log.action}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {ENTITY_LABEL[log.entity] ?? log.entity} · <span className="font-mono">{log.entityId}</span>
                    </p>
                  </div>
                  {open && <AuditDetail log={log} path={path} />}
                </Card>
              );
            })}
          </div>

          <Pagination page={currentPage} perPage={PER_PAGE} total={rows.length} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function AuditDetail({ log, path }: { log: AuditLog; path: string | null }) {
  return (
    <div className="space-y-3 border-t border-line/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{ENTITY_LABEL[log.entity] ?? log.entity}</Badge>
          <span className="font-mono text-xs text-ink2">{log.entityId}</span>
          {path && (
            <Link to={path} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Mở đối tượng <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted">IP {log.ip}</span>
      </div>
      {log.reason && (
        <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-warning">Lý do</p>
          <p className="mt-0.5 text-sm text-warning">{log.reason}</p>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Trước thay đổi</p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-base/70 p-3 text-[11px] leading-relaxed text-ink2">{prettyMasked(log.before)}</pre>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Sau thay đổi</p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-line bg-base/70 p-3 text-[11px] leading-relaxed text-ink2">{prettyMasked(log.after)}</pre>
        </div>
      </div>
    </div>
  );
}
