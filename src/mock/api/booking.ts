import type {
  Booking, BookingCombo, BookingDetail, CheckinLog, CheckinResult, Database, Movie, Paged,
  Payment, PaymentStatus, Seat, Shift, Showtime, Ticket, User,
} from '@/types/domain';
import { ApiError } from '@/types/domain';
import { cinemaNow, dateISO } from '@/lib/datetime';
import { includedTax } from '../pricing';
import { computeVoucherDiscount } from '../pricing';
import {
  audit, confirmPaidBooking, getActor, issueTickets, latestPayment,
  mutateDb, nextId, notify, releaseSeats, requirePermission, revertVoucher,
  startMsOf, endMsOf, withDb, can,
} from '../core';
import { makeBookingCode } from '../crypto';
import { activeSeatIds, toShowtimePublic, type ShowtimePublic } from './catalog';

export interface PaymentInfo {
  booking: BookingDetail;
  payment: Payment | null;
  amount: number;
  transferContent: string;
  bank: { name: string; code: string; accountNumber: string; accountName: string; prefix: string };
  qrValue: string;
  qrImageUrl?: string;
  useCustomQr: boolean;
  status: PaymentStatus;
  rejectReasonCode?: string;
  rejectNote?: string;
  proofUrl?: string;
  proofDeadlineAt?: string;
  deadline?: string;
  serverTime: string;
}

export interface CheckinResponse {
  result: CheckinResult;
  message: string;
  ticket?: Ticket;
  booking?: Booking;
  showtime?: Showtime;
  movie?: Movie;
  checkedInAt?: string;
  checkedInBy?: string;
  ticketsRemaining: number;
  ticketsTotal: number;
  cinemaName?: string;
  roomName?: string;
  seatCodes: string[];
  ageWarning?: string;
}

function accessBooking(db: Database, code: string, allowStaff = true): { booking: Booking; user: User } {
  const user = getActor(db);
  const booking = db.bookings.find((b) => b.code.toUpperCase() === code.toUpperCase());
  if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', {}, 404);
  const owns = booking.userId === user.id;
  const isStaff = allowStaff && (can(user, 'booking.read') || user.role === 'staff');
  if (!owns && !isStaff) throw new ApiError('FORBIDDEN', 'Bạn không có quyền xem đơn này.', {}, 403);
  return { booking, user };
}

export function toBookingDetail(db: Database, booking: Booking): BookingDetail {
  const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
  const movie = db.movies.find((m) => m.id === showtime.movieId)!;
  const room = db.rooms.find((r) => r.id === showtime.roomId)!;
  const cinema = db.cinemas.find((c) => c.id === showtime.cinemaId)!;
  const payments = db.payments.filter((p) => p.bookingId === booking.id).sort((a, b) => b.id - a.id);
  const tickets = db.tickets.filter((t) => t.bookingId === booking.id);
  const payment = payments[0];
  let holdDeadline: string | undefined;
  if (booking.status === 'holding') {
    holdDeadline = booking.holdExpiresAt;
    if (payment?.status === 'proof_submitted' && payment.submittedAt) {
      const proof = new Date(payment.submittedAt).getTime() + db.settings.proofPendingMaxMinutes * 60_000;
      const show = startMsOf(showtime) - 30 * 60_000;
      holdDeadline = new Date(Math.min(proof, show)).toISOString();
    }
    if (payment && payment.status !== 'proof_submitted' && payment.status !== 'rejected') {
      holdDeadline = booking.holdExpiresAt;
    }
  }
  return {
    ...booking, showtime, movie, room, cinema, payments, tickets,
    serverTime: new Date().toISOString(), holdDeadline,
  };
}

function recomputeTotals(db: Database, booking: Booking): void {
  booking.ticketsSubtotal = booking.seats.reduce((sum, s) => sum + s.price, 0);
  booking.combosSubtotal = booking.combos.reduce((sum, c) => sum + c.price * c.quantity, 0);
  booking.discount = 0;
  if (booking.voucherCode) {
    const voucher = db.vouchers.find((v) => v.code === booking.voucherCode);
    if (voucher) {
      const uses = db.voucherUsages.filter((u) => u.voucherCode === voucher.code && u.userId === (booking.userId ?? 'guest') && !u.reverted).length;
      booking.discount = computeVoucherDiscount(voucher, {
        ticketsSubtotal: booking.ticketsSubtotal,
        combosSubtotal: booking.combosSubtotal,
        userId: booking.userId ?? 'guest',
        usesByUser: uses,
      });
    }
  }
  const afterVoucher = Math.max(0, booking.ticketsSubtotal + booking.combosSubtotal - booking.discount);
  const maxPointsDiscount = Math.floor(afterVoucher * 0.2);
  if (booking.pointsUsed > 0) {
    booking.pointsUsed = Math.min(booking.pointsUsed, Math.floor(maxPointsDiscount / 1000));
  }
  booking.pointsDiscount = Math.min(booking.pointsUsed * 1000, maxPointsDiscount);
  booking.finalAmount = Math.max(0, afterVoucher - booking.pointsDiscount);
  booking.taxAmount = includedTax(booking.finalAmount, db.settings.vatPercent);
  booking.updatedAt = new Date().toISOString();
}

function validateContact(input: { name: string; email: string; phone: string }): void {
  const fields: Record<string, string> = {};
  if (!input.name.trim()) fields.name = 'Vui lòng nhập họ tên';
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(input.email.trim())) fields.email = 'Email không hợp lệ';
  if (!/^(0|\+84)\d{9}$/.test(input.phone.replace(/\s/g, ''))) fields.phone = 'Số điện thoại không hợp lệ';
  if (Object.keys(fields).length) throw new ApiError('VALIDATION_ERROR', 'Thông tin liên hệ chưa hợp lệ.', { fields }, 422);
}

function validateSeatSelection(db: Database, showtime: Showtime, seatIds: number[], excludeBookingId?: number): Seat[] {
  if (seatIds.length === 0) throw new ApiError('VALIDATION_ERROR', 'Vui lòng chọn ít nhất 1 ghế.', {}, 422);
  if (seatIds.length > db.settings.maxSeatsPerBooking) {
    throw new ApiError('SEAT_LIMIT_EXCEEDED', `Mỗi đơn chỉ được chọn tối đa ${db.settings.maxSeatsPerBooking} ghế.`, { max: db.settings.maxSeatsPerBooking }, 422);
  }
  if (new Set(seatIds).size !== seatIds.length) throw new ApiError('VALIDATION_ERROR', 'Danh sách ghế bị trùng.', {}, 422);
  const roomSeats = db.seats.filter((s) => s.roomId === showtime.roomId && seatIds.includes(s.id));
  if (roomSeats.length !== seatIds.length) throw new ApiError('SEAT_UNAVAILABLE', 'Một số ghế không tồn tại trong phòng.', {}, 409);
  for (const seat of roomSeats) {
    if (seat.type === 'disabled' || seat.type === 'aisle' || seat.type === 'blank') {
      throw new ApiError('SEAT_UNAVAILABLE', `Ghế ${seat.code} đang bảo trì hoặc không bán.`, { seat_ids: [seat.id] }, 409);
    }
    if (showtime.blockedSeatIds.includes(seat.id)) {
      throw new ApiError('SEAT_UNAVAILABLE', `Ghế ${seat.code} đã bị chặn cho suất chiếu này.`, { seat_ids: [seat.id] }, 409);
    }
  }
  const taken = activeSeatIds(db, showtime.id, excludeBookingId);
  const lost = roomSeats.filter((s) => taken.has(s.id));
  if (lost.length) {
    throw new ApiError(
      'SEAT_UNAVAILABLE',
      `Ghế ${lost.map((s) => s.code).join(', ')} vừa có người khác chọn. Vui lòng chọn ghế khác.`,
      { seat_ids: lost.map((s) => s.id), codes: lost.map((s) => s.code) },
      409,
    );
  }
  return roomSeats.sort((a, b) => a.y - b.y || a.x - b.x);
}

