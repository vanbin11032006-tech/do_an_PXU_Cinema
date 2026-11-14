import type {
  Booking, Database, Notification, SessionUser, Showtime, Ticket, User,
} from '@/types/domain';
import { ApiError } from '@/types/domain';
import { cinemaNow, dateISO, showtimeEnd, showtimeStart } from '@/lib/datetime';
import { ensureDb, writeDb } from './db';
import { makeTicketCode } from './crypto';

/* ------------------------------------------------------------------ */
/* Actor / access                                                      */
/* ------------------------------------------------------------------ */

let actorId: string | null = null;

export function setActor(id: string | null): void {
  actorId = id;
}
export function getActorId(): string | null {
  return actorId;
}

export function toSessionUser(user: User): SessionUser {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return rest;
}

export function getActor(db: Database): User {
  const user = db.users.find((u) => u.id === actorId);
  if (!user) throw new ApiError('UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', {}, 401);
  if (user.status === 'locked') throw new ApiError('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.', {}, 423);
  return user;
}

export function getMaybeActor(db: Database): User | null {
  return db.users.find((u) => u.id === actorId) ?? null;
}

export function can(user: Pick<User, 'role' | 'permissions'> | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions.includes('*')) return true;
  return user.permissions.includes(permission)
    || user.permissions.some((p) => p.endsWith('.*') && permission.startsWith(p.slice(0, -1)));
}

export function requirePermission(db: Database, permission: string): User {
  const user = getActor(db);
  if (!can(user, permission)) throw new ApiError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.', { permission }, 403);
  return user;
}

export function scopeCinemaIds(user: User): number[] {
  if (user.role === 'admin' || user.cinemaIds.length === 0) return [];
  return user.cinemaIds;
}

