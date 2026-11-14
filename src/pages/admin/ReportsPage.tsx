import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Info, RefreshCw } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { exportReport, getReport } from '@/api';
import type { ReportResult } from '@/api';
import { useUiStore } from '@/store/ui';
import { errorMessage } from '@/lib/errors';
import { addDaysISO, dateISO } from '@/lib/datetime';
import { compactMoney, downloadBlob, formatDate, money, number } from '@/lib/format';
import {
  Button, Card, DataTable, ErrorState, Field, Input, PageHeader, Skeleton, StatusBadge, Tabs,
  Tooltip, toast,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { CinemaSelect, Notice, Panel } from './commerce/shared';

const REPORTS = [
  {
    value: 'revenue',
    label: 'Doanh thu',
    definition: 'Doanh thu theo ngày trong khoảng lọc, đã trừ các khoản hoàn tiền hoàn tất; kèm số vé, số đơn và giá trị trung bình mỗi đơn.',
  },
  {
    value: 'movies',
    label: 'Phim',
    definition: 'Doanh thu và số vé theo từng phim, chỉ tính các đơn đã thanh toán phát sinh trong khoảng ngày.',
  },
  {
    value: 'showtimes',
    label: 'Suất chiếu',
    definition: 'Số vé đã bán trên sức chứa từng suất chiếu trong khoảng ngày, kèm tỷ lệ lấp đầy phòng.',
  },
  {
    value: 'staff-shifts',
    label: 'Ca làm việc',
    definition: 'Ca của nhân viên: tiền đầu ca, doanh số, số giao dịch và chênh lệch quỹ cuối ca.',
  },
  {
    value: 'vouchers',
    label: 'Voucher',
    definition: 'Lượt dùng và tổng tiền giảm của từng voucher, không tính các lượt đã bị hoàn.',
  },
  {
    value: 'refunds',
    label: 'Hoàn / hủy',
    definition: 'Các yêu cầu hoàn tiền phát sinh trong khoảng ngày; tổng tiền chỉ gồm các yêu cầu đã hoàn tất.',
  },
  {
    value: 'customers',
    label: 'Khách hàng',
    definition: 'Chi tiêu, số đơn và điểm thưởng hiện tại của khách hàng trong khoảng ngày.',
  },
  {
    value: 'concessions',
    label: 'Bắp nước',
    definition: 'Số lượng đã bán, doanh thu và tồn kho hiện tại của từng sản phẩm bắp nước.',
  },
  {
    value: 'checkin',
    label: 'Soát vé',
    definition: 'Tỷ lệ soát vé thành công theo suất chiếu, gồm số vé không đến và lượt quét lỗi.',
  },
] as const;

type ReportType = (typeof REPORTS)[number]['value'];
type ReportRow = Record<string, string | number>;

const MONEY_KEYS: Record<string, true> = {
  revenue: true, avg: true, openingCash: true, sales: true, difference: true,
  discount: true, amount: true, spend: true, price: true,
};
const DATE_KEYS: Record<string, true> = { date: true, created: true };

function renderReportValue(key: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === '') return <span className="text-muted">—</span>;
  if (key === 'status') return <StatusBadge status={String(value)} />;
  if (DATE_KEYS[key]) return formatDate(String(value));
  if (MONEY_KEYS[key]) return <span className="text-money">{money(Number(value))}</span>;
  if (typeof value === 'number') return <span className="text-money">{number(value)}</span>;
  return String(value);
}