function assertShowtimeSelling(db: Database, showtime: Showtime, channel: 'online' | 'pos'): ShowtimePublic {
  const view = toShowtimePublic(db, showtime);
  if (showtime.status === 'cancelled') throw new ApiError('SHOWTIME_CLOSED', 'Suất chiếu đã bị hủy.', {}, 409);
  const cutoffMinutes = channel === 'online' ? db.settings.onlineCloseBeforeMinutes : db.settings.posCloseBeforeMinutes;
  const cutoff = startMsOf(showtime) - cutoffMinutes * 60_000;
  const statusBlocks = channel === 'online' ? showtime.status === 'closed' || showtime.status === 'finished' : showtime.status === 'finished';
  if (Date.now() > cutoff || statusBlocks) {
    throw new ApiError('SHOWTIME_CLOSED', 'Suất chiếu đã đóng bán.', { sale_state: view.saleState }, 409);
  }
  return view;
}

function seatSnapshots(db: Database, showtime: Showtime, seats: Seat[]): Booking['seats'] {
  return seats.map((seat) => {
    const base = showtime.basePrice;
    const raw = seat.type === 'vip'
      ? base + db.settings.seatSurcharge.vip
      : seat.type === 'couple'
        ? base * 2 + db.settings.seatSurcharge.couple
        : base + db.settings.seatSurcharge.standard;
    const price = Math.round(raw / db.settings.priceRounding) * db.settings.priceRounding;
    return { seatId: seat.id, code: seat.code, type: seat.type, price, active: true };
  });
}

/* ------------------------------------------------------------------ */
/* Create / read                                                       */
/* ------------------------------------------------------------------ */

const idempotentBookings = new Map<string, string>();

export async function createBooking(input: {
  showtimeId: number; seatIds: number[]; acceptAgeNotice: boolean; idempotencyKey?: string;
}): Promise<BookingDetail> {
  if (input.idempotencyKey) {
    const existing = idempotentBookings.get(input.idempotencyKey);
    if (existing) {
      const detail = await getBooking(existing);
      return detail;
    }
  }
  return mutateDb((db) => {
    const user = getActor(db);
    const showtime = db.showtimes.find((s) => s.id === input.showtimeId);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    assertShowtimeSelling(db, showtime, 'online');
    const movie = db.movies.find((m) => m.id === showtime.movieId)!;
    if ((movie.age === 'T16' || movie.age === 'T18') && !input.acceptAgeNotice) {
      throw new ApiError('VALIDATION_ERROR', 'Bạn cần xác nhận đủ độ tuổi và sẽ xuất trình giấy tờ khi cần.', { fields: { acceptAgeNotice: 'Bắt buộc' } }, 422);
    }

    // One active hold per showtime per user: replace it transparently.
    const oldHolds = db.bookings.filter(
      (b) => b.userId === user.id && b.showtimeId === showtime.id && b.status === 'holding',
    );
    for (const old of oldHolds) {
      old.status = 'cancelled';
      old.cancelReason = 'Thay thế bằng đơn giữ ghế mới';
      old.cancelledAt = new Date().toISOString();
      releaseSeats(old);
      const pay = latestPayment(db, old.id);
      if (pay && (pay.status === 'pending' || pay.status === 'rejected' || pay.status === 'proof_submitted')) pay.status = 'cancelled';
      revertVoucher(db, old);
    }

    const otherHolds = db.bookings.filter((b) => b.userId === user.id && b.status === 'holding' && b.showtimeId !== showtime.id);
    if (otherHolds.length >= db.settings.maxActiveHoldsPerUser) {
      throw new ApiError('HOLD_LIMIT_EXCEEDED', `Bạn chỉ được giữ tối đa ${db.settings.maxActiveHoldsPerUser} đơn cùng lúc. Vui lòng hủy bớt đơn cũ.`, { max: db.settings.maxActiveHoldsPerUser }, 429);
    }

    const seats = validateSeatSelection(db, showtime, input.seatIds);
    const now = Date.now();
    const booking: Booking = {
      id: nextId(db.bookings),
      code: makeBookingCode(),
      userId: user.id, cinemaId: showtime.cinemaId, showtimeId: showtime.id, channel: 'online',
      status: 'holding',
      seats: seatSnapshots(db, showtime, seats), combos: [],
      ticketsSubtotal: 0, combosSubtotal: 0, discount: 0, pointsUsed: 0, pointsDiscount: 0,
      taxAmount: 0, finalAmount: 0,
      customerName: user.name, customerEmail: user.email, customerPhone: user.phone,
      holdExpiresAt: new Date(now + db.settings.holdMinutes * 60_000).toISOString(),
      holdExtended: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    recomputeTotals(db, booking);
    db.bookings.push(booking);
    if (input.idempotencyKey) idempotentBookings.set(input.idempotencyKey, booking.code);
    return toBookingDetail(db, booking);
  });
}

export async function getBooking(code: string): Promise<BookingDetail> {
  return withDb((db) => {
    const { booking } = accessBooking(db, code);
    return toBookingDetail(db, booking);
  });
}

export async function getMyHolding(showtimeId: number): Promise<BookingDetail | null> {
  return withDb((db) => {
    const user = getActor(db);
    const booking = db.bookings.find(
      (b) => b.userId === user.id && b.showtimeId === showtimeId && b.status === 'holding',
    );
    return booking ? toBookingDetail(db, booking) : null;
  });
}

export async function updateBookingSeats(code: string, seatIds: number[]): Promise<BookingDetail> {
  return mutateDb((db) => {
    const user = getActor(db);
    const { booking } = accessBooking(db, code);
    if (booking.userId !== user.id) throw new ApiError('FORBIDDEN', 'Chỉ chủ đơn được đổi ghế.', {}, 403);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã được chốt, không thể đổi ghế.', {}, 409);
    const payment = latestPayment(db, booking.id);
    if (payment && payment.status !== 'rejected' && payment.status !== 'pending') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đang chờ duyệt thanh toán, không thể đổi ghế.', {}, 409);
    }
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
    assertShowtimeSelling(db, showtime, 'online');
    // release current seats to allow keeping the same ones
    const previous = booking.seats.map((s) => ({ ...s }));
    for (const s of booking.seats) s.active = false;
    let seats: Seat[];
    try {
      seats = validateSeatSelection(db, showtime, seatIds);
    } catch (err) {
      for (const s of booking.seats) s.active = previous.find((p) => p.seatId === s.seatId)?.active ?? true;
      throw err;
    }
    booking.seats = seatSnapshots(db, showtime, seats);
    recomputeTotals(db, booking);
    return toBookingDetail(db, booking);
  });
}

