import type {
  AppSettings, AuditLog, Booking, BookingDetail, Database, MembershipTier, Payment, PaymentException,
  PaymentStatus, Refund, SessionUser, Showtime, User, Voucher,
} from '@/types/domain';
import { ApiError } from '@/types/domain';
import { hashPassword } from '../crypto';
import { addDaysISO, dateISO } from '@/lib/datetime';
import { money, toCsv } from '@/lib/format';
import {
  audit, latestPayment, mutateDb, nextId, notify, requirePermission,
  restoreComboStock, revertVoucher, scopeCinemaIds, startMsOf, toSessionUser, withDb,
} from '../core';
import { activeSeatIds, sellableSeats, toShowtimePublic, type ShowtimePublic } from './catalog';
import { toBookingDetail } from './booking';
import { includedTax } from '../pricing';

export interface OrderRow {
  booking: Booking;
  showtime: Showtime;
  movieTitle: string;
  cinemaName: string;
  roomName: string;
  paymentStatus: PaymentStatus;
  method?: Payment['method'];
  channel: Booking['channel'];
  ticketCount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export interface TimelineEvent {
  at: string;
  label: string;
  detail?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}

export interface OrderDetail {
  detail: BookingDetail;
  customer: SessionUser | null;
  staffName?: string;
  shiftId?: string;
  timeline: TimelineEvent[];
  refundedAmount: number;
  internalNote?: string;
}

export interface DashboardSummary {
  revenueToday: number;
  revenuePrevDay: number;
  revenueMonth: number;
  ticketsToday: number;
  ordersToday: number;
  occupancyRate: number;
  pendingReceipts: number;
  expiredToday: number;
  avgOrderValue: number;
  newCustomers: number;
  onlineShare: number;
  posShare: number;
}

export interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
  tickets: number;
  orders: number;
}

export interface ReceiptQueueItem {
  booking: Booking;
  payment: Payment;
  showtime: Showtime;
  movieTitle: string;
  cinemaName: string;
  customerName: string;
  customerPhone: string;
  waitMinutes: number;
  slaDeadlineAt: string;
  duplicateOf: string[];
}

export interface RefundRow extends Refund {
  bookingCode: string;
  customerName: string;
  movieTitle: string;
  seats: string[];
}

export interface MemberRow {
  user: SessionUser;
  totalSpend: number;
  bookingsCount: number;
  lastVisit?: string;
  tier: MembershipTier;
}