export function canAccessCinema(user: User, cinemaId: number): boolean {
  const scope = scopeCinemaIds(user);
  return scope.length === 0 || scope.includes(cinemaId);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const LATENCY = 140;

export function pause(ms = LATENCY): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export function nextId<T extends { id: number }>(rows: T[]): number {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

export async function withDb<T>(fn: (db: Database, nowMs: number) => T | Promise<T>): Promise<T> {
  const db = await ensureDb();
  const changed = runJobs(db);
  if (changed) await writeDb(() => undefined);
  const result = await fn(db, Date.now());
  await pause();
  return result;
}

export async function mutateDb<T>(fn: (db: Database, nowMs: number) => T | Promise<T>): Promise<T> {
  const db = await ensureDb();
  runJobs(db);
  let result!: T;
  await writeDb((d) => {
    result = fn(d, Date.now()) as T;
  });
  await pause();
  return result;
}

export function audit(
  db: Database,
  actor: User,
  action: string,
  entity: string,
  entityId: string | number,
  before?: unknown,
  after?: unknown,
  reason?: string,
): void {
  db.auditLogs.push({
    id: nextId(db.auditLogs),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entity,
    entityId: String(entityId),
    before,
    after,
    ip: '203.113.10.24',
    reason,
  });
}

export function notify(db: Database, userId: string, title: string, body: string, type: Notification['type'], link?: string): void {
  db.notifications.push({
    id: nextId(db.notifications),
    userId,
    title,
    body,
    type,
    read: false,
    createdAt: new Date().toISOString(),
    link,
  });
}

/* ------------------------------------------------------------------ */
/* Booking lifecycle helpers                                           */
/* ------------------------------------------------------------------ */

export function startMsOf(showtime: Showtime): number {
  return showtimeStart(showtime).getTime();
}
export function endMsOf(showtime: Showtime): number {
  return showtimeEnd(showtime).getTime();
}

export function latestPayment(db: Database, bookingId: number) {
  return [...db.payments].filter((p) => p.bookingId === bookingId).sort((a, b) => b.id - a.id)[0];
}

export function releaseSeats(booking: Booking): void {
  for (const seat of booking.seats) seat.active = false;
}

export function revertVoucher(db: Database, booking: Booking): void {
  if (!booking.voucherCode) return;
  const usage = [...db.voucherUsages].reverse().find((u) => u.bookingId === booking.id && !u.reverted);
  if (!usage) return;
  usage.reverted = true;
  const voucher = db.vouchers.find((v) => v.code === booking.voucherCode);
  if (voucher) voucher.usedCount = Math.max(0, voucher.usedCount - 1);
}

export function restoreComboStock(db: Database, booking: Booking): void {
  for (const item of booking.combos) {
    const combo = db.combos.find((c) => c.id === item.comboId);
    if (combo) {
      combo.stock += item.quantity;
      combo.sold = Math.max(0, combo.sold - item.quantity);
    }
  }
}

export function consumeComboStock(db: Database, booking: Booking): void {
  for (const item of booking.combos) {
    const combo = db.combos.find((c) => c.id === item.comboId);
    if (combo) {
      combo.stock = Math.max(0, combo.stock - item.quantity);
      combo.sold += item.quantity;
    }
  }
}

export function awardPoints(db: Database, booking: Booking, user: User | null): void {
  if (!user) return;
  if (booking.pointsUsed > 0) {
    const spend = Math.min(booking.pointsUsed, user.points);
    user.points -= spend;
    db.pointTransactions.push({
      id: nextId(db.pointTransactions),
      userId: user.id,
      type: 'redeem',
      points: -spend,
      reason: `Dùng điểm cho đơn ${booking.code}`,
      at: new Date().toISOString(),
      bookingCode: booking.code,
    });
  }
  const points = Math.floor(booking.finalAmount / db.settings.pointsPerVnd);
  if (points <= 0) return;
  user.points += points;
  db.pointTransactions.push({
    id: nextId(db.pointTransactions),
    userId: user.id,
    type: 'earn',
    points,
    reason: `Tích điểm đơn ${booking.code}`,
    at: new Date().toISOString(),
    bookingCode: booking.code,
  });
}

export function issueTickets(db: Database, booking: Booking): Ticket[] {
  const existing = db.tickets.filter((t) => t.bookingId === booking.id);
  if (existing.some((t) => t.status === 'valid' || t.status === 'used')) return existing;
  const created: Ticket[] = booking.seats.map((seat) => ({
    id: nextId(db.tickets),
    bookingId: booking.id,
    seatId: seat.seatId,
    seatCode: seat.code,
    code: makeTicketCode(),
    status: 'valid',
    issuedAt: new Date().toISOString(),
  }));
  db.tickets.push(...created);
  return created;
}

export function confirmPaidBooking(db: Database, booking: Booking, reviewerId: string, amount: number): void {
  const payment = latestPayment(db, booking.id);
  if (payment) {
    payment.status = 'paid';
    payment.paidAt = new Date().toISOString();
    payment.reviewedBy = reviewerId;
    payment.reviewedAt = payment.paidAt;
    payment.amount = amount;
  }
  booking.status = 'confirmed';
  booking.confirmedAt = booking.confirmedAt ?? new Date().toISOString();
  booking.updatedAt = new Date().toISOString();
  issueTickets(db, booking);
  consumeComboStock(db, booking);
  const user = booking.userId ? db.users.find((u) => u.id === booking.userId) ?? null : null;
  awardPoints(db, booking, user);
  if (booking.voucherCode) {
    const voucher = db.vouchers.find((v) => v.code === booking.voucherCode);
    if (voucher) {
      voucher.usedCount += 1;
      db.voucherUsages.push({
        id: nextId(db.voucherUsages),
        voucherCode: voucher.code,
        bookingId: booking.id,
        userId: booking.userId ?? 'guest',
        discount: booking.discount,
        at: new Date().toISOString(),
      });
    }
  }
  if (booking.userId) {
    notify(
      db, booking.userId, 'Thanh toán thành công',
      `Đơn ${booking.code} đã được xác nhận. Vé điện tử của bạn đã sẵn sàng trong mục "Vé của tôi".`,
      'payment', `/ve/${booking.code}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Jobs (idempotent maintenance)                                       */
/* ------------------------------------------------------------------ */

export function runJobs(db: Database): boolean {
  let changed = false;
  const now = Date.now();
  const today = dateISO(cinemaNow());

  for (const booking of db.bookings) {
    if (booking.status !== 'holding') continue;
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId);
    if (!showtime) continue;
    const payment = latestPayment(db, booking.id);
    let deadline = new Date(booking.holdExpiresAt).getTime();
    if (payment?.status === 'proof_submitted' && payment.submittedAt) {
      const proofDeadline = new Date(payment.submittedAt).getTime() + db.settings.proofPendingMaxMinutes * 60_000;
      const showDeadline = startMsOf(showtime) - 30 * 60_000;
      deadline = Math.min(proofDeadline, showDeadline);
    }
    if (now <= deadline) continue;
    booking.status = 'expired';
    booking.updatedAt = new Date().toISOString();
    releaseSeats(booking);
    if (payment && ['pending', 'proof_submitted', 'rejected'].includes(payment.status)) {
      payment.status = 'expired';
    }
    revertVoucher(db, booking);
    if (booking.userId) {
      notify(
        db, booking.userId, 'Đơn đã hết hạn',
        payment?.status === 'expired' && payment.proofUrl
          ? `Đơn ${booking.code} đã hết thời gian giữ ghế trong khi chờ duyệt. Vui lòng liên hệ hỗ trợ nếu bạn đã chuyển khoản.`
          : `Đơn ${booking.code} đã hết thời gian giữ ghế. Ghế đã được nhả cho khách khác.`,
        'booking', `/dat-ve/${showtime.id}/ghe`,
      );
    }
    changed = true;
  }

  for (const showtime of db.showtimes) {
    if (showtime.status === 'cancelled' || showtime.status === 'finished') continue;
    const start = startMsOf(showtime);
    const end = endMsOf(showtime);
    if (end < now) {
      showtime.status = 'finished';
      changed = true;
      for (const booking of db.bookings) {
        if (booking.showtimeId !== showtime.id) continue;
        if (booking.status === 'confirmed') {
          booking.status = 'completed';
          changed = true;
        }
      }
      for (const ticket of db.tickets) {
        const booking = db.bookings.find((b) => b.id === ticket.bookingId);
        if (booking?.showtimeId === showtime.id && ticket.status === 'valid') {
          ticket.status = 'expired';
          changed = true;
        }
      }
    } else if (start - db.settings.onlineCloseBeforeMinutes * 60_000 < now && showtime.status === 'selling') {
      showtime.status = 'closed';
      changed = true;
    }
  }

  for (const movie of db.movies) {
    if (movie.deletedAt) continue;
    if (movie.status === 'coming_soon' && movie.releaseDate <= today) {
      movie.status = 'now_showing';
      changed = true;
    }
  }

  return changed;
}