export async function updateBookingCombos(code: string, items: { comboId: number; quantity: number }[]): Promise<BookingDetail> {
  return mutateDb((db) => {
    const user = getActor(db);
    const { booking } = accessBooking(db, code);
    if (booking.userId !== user.id) throw new ApiError('FORBIDDEN', 'Chỉ chủ đơn được đổi combo.', {}, 403);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã chốt, không thể đổi combo.', {}, 409);
    const payment = latestPayment(db, booking.id);
    if (payment && payment.status !== 'rejected' && payment.status !== 'pending') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đang chờ duyệt thanh toán, không thể đổi combo.', {}, 409);
    }
    const next: BookingCombo[] = [];
    for (const item of items) {
      if (item.quantity <= 0) continue;
      const combo = db.combos.find((c) => c.id === item.comboId && c.status === 'active');
      if (!combo) throw new ApiError('NOT_FOUND', 'Combo không tồn tại hoặc đã ngừng bán.', {}, 404);
      if (combo.stock <= 0) throw new ApiError('COMBO_OUT_OF_STOCK', `${combo.name} đã hết hàng.`, { combo_id: combo.id }, 409);
      if (item.quantity > combo.maxPerOrder) {
        throw new ApiError('VALIDATION_ERROR', `${combo.name} chỉ được mua tối đa ${combo.maxPerOrder} phần mỗi đơn.`, { fields: { combos: 'Vượt giới hạn' } }, 422);
      }
      if (item.quantity > combo.stock) {
        throw new ApiError('COMBO_OUT_OF_STOCK', `${combo.name} chỉ còn ${combo.stock} phần.`, { combo_id: combo.id, stock: combo.stock }, 409);
      }
      next.push({ comboId: combo.id, name: combo.name, price: combo.price, quantity: item.quantity });
    }
    booking.combos = next;
    recomputeTotals(db, booking);
    return toBookingDetail(db, booking);
  });
}

export async function applyVoucher(code: string, voucherCode: string): Promise<BookingDetail> {
  return mutateDb((db) => {
    const { booking, user } = accessBooking(db, code);
    if (booking.userId !== user.id) throw new ApiError('FORBIDDEN', 'Chỉ chủ đơn được áp voucher.', {}, 403);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã chốt, không thể áp voucher.', {}, 409);
    const voucher = db.vouchers.find((v) => v.code.toUpperCase() === voucherCode.trim().toUpperCase());
    if (!voucher) throw new ApiError('VOUCHER_INVALID', 'Mã giảm giá không tồn tại.', {}, 422);
    const uses = db.voucherUsages.filter((u) => u.voucherCode === voucher.code && u.userId === user.id && !u.reverted).length;
    computeVoucherDiscount(voucher, {
      ticketsSubtotal: booking.ticketsSubtotal,
      combosSubtotal: booking.combosSubtotal,
      userId: user.id,
      usesByUser: uses,
    });
    booking.voucherCode = voucher.code;
    recomputeTotals(db, booking);
    return toBookingDetail(db, booking);
  });
}

export async function removeVoucher(code: string): Promise<BookingDetail> {
  return mutateDb((db) => {
    const { booking, user } = accessBooking(db, code);
    if (booking.userId !== user.id) throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã chốt.', {}, 409);
    booking.voucherCode = undefined;
    recomputeTotals(db, booking);
    return toBookingDetail(db, booking);
  });
}

export async function redeemPoints(code: string, points: number): Promise<BookingDetail> {
  return mutateDb((db) => {
    const { booking, user } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã chốt.', {}, 409);
    if (points < 0 || !Number.isFinite(points)) throw new ApiError('VALIDATION_ERROR', 'Số điểm không hợp lệ.', {}, 422);
    if (points > user.points) throw new ApiError('VALIDATION_ERROR', 'Bạn không đủ điểm thưởng.', { available: user.points }, 422);
    booking.pointsUsed = Math.floor(points);
    recomputeTotals(db, booking);
    return toBookingDetail(db, booking);
  });
}

function ownedBooking(db: Database, code: string) {
  const { booking, user } = accessBooking(db, code);
  if (booking.userId !== user.id) throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
  return { booking, user };
}

export async function updateContact(code: string, contact: { name: string; email: string; phone: string }): Promise<BookingDetail> {
  validateContact(contact);
  return mutateDb((db) => {
    const { booking } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã chốt, không thể sửa liên hệ.', {}, 409);
    booking.customerName = contact.name.trim();
    booking.customerEmail = contact.email.trim();
    booking.customerPhone = contact.phone.trim();
    booking.updatedAt = new Date().toISOString();
    return toBookingDetail(db, booking);
  });
}

export async function extendHold(code: string): Promise<BookingDetail> {
  return mutateDb((db) => {
    const { booking } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn không còn giữ ghế.', {}, 409);
    if (booking.holdExtended) throw new ApiError('BOOKING_INVALID_STATE', 'Bạn chỉ được gia hạn giữ ghế 1 lần.', {}, 409);
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
    const maxDeadline = startMsOf(showtime) - db.settings.onlineCloseBeforeMinutes * 60_000;
    const next = Math.min(new Date(booking.holdExpiresAt).getTime() + db.settings.holdExtendMinutes * 60_000, maxDeadline);
    booking.holdExpiresAt = new Date(next).toISOString();
    booking.holdExtended = true;
    return toBookingDetail(db, booking);
  });
}

export async function confirmBooking(code: string): Promise<BookingDetail> {
  return mutateDb((db) => {
    const { booking, user } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn không ở trạng thái giữ ghế.', {}, 409);
    const payment = latestPayment(db, booking.id);
    if (payment && payment.status === 'proof_submitted') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Biên lai đang chờ duyệt. Vui lòng đợi xác nhận.', {}, 409);
    }
    if (booking.voucherCode) {
      const voucher = db.vouchers.find((v) => v.code === booking.voucherCode);
      if (!voucher) {
        booking.voucherCode = undefined;
        recomputeTotals(db, booking);
      } else {
        const uses = db.voucherUsages.filter((u) => u.voucherCode === voucher.code && u.userId === user.id && !u.reverted).length;
        try {
          computeVoucherDiscount(voucher, {
            ticketsSubtotal: booking.ticketsSubtotal, combosSubtotal: booking.combosSubtotal,
            userId: user.id, usesByUser: uses,
          });
        } catch (err) {
          booking.voucherCode = undefined;
          recomputeTotals(db, booking);
          throw err;
        }
      }
    }
    if (booking.finalAmount === 0) {
      const pending: Payment = {
        id: nextId(db.payments), bookingId: booking.id, provider: 'bank_qr', method: 'bank_qr',
        amount: 0, status: 'paid', transferContent: `${db.settings.transferPrefix} ${booking.code.slice(-6)}`,
        paidAt: new Date().toISOString(), reviewedBy: user.id, reviewedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      db.payments.push(pending);
      confirmPaidBooking(db, booking, user.id, 0);
      return toBookingDetail(db, booking);
    }
    let existing = db.payments.filter((p) => p.bookingId === booking.id);
    const reusable = existing.find((p) => p.status === 'pending' || p.status === 'rejected');
    if (reusable) {
      reusable.status = 'pending';
      reusable.amount = booking.finalAmount;
      reusable.rejectReasonCode = undefined;
      reusable.rejectNote = undefined;
    } else {
      existing = [];
      const created: Payment = {
        id: nextId(db.payments), bookingId: booking.id, provider: 'bank_qr', method: 'bank_qr',
        amount: booking.finalAmount, status: 'pending',
        transferContent: `${db.settings.transferPrefix} ${booking.code.slice(-6)}`,
        createdAt: new Date().toISOString(),
      };
      db.payments.push(created);
    }
    return toBookingDetail(db, booking);
  });
}