export interface ReportResult {
  title: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number | undefined>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function localDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function scopedCinemaIds(user: User, requested?: number): number[] {
  const scope = scopeCinemaIds(user);
  if (requested) {
    if (scope.length && !scope.includes(requested)) throw new ApiError('FORBIDDEN', 'Bạn không có quyền với rạp này.', {}, 403);
    return [requested];
  }
  return scope;
}

function orderRows(db: Database, rows: Booking[]): OrderRow[] {
  return rows.map((booking) => {
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
    const movie = db.movies.find((m) => m.id === showtime.movieId);
    const cinema = db.cinemas.find((c) => c.id === showtime.cinemaId);
    const room = db.rooms.find((r) => r.id === showtime.roomId);
    const payment = latestPayment(db, booking.id);
    return {
      booking, showtime, movieTitle: movie?.title ?? '—', cinemaName: cinema?.name ?? '—', roomName: room?.name ?? '—',
      paymentStatus: payment?.status ?? 'pending', method: payment?.method, channel: booking.channel,
      ticketCount: booking.seats.length,
      customerName: booking.customerName, customerPhone: booking.customerPhone, customerEmail: booking.customerEmail,
    };
  });
}

export function paymentStatusOf(db: Database, bookingId: number): PaymentStatus {
  return latestPayment(db, bookingId)?.status ?? 'pending';
}

function paidRevenue(db: Database, from: string, to: string, cinemaIds: number[]): number {
  let revenue = 0;
  for (const payment of db.payments) {
    if (!payment.paidAt) continue;
    if (payment.status !== 'paid' && payment.status !== 'partially_refunded' && payment.status !== 'refunded') continue;
    const date = localDate(payment.paidAt);
    if (date < from || date > to) continue;
    const booking = db.bookings.find((b) => b.id === payment.bookingId);
    if (!booking) continue;
    if (cinemaIds.length && !cinemaIds.includes(booking.cinemaId)) continue;
    revenue += payment.amount;
  }
  for (const refund of db.refunds) {
    if (refund.status !== 'completed' || !refund.completedAt) continue;
    const date = localDate(refund.completedAt);
    if (date < from || date > to) continue;
    const booking = db.bookings.find((b) => b.id === refund.bookingId);
    if (!booking) continue;
    if (cinemaIds.length && !cinemaIds.includes(booking.cinemaId)) continue;
    revenue -= refund.amount;
  }
  return revenue;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function getDashboardSummary(input: { cinemaId?: number } = {}): Promise<DashboardSummary> {
  return withDb((db) => {
    const actor = requirePermission(db, 'dashboard.view');
    const scope = scopedCinemaIds(actor, input.cinemaId);
    const today = dateISO();
    const yesterday = addDaysISO(today, -1);
    const monthStart = `${today.slice(0, 7)}-01`;
    const revenueToday = paidRevenue(db, today, today, scope);
    const revenuePrevDay = paidRevenue(db, yesterday, yesterday, scope);
    const revenueMonth = paidRevenue(db, monthStart, today, scope);
    const todaysBookings = db.bookings.filter((b) => {
      if (scope.length && !scope.includes(b.cinemaId)) return false;
      return (b.confirmedAt && localDate(b.confirmedAt) === today) || (b.createdAt && localDate(b.createdAt) === today);
    });
    const paidBookings = todaysBookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
    const ticketsToday = paidBookings.reduce((sum, b) => sum + b.seats.filter((s) => s.active).length, 0);
    let capacity = 0;
    let occupied = 0;
    const todayShowtimes = db.showtimes.filter((s) => {
      if (s.showDate !== today || s.status === 'cancelled') return false;
      if (scope.length && !scope.includes(s.cinemaId)) return false;
      return startMsOf(s) < Date.now();
    });
    for (const showtime of todayShowtimes) {
      capacity += sellableSeats(db, showtime.roomId).length;
      occupied += activeSeatIds(db, showtime.id).size;
    }
    const pendingReceipts = db.payments.filter((p) => p.status === 'proof_submitted').length;
    const expiredToday = db.bookings.filter((b) => b.status === 'expired' && localDate(b.updatedAt) === today).length;
    const online = paidBookings.filter((b) => b.channel === 'online').reduce((sum, b) => sum + b.finalAmount, 0);
    const pos = paidBookings.filter((b) => b.channel === 'pos').reduce((sum, b) => sum + b.finalAmount, 0);
    const total = online + pos;
    const newCustomers = db.users.filter((u) => u.role === 'customer' && localDate(u.createdAt) === today).length;
    return {
      revenueToday, revenuePrevDay, revenueMonth, ticketsToday,
      ordersToday: paidBookings.length,
      occupancyRate: capacity ? Math.round((occupied / capacity) * 100) : 0,
      pendingReceipts, expiredToday,
      avgOrderValue: paidBookings.length ? Math.round(revenueToday / paidBookings.length) : 0,
      newCustomers,
      onlineShare: total ? Math.round((online / total) * 100) : 0,
      posShare: total ? 100 - Math.round((online / total) * 100) : 0,
    };
  });
}

export async function getRevenueSeries(input: { days?: number; cinemaId?: number } = {}): Promise<RevenuePoint[]> {
  return withDb((db) => {
    const actor = requirePermission(db, 'dashboard.view');
    const scope = scopedCinemaIds(actor, input.cinemaId);
    const days = input.days ?? 14;
    const points: RevenuePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysISO(dateISO(), -i);
      const revenue = paidRevenue(db, date, date, scope);
      const bookings = db.bookings.filter((b) => {
        if (scope.length && !scope.includes(b.cinemaId)) return false;
        if (b.status !== 'confirmed' && b.status !== 'completed') return false;
        return localDate(b.confirmedAt) === date;
      });
      points.push({
        date,
        label: `${date.slice(8, 10)}-${date.slice(5, 7)}`,
        revenue,
        tickets: bookings.reduce((sum, b) => sum + b.seats.length, 0),
        orders: bookings.length,
      });
    }
    return points;
  });
}

export async function getTopMovies(limit = 5, cinemaId?: number): Promise<{ movieTitle: string; revenue: number; tickets: number; posterArt: string }[]> {
  return withDb((db) => {
    const actor = requirePermission(db, 'dashboard.view');
    const scope = scopedCinemaIds(actor, cinemaId);
    const map = new Map<number, { revenue: number; tickets: number }>();
    for (const booking of db.bookings) {
      if (booking.status !== 'confirmed' && booking.status !== 'completed') continue;
      if (scope.length && !scope.includes(booking.cinemaId)) continue;
      const showtime = db.showtimes.find((s) => s.id === booking.showtimeId);
      if (!showtime) continue;
      const entry = map.get(showtime.movieId) ?? { revenue: 0, tickets: 0 };
      entry.revenue += booking.finalAmount;
      entry.tickets += booking.seats.length;
      map.set(showtime.movieId, entry);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit)
      .map(([movieId, stats]) => {
        const movie = db.movies.find((m) => m.id === movieId);
        return { movieTitle: movie?.title ?? '—', revenue: stats.revenue, tickets: stats.tickets, posterArt: movie?.art.from ?? '#ff6600' };
      });
  });
}

export async function getChannelBreakdown(cinemaId?: number): Promise<{ online: number; pos: number; methods: { method: string; amount: number; count: number }[] }> {
  return withDb((db) => {
    const actor = requirePermission(db, 'dashboard.view');
    const scope = scopedCinemaIds(actor, cinemaId);
    let online = 0;
    let pos = 0;
    const methods = new Map<string, { amount: number; count: number }>();
    for (const payment of db.payments) {
      if (payment.status !== 'paid' && payment.status !== 'partially_refunded') continue;
      const booking = db.bookings.find((b) => b.id === payment.bookingId);
      if (!booking) continue;
      if (scope.length && !scope.includes(booking.cinemaId)) continue;
      if (booking.channel === 'online') online += payment.amount;
      else pos += payment.amount;
      const entry = methods.get(payment.method) ?? { amount: 0, count: 0 };
      entry.amount += payment.amount;
      entry.count += 1;
      methods.set(payment.method, entry);
    }
    return {
      online, pos,
      methods: [...methods.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
    };
  });
}

export async function getUpcomingShowtimes(limit = 6, cinemaId?: number): Promise<ShowtimePublic[]> {
  return withDb((db) => {
    const actor = requirePermission(db, 'dashboard.view');
    const scope = scopedCinemaIds(actor, cinemaId);
    return db.showtimes
      .filter((s) => s.status === 'selling' || s.status === 'closed')
      .filter((s) => !scope.length || scope.includes(s.cinemaId))
      .filter((s) => startMsOf(s) > Date.now() - 30 * 60_000)
      .sort((a, b) => startMsOf(a) - startMsOf(b))
      .slice(0, limit)
      .map((s) => toShowtimePublic(db, s));
  });
}

export async function getAdminAlerts(): Promise<{ type: 'stock' | 'exception' | 'receipt' | 'refund'; title: string; detail: string; link: string; tone: 'warning' | 'danger' | 'info' }[]> {
  return withDb((db) => {
    requirePermission(db, 'dashboard.view');
    const alerts: { type: 'stock' | 'exception' | 'receipt' | 'refund'; title: string; detail: string; link: string; tone: 'warning' | 'danger' | 'info' }[] = [];
    for (const combo of db.combos.filter((c) => c.stock < 20)) {
      alerts.push({
        type: 'stock', title: `Tồn kho thấp: ${combo.name}`,
        detail: `Còn ${combo.stock} phần. Cân nhắc nhập thêm hàng.`, link: '/admin/combo',
        tone: combo.stock === 0 ? 'danger' : 'warning',
      });
    }
    const openExceptions = db.exceptions.filter((e) => e.status === 'open');
    if (openExceptions.length) {
      alerts.push({
        type: 'exception', title: `${openExceptions.length} giao dịch bất thường`,
        detail: 'Có khoản chuyển khoản chưa liên kết được với đơn nào.', link: '/admin/giao-dich-bat-thuong', tone: 'danger',
      });
    }
    const stale = db.payments.filter((p) => p.status === 'proof_submitted' && p.submittedAt && Date.now() - new Date(p.submittedAt).getTime() > 10 * 60_000);
    if (stale.length) {
      alerts.push({
        type: 'receipt', title: `${stale.length} biên lai chờ quá 10 phút`,
        detail: 'Đơn đang giữ ghế theo SLA, cần duyệt sớm.', link: '/admin/duyet-bien-lai', tone: 'warning',
      });
    }
    const refunds = db.refunds.filter((r) => r.status === 'requested');
    if (refunds.length) {
      alerts.push({
        type: 'refund', title: `${refunds.length} yêu cầu hoàn tiền`,
        detail: 'Chờ quản lý duyệt và xử lý.', link: '/admin/hoan-tien', tone: 'info',
      });
    }
    return alerts.slice(0, 8);
  });
}

export async function getAdminBadges(): Promise<{ receipts: number; exceptions: number; refunds: number; lowStock: number }> {
  return withDb((db) => {
    requirePermission(db, 'dashboard.view');
    return {
      receipts: db.payments.filter((p) => p.status === 'proof_submitted').length,
      exceptions: db.exceptions.filter((e) => e.status === 'open').length,
      refunds: db.refunds.filter((r) => r.status === 'requested').length,
      lowStock: db.combos.filter((c) => c.stock < 20).length,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Orders                                                             */
/* ------------------------------------------------------------------ */

export interface OrderQuery {
  q?: string; status?: Booking['status'] | 'all'; paymentStatus?: PaymentStatus | 'all';
  channel?: 'online' | 'pos' | 'all'; cinemaId?: number; from?: string; to?: string;
  voucher?: string; page?: number; perPage?: number; sort?: 'newest' | 'oldest' | 'amount';
}

export async function listOrders(params: OrderQuery = {}): Promise<{ rows: OrderRow[]; total: number; page: number; perPage: number }> {
  return withDb((db) => {
    const actor = requirePermission(db, 'booking.read');
    const scope = scopeCinemaIds(actor);
    let rows = db.bookings.filter((b) => !params.cinemaId || b.cinemaId === params.cinemaId);
    if (scope.length) rows = rows.filter((b) => scope.includes(b.cinemaId));
    if (params.status && params.status !== 'all') rows = rows.filter((b) => b.status === params.status);
    if (params.channel && params.channel !== 'all') rows = rows.filter((b) => b.channel === params.channel);
    if (params.from) rows = rows.filter((b) => localDate(b.createdAt) >= params.from!);
    if (params.to) rows = rows.filter((b) => localDate(b.createdAt) <= params.to!);
    if (params.voucher) rows = rows.filter((b) => b.voucherCode?.toUpperCase() === params.voucher!.toUpperCase());
    if (params.paymentStatus && params.paymentStatus !== 'all') {
      rows = rows.filter((b) => paymentStatusOf(db, b.id) === params.paymentStatus);
    }
    if (params.q?.trim()) {
      const needle = params.q.trim().toLowerCase();
      rows = rows.filter((b) => b.code.toLowerCase().includes(needle)
        || b.customerName.toLowerCase().includes(needle)
        || b.customerPhone.includes(needle)
        || b.customerEmail.toLowerCase().includes(needle));
    }
    rows = [...rows].sort((a, b) => {
      if (params.sort === 'oldest') return a.createdAt.localeCompare(b.createdAt);
      if (params.sort === 'amount') return b.finalAmount - a.finalAmount;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 12;
    const total = rows.length;
    return {
      rows: orderRows(db, rows.slice((page - 1) * perPage, page * perPage)),
      total, page, perPage,
    };
  });
}

export async function getOrderDetail(bookingId: number): Promise<OrderDetail> {
  return withDb((db) => {
    const actor = requirePermission(db, 'booking.read');
    const scope = scopeCinemaIds(actor);
    const booking = db.bookings.find((b) => b.id === bookingId || b.code === String(bookingId));
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', {}, 404);
    if (scope.length && !scope.includes(booking.cinemaId)) throw new ApiError('FORBIDDEN', 'Đơn thuộc rạp khác.', {}, 403);
    const detail = toBookingDetail(db, booking);
    const customer = booking.userId ? db.users.find((u) => u.id === booking.userId) ?? null : null;
    const staff = booking.staffId ? db.users.find((u) => u.id === booking.staffId) : null;
    const timeline: TimelineEvent[] = [{
      at: booking.createdAt, label: booking.channel === 'pos' ? 'Tạo đơn tại quầy' : 'Tạo đơn trực tuyến',
      detail: `${booking.seats.length} ghế · ${money(booking.finalAmount)}`, tone: 'info',
    }];
    const payment = latestPayment(db, booking.id);
    if (payment?.submittedAt) timeline.push({ at: payment.submittedAt, label: 'Khách gửi biên lai', detail: money(payment.paidAmount ?? payment.amount), tone: 'warning' });
    if (payment?.reviewedAt) {
      timeline.push({
        at: payment.reviewedAt,
        label: payment.status === 'rejected' ? 'Từ chối biên lai' : 'Duyệt thanh toán',
        detail: payment.rejectNote ?? (payment.reviewedBy ? `Bởi ${db.users.find((u) => u.id === payment.reviewedBy)?.name ?? payment.reviewedBy}` : undefined),
        tone: payment.status === 'rejected' ? 'danger' : 'success',
      });
    }
    if (booking.confirmedAt) timeline.push({ at: booking.confirmedAt, label: 'Xác nhận đơn & phát hành vé', detail: `${detail.tickets.length} vé`, tone: 'success' });
    for (const ticket of detail.tickets.filter((t) => t.checkedInAt)) {
      timeline.push({ at: ticket.checkedInAt!, label: `Check-in ghế ${ticket.seatCode}`, detail: ticket.checkedInBy, tone: 'neutral' });
    }
    if (booking.comboPickedUpAt) timeline.push({ at: booking.comboPickedUpAt, label: 'Nhận combo bắp nước', tone: 'neutral' });
    if (booking.cancelledAt) timeline.push({ at: booking.cancelledAt, label: 'Hủy đơn', detail: booking.cancelReason, tone: 'danger' });
    const refunds = db.refunds.filter((r) => r.bookingId === booking.id);
    for (const refund of refunds) {
      timeline.push({
        at: refund.completedAt ?? refund.createdAt,
        label: `Hoàn tiền ${refund.status === 'completed' ? 'hoàn tất' : refund.status}`,
        detail: `${money(refund.amount)} · ${refund.reason}`, tone: refund.status === 'rejected' ? 'danger' : 'warning',
      });
    }
    timeline.sort((a, b) => a.at.localeCompare(b.at));
    return {
      detail, customer: customer ? toSessionUser(customer) : null,
      staffName: staff?.name, shiftId: booking.shiftId,
      timeline,
      refundedAmount: refunds.filter((r) => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0),
    };
  });
}

export async function cancelOrder(bookingId: number, reason: string, withRefund: boolean): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'booking.cancel');
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    if (booking.status === 'cancelled' || booking.status === 'expired') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã bị hủy.', {}, 409);
    if (reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do hủy (tối thiểu 5 ký tự).', { fields: { reason: 'Bắt buộc' } }, 422);
    const wasPaid = booking.status === 'confirmed' || booking.status === 'completed';
    for (const seat of booking.seats) seat.active = false;
    for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id)) ticket.status = 'cancelled';
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.cancelReason = reason;
    if (wasPaid && withRefund) {
      db.refunds.push({
        id: nextId(db.refunds), code: `RF-${booking.code.slice(-6)}`, bookingId: booking.id,
        scope: 'full', seatIds: booking.seats.map((s) => s.seatId), amount: booking.finalAmount,
        reason, status: 'requested', requestedBy: actor.id, createdAt: new Date().toISOString(),
      });
    }
    revertVoucher(db, booking);
    restoreComboStock(db, booking);
    if (booking.userId) {
      notify(db, booking.userId, 'Đơn hàng đã bị hủy', `Đơn ${booking.code} đã bị hủy. Lý do: ${reason}.${wasPaid && withRefund ? ' Yêu cầu hoàn tiền đã được tạo.' : ''}`, 'booking', '/tai-khoan/ve-cua-toi');
    }
    audit(db, actor, 'order.cancel', 'order', booking.code, { status: wasPaid ? 'confirmed' : 'holding' }, { status: 'cancelled', withRefund }, reason);
    return { message: `Đã hủy đơn ${booking.code}${withRefund ? ' và tạo yêu cầu hoàn tiền' : ''}.` };
  });
}

export async function changeOrderSeats(bookingId: number, seatIds: number[], reason: string): Promise<{ message: string; difference: number }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'booking.change');
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    if (booking.status !== 'confirmed') throw new ApiError('BOOKING_INVALID_STATE', 'Chỉ đổi ghế cho đơn đã thanh toán chưa chiếu.', {}, 409);
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
    if (startMsOf(showtime) - Date.now() < 30 * 60_000) {
      throw new ApiError('BOOKING_INVALID_STATE', 'Chỉ được đổi ghế trước giờ chiếu tối thiểu 30 phút.', {}, 409);
    }
    if (reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do đổi ghế.', {}, 422);
    const taken = activeSeatIds(db, showtime.id, booking.id);
    const newSeats = db.seats.filter((s) => seatIds.includes(s.id) && s.roomId === showtime.roomId);
    if (newSeats.length !== seatIds.length) throw new ApiError('SEAT_UNAVAILABLE', 'Một số ghế không hợp lệ.', {}, 409);
    if (newSeats.some((s) => taken.has(s.id) || s.type === 'disabled')) throw new ApiError('SEAT_UNAVAILABLE', 'Ghế mới đã có người chọn.', {}, 409);
    const oldTotal = booking.ticketsSubtotal;
    for (const seat of booking.seats) seat.active = false;
    booking.seats = newSeats.map((seat) => ({
      seatId: seat.id, code: seat.code, type: seat.type,
      price: (seat.type === 'vip' ? showtime.basePrice + db.settings.seatSurcharge.vip
        : seat.type === 'couple' ? showtime.basePrice * 2 + db.settings.seatSurcharge.couple
          : showtime.basePrice + db.settings.seatSurcharge.standard),
      active: true,
    }));
    booking.ticketsSubtotal = booking.seats.reduce((sum, s) => sum + s.price, 0);
    const difference = booking.ticketsSubtotal - oldTotal;
    booking.finalAmount = Math.max(0, booking.finalAmount + difference);
    booking.taxAmount = includedTax(booking.finalAmount, db.settings.vatPercent);
    booking.updatedAt = new Date().toISOString();
    for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id)) {
      const match = booking.seats.find((s) => s.seatId === ticket.seatId);
      if (match) ticket.seatCode = match.code;
    }
    audit(db, actor, 'order.change_seats', 'order', booking.code, { seats: oldTotal }, { seats: booking.ticketsSubtotal, difference }, reason);
    return { message: `Đã đổi ghế đơn ${booking.code}.`, difference };
  });
}

