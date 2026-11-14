import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Armchair, Banknote, CalendarRange, ChevronRight, Megaphone, Package,
  ReceiptText, RefreshCw, RotateCcw, Ticket, TimerOff, TrendingUp, WalletCards,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  getAdminAlerts, getChannelBreakdown, getDashboardSummary, getRevenueSeries, getTopMovies,
  getUpcomingShowtimes, listOrders,
} from '@/api';
import type { OrderRow } from '@/api';
import { useUiStore } from '@/store/ui';
import { errorMessage } from '@/lib/errors';
import { compactMoney, formatDate, money, number, percent, relativeTime } from '@/lib/format';
import {
  Badge, Button, Card, ErrorState, PageHeader, Progress, Skeleton, StatusBadge, Tabs, toast,
} from '@/components/ui';
import { PosterArt } from '@/components/common';
import {
  ChannelBadge, CinemaSelect, KpiCard, Notice, Panel, RevenueDelta, paymentMethodLabel,
} from './commerce/shared';

const RANGE_OPTIONS = [
  { value: '7', label: '7 ngày' },
  { value: '14', label: '14 ngày' },
  { value: '30', label: '30 ngày' },
] as const;

type RangeDays = 7 | 14 | 30;

const ALERT_ICON = {
  stock: Package,
  exception: AlertTriangle,
  receipt: ReceiptText,
  refund: RotateCcw,
} as const;

const ALERT_TONE = {
  warning: 'border-warning/35 bg-warning/5',
  danger: 'border-danger/35 bg-danger/5',
  info: 'border-info/30 bg-info/5',
} as const;

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
  color: '#f8fafc',
} as const;