export async function cancelHolding(code: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const { booking } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Chỉ có thể hủy đơn đang giữ ghế.', {}, 409);
    const payment = latestPayment(db, booking.id);
    if (payment && payment.status === 'proof_submitted') {
      throw new ApiError('REFUND_NOT_ALLOWED', 'Biên lai đang chờ duyệt, vui lòng liên hệ hotline để được hỗ trợ.', {}, 409);
    }
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();
    booking.cancelReason = 'Khách hủy đơn';
    releaseSeats(booking);
    if (payment) payment.status = 'cancelled';
    revertVoucher(db, booking);
    return { message: 'Đã hủy đơn giữ ghế. Ghế đã được nhả.' };
  });
}

export async function myBookings(tab: 'upcoming' | 'past' | 'cancelled' | 'all' = 'all', page = 1, perPage = 10): Promise<Paged<BookingDetail>> {
  return withDb((db) => {
    const user = getActor(db);
    const now = Date.now();
    let rows = db.bookings.filter((b) => b.userId === user.id);
    if (tab === 'upcoming') {
      rows = rows.filter((b) => (b.status === 'holding' || b.status === 'confirmed') && startMsOf(db.showtimes.find((s) => s.id === b.showtimeId)!) > now);
    } else if (tab === 'past') {
      rows = rows.filter((b) => b.status === 'completed');
    } else if (tab === 'cancelled') {
      rows = rows.filter((b) => b.status === 'cancelled' || b.status === 'expired');
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const details = rows.map((b) => toBookingDetail(db, b));
    const start = (page - 1) * perPage;
    return { items: details.slice(start, start + perPage), total: details.length, page, perPage };
  });
}

export async function resendTicketsEmail(code: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const { booking, user } = accessBooking(db, code);
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Đơn chưa thanh toán, chưa thể gửi vé.', {}, 409);
    }
    notify(db, user.id, 'Đã gửi lại vé', `Vé của đơn ${booking.code} đã được gửi tới ${booking.customerEmail || user.email}.`, 'booking', `/ve/${booking.code}`);
    return { message: `Đã gửi lại vé tới ${booking.customerEmail || user.email}.` };
  });
}

/* ------------------------------------------------------------------ */
/* Payment                                                             */
/* ------------------------------------------------------------------ */

function ensurePayment(db: Database, booking: Booking): Payment {
  const existing = latestPayment(db, booking.id);
  if (existing) return existing;
  const payment: Payment = {
    id: nextId(db.payments), bookingId: booking.id, provider: 'bank_qr', method: 'bank_qr',
    amount: booking.finalAmount, status: 'pending',
    transferContent: `${db.settings.transferPrefix} ${booking.code.slice(-6)}`,
    createdAt: new Date().toISOString(),
  };
  db.payments.push(payment);
  return payment;
}

export async function getPaymentInfo(code: string): Promise<PaymentInfo> {
  return withDb((db) => {
    const { booking } = accessBooking(db, code);
    const detail = toBookingDetail(db, booking);
    const payment = latestPayment(db, booking.id) ?? null;
    const amount = payment?.amount ?? booking.finalAmount;
    const transferContent = payment?.transferContent ?? `${db.settings.transferPrefix} ${booking.code.slice(-6)}`;
    const s = db.settings;
    const qrValue = `${s.bankCode}|${s.accountNumber}|${amount}|${transferContent}`;
    const qrImageUrl = s.useCustomQr && s.customQrUrl
      ? s.customQrUrl
      : `https://img.vietqr.io/image/${s.bankCode}-${s.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(s.accountName)}`;
    let proofDeadlineAt: string | undefined;
    if (payment?.status === 'proof_submitted' && payment.submittedAt) {
      proofDeadlineAt = new Date(Math.min(
        new Date(payment.submittedAt).getTime() + s.proofPendingMaxMinutes * 60_000,
        startMsOf(detail.showtime) - 30 * 60_000,
      )).toISOString();
    }
    return {
      booking: detail, payment, amount, transferContent,
      bank: { name: s.bankName, code: s.bankCode, accountNumber: s.accountNumber, accountName: s.accountName, prefix: s.transferPrefix },
      qrValue, qrImageUrl, useCustomQr: s.useCustomQr && Boolean(s.customQrUrl),
      status: payment?.status ?? 'pending',
      rejectReasonCode: payment?.rejectReasonCode, rejectNote: payment?.rejectNote,
      proofUrl: payment?.proofUrl, proofDeadlineAt,
      deadline: detail.holdDeadline, serverTime: new Date().toISOString(),
    };
  });
}

/**
 * Xác nhận thanh toán tức thời (mô phỏng webhook ngân hàng trả về giao dịch khớp).
 * Đơn chuyển thẳng sang `confirmed`, vé được phát hành ngay trong cùng một giao dịch.
 */
export async function completePayment(code: string): Promise<PaymentInfo> {
  const result = await mutateDb((db) => {
    const { booking, user } = ownedBooking(db, code);
    if (booking.status === 'confirmed' || booking.status === 'completed') return booking;
    if (booking.status !== 'holding') {
      throw new ApiError('HOLD_EXPIRED', 'Đơn đã hết thời gian giữ ghế. Vui lòng chọn lại ghế.', {}, 409);
    }
    const payment = ensurePayment(db, booking);
    if (payment.status === 'paid') return booking;
    if (payment.status === 'expired' || payment.status === 'cancelled') {
      throw new ApiError('HOLD_EXPIRED', 'Đơn đã hết thời gian giữ ghế. Vui lòng chọn lại ghế.', {}, 409);
    }
    payment.rejectReasonCode = undefined;
    payment.rejectNote = undefined;
    payment.submittedAt = undefined;
    const previousStatus = payment.status;
    confirmPaidBooking(db, booking, 'system', booking.finalAmount);
    audit(db, user, 'payment.complete', 'order', booking.id, { payment_status: previousStatus }, { payment_status: 'paid', amount: booking.finalAmount });
    return booking;
  });
  return getPaymentInfo(result.code);
}

const REJECT_REASONS = ['unclear_proof', 'wrong_amount', 'wrong_content', 'not_received', 'other'] as const;