export async function addOrderNote(bookingId: number, note: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'booking.read');
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    booking.note = note.trim();
    audit(db, actor, 'order.note', 'order', booking.code, undefined, { note });
    return { message: 'Đã lưu ghi chú nội bộ.' };
  });
}

/* ------------------------------------------------------------------ */
/* Receipt review queue                                                */
/* ------------------------------------------------------------------ */

export async function listReceiptQueue(): Promise<ReceiptQueueItem[]> {
  return withDb((db) => {
    requirePermission(db, 'payment.review');
    const payments = db.payments.filter((p) => p.status === 'proof_submitted').sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
    return payments.map((payment) => {
      const booking = db.bookings.find((b) => b.id === payment.bookingId)!;
      const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
      const movie = db.movies.find((m) => m.id === showtime.movieId);
      const cinema = db.cinemas.find((c) => c.id === booking.cinemaId);
      const submitted = payment.submittedAt ? new Date(payment.submittedAt).getTime() : Date.now();
      const slaDeadlineAt = new Date(Math.min(
        submitted + db.settings.proofPendingMaxMinutes * 60_000,
        startMsOf(showtime) - 30 * 60_000,
      )).toISOString();
      const duplicates = db.payments
        .filter((p) => p.proofHash && p.proofHash === payment.proofHash && p.id !== payment.id)
        .map((p) => db.bookings.find((b) => b.id === p.bookingId)?.code)
        .filter((code): code is string => Boolean(code));
      return {
        booking, payment, showtime, movieTitle: movie?.title ?? '—', cinemaName: cinema?.name ?? '—',
        customerName: booking.customerName, customerPhone: booking.customerPhone,
        waitMinutes: Math.round((Date.now() - submitted) / 60_000),
        slaDeadlineAt, duplicateOf: duplicates,
      };
    });
  });
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/* ------------------------------------------------------------------ */

function refundRows(db: Database, rows: Refund[]): RefundRow[] {
  return rows.map((refund) => {
    const booking = db.bookings.find((b) => b.id === refund.bookingId);
    const showtime = booking ? db.showtimes.find((s) => s.id === booking.showtimeId) : undefined;
    const movie = showtime ? db.movies.find((m) => m.id === showtime.movieId) : undefined;
    return {
      ...refund,
      bookingCode: booking?.code ?? '—',
      customerName: booking?.customerName ?? '—',
      movieTitle: movie?.title ?? '—',
      seats: booking ? booking.seats.filter((s) => refund.seatIds.includes(s.seatId)).map((s) => s.code) : [],
    };
  });
}

export async function listRefunds(status?: Refund['status'] | 'all'): Promise<RefundRow[]> {
  return withDb((db) => {
    requirePermission(db, 'refund.request');
    const rows = db.refunds
      .filter((r) => !status || status === 'all' || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return refundRows(db, rows);
  });
}

export async function createRefund(input: {
  bookingId: number; scope: 'full' | 'partial'; seatIds?: number[]; reason: string;
}): Promise<RefundRow> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'refund.request');
    const booking = db.bookings.find((b) => b.id === input.bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new ApiError('REFUND_NOT_ALLOWED', 'Chỉ hoàn tiền cho đơn đã thanh toán.', {}, 409);
    }
    if (input.reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do hoàn tiền.', {}, 422);
    const seatIds = input.scope === 'full' ? booking.seats.map((s) => s.seatId) : (input.seatIds ?? []);
    if (!seatIds.length) throw new ApiError('VALIDATION_ERROR', 'Vui lòng chọn ghế cần hoàn.', {}, 422);
    const amount = input.scope === 'full'
      ? booking.finalAmount
      : booking.seats.filter((s) => seatIds.includes(s.seatId)).reduce((sum, s) => sum + s.price, 0);
    if (amount <= 0) throw new ApiError('VALIDATION_ERROR', 'Số tiền hoàn không hợp lệ.', {}, 422);
    const refund: Refund = {
      id: nextId(db.refunds), code: `RF-${booking.code.slice(-6)}-${db.refunds.length + 1}`,
      bookingId: booking.id, scope: input.scope, seatIds, amount,
      reason: input.reason, status: 'requested', requestedBy: actor.id, createdAt: new Date().toISOString(),
    };
    db.refunds.push(refund);
    audit(db, actor, 'refund.request', 'refund', refund.code, undefined, { amount, scope: input.scope, booking: booking.code }, input.reason);
    return refundRows(db, [refund])[0];
  });
}