export default function DashboardPage() {
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);
  const setAdminCinemaId = useUiStore((state) => state.setAdminCinemaId);
  const [days, setDays] = useState<RangeDays>(14);
  const cinemaId = adminCinemaId ?? undefined;
  const cinemaKey = cinemaId ?? 'all';

  const summaryQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'summary', cinemaKey],
    queryFn: () => getDashboardSummary({ cinemaId }),
    refetchInterval: 60_000,
  });
  const revenueQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'revenue', days, cinemaKey],
    queryFn: () => getRevenueSeries({ days, cinemaId }),
    refetchInterval: 60_000,
  });
  const channelQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'channels', cinemaKey],
    queryFn: () => getChannelBreakdown(cinemaId),
    refetchInterval: 60_000,
  });
  const topMoviesQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'top-movies', cinemaKey],
    queryFn: () => getTopMovies(5, cinemaId),
    refetchInterval: 60_000,
  });
  const upcomingQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'upcoming', cinemaKey],
    queryFn: () => getUpcomingShowtimes(6, cinemaId),
    refetchInterval: 60_000,
  });
  const ordersQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'latest-orders', cinemaKey],
    queryFn: () => listOrders({ cinemaId, page: 1, perPage: 6, sort: 'newest' }),
    refetchInterval: 60_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'alerts'],
    queryFn: getAdminAlerts,
    refetchInterval: 60_000,
  });

  const summary = summaryQuery.data;
  const series = revenueQuery.data ?? [];
  const channels = channelQuery.data;
  const channelTotal = (channels?.online ?? 0) + (channels?.pos ?? 0);
  const channelData = [
    { name: 'Trực tuyến', value: channels?.online ?? 0, color: '#38bdf8' },
    { name: 'Tại quầy', value: channels?.pos ?? 0, color: '#ff6600' },
  ].filter((item) => item.value > 0);
  const topMovies = topMoviesQuery.data ?? [];
  const maxMovieRevenue = Math.max(...topMovies.map((movie) => movie.revenue), 1);

  function refreshAll() {
    void Promise.all([
      summaryQuery.refetch(), revenueQuery.refetch(), channelQuery.refetch(),
      topMoviesQuery.refetch(), upcomingQuery.refetch(), ordersQuery.refetch(), alertsQuery.refetch(),
    ]).catch(() => undefined);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bảng điều khiển"
        description="Tổng quan vận hành rạp: doanh thu, vé bán, công suất phòng và các việc cần xử lý hôm nay."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="dashboard-cinema" className="label">Rạp</label>
              <CinemaSelect id="dashboard-cinema" value={adminCinemaId} onChange={setAdminCinemaId} className="min-w-[190px]" />
            </div>
            <Button
              variant="secondary"
              icon={<RefreshCw className={summaryQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={refreshAll}
              disabled={summaryQuery.isFetching}
            >
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Tự động cập nhật mỗi 60 giây · số liệu theo giờ Việt Nam</span>
        {adminCinemaId && <Badge tone="brand">Đang lọc theo rạp đã chọn</Badge>}
      </div>

      {summaryQuery.isError ? (
        <ErrorState
          title="Không tải được số liệu tổng quan"
          message={errorMessage(summaryQuery.error)}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : (
        <>
          <section aria-label="Chỉ số chính" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Doanh thu hôm nay"
              value={money(summary?.revenueToday)}
              icon={Banknote}
              tone="brand"
              loading={summaryQuery.isLoading && !summary}
              hint={
                summary
                  ? <RevenueDelta current={summary.revenueToday} previous={summary.revenuePrevDay} />
                  : undefined
              }
            />
            <KpiCard
              label="Doanh thu tháng"
              value={money(summary?.revenueMonth)}
              icon={CalendarRange}
              tone="gold"
              loading={summaryQuery.isLoading && !summary}
              hint="Từ đầu tháng đến hôm nay"
            />
            <KpiCard
              label="Vé bán hôm nay"
              value={number(summary?.ticketsToday)}
              icon={Ticket}
              tone="info"
              loading={summaryQuery.isLoading && !summary}
              hint={summary ? `${summary.ordersToday} đơn đã thanh toán` : undefined}
            />
            <KpiCard
              label="Tỷ lệ lấp đầy"
              value={`${summary?.occupancyRate ?? 0}%`}
              icon={Armchair}
              tone="success"
              loading={summaryQuery.isLoading && !summary}
              hint={
                summary
                  ? <Progress value={summary.occupancyRate} tone="success" className="mt-1 max-w-[140px]" />
                  : undefined
              }
            />
            <KpiCard
              label="Biên lai chờ duyệt"
              value={number(summary?.pendingReceipts)}
              icon={ReceiptText}
              tone="warning"
              loading={summaryQuery.isLoading && !summary}
              hint={<Link to="/admin/duyet-bien-lai" className="inline-flex items-center gap-1 font-semibold text-warning hover:underline">Mở hàng chờ <ChevronRight className="h-3 w-3" /></Link>}
            />
            <KpiCard
              label="Đơn hết hạn hôm nay"
              value={number(summary?.expiredToday)}
              icon={TimerOff}
              tone="danger"
              loading={summaryQuery.isLoading && !summary}
              hint="Giữ ghế quá hạn, chưa thanh toán"
            />
            <KpiCard
              label="Giá trị đơn trung bình"
              value={money(summary?.avgOrderValue)}
              icon={WalletCards}
              tone="brand"
              loading={summaryQuery.isLoading && !summary}
              hint="Trên các đơn đã thanh toán hôm nay"
            />
            <KpiCard
              label="Khách hàng mới"
              value={number(summary?.newCustomers)}
              icon={TrendingUp}
              tone="info"
              loading={summaryQuery.isLoading && !summary}
              hint="Tài khoản tạo mới trong ngày"
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title="Doanh thu theo ngày"
              description="Doanh thu đã thanh toán, đã trừ hoàn tiền hoàn tất."
              className="xl:col-span-2"
              action={
                <Tabs
                  items={RANGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={days === 7 ? '7' : days === 14 ? '14' : '30'}
                  onChange={(value) => setDays(Number(value) as RangeDays)}
                  variant="segment"
                  size="sm"
                />
              }
            >
              {revenueQuery.isError ? (
                <ErrorState
                  title="Không tải được biểu đồ doanh thu"
                  message={errorMessage(revenueQuery.error)}
                  onRetry={() => void revenueQuery.refetch()}
                />
              ) : revenueQuery.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : series.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Chưa có dữ liệu doanh thu trong khoảng đã chọn.</p>
              ) : null}
              {!revenueQuery.isLoading && !revenueQuery.isError && series.length > 0 && (
                <RevenueChart data={series} />
              )}
            </Panel>

            <Panel title="Cơ cấu kênh bán" description="Tổng hợp theo giao dịch đã thanh toán.">
              {channelQuery.isError ? (
                <ErrorState
                  title="Không tải được cơ cấu kênh"
                  message={errorMessage(channelQuery.error)}
                  onRetry={() => void channelQuery.refetch()}
                />
              ) : channelQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-40 w-40 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : channelTotal === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Chưa có giao dịch đã thanh toán.</p>
              ) : (
                <div>
                  <div className="relative mx-auto h-[184px] w-full max-w-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                          {channelData.map((item) => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          formatter={(value) => money(Number(value))}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-bold text-ink">{percent(channels?.online ?? 0, channelTotal)}%</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted">trực tuyến</span>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {channelData.map((item) => (
                      <li key={item.name} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 text-ink2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden />
                          {item.name}
                        </span>
                        <span className="text-money font-semibold text-ink">{money(item.value)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 space-y-1.5 border-t border-line/60 pt-3">
                    {(channels?.methods ?? []).slice(0, 4).map((method) => (
                      <div key={method.method} className="flex items-center justify-between text-[11px] text-muted">
                        <span>{paymentMethodLabel(method.method)} · {number(method.count)} giao dịch</span>
                        <span className="text-money text-ink2">{money(method.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Vé bán theo ngày" description={`Số vé của đơn đã xác nhận trong ${days} ngày.`} className="xl:col-span-2">
              {revenueQuery.isError ? (
                <ErrorState
                  title="Không tải được dữ liệu vé"
                  message={errorMessage(revenueQuery.error)}
                  onRetry={() => void revenueQuery.refetch()}
                />
              ) : revenueQuery.isLoading ? (
                <Skeleton className="h-[210px] w-full" />
              ) : series.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Chưa có dữ liệu vé trong khoảng đã chọn.</p>
              ) : (
                <TicketsChart data={series} />
              )}
            </Panel>

            <Panel
              title="Top 5 phim"
              description="Xếp theo doanh thu đơn đã thanh toán."
              action={<TrendingUp className="h-4 w-4 text-gold" />}
            >
              {topMoviesQuery.isError ? (
                <ErrorState
                  title="Không tải được top phim"
                  message={errorMessage(topMoviesQuery.error)}
                  onRetry={() => void topMoviesQuery.refetch()}
                />
              ) : topMoviesQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : topMovies.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Chưa có phim phát sinh doanh thu.</p>
              ) : (
                <ol className="space-y-3">
                  {topMovies.map((movie, index) => (
                    <li key={movie.movieTitle} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-base/50 text-[11px] font-bold text-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-medium text-ink">{movie.movieTitle}</p>
                          <span className="text-money shrink-0 text-xs font-semibold text-gold">{money(movie.revenue)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: movie.posterArt }}
                            aria-hidden
                          />
                          <span className="text-[11px] text-muted">{number(movie.tickets)} vé</span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand/60 to-gold"
                              style={{ width: `${Math.max(4, percent(movie.revenue, maxMovieRevenue))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title="Suất chiếu sắp tới"
              description="Sức chứa và tỷ lệ lấp đầy theo phòng."
              className="xl:col-span-2"
              action={<Link to="/admin/suat-chieu" className="text-xs font-semibold text-brand hover:underline">Quản lý suất chiếu</Link>}
            >
              {upcomingQuery.isError ? (
                <ErrorState
                  title="Không tải được suất chiếu"
                  message={errorMessage(upcomingQuery.error)}
                  onRetry={() => void upcomingQuery.refetch()}
                />
              ) : upcomingQuery.isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
                </div>
              ) : (upcomingQuery.data ?? []).length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Không có suất chiếu sắp tới.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(upcomingQuery.data ?? []).map((showtime) => {
                    const sold = Math.max(0, showtime.totalSeats - showtime.availableSeats);
                    const occupancy = percent(sold, showtime.totalSeats);
                    return (
                      <article key={showtime.id} className="flex gap-3 rounded-card border border-line/70 bg-base/35 p-2.5">
                        <div className="h-[68px] w-12 shrink-0 overflow-hidden rounded-md border border-line/70">
                          <PosterArt movie={showtime.movie} variant="thumb" showTitle={false} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-ink">{showtime.movie.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {formatDate(showtime.showDate)} · {showtime.startTime} · {showtime.room.name}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Progress value={occupancy} tone={occupancy >= 80 ? 'success' : 'brand'} className="h-1.5" />
                            <span className="shrink-0 text-money text-[11px] font-semibold text-ink2">{occupancy}%</span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted">
                            Bán {sold}/{showtime.totalSeats} ghế · còn {showtime.availableSeats}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel
              title="Cảnh báo vận hành"
              description="Việc cần xử lý để không gián đoạn bán vé."
              action={<Megaphone className="h-4 w-4 text-warning" />}
            >
              {alertsQuery.isError ? (
                <ErrorState
                  title="Không tải được cảnh báo"
                  message={errorMessage(alertsQuery.error)}
                  onRetry={() => void alertsQuery.refetch()}
                />
              ) : alertsQuery.isLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
                </div>
              ) : (alertsQuery.data ?? []).length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">Không có cảnh báo cần xử lý.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(alertsQuery.data ?? []).map((alert) => {
                    const Icon = ALERT_ICON[alert.type];
                    return (
                      <li key={`${alert.type}-${alert.title}`}>
                        <Link
                          to={alert.link}
                          className={`flex items-start gap-2.5 rounded-lg border p-3 transition hover:border-brand/40 ${ALERT_TONE[alert.tone]}`}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-current opacity-80" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-ink">{alert.title}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{alert.detail}</p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            title="Đơn hàng mới nhất"
            description="6 đơn gần đây theo thời điểm tạo."
            action={<Link to="/admin/don-hang" className="text-xs font-semibold text-brand hover:underline">Xem tất cả</Link>}
          >
            {ordersQuery.isError ? (
              <ErrorState
                title="Không tải được đơn hàng mới"
                message={errorMessage(ordersQuery.error)}
                onRetry={() => void ordersQuery.refetch()}
              />
            ) : ordersQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
              </div>
            ) : (ordersQuery.data?.rows ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">Chưa có đơn hàng.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {(ordersQuery.data?.rows ?? []).map((row: OrderRow) => (
                  <li key={row.booking.id}>
                    <Link
                      to={`/admin/don-hang/${row.booking.id}`}
                      className="flex flex-wrap items-center gap-3 py-3 transition hover:bg-elevated/30"
                    >
                      <div className="min-w-[130px] flex-1">
                        <p className="font-mono text-xs font-semibold text-brand">{row.booking.code}</p>
                        <p className="text-[11px] text-muted">{relativeTime(row.booking.createdAt)}</p>
                      </div>
                      <div className="min-w-[150px] flex-1">
                        <p className="text-sm font-medium text-ink">{row.customerName}</p>
                        <p className="text-[11px] text-muted">{row.movieTitle} · {row.roomName}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.paymentStatus} />
                        <ChannelBadge channel={row.channel} />
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-money text-sm font-semibold text-ink">{money(row.booking.finalAmount)}</p>
                        <p className="text-[11px] text-muted">{row.ticketCount} ghế</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {summaryQuery.isError && (
        <Notice tone="warning" title="Một số khối số liệu có thể chưa cập nhật">
          Hệ thống đang thử tải lại dashboard. Bạn vẫn có thể mở các trang nghiệp vụ từ menu quản trị.
        </Notice>
      )}

      {summaryQuery.isSuccess && summary && summary.pendingReceipts > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm font-semibold text-ink">{summary.pendingReceipts} biên lai đang chờ duyệt</p>
              <p className="text-xs text-muted">Duyệt sớm để giữ ghế cho khách theo SLA.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/duyet-bien-lai"
              className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-white shadow-glow transition hover:bg-brand-600"
            >
              Duyệt ngay
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { toast.info('Đã làm mới hàng chờ', 'Số liệu biên lai sẽ cập nhật trong giây lát.'); void alertsQuery.refetch(); }}
            >
              Kiểm tra lại
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function RevenueChart({ data }: { data: { label: string; revenue: number; tickets: number }[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboard-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6600" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#ff6600" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#cbd5e1' }}
            itemStyle={{ color: '#f8fafc' }}
            formatter={(value) => money(Number(value))}
            labelFormatter={(label) => `Ngày ${label}`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Doanh thu"
            stroke="#ff6600"
            strokeWidth={2}
            fill="url(#dashboard-revenue-fill)"
            activeDot={{ r: 4, fill: '#ff6600', stroke: '#0b0f19' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TicketsChart({ data }: { data: { label: string; tickets: number }[] }) {
  return (
    <div className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: '#cbd5e1' }}
            itemStyle={{ color: '#f8fafc' }}
            cursor={{ fill: 'rgba(56,189,248,0.08)' }}
            formatter={(value) => `${number(Number(value))} vé`}
            labelFormatter={(label) => `Ngày ${label}`}
          />
          <Bar dataKey="tickets" name="Vé" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