export async function submitPaymentProof(code: string, input: {
  dataUrl: string; fileName: string; mimeType: string; size: number; paidAmount?: number; hash: string;
}): Promise<PaymentInfo> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(input.mimeType)) {
    throw new ApiError('VALIDATION_ERROR', 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.', { fields: { file: 'Sai định dạng' } }, 422);
  }
  if (input.size > 5 * 1024 * 1024) {
    throw new ApiError('VALIDATION_ERROR', 'Ảnh biên lai tối đa 5MB.', { fields: { file: 'Ảnh quá lớn' } }, 422);
  }
  if (!input.dataUrl) throw new ApiError('PAYMENT_PROOF_REQUIRED', 'Vui lòng tải lên ảnh biên lai chuyển khoản.', {}, 422);

  const result = await mutateDb((db) => {
    const { booking } = ownedBooking(db, code);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn không còn giữ ghế để gửi biên lai.', {}, 409);
    const payment = ensurePayment(db, booking);
    if (payment.status === 'paid') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã được thanh toán.', {}, 409);
    const duplicate = db.payments.find((p) => p.proofHash && p.proofHash === input.hash && p.id !== payment.id);
    if (duplicate) {
      const other = db.bookings.find((b) => b.id === duplicate.bookingId);
      throw new ApiError('PAYMENT_PROOF_DUPLICATE', 'Ảnh biên lai này đã được dùng cho một đơn khác.', { booking_code: other?.code }, 409);
    }
    payment.proofUrl = input.dataUrl;
    payment.proofHash = input.hash;
    payment.paidAmount = input.paidAmount;
    payment.status = 'proof_submitted';
    payment.submittedAt = new Date().toISOString();
    payment.amount = booking.finalAmount;
    payment.rejectReasonCode = undefined;
    payment.rejectNote = undefined;
    booking.updatedAt = new Date().toISOString();
    const admins = db.users.filter((u) => u.role === 'admin' || u.role === 'manager');
    for (const admin of admins) {
      notify(db, admin.id, 'Biên lai mới chờ duyệt', `Đơn ${booking.code} gửi biên lai ${new Intl.NumberFormat('vi-VN').format(booking.finalAmount)}đ. Cần duyệt trong thời hạn SLA.`, 'payment', '/admin/duyet-bien-lai');
    }
    notify(db, booking.userId!, 'Đã nhận biên lai', `PXU Cinema đã nhận biên lai cho đơn ${booking.code}. Chúng tôi sẽ xác nhận trong thời gian sớm nhất.`, 'payment', `/thanh-toan/${booking.code}`);
    if (db.settings.paymentConfirmMode === 'auto') {
      confirmPaidBooking(db, booking, 'system', booking.finalAmount);
    }
    return toBookingDetail(db, booking);
  });
  return getPaymentInfo(result.code);
}

export const rejectionReasons = REJECT_REASONS;

export async function approvePayment(bookingId: number, input: { allowMismatch?: boolean } = {}): Promise<{ message: string; booking: BookingDetail; idempotent: boolean }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'payment.review');
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', {}, 404);
    if (booking.status === 'confirmed' || booking.status === 'completed') {
      return { message: 'Đơn đã được duyệt trước đó.', booking: toBookingDetail(db, booking), idempotent: true };
    }
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn không ở trạng thái chờ duyệt.', {}, 409);
    const payment = latestPayment(db, booking.id);
    if (!payment) throw new ApiError('PAYMENT_PROOF_REQUIRED', 'Đơn chưa có thông tin thanh toán.', {}, 422);
    if (payment.status !== 'proof_submitted') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Biên lai không ở trạng thái chờ duyệt.', {}, 409);
    }
    if (payment.paidAmount !== undefined && payment.paidAmount !== booking.finalAmount && !input.allowMismatch) {
      throw new ApiError(
        'PAYMENT_AMOUNT_MISMATCH',
        `Số tiền khách nhập (${new Intl.NumberFormat('vi-VN').format(payment.paidAmount)}đ) khác số tiền cần thu (${new Intl.NumberFormat('vi-VN').format(booking.finalAmount)}đ).`,
        { expected: booking.finalAmount, declared: payment.paidAmount },
        409,
      );
    }
    confirmPaidBooking(db, booking, actor.id, booking.finalAmount);
    audit(db, actor, 'payment.approve', 'order', booking.id, { payment_status: 'proof_submitted' }, { payment_status: 'paid', amount: booking.finalAmount });
    return { message: `Đã duyệt đơn ${booking.code} và phát hành ${booking.seats.length} vé.`, booking: toBookingDetail(db, booking), idempotent: false };
  });
}

export async function rejectPayment(bookingId: number, reasonCode: string, note: string): Promise<{ message: string; booking: BookingDetail }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'payment.review');
    const booking = db.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn hàng.', {}, 404);
    if (!REJECT_REASONS.includes(reasonCode as (typeof REJECT_REASONS)[number])) {
      throw new ApiError('VALIDATION_ERROR', 'Vui lòng chọn lý do từ chối.', { fields: { reason: 'Bắt buộc' } }, 422);
    }
    const payment = latestPayment(db, booking.id);
    if (!payment || payment.status !== 'proof_submitted') {
      throw new ApiError('BOOKING_INVALID_STATE', 'Biên lai không ở trạng thái chờ duyệt.', {}, 409);
    }
    payment.status = 'rejected';
    payment.rejectReasonCode = reasonCode;
    payment.rejectNote = note;
    payment.reviewedBy = actor.id;
    payment.reviewedAt = new Date().toISOString();
    const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
    const maxHold = startMsOf(showtime) - 30 * 60_000;
    const extended = Math.min(Date.now() + 15 * 60_000, maxHold);
    if (extended > Date.now()) booking.holdExpiresAt = new Date(extended).toISOString();
    if (booking.userId) {
      notify(
        db, booking.userId, 'Biên lai bị từ chối',
        `Biên lai đơn ${booking.code} chưa hợp lệ${note ? `: ${note}` : ''}. Bạn có thể gửi lại ảnh khác trước ${new Date(booking.holdExpiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}.`,
        'payment', `/thanh-toan/${booking.code}`,
      );
    }
    audit(db, actor, 'payment.reject', 'order', booking.id, { payment_status: 'proof_submitted' }, { payment_status: 'rejected', reasonCode, note });
    return { message: `Đã từ chối biên lai đơn ${booking.code}. Khách có thể gửi lại.`, booking: toBookingDetail(db, booking) };
  });
}

/* ------------------------------------------------------------------ */
/* Tickets & check-in                                                  */
/* ------------------------------------------------------------------ */

export interface TicketView {
  ticket: Ticket;
  booking: BookingDetail;
}

export async function getTicketByCode(ticketCode: string): Promise<TicketView> {
  return withDb((db) => {
    const actor = getActor(db);
    const ticket = db.tickets.find((t) => t.code.toUpperCase() === ticketCode.trim().toUpperCase());
    if (!ticket) throw new ApiError('NOT_FOUND', 'Không tìm thấy vé.', {}, 404);
    const booking = db.bookings.find((b) => b.id === ticket.bookingId);
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn của vé.', {}, 404);
    const allowed = booking.userId === actor.id || can(actor, 'booking.read') || actor.role === 'staff';
    if (!allowed) throw new ApiError('FORBIDDEN', 'Bạn không có quyền xem vé này.', {}, 403);
    return { ticket, booking: toBookingDetail(db, booking) };
  });
}