export async function approveRefund(id: number, note?: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'refund.approve');
    const refund = db.refunds.find((r) => r.id === id);
    if (!refund) throw new ApiError('NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền.', {}, 404);
    if (refund.status !== 'requested') throw new ApiError('BOOKING_INVALID_STATE', 'Yêu cầu không ở trạng thái chờ duyệt.', {}, 409);
    if (refund.amount > db.settings.refundApprovalThreshold && actor.role !== 'admin' && actor.role !== 'manager') {
      throw new ApiError('FORBIDDEN', 'Hoàn tiền trên ngưỡng cần quản lý hoặc quản trị viên duyệt.', {}, 403);
    }
    refund.status = 'approved';
    refund.approvedBy = actor.id;
    refund.note = note;
    audit(db, actor, 'refund.approve', 'refund', refund.id, { status: 'requested' }, { status: 'approved' }, note);
    return { message: 'Đã duyệt yêu cầu hoàn tiền. Tiếp theo hãy chuyển tiền và nhập mã giao dịch.' };
  });
}

export async function rejectRefund(id: number, reason: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'refund.approve');
    const refund = db.refunds.find((r) => r.id === id);
    if (!refund) throw new ApiError('NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền.', {}, 404);
    if (reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối.', {}, 422);
    refund.status = 'rejected';
    refund.note = reason;
    audit(db, actor, 'refund.reject', 'refund', refund.id, { status: refund.status }, { status: 'rejected' }, reason);
    return { message: 'Đã từ chối yêu cầu hoàn tiền.' };
  });
}

export async function completeRefund(id: number, reference: string, note?: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'refund.process');
    const refund = db.refunds.find((r) => r.id === id);
    if (!refund) throw new ApiError('NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền.', {}, 404);
    if (refund.status !== 'approved' && refund.status !== 'processing') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Yêu cầu cần được duyệt trước khi hoàn tất.', {}, 409);
    }
    if (!reference.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập mã giao dịch hoàn tiền.', {}, 422);
    const booking = db.bookings.find((b) => b.id === refund.bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', {}, 404);
    refund.status = 'completed';
    refund.reference = reference;
    refund.note = note;
    refund.completedAt = new Date().toISOString();
    const payment = latestPayment(db, booking.id);
    if (refund.scope === 'full') {
      for (const seat of booking.seats) seat.active = false;
      for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id)) ticket.status = 'cancelled';
      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.cancelReason = `Hoàn tiền toàn phần: ${refund.reason}`;
      if (payment) payment.status = 'refunded';
      revertVoucher(db, booking);
      restoreComboStock(db, booking);
      if (booking.userId) {
        const user = db.users.find((u) => u.id === booking.userId);
        const earned = db.pointTransactions.find((t) => t.bookingCode === booking.code && t.type === 'earn');
        if (user && earned) {
          const revert = Math.min(earned.points, user.points);
          user.points -= revert;
          db.pointTransactions.push({
            id: nextId(db.pointTransactions), userId: user.id, type: 'refund_revert',
            points: -revert, reason: `Thu hồi điểm do hoàn đơn ${booking.code}`,
            at: new Date().toISOString(), bookingCode: booking.code,
          });
        }
      }
    } else {
      for (const seatId of refund.seatIds) {
        const seat = booking.seats.find((s) => s.seatId === seatId);
        if (seat) seat.active = false;
      }
      for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id && refund.seatIds.includes(t.seatId))) {
        ticket.status = 'cancelled';
      }
      if (payment) payment.status = 'partially_refunded';
    }
    if (booking.userId) {
      notify(db, booking.userId, 'Đã hoàn tiền', `Yêu cầu hoàn tiền ${money(refund.amount)} cho đơn ${booking.code} đã hoàn tất. Mã giao dịch: ${reference}.`, 'payment', '/tai-khoan/ve-cua-toi');
    }
    audit(db, actor, 'refund.complete', 'refund', refund.id, { status: 'approved' }, { status: 'completed', reference, amount: refund.amount }, note);
    return { message: `Đã hoàn tất hoàn tiền ${money(refund.amount)}.` };
  });
}