export default function ReportsPage() {
  const today = dateISO();
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);
  const [type, setType] = useState<ReportType>('revenue');
  const [from, setFrom] = useState(addDaysISO(today, -13));
  const [to, setTo] = useState(today);
  const [cinemaId, setCinemaId] = useState<number | null>(adminCinemaId);

  useEffect(() => {
    setCinemaId(adminCinemaId);
  }, [adminCinemaId]);

  const activeReport = REPORTS.find((report) => report.value === type) ?? REPORTS[0];
  const rangeValid = Boolean(from) && Boolean(to) && from <= to;

  const reportQuery = useQuery({
    queryKey: ['admin', 'reports', type, { from, to, cinemaId: cinemaId ?? 'all' }],
    queryFn: () => getReport(type, { from, to, cinemaId: cinemaId ?? undefined }),
    enabled: rangeValid,
  });

  const exportMutation = useMutation({
    mutationFn: () => exportReport(type, { from, to, cinemaId: cinemaId ?? undefined }),
    onSuccess: ({ filename, content }) => {
      downloadBlob(content, filename, 'text/csv;charset=utf-8');
      toast.success('Đã xuất báo cáo', filename);
    },
    onError: (error) => toast.error('Không xuất được báo cáo', errorMessage(error)),
  });

  const report: ReportResult | undefined = reportQuery.data;
  const tableRows: ReportRow[] = (report?.rows ?? []).map((row, index) => ({ ...row, __key: index }));
  const columns: Column<ReportRow>[] = (report?.columns ?? []).map((column) => ({
    key: column.key,
    header: column.label,
    align: column.align,
    sortValue: (row) => (typeof row[column.key] === 'number' ? row[column.key] : String(row[column.key] ?? '')),
    render: (row) => renderReportValue(column.key, row[column.key]),
  }));
  const totalEntries = Object.entries(report?.totals ?? {}).filter(([, value]) => value !== undefined);

  function resetFilters() {
    setFrom(addDaysISO(dateISO(), -13));
    setTo(dateISO());
    setCinemaId(adminCinemaId);
  }

  function refresh() {
    void reportQuery.refetch();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Báo cáo"
        description="Chọn loại báo cáo, khoảng ngày và rạp. Số liệu lấy trực tiếp từ hệ thống, không tính lại trên giao diện."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw className={reportQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={refresh}
              disabled={reportQuery.isFetching || !rangeValid}
            >
              Làm mới
            </Button>
            <Button
              variant="primary"
              icon={<Download className="h-4 w-4" />}
              loading={exportMutation.isPending}
              disabled={!rangeValid || reportQuery.isFetching || !report || report.rows.length === 0}
              onClick={() => exportMutation.mutate()}
            >
              Xuất CSV
            </Button>
          </div>
        }
      />

      <Tabs
        items={REPORTS.map((reportItem) => ({ value: reportItem.value, label: reportItem.label }))}
        value={type}
        onChange={setType}
        className="overflow-x-auto"
      />

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Từ ngày" htmlFor="report-from" required>
            <Input
              id="report-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              error={!rangeValid && Boolean(from && to)}
            />
          </Field>
          <Field label="Đến ngày" htmlFor="report-to" required>
            <Input
              id="report-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              error={!rangeValid && Boolean(from && to)}
            />
          </Field>
          <Field label="Rạp" htmlFor="report-cinema">
            <CinemaSelect id="report-cinema" value={cinemaId} onChange={setCinemaId} />
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" className="w-full" onClick={resetFilters}>Đặt lại 14 ngày</Button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Mặc định 14 ngày gần nhất. Báo cáo doanh thu và vé tổng hợp theo ngày; báo cáo suất chiếu giới hạn 200 dòng gần nhất.
        </p>
      </Card>

      {!rangeValid ? (
        <Notice tone="warning" title="Khoảng ngày không hợp lệ">
          Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc. Điều chỉnh lại bộ lọc để tải báo cáo.
        </Notice>
      ) : reportQuery.isError ? (
        <ErrorState
          title="Không tải được báo cáo"
          message={errorMessage(reportQuery.error)}
          onRetry={() => void reportQuery.refetch()}
        />
      ) : (
        <Panel
          title={
            <span className="flex items-center gap-2">
              {report?.title ?? activeReport.label}
              <Tooltip content={activeReport.definition}>
                <button
                  type="button"
                  aria-label="Xem định nghĩa báo cáo"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand/50 hover:text-brand"
                >
                  <Info className="h-3 w-3" />
                </button>
              </Tooltip>
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{formatDate(from)} – {formatDate(to)}</span>
              <span>·</span>
              <span>{cinemaId ? 'Theo rạp đã chọn' : 'Tất cả rạp'}</span>
              {report && <span>· {report.rows.length} dòng</span>}
            </span>
          }
          action={<FileSpreadsheet className="h-4 w-4 text-brand" />}
        >
          <div className="mb-4">
            <p className="text-xs leading-relaxed text-muted">{activeReport.definition}</p>
          </div>

          {totalEntries.length > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {totalEntries.map(([key, value]) => {
                const label = report?.columns.find((column) => column.key === key)?.label ?? key;
                return (
                  <div key={key} className="rounded-lg border border-line/70 bg-base/40 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Tổng · {label}</p>
                    <p className="mt-0.5 text-money text-base font-semibold text-ink">
                      {renderReportValue(key, value)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {type === 'revenue' && (
            <div className="mb-4">
              {reportQuery.isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <RevenueReportChart rows={report?.rows ?? []} />
              )}
            </div>
          )}

          <DataTable
            columns={columns}
            rows={tableRows}
            rowKey={(row) => String(row.__key)}
            loading={reportQuery.isLoading}
            empty={report && report.rows.length === 0 ? 'Không có dữ liệu trong khoảng đã chọn' : 'Chưa có dữ liệu báo cáo'}
          />
          {reportQuery.isLoading && (
            <p className="mt-3 text-xs text-muted">Đang tổng hợp báo cáo…</p>
          )}
        </Panel>
      )}
    </div>
  );
}

function RevenueReportChart({ rows }: { rows: ReportRow[] }) {
  const data = rows.map((row) => ({
    label: formatDate(String(row.date ?? '')),
    revenue: Number(row.revenue ?? 0),
  }));
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="report-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6600" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ff6600" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <ChartTooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#f8fafc' }}
            labelStyle={{ color: '#cbd5e1' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value) => money(Number(value))}
          />
          <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#ff6600" strokeWidth={2} fill="url(#report-revenue-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