function checkinCore(
  db: Database,
  actor: User,
  input: { ticketCode: string; showtimeId?: number; override?: boolean; idVerified?: boolean; pin?: string; cinemaId?: number },
): CheckinResponse {
  const code = input.ticketCode.trim().toUpperCase();
  const ticket = db.tickets.find((t) => t.code.toUpperCase() === code);
  const staffCinema = input.cinemaId ?? actor.cinemaIds[0] ?? 0;
  const base = { ticketsRemaining: 0, ticketsTotal: 0, seatCodes: [] as string[] };

  const log = (result: CheckinResult, showtimeId?: number) => {
    const entry: CheckinLog = {
      id: nextId(db.checkinLogs), ticketCode: code, result,
      staffId: actor.id, staffName: actor.name, cinemaId: staffCinema,
      showtimeId, at: new Date().toISOString(),
    };
    db.checkinLogs.push(entry);
  };

  if (!ticket) {
    log('NOT_FOUND');
    return { ...base, result: 'NOT_FOUND', message: 'Mã vé không tồn tại. Vui lòng kiểm tra lại.' };
  }

  const booking = db.bookings.find((b) => b.id === ticket.bookingId)!;
  const showtime = db.showtimes.find((s) => s.id === booking.showtimeId)!;
  const movie = db.movies.find((m) => m.id === showtime.movieId)!;
  const room = db.rooms.find((r) => r.id === showtime.roomId)!;
  const cinema = db.cinemas.find((c) => c.id === showtime.cinemaId)!;
  const bookingTickets = db.tickets.filter((t) => t.bookingId === booking.id);
  const total = bookingTickets.length;
  const remaining = bookingTickets.filter((t) => t.status === 'valid').length;
  const shared = {
    ...base,
    ticket, booking, showtime, movie,
    ticketsTotal: total,
    cinemaName: cinema.name, roomName: room.name,
    seatCodes: booking.seats.map((s) => s.code),
  };

  if (ticket.status === 'used') {
    log('ALREADY_USED', showtime.id);
    return {
      ...shared, result: 'ALREADY_USED',
      message: `Vé đã được sử dụng lúc ${ticket.checkedInAt ? new Date(ticket.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}${ticket.checkedInBy ? ` bởi ${ticket.checkedInBy}` : ''}.`,
      checkedInAt: ticket.checkedInAt, checkedInBy: ticket.checkedInBy,
      ticketsRemaining: remaining,
    };
  }
  if (ticket.status === 'cancelled' || booking.status === 'cancelled') {
    log('CANCELLED', showtime.id);
    return { ...shared, result: 'CANCELLED', message: 'Vé hoặc đơn hàng đã bị hủy.', ticketsRemaining: remaining };
  }
  if (ticket.status === 'expired' || booking.status === 'expired') {
    log('TOO_LATE', showtime.id);
    return { ...shared, result: 'TOO_LATE', message: 'Vé đã hết hạn sử dụng.', ticketsRemaining: remaining };
  }
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    log('NOT_PAID', showtime.id);
    return { ...shared, result: 'NOT_PAID', message: 'Đơn chưa được thanh toán hoặc chưa xác nhận.', ticketsRemaining: remaining };
  }
  const scoped = actor.role === 'admin' || actor.cinemaIds.length === 0 || actor.cinemaIds.includes(showtime.cinemaId);
  if (!scoped) {
    log('WRONG_CINEMA', showtime.id);
    return { ...shared, result: 'WRONG_CINEMA', message: `Vé thuộc ${cinema.name}, không thuộc rạp bạn đang làm việc.`, ticketsRemaining: remaining };
  }
  if (input.showtimeId && input.showtimeId !== showtime.id) {
    log('WRONG_CINEMA', showtime.id);
    return { ...shared, result: 'WRONG_CINEMA', message: 'Vé không thuộc suất chiếu đang chọn.', ticketsRemaining: remaining };
  }

  const now = Date.now();
  const start = startMsOf(showtime);
  const end = endMsOf(showtime);
  const earlyLimit = start - db.settings.checkinOpenBeforeMinutes * 60_000;
  const lateLimit = end + db.settings.checkinLateAllowMinutes * 60_000;
  const canOverride = (actor.role === 'manager' || actor.role === 'admin') && input.override;
  if (input.override && input.pin !== '1234' && actor.role !== 'admin') {
    throw new ApiError('FORBIDDEN', 'PIN quản lý không đúng.', {}, 403);
  }
  if (now < earlyLimit && !canOverride) {
    log('TOO_EARLY', showtime.id);
    return {
      ...shared, result: 'TOO_EARLY',
      message: `Chưa đến giờ vào phòng. Mở check-in từ ${new Date(earlyLimit).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}.`,
      ticketsRemaining: remaining,
    };
  }
  if (now > lateLimit && !canOverride) {
    log('TOO_LATE', showtime.id);
    return { ...shared, result: 'TOO_LATE', message: 'Đã quá giờ cho phép vào phòng. Cần quản lý xác nhận.', ticketsRemaining: remaining };
  }
  if ((movie.age === 'T16' || movie.age === 'T18') && !input.idVerified) {
    log('ID_CHECK_REQUIRED', showtime.id);
    return {
      ...shared, result: 'ID_CHECK_REQUIRED',
      message: `Phim nhãn ${movie.age}. Vui lòng kiểm tra giấy tờ (CCCD/Hộ chiếu) của khách trước khi cho vào.`,
      ticketsRemaining: remaining,
      ageWarning: movie.age,
    };
  }

  ticket.status = 'used';
  ticket.checkedInAt = new Date().toISOString();
  ticket.checkedInBy = actor.name;
  ticket.checkedInCinemaId = showtime.cinemaId;
  log('OK', showtime.id);
  const left = db.tickets.filter((t) => t.bookingId === booking.id && t.status === 'valid').length;
  return {
    ...shared, result: 'OK',
    message: `Hợp lệ · ${movie.title} · ${room.name} · Ghế ${ticket.seatCode}.`,
    checkedInAt: ticket.checkedInAt, checkedInBy: actor.name,
    ticketsRemaining: left,
  };
}

export async function checkin(input: {
  ticketCode: string; showtimeId?: number; override?: boolean; idVerified?: boolean; pin?: string; cinemaId?: number;
}): Promise<CheckinResponse> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Chỉ nhân viên được soát vé.', {}, 403);
    }
    if (!input.ticketCode.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập mã vé.', {}, 422);
    return checkinCore(db, actor, input);
  });
}

export async function checkinBooking(bookingCode: string, input: { pin?: string; idVerified?: boolean } = {}): Promise<CheckinResponse> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Chỉ nhân viên được soát vé.', {}, 403);
    }
    const booking = db.bookings.find((b) => b.code.toUpperCase() === bookingCode.trim().toUpperCase());
    if (!booking) return { result: 'NOT_FOUND', message: 'Không tìm thấy đơn hàng.', ticketsRemaining: 0, ticketsTotal: 0, seatCodes: [] };
    const valid = db.tickets.filter((t) => t.bookingId === booking.id && t.status === 'valid');
    let last: CheckinResponse | null = null;
    let success = 0;
    for (const ticket of valid) {
      last = checkinCore(db, actor, { ticketCode: ticket.code, idVerified: input.idVerified, pin: input.pin });
      if (last.result === 'OK') success++;
    }
    if (!last) {
      const any = db.tickets.find((t) => t.bookingId === booking.id);
      if (!any) return { result: 'NOT_FOUND', message: 'Đơn chưa có vé.', ticketsRemaining: 0, ticketsTotal: 0, seatCodes: [] };
      last = checkinCore(db, actor, { ticketCode: any.code });
      return last;
    }
    return { ...last, message: `Đã check-in ${success}/${valid.length} vé của đơn ${booking.code}.` };
  });
}