/* ------------------------------------------------------------------ */
/* Payment exceptions                                                  */
/* ------------------------------------------------------------------ */

export async function listPaymentExceptions(): Promise<PaymentException[]> {
  return withDb((db) => {
    requirePermission(db, 'payment.exception.manage');
    return [...db.exceptions].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  });
}

export async function resolvePaymentException(id: number, input: {
  action: 'link' | 'restore' | 'refund' | 'ignore'; bookingCode?: string; note: string;
}): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'payment.exception.manage');
    const exception = db.exceptions.find((e) => e.id === id);
    if (!exception) throw new ApiError('NOT_FOUND', 'Không tìm thấy giao dịch.', {}, 404);
    if (exception.status === 'resolved') throw new ApiError('BOOKING_INVALID_STATE', 'Giao dịch đã được xử lý.', {}, 409);
    if (!input.note.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập ghi chú xử lý.', {}, 422);
    if (input.action === 'link') {
      const booking = db.bookings.find((b) => b.code.toUpperCase() === (input.bookingCode ?? '').toUpperCase());
      if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy mã đơn cần liên kết.', {}, 404);
      booking.note = `${booking.note ? `${booking.note}\n` : ''}[Giao dịch bất thường #${exception.id}] Đã liên kết ${money(exception.amount)} · ${exception.bankRef}`;
    }
    exception.status = 'resolved';
    exception.action = input.action;
    exception.note = input.note;
    exception.resolvedBy = actor.id;
    audit(db, actor, 'payment_exception.resolve', 'payment_exception', exception.id, { status: 'open' }, { action: input.action, note: input.note }, input.note);
    return { message: `Đã xử lý giao dịch bất thường (${input.action}).` };
  });
}

/* ------------------------------------------------------------------ */
/* Vouchers                                                            */
/* ------------------------------------------------------------------ */

export async function listVouchers(): Promise<(Voucher & { usageCount: number; revenue: number })[]> {
  return withDb((db) => {
    requirePermission(db, 'voucher.read');
    return db.vouchers.map((voucher) => {
      const usages = db.voucherUsages.filter((u) => u.voucherCode === voucher.code && !u.reverted);
      const revenue = usages.reduce((sum, usage) => {
        const booking = db.bookings.find((b) => b.id === usage.bookingId);
        return sum + (booking?.finalAmount ?? 0);
      }, 0);
      return { ...voucher, usageCount: usages.length, revenue };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export async function saveVoucher(input: Partial<Voucher> & { code: string; label: string; type: Voucher['type']; value: number }): Promise<Voucher> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'voucher.write');
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new ApiError('VALIDATION_ERROR', 'Mã voucher gồm 3–20 ký tự chữ và số.', { fields: { code: 'Không hợp lệ' } }, 422);
    if (input.type === 'percent' && (input.value <= 0 || input.value > 100)) throw new ApiError('VALIDATION_ERROR', 'Giá trị phần trăm phải từ 1–100.', { fields: { value: 'Không hợp lệ' } }, 422);
    if (input.type === 'fixed' && input.value <= 0) throw new ApiError('VALIDATION_ERROR', 'Giá trị giảm phải lớn hơn 0.', { fields: { value: 'Không hợp lệ' } }, 422);
    if (db.vouchers.some((v) => v.code === code && v.id !== input.id)) throw new ApiError('VALIDATION_ERROR', 'Mã voucher đã tồn tại.', { fields: { code: 'Đã tồn tại' } }, 422);
    const base = {
      code, label: input.label, type: input.type, value: input.value,
      minOrder: input.minOrder ?? 0, maxDiscount: input.maxDiscount ?? 0,
      startsAt: input.startsAt ?? new Date().toISOString(),
      expiresAt: input.expiresAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
      totalUses: input.totalUses ?? 100, perUser: input.perUser ?? 1,
      applyTo: input.applyTo ?? 'all', status: input.status ?? 'active',
    };
    if (new Date(base.expiresAt) <= new Date(base.startsAt)) {
      throw new ApiError('VALIDATION_ERROR', 'Ngày hết hạn phải sau ngày bắt đầu.', { fields: { expiresAt: 'Không hợp lệ' } }, 422);
    }
    if (input.id) {
      const voucher = db.vouchers.find((v) => v.id === input.id);
      if (!voucher) throw new ApiError('NOT_FOUND', 'Không tìm thấy voucher.', {}, 404);
      const before = { ...voucher };
      Object.assign(voucher, base);
      audit(db, actor, 'voucher.update', 'voucher', voucher.id, before, voucher);
      return voucher;
    }
    const voucher: Voucher = {
      ...base, id: nextId(db.vouchers), usedCount: 0, createdAt: new Date().toISOString(),
    };
    db.vouchers.push(voucher);
    audit(db, actor, 'voucher.create', 'voucher', voucher.id, undefined, voucher);
    return voucher;
  });
}

export async function voucherUsages(code: string) {
  return withDb((db) => {
    requirePermission(db, 'voucher.read');
    return db.voucherUsages
      .filter((u) => u.voucherCode.toUpperCase() === code.toUpperCase())
      .map((usage) => {
        const booking = db.bookings.find((b) => b.id === usage.bookingId);
        return { ...usage, bookingCode: booking?.code ?? '—', customerName: booking?.customerName ?? '—' };
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  });
}

/* ------------------------------------------------------------------ */
/* Members & users                                                     */
/* ------------------------------------------------------------------ */

export async function listMembers(q = ''): Promise<MemberRow[]> {
  return withDb((db) => {
    requirePermission(db, 'member.read');
    const needle = q.trim().toLowerCase();
    const customers = db.users.filter((u) => u.role === 'customer'
      && (!needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.phone.includes(needle)));
    return customers.map((user) => {
      const bookings = db.bookings.filter((b) => b.userId === user.id && (b.status === 'confirmed' || b.status === 'completed'));
      const totalSpend = bookings.reduce((sum, b) => sum + b.finalAmount, 0);
      const last = bookings
        .map((b) => db.showtimes.find((s) => s.id === b.showtimeId))
        .filter((s): s is Showtime => Boolean(s))
        .sort((a, b) => (b.showDate + b.startTime).localeCompare(a.showDate + a.startTime))[0];
      const tier = db.tiers.find((t) => t.key === user.tier) ?? db.tiers[0];
      return {
        user: toSessionUser(user),
        totalSpend, bookingsCount: bookings.length,
        lastVisit: last ? `${last.showDate} ${last.startTime}` : undefined,
        tier,
      };
    }).sort((a, b) => b.totalSpend - a.totalSpend);
  });
}

export async function adjustMemberPoints(userId: string, delta: number, reason: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'member.adjust_points');
    if (!Number.isInteger(delta) || delta === 0) throw new ApiError('VALIDATION_ERROR', 'Số điểm điều chỉnh phải là số nguyên khác 0.', {}, 422);
    if (reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do điều chỉnh điểm.', {}, 422);
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('NOT_FOUND', 'Không tìm thấy thành viên.', {}, 404);
    if (user.points + delta < 0) throw new ApiError('VALIDATION_ERROR', 'Số điểm sau điều chỉnh không được âm.', {}, 422);
    const before = user.points;
    user.points += delta;
    db.pointTransactions.push({
      id: nextId(db.pointTransactions), userId, type: 'adjust', points: delta, reason,
      at: new Date().toISOString(),
    });
    audit(db, actor, 'member.adjust_points', 'user', userId, { points: before }, { points: user.points }, reason);
    return { message: `Đã điều chỉnh ${delta > 0 ? '+' : ''}${delta} điểm cho ${user.name}.` };
  });
}

export async function listMembershipTiers(): Promise<MembershipTier[]> {
  return withDb((db) => [...db.tiers]);
}

export async function saveMembershipTiers(tiers: MembershipTier[]): Promise<MembershipTier[]> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'member.adjust_points');
    db.tiers = tiers;
    audit(db, actor, 'membership_tiers.update', 'settings', 'tiers', undefined, tiers);
    return tiers;
  });
}

export async function listUsers(params: { q?: string; role?: string; status?: string } = {}): Promise<SessionUser[]> {
  return withDb((db) => {
    requirePermission(db, 'user.read');
    let rows = db.users;
    if (params.role && params.role !== 'all') rows = rows.filter((u) => u.role === params.role);
    if (params.status && params.status !== 'all') rows = rows.filter((u) => u.status === params.status);
    if (params.q?.trim()) {
      const needle = params.q.trim().toLowerCase();
      rows = rows.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle) || u.phone.includes(needle));
    }
    return rows
      .slice()
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
      .map((u) => toSessionUser(u));
  });
}

export async function changeUserRole(userId: string, role: User['role'], reason: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'user.set_role');
    if (actor.id === userId) throw new ApiError('FORBIDDEN', 'Bạn không thể tự thay đổi vai trò của mình.', {}, 403);
    if (reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do thay đổi vai trò.', {}, 422);
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', {}, 404);
    if (user.role === 'admin' && role !== 'admin') {
      const admins = db.users.filter((u) => u.role === 'admin');
      if (admins.length <= 1) throw new ApiError('LAST_ADMIN', 'Không thể hạ quyền quản trị viên cuối cùng.', {}, 409);
    }
    const before = user.role;
    user.role = role;
    user.permissions = role === 'admin' ? ['*'] : role === 'staff' ? ['booking.read', 'shift.manage'] : role === 'manager' ? MANAGER_PERMISSIONS_REF : [];
    audit(db, actor, 'user.set_role', 'user', userId, { role: before }, { role }, reason);
    return { message: `Đã đổi vai trò ${user.name} sang ${role}.` };
  });
}

const MANAGER_PERMISSIONS_REF = [
  'dashboard.view', 'movie.read', 'movie.write', 'cinema.read', 'cinema.write', 'room.read', 'room.write',
  'showtime.read', 'showtime.write', 'showtime.cancel', 'pricing.read', 'pricing.write', 'combo.read',
  'combo.write', 'inventory.write', 'booking.read', 'booking.cancel', 'booking.change', 'booking.resend',
  'payment.review', 'payment.exception.manage', 'refund.request', 'refund.approve', 'refund.process',
  'voucher.read', 'voucher.write', 'member.read', 'member.adjust_points', 'user.read', 'user.lock',
  'paymentsetting.read', 'content.write', 'review.moderate', 'report.view', 'report.export',
  'audit.view', 'setting.read', 'checkin.override', 'checkin.undo', 'shift.manage',
];

export async function lockUser(userId: string, lock: boolean, reason: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'user.lock');
    if (actor.id === userId) throw new ApiError('FORBIDDEN', 'Bạn không thể tự khóa tài khoản của mình.', {}, 403);
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', {}, 404);
    if (lock && reason.trim().length < 5) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do khóa tài khoản.', {}, 422);
    const before = user.status;
    user.status = lock ? 'locked' : 'active';
    audit(db, actor, lock ? 'user.lock' : 'user.unlock', 'user', userId, { status: before }, { status: user.status }, reason);
    return { message: lock ? `Đã khóa tài khoản ${user.name}.` : `Đã mở khóa tài khoản ${user.name}.` };
  });
}

export async function sendUserPasswordReset(userId: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'user.write');
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', {}, 404);
    audit(db, actor, 'user.reset_password', 'user', userId);
    return { message: `Đã gửi email đặt lại mật khẩu tới ${user.email}.` };
  });
}

export async function createStaffUser(input: {
  name: string; email: string; phone: string; role: 'staff' | 'manager'; cinemaIds: number[];
}): Promise<{ message: string }> {
  const passwordHash = await hashPassword(`Pxu@${Math.floor(Math.random() * 900000) + 100000}`);
  return mutateDb((db) => {
    const actor = requirePermission(db, 'user.write');
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError('VALIDATION_ERROR', 'Email đã tồn tại.', { fields: { email: 'Đã tồn tại' } }, 422);
    db.users.push({
      id: `u-${Date.now().toString(36)}`, name: input.name, email, phone: input.phone,
      passwordHash, role: input.role, permissions: input.role === 'staff' ? ['booking.read', 'shift.manage'] : MANAGER_PERMISSIONS_REF,
      cinemaIds: input.cinemaIds, points: 0, tier: 'member', emailVerified: false, status: 'invited',
      avatarSeed: Math.floor(Math.random() * 90) + 10, createdAt: new Date().toISOString(),
    });
    audit(db, actor, 'user.create', 'user', email, undefined, { role: input.role, cinemaIds: input.cinemaIds });
    return { message: `Đã gửi lời mời tới ${email}. Nhân viên sẽ đặt mật khẩu qua email.` };
  });
}

/* ------------------------------------------------------------------ */
/* Settings & payment config                                           */
/* ------------------------------------------------------------------ */

export async function getSettings(): Promise<AppSettings> {
  return withDb((db) => {
    requirePermission(db, 'setting.read');
    return { ...db.settings };
  });
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'setting.write');
    const before = { ...db.settings };
    const numericKeys: (keyof AppSettings)[] = [
      'holdMinutes', 'holdExtendMinutes', 'proofPendingMaxMinutes', 'maxSeatsPerBooking',
      'maxActiveHoldsPerUser', 'onlineCloseBeforeMinutes', 'posCloseBeforeMinutes',
      'roomCleaningMinutes', 'adsMinutes', 'checkinOpenBeforeMinutes', 'checkinLateAllowMinutes',
      'customerCancelBeforeHours', 'customerRefundPercent', 'pointsPerVnd', 'vatPercent',
      'priceRounding', 'receiptMaxMb', 'loginMaxAttempts', 'refundApprovalThreshold',
    ];
    for (const key of numericKeys) {
      const value = patch[key];
      if (typeof value === 'number' && (value < 0 || !Number.isFinite(value))) {
        throw new ApiError('VALIDATION_ERROR', `Giá trị ${String(key)} không hợp lệ.`, { fields: { [key]: 'Không hợp lệ' } }, 422);
      }
    }
    if (patch.maxSeatsPerBooking !== undefined && (patch.maxSeatsPerBooking < 1 || patch.maxSeatsPerBooking > 20)) {
      throw new ApiError('VALIDATION_ERROR', 'Số ghế tối đa mỗi đơn phải từ 1–20.', { fields: { maxSeatsPerBooking: '1–20' } }, 422);
    }
    Object.assign(db.settings, patch);
    audit(db, actor, 'settings.update', 'settings', 'global', before, { ...db.settings });
    return { ...db.settings };
  });
}