export async function undoCheckin(ticketId: number, reason: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'checkin.undo');
    if (reason.trim().length < 10) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do hoàn tác (tối thiểu 10 ký tự).', { fields: { reason: 'Tối thiểu 10 ký tự' } }, 422);
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new ApiError('NOT_FOUND', 'Không tìm thấy vé.', {}, 404);
    if (ticket.status !== 'used') throw new ApiError('BOOKING_INVALID_STATE', 'Vé chưa được check-in.', {}, 409);
    const before = { status: ticket.status, checkedInAt: ticket.checkedInAt };
    ticket.status = 'valid';
    ticket.checkedInAt = undefined;
    ticket.checkedInBy = undefined;
    audit(db, actor, 'checkin.undo', 'ticket', ticket.id, before, { status: 'valid' }, reason);
    return { message: 'Đã hoàn tác check-in. Vé có thể soát lại.' };
  });
}

export async function confirmComboPickup(bookingCode: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Chỉ nhân viên được xác nhận combo.', {}, 403);
    }
    const booking = db.bookings.find((b) => b.code.toUpperCase() === bookingCode.trim().toUpperCase());
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    if (!booking.combos.length) throw new ApiError('BOOKING_INVALID_STATE', 'Đơn không có combo bắp nước.', {}, 409);
    if (booking.comboPickedUpAt) throw new ApiError('BOOKING_INVALID_STATE', `Combo đã được nhận lúc ${new Date(booking.comboPickedUpAt).toLocaleString('vi-VN')}.`, {}, 409);
    booking.comboPickedUpAt = new Date().toISOString();
    audit(db, actor, 'combo.pickup', 'booking', booking.code, undefined, { pickedUpAt: booking.comboPickedUpAt });
    return { message: `Đã xác nhận nhận combo cho đơn ${booking.code}.` };
  });
}

export async function checkinStats(showtimeId?: number): Promise<{ checkedIn: number; total: number; failed: number }> {
  return withDb((db) => {
    requirePermission(db, 'booking.read');
    const bookings = db.bookings.filter((b) => (showtimeId ? b.showtimeId === showtimeId : true)
      && (b.status === 'confirmed' || b.status === 'completed'));
    const ids = new Set(bookings.map((b) => b.id));
    const tickets = db.tickets.filter((t) => ids.has(t.bookingId));
    const logs = db.checkinLogs.filter((l) => showtimeId ? l.showtimeId === showtimeId : true);
    return {
      checkedIn: tickets.filter((t) => t.status === 'used').length,
      total: tickets.length,
      failed: logs.filter((l) => l.result !== 'OK').length,
    };
  });
}

export async function recentCheckins(limit = 20): Promise<CheckinLog[]> {
  return withDb((db) => {
    requirePermission(db, 'booking.read');
    return [...db.checkinLogs].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  });
}

export async function ticketsForBooking(code: string): Promise<Ticket[]> {
  return withDb((db) => {
    const { booking } = accessBooking(db, code);
    return db.tickets.filter((t) => t.bookingId === booking.id);
  });
}

export function explainResult(result: CheckinResult): string {
  const map: Record<CheckinResult, string> = {
    OK: 'Hợp lệ',
    ALREADY_USED: 'Đã sử dụng',
    TOO_EARLY: 'Chưa đến giờ',
    TOO_LATE: 'Quá giờ',
    NOT_FOUND: 'Không tồn tại',
    NOT_PAID: 'Chưa thanh toán',
    CANCELLED: 'Đã hủy',
    WRONG_CINEMA: 'Sai rạp / suất',
    ID_CHECK_REQUIRED: 'Cần kiểm tra giấy tờ',
  };
  return map[result];
}

export async function staffCurrentShowtimes(): Promise<ShowtimePublic[]> {
  return withDb((db) => {
    const actor = getActor(db);
    if (actor.role === 'customer') throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    const scope = actor.role === 'admin' || actor.cinemaIds.length === 0 ? null : actor.cinemaIds;
    const now = Date.now();
    return db.showtimes
      .filter((s) => (!scope || scope.includes(s.cinemaId)) && s.status !== 'cancelled')
      .filter((s) => Math.abs(startMsOf(s) - now) < 3 * 3600_000)
      .sort((a, b) => startMsOf(a) - startMsOf(b))
      .map((s) => toShowtimePublic(db, s));
  });
}

export async function staffTodayBookings(cinemaId?: number): Promise<BookingDetail[]> {
  return withDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    }
    const scope = actor.role === 'admin' || actor.cinemaIds.length === 0 ? (cinemaId ? [cinemaId] : null) : actor.cinemaIds;
    const today = dateISO(cinemaNow());
    return db.bookings
      .filter((b) => {
        const st = db.showtimes.find((s) => s.id === b.showtimeId);
        if (!st) return false;
        const inScope = !scope || scope.includes(st.cinemaId);
        const cinemaMatch = !cinemaId || st.cinemaId === cinemaId;
        return inScope && cinemaMatch && (st.showDate === today || b.status === 'holding');
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((b) => toBookingDetail(db, b));
  });
}

export async function posCreateBooking(input: {
  showtimeId: number; seatIds: number[]; comboItems?: { comboId: number; quantity: number }[];
  customerName?: string; customerPhone?: string;
}): Promise<BookingDetail> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Chỉ nhân viên bán vé tại quầy.', {}, 403);
    }
    const shift = db.shifts.find((s) => s.staffId === actor.id && s.status === 'open');
    if (!shift) throw new ApiError('BOOKING_INVALID_STATE', 'Bạn cần mở ca làm việc trước khi bán vé.', {}, 409);
    const showtime = db.showtimes.find((s) => s.id === input.showtimeId);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    assertShowtimeSelling(db, showtime, 'pos');
    const seats = validateSeatSelection(db, showtime, input.seatIds);
    const booking: Booking = {
      id: nextId(db.bookings),
      code: makeBookingCode(),
      userId: null, cinemaId: showtime.cinemaId, showtimeId: showtime.id, channel: 'pos',
      staffId: actor.id, shiftId: String(shift.id),
      status: 'holding', seats: seatSnapshots(db, showtime, seats), combos: [],
      ticketsSubtotal: 0, combosSubtotal: 0, discount: 0, pointsUsed: 0, pointsDiscount: 0,
      taxAmount: 0, finalAmount: 0,
      customerName: input.customerName?.trim() || 'Khách lẻ',
      customerEmail: '', customerPhone: input.customerPhone?.trim() ?? '',
      holdExpiresAt: new Date(Date.now() + 3 * 60_000).toISOString(),
      holdExtended: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    for (const item of input.comboItems ?? []) {
      if (item.quantity <= 0) continue;
      const combo = db.combos.find((c) => c.id === item.comboId);
      if (!combo) continue;
      if (combo.stock < item.quantity) throw new ApiError('COMBO_OUT_OF_STOCK', `${combo.name} không đủ hàng.`, { combo_id: combo.id }, 409);
      booking.combos.push({ comboId: combo.id, name: combo.name, price: combo.price, quantity: item.quantity });
    }
    recomputeTotals(db, booking);
    db.bookings.push(booking);
    return toBookingDetail(db, booking);
  });
}

export async function posPay(code: string, input: { method: 'cash' | 'card' | 'bank_qr' | 'mixed'; amountReceived?: number; reference?: string }): Promise<{ booking: BookingDetail; change: number; message: string }> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    }
    const booking = db.bookings.find((b) => b.code.toUpperCase() === code.toUpperCase());
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    if (booking.channel !== 'pos') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn này không phải đơn tại quầy.', {}, 409);
    if (booking.status !== 'holding') throw new ApiError('BOOKING_INVALID_STATE', 'Đơn đã được thanh toán.', {}, 409);
    const shift = db.shifts.find((s) => s.id === Number(booking.shiftId));
    if (!shift || shift.status !== 'open') throw new ApiError('BOOKING_INVALID_STATE', 'Ca làm việc đã đóng.', {}, 409);
    if (input.method === 'cash' && (input.amountReceived ?? 0) < booking.finalAmount) {
      throw new ApiError('VALIDATION_ERROR', 'Tiền khách đưa chưa đủ.', { required: booking.finalAmount }, 422);
    }
    const change = input.method === 'cash' ? Math.max(0, (input.amountReceived ?? 0) - booking.finalAmount) : 0;
    let payment = latestPayment(db, booking.id);
    if (!payment) {
      payment = {
        id: nextId(db.payments), bookingId: booking.id,
        provider: input.method === 'cash' ? 'cash' : input.method === 'card' ? 'card' : 'bank_qr',
        method: input.method, amount: booking.finalAmount, status: 'paid',
        transferContent: `${db.settings.transferPrefix} ${booking.code.slice(-6)}`,
        reference: input.reference, paidAt: new Date().toISOString(),
        reviewedBy: actor.id, reviewedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      db.payments.push(payment);
    } else {
      payment.status = 'paid';
      payment.method = input.method;
      payment.paidAt = new Date().toISOString();
      payment.reference = input.reference;
      payment.reviewedBy = actor.id;
      payment.reviewedAt = payment.paidAt;
    }
    booking.status = 'confirmed';
    booking.confirmedAt = new Date().toISOString();
    issueTickets(db, booking);
    for (const item of booking.combos) {
      const combo = db.combos.find((c) => c.id === item.comboId);
      if (combo) {
        combo.stock = Math.max(0, combo.stock - item.quantity);
        combo.sold += item.quantity;
      }
    }
    if (input.method === 'cash') {
      shift.totalSales += booking.finalAmount;
      shift.transactions += 1;
      shift.expectedCash = shift.openingCash + shift.totalSales;
    }
    audit(db, actor, 'pos.pay', 'booking', booking.code, undefined, { method: input.method, amount: booking.finalAmount });
    return {
      booking: toBookingDetail(db, booking), change,
      message: `Đã thanh toán ${new Intl.NumberFormat('vi-VN').format(booking.finalAmount)}đ${change ? ` · Tiền thừa ${new Intl.NumberFormat('vi-VN').format(change)}đ` : ''}.`,
    };
  });
}

export async function reprintTicket(code: string): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    }
    const booking = db.bookings.find((b) => b.code.toUpperCase() === code.toUpperCase());
    if (!booking) throw new ApiError('NOT_FOUND', 'Không tìm thấy đơn.', {}, 404);
    audit(db, actor, 'ticket.reprint', 'booking', booking.code);
    return { message: `Đã gửi lệnh in lại vé đơn ${booking.code}.` };
  });
}

export async function openShift(openingCash: number, cinemaId: number): Promise<{ message: string }> {
  return mutateDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    }
    if (db.shifts.some((s) => s.staffId === actor.id && s.status === 'open')) {
      throw new ApiError('BOOKING_INVALID_STATE', 'Bạn đang có ca mở.', {}, 409);
    }
    if (openingCash < 0) throw new ApiError('VALIDATION_ERROR', 'Tiền đầu ca không hợp lệ.', {}, 422);
    db.shifts.push({
      id: nextId(db.shifts), staffId: actor.id, staffName: actor.name, cinemaId,
      openedAt: new Date().toISOString(), openingCash, status: 'open',
      totalSales: 0, transactions: 0, expectedCash: openingCash,
    });
    audit(db, actor, 'shift.open', 'shift', cinemaId, undefined, { openingCash });
    return { message: 'Đã mở ca làm việc.' };
  });
}

export async function closeShift(shiftId: number, countedCash: number, note: string): Promise<{ message: string; difference: number }> {
  return mutateDb((db) => {
    const actor = getActor(db);
    const shift = db.shifts.find((s) => s.id === shiftId);
    if (!shift) throw new ApiError('NOT_FOUND', 'Không tìm thấy ca.', {}, 404);
    if (shift.status !== 'open') throw new ApiError('BOOKING_INVALID_STATE', 'Ca đã đóng.', {}, 409);
    if (shift.staffId !== actor.id && actor.role !== 'admin' && actor.role !== 'manager') throw new ApiError('FORBIDDEN', 'Không có quyền.', {}, 403);
    const cashSales = db.bookings
      .filter((b) => b.shiftId === String(shift.id) && b.status !== 'cancelled' && b.status !== 'expired')
      .reduce((sum, b) => {
        const p = latestPayment(db, b.id);
        return p?.method === 'cash' && p.status === 'paid' ? sum + p.amount : sum;
      }, 0);
    shift.expectedCash = shift.openingCash + cashSales;
    shift.countedCash = countedCash;
    shift.difference = countedCash - shift.expectedCash;
    shift.closedAt = new Date().toISOString();
    shift.status = 'closed';
    shift.note = note;
    audit(db, actor, 'shift.close', 'shift', shift.id, undefined, { countedCash, expectedCash: shift.expectedCash, difference: shift.difference }, note);
    return {
      message: `Đã đóng ca. Chênh lệch: ${new Intl.NumberFormat('vi-VN').format(shift.difference)}đ.`,
      difference: shift.difference,
    };
  });
}

export interface CurrentShiftInfo {
  shift: Shift | null;
  todaySales: number;
  transactions: number;
}

export async function currentShift(): Promise<CurrentShiftInfo> {
  return withDb((db) => {
    const actor = getActor(db);
    const shift = db.shifts.find((s) => s.staffId === actor.id && s.status === 'open') ?? null;
    const today = dateISO(cinemaNow());
    const posBookings = db.bookings.filter((b) => b.channel === 'pos' && b.staffId === actor.id && b.createdAt.slice(0, 10) === today && b.status !== 'cancelled');
    return {
      shift,
      todaySales: posBookings.reduce((sum, b) => sum + b.finalAmount, 0),
      transactions: posBookings.length,
    };
  });
}

export async function cinemaNameFor(cinemaId: number): Promise<string> {
  return withDb((db) => db.cinemas.find((c) => c.id === cinemaId)?.name ?? '—');
}