export interface PaymentSettings {
  bankName: string; bankCode: string; accountNumber: string; accountName: string;
  transferPrefix: string; useCustomQr: boolean; customQrUrl?: string;
  paymentConfirmMode: 'manual' | 'auto'; webhookSecretHint: string;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  return withDb((db) => {
    requirePermission(db, 'paymentsetting.read');
    const s = db.settings;
    return {
      bankName: s.bankName, bankCode: s.bankCode, accountNumber: s.accountNumber,
      accountName: s.accountName, transferPrefix: s.transferPrefix,
      useCustomQr: s.useCustomQr, customQrUrl: s.customQrUrl,
      paymentConfirmMode: s.paymentConfirmMode, webhookSecretHint: s.webhookSecretHint,
    };
  });
}

export async function savePaymentSettings(input: PaymentSettings, password: string): Promise<PaymentSettings> {
  const passwordHash = await hashPassword(password);
  return mutateDb((db) => {
    const actor = requirePermission(db, 'paymentsetting.write');
    if (actor.passwordHash !== passwordHash) throw new ApiError('FORBIDDEN', 'Mật khẩu xác nhận không đúng.', {}, 403);
    if (!/^\d{6,19}$/.test(input.accountNumber)) throw new ApiError('VALIDATION_ERROR', 'Số tài khoản phải gồm 6–19 chữ số.', { fields: { accountNumber: 'Không hợp lệ' } }, 422);
    if (!/^[A-Z0-9]{2,6}$/.test(input.transferPrefix.toUpperCase())) throw new ApiError('VALIDATION_ERROR', 'Tiền tố nội dung gồm 2–6 ký tự A-Z0-9.', { fields: { transferPrefix: 'Không hợp lệ' } }, 422);
    if (input.useCustomQr && !input.customQrUrl) throw new ApiError('VALIDATION_ERROR', 'Vui lòng tải lên ảnh QR trước khi bật chế độ ảnh tùy chỉnh.', { fields: { customQrUrl: 'Bắt buộc' } }, 422);
    const before = {
      bankName: db.settings.bankName, bankCode: db.settings.bankCode, accountNumber: db.settings.accountNumber,
      transferPrefix: db.settings.transferPrefix, useCustomQr: db.settings.useCustomQr,
      paymentConfirmMode: db.settings.paymentConfirmMode,
    };
    Object.assign(db.settings, {
      bankName: input.bankName, bankCode: input.bankCode.toUpperCase(),
      accountNumber: input.accountNumber, accountName: input.accountName.toUpperCase(),
      transferPrefix: input.transferPrefix.toUpperCase(),
      useCustomQr: input.useCustomQr, customQrUrl: input.customQrUrl,
      paymentConfirmMode: input.paymentConfirmMode,
    });
    audit(db, actor, 'payment_settings.update', 'settings', 'payment', before, {
      ...input, webhookSecretHint: db.settings.webhookSecretHint,
    });
    return { ...input, transferPrefix: db.settings.transferPrefix, bankCode: db.settings.bankCode };
  });
}

export async function testQr(input: { bankCode: string; accountNumber: string; accountName: string; amount: number; content: string }): Promise<{ qrValue: string; url: string }> {
  return withDb((db) => {
    requirePermission(db, 'paymentsetting.read');
    const qrValue = `${input.bankCode}|${input.accountNumber}|${input.amount}|${input.content}`;
    return {
      qrValue,
      url: `https://img.vietqr.io/image/${input.bankCode}-${input.accountNumber}-compact2.png?amount=${input.amount}&addInfo=${encodeURIComponent(input.content)}&accountName=${encodeURIComponent(input.accountName)}`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Audit & reports                                                     */
/* ------------------------------------------------------------------ */

export async function listAuditLogs(params: { q?: string; action?: string; from?: string; to?: string; limit?: number } = {}): Promise<AuditLog[]> {
  return withDb((db) => {
    requirePermission(db, 'audit.view');
    let rows = [...db.auditLogs];
    if (params.action && params.action !== 'all') rows = rows.filter((l) => l.action.startsWith(params.action!));
    if (params.from) rows = rows.filter((l) => localDate(l.at) >= params.from!);
    if (params.to) rows = rows.filter((l) => localDate(l.at) <= params.to!);
    if (params.q?.trim()) {
      const needle = params.q.toLowerCase();
      rows = rows.filter((l) => l.actorName.toLowerCase().includes(needle) || l.action.toLowerCase().includes(needle) || l.entityId.toLowerCase().includes(needle));
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, params.limit ?? 100);
  });
}

export async function getReport(type: string, params: { from?: string; to?: string; cinemaId?: number } = {}): Promise<ReportResult> {
  return withDb((db) => {
    const actor = requirePermission(db, 'report.view');
    const scope = scopedCinemaIds(actor, params.cinemaId);
    const to = params.to ?? dateISO();
    const from = params.from ?? addDaysISO(to, -13);
    const inRange = (iso?: string) => {
      const d = localDate(iso);
      return Boolean(d) && d >= from && d <= to;
    };
    const scopedBookings = db.bookings.filter((b) => !scope.length || scope.includes(b.cinemaId));

    if (type === 'revenue') {
      const rows: Record<string, string | number>[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = addDaysISO(to, -i);
        const revenue = paidRevenue(db, date, date, scope);
        const tickets = scopedBookings.filter((b) => (b.status === 'confirmed' || b.status === 'completed') && localDate(b.confirmedAt) === date).reduce((sum, b) => sum + b.seats.length, 0);
        const orders = scopedBookings.filter((b) => (b.status === 'confirmed' || b.status === 'completed') && localDate(b.confirmedAt) === date).length;
        rows.push({ date, revenue, tickets, orders, avg: orders ? Math.round(revenue / orders) : 0 });
      }
      return {
        title: 'Báo cáo doanh thu',
        columns: [
          { key: 'date', label: 'Ngày' }, { key: 'revenue', label: 'Doanh thu', align: 'right' },
          { key: 'tickets', label: 'Vé', align: 'right' }, { key: 'orders', label: 'Đơn', align: 'right' },
          { key: 'avg', label: 'TB/đơn', align: 'right' },
        ],
        rows,
        totals: {
          revenue: rows.reduce((s, r) => s + Number(r.revenue), 0),
          tickets: rows.reduce((s, r) => s + Number(r.tickets), 0),
          orders: rows.reduce((s, r) => s + Number(r.orders), 0),
        },
      };
    }

    if (type === 'movies') {
      const map = new Map<number, { revenue: number; tickets: number }>();
      for (const booking of scopedBookings) {
        if (booking.status !== 'confirmed' && booking.status !== 'completed') continue;
        if (!inRange(booking.confirmedAt)) continue;
        const showtime = db.showtimes.find((s) => s.id === booking.showtimeId);
        if (!showtime) continue;
        const entry = map.get(showtime.movieId) ?? { revenue: 0, tickets: 0 };
        entry.revenue += booking.finalAmount;
        entry.tickets += booking.seats.length;
        map.set(showtime.movieId, entry);
      }
      const rows = [...map.entries()].map(([movieId, stats]) => {
        const movie = db.movies.find((m) => m.id === movieId);
        return { movie: movie?.title ?? '—', age: movie?.age ?? '—', revenue: stats.revenue, tickets: stats.tickets };
      }).sort((a, b) => b.revenue - a.revenue);
      return {
        title: 'Báo cáo phim', columns: [
          { key: 'movie', label: 'Phim' }, { key: 'age', label: 'Nhãn' },
          { key: 'tickets', label: 'Vé bán', align: 'right' }, { key: 'revenue', label: 'Doanh thu', align: 'right' },
        ], rows,
        totals: { revenue: rows.reduce((s, r) => s + r.revenue, 0), tickets: rows.reduce((s, r) => s + r.tickets, 0) },
      };
    }

    if (type === 'showtimes') {
      const rows = db.showtimes
        .filter((s) => s.showDate >= from && s.showDate <= to && (!scope.length || scope.includes(s.cinemaId)))
        .map((s) => {
          const capacity = sellableSeats(db, s.roomId).length;
          const sold = activeSeatIds(db, s.id).size;
          const movie = db.movies.find((m) => m.id === s.movieId);
          const room = db.rooms.find((r) => r.id === s.roomId);
          return {
            date: s.showDate, time: s.startTime, movie: movie?.title ?? '—', room: room?.name ?? '—',
            sold, capacity, occupancy: capacity ? Math.round((sold / capacity) * 100) : 0,
          };
        });
      return {
        title: 'Báo cáo suất chiếu',
        columns: [
          { key: 'date', label: 'Ngày' }, { key: 'time', label: 'Giờ' }, { key: 'movie', label: 'Phim' },
          { key: 'room', label: 'Phòng' }, { key: 'sold', label: 'Vé bán', align: 'right' },
          { key: 'capacity', label: 'Sức chứa', align: 'right' }, { key: 'occupancy', label: 'Lấp đầy %', align: 'right' },
        ], rows: rows.slice(0, 200),
      };
    }

    if (type === 'staff-shifts') {
      const rows = db.shifts
        .filter((s) => (!scope.length || scope.includes(s.cinemaId)) && localDate(s.openedAt) >= from && localDate(s.openedAt) <= to)
        .map((s) => ({
          staff: s.staffName, opened: s.openedAt.slice(0, 16).replace('T', ' '),
          openingCash: s.openingCash, sales: s.totalSales, transactions: s.transactions,
          difference: s.difference ?? 0, status: s.status,
        }));
      return {
        title: 'Báo cáo ca làm việc',
        columns: [
          { key: 'staff', label: 'Nhân viên' }, { key: 'opened', label: 'Mở ca' },
          { key: 'openingCash', label: 'Tiền đầu ca', align: 'right' },
          { key: 'sales', label: 'Doanh số', align: 'right' }, { key: 'transactions', label: 'Giao dịch', align: 'right' },
          { key: 'difference', label: 'Chênh lệch', align: 'right' }, { key: 'status', label: 'Trạng thái' },
        ], rows,
      };
    }

    if (type === 'vouchers') {
      const rows = db.vouchers.map((v) => {
        const usages = db.voucherUsages.filter((u) => u.voucherCode === v.code && !u.reverted);
        const discount = usages.reduce((sum, u) => sum + u.discount, 0);
        return { code: v.code, label: v.label, used: usages.length, total: v.totalUses, discount, status: v.status };
      });
      return {
        title: 'Báo cáo voucher',
        columns: [
          { key: 'code', label: 'Mã' }, { key: 'label', label: 'Mô tả' },
          { key: 'used', label: 'Đã dùng', align: 'right' }, { key: 'total', label: 'Tổng lượt', align: 'right' },
          { key: 'discount', label: 'Tiền giảm', align: 'right' }, { key: 'status', label: 'Trạng thái' },
        ], rows,
        totals: { used: rows.reduce((s, r) => s + r.used, 0), discount: rows.reduce((s, r) => s + r.discount, 0) },
      };
    }

    if (type === 'refunds') {
      const rows = refundRows(db, db.refunds.filter((r) => inRange(r.createdAt))).map((r) => ({
        code: r.code, booking: r.bookingCode, amount: r.amount, reason: r.reason, status: r.status,
        created: r.createdAt.slice(0, 10),
      }));
      return {
        title: 'Báo cáo hoàn / hủy',
        columns: [
          { key: 'code', label: 'Mã hoàn' }, { key: 'booking', label: 'Đơn' },
          { key: 'amount', label: 'Số tiền', align: 'right' }, { key: 'reason', label: 'Lý do' },
          { key: 'status', label: 'Trạng thái' }, { key: 'created', label: 'Ngày' },
        ], rows,
        totals: { amount: rows.filter((r) => r.status === 'completed').reduce((s, r) => s + Number(r.amount), 0) },
      };
    }

    if (type === 'customers') {
      const rows = db.users.filter((u) => u.role === 'customer').map((u) => {
        const bookings = scopedBookings.filter((b) => b.userId === u.id && (b.status === 'confirmed' || b.status === 'completed') && inRange(b.confirmedAt));
        return {
          name: u.name, email: u.email, tier: u.tier,
          bookings: bookings.length,
          spend: bookings.reduce((sum, b) => sum + b.finalAmount, 0),
          points: u.points,
        };
      }).sort((a, b) => b.spend - a.spend);
      return {
        title: 'Báo cáo khách hàng',
        columns: [
          { key: 'name', label: 'Khách hàng' }, { key: 'email', label: 'Email' }, { key: 'tier', label: 'Hạng' },
          { key: 'bookings', label: 'Số đơn', align: 'right' }, { key: 'spend', label: 'Chi tiêu', align: 'right' },
          { key: 'points', label: 'Điểm', align: 'right' },
        ], rows,
      };
    }

    if (type === 'concessions') {
      const rows = db.combos.map((c) => ({
        name: c.name, category: c.category, sold: c.sold, revenue: c.sold * c.price, stock: c.stock, price: c.price,
      })).sort((a, b) => b.revenue - a.revenue);
      return {
        title: 'Báo cáo bắp nước',
        columns: [
          { key: 'name', label: 'Sản phẩm' }, { key: 'category', label: 'Danh mục' },
          { key: 'sold', label: 'Đã bán', align: 'right' }, { key: 'revenue', label: 'Doanh thu', align: 'right' },
          { key: 'stock', label: 'Tồn kho', align: 'right' },
        ], rows,
        totals: { revenue: rows.reduce((s, r) => s + r.revenue, 0), sold: rows.reduce((s, r) => s + r.sold, 0) },
      };
    }

    // checkin
    const rows = db.showtimes
      .filter((s) => s.showDate >= from && s.showDate <= to && (!scope.length || scope.includes(s.cinemaId)))
      .map((s) => {
        const bookings = db.bookings.filter((b) => b.showtimeId === s.id && (b.status === 'confirmed' || b.status === 'completed'));
        const tickets = db.tickets.filter((t) => bookings.some((b) => b.id === t.bookingId));
        const used = tickets.filter((t) => t.status === 'used').length;
        const failed = db.checkinLogs.filter((l) => l.showtimeId === s.id && l.result !== 'OK').length;
        const movie = db.movies.find((m) => m.id === s.movieId);
        return {
          date: s.showDate, time: s.startTime, movie: movie?.title ?? '—',
          total: tickets.length, used, noShow: tickets.length - used,
          rate: tickets.length ? Math.round((used / tickets.length) * 100) : 0, failed,
        };
      }).filter((r) => r.total > 0);
    return {
      title: 'Báo cáo soát vé',
      columns: [
        { key: 'date', label: 'Ngày' }, { key: 'time', label: 'Giờ' }, { key: 'movie', label: 'Phim' },
        { key: 'total', label: 'Tổng vé', align: 'right' }, { key: 'used', label: 'Đã vào', align: 'right' },
        { key: 'noShow', label: 'Không đến', align: 'right' }, { key: 'rate', label: 'Tỷ lệ %', align: 'right' },
        { key: 'failed', label: 'Quét lỗi', align: 'right' },
      ], rows,
    };
  });
}

export async function exportReport(type: string, params: { from?: string; to?: string; cinemaId?: number } = {}): Promise<{ filename: string; content: string }> {
  const report = await getReport(type, params);
  return {
    filename: `pxu-${type}-${dateISO()}.csv`,
    content: toCsv(report.rows),
  };
}

export function refundStatusLabel(status: Refund['status']): string {
  const map: Record<Refund['status'], string> = {
    requested: 'Chờ duyệt', approved: 'Đã duyệt', processing: 'Đang xử lý',
    completed: 'Hoàn tất', rejected: 'Từ chối', failed: 'Thất bại',
  };
  return map[status];
}
