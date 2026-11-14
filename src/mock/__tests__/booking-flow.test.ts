import { beforeAll, describe, expect, it } from 'vitest';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
if (typeof globalThis.btoa !== 'function') {
  Object.defineProperty(globalThis, 'btoa', {
    value: (input: string) => Buffer.from(input, 'binary').toString('base64'),
    configurable: true,
  });
}

import {
  applyVoucher, approvePayment, approveRefund, checkin, checkinStats, completeRefund, confirmBooking,
  createBooking, createRefund, createShowtime, currentShift, getBooking, getPaymentInfo, getShowtimeSeats,
  listShowtimes, login, posCreateBooking, posPay, resetDb, setActor, submitPaymentProof,
  updateBookingCombos, validateShowtime, type ShowtimePublic,
} from '@/mock';
import { writeDb } from '@/mock/db';
import { ApiError } from '@/types/domain';
import { dateISO, cinemaNow, minutesToTime, timeToMinutes } from '@/lib/datetime';

async function pickShowtime(movieAgeFilter: (age: string) => boolean): Promise<ShowtimePublic> {
  const showtimes = await listShowtimes({});
  const candidates = showtimes.filter(
    (s) => s.saleState === 'selling' && movieAgeFilter(s.movie.age) && s.availableSeats >= 6 && s.showDate > dateISO(),
  );
  if (!candidates.length) throw new Error('No sellable showtime found');
  return candidates[0];
}

describe('PXU booking engine', () => {
  beforeAll(async () => {
    await resetDb();
  }, 60_000);

  it('enforces holds, vouchers, payment review, ticket issuance and check-in', async () => {
    const user = await login('khach@pxu.vn', 'Khach@123');
    expect(user.role).toBe('customer');

    const showtime = await pickShowtime((age) => age !== 'T16' && age !== 'T18');
    const seatMap = await getShowtimeSeats(showtime.id);
    const seats = seatMap.seats.filter((s) => s.status === 'available' && s.type !== 'couple').slice(0, 2);
    expect(seats.length).toBe(2);

    const booking = await createBooking({
      showtimeId: showtime.id,
      seatIds: seats.map((s) => s.id),
      acceptAgeNotice: true,
      idempotencyKey: 'test-idem-1',
    });
    expect(booking.status).toBe('holding');
    expect(booking.seats).toHaveLength(2);

    // A second customer cannot take the same seats.
    await login('hoangnam@example.com', 'Khach@123');
    await expect(createBooking({
      showtimeId: showtime.id,
      seatIds: seats.map((s) => s.id),
      acceptAgeNotice: true,
    })).rejects.toMatchObject({ code: 'SEAT_UNAVAILABLE' });

    // Original customer resumes the booking, adds combos and a voucher.
    setActor('u-customer');
    const withCombos = await updateBookingCombos(booking.code, [{ comboId: 1, quantity: 1 }]);
    expect(withCombos.combosSubtotal).toBeGreaterThan(0);

    const discounted = await applyVoucher(booking.code, 'PXU10');
    expect(discounted.discount).toBeGreaterThan(0);
    expect(discounted.finalAmount).toBe(discounted.ticketsSubtotal + discounted.combosSubtotal - discounted.discount);

    const confirmFailed = await expect(applyVoucher(booking.code, 'HETHAN')).rejects.toBeInstanceOf(ApiError);
    await confirmFailed;

    const confirmedFlow = await confirmBooking(booking.code);
    expect(confirmedFlow.payments[0].status).toBe('pending');

    const payment = await getPaymentInfo(booking.code);
    expect(payment.amount).toBe(discounted.finalAmount);

    await submitPaymentProof(booking.code, {
      dataUrl: 'data:image/png;base64,dGVzdA==',
      fileName: 'bien-lai.png',
      mimeType: 'image/png',
      size: 1024,
      hash: 'hash-flow-1',
    });
    const pending = await getBooking(booking.code);
    expect(pending.payments[0].status).toBe('proof_submitted');

    setActor('u-admin');
    const approval = await approvePayment(booking.id);
    expect(approval.booking.status).toBe('confirmed');
    expect(approval.booking.tickets).toHaveLength(2);

    // Shift the showtime so it is inside the check-in window, then scan.
    await writeDb((db) => {
      const st = db.showtimes.find((s) => s.id === showtime.id)!;
      const now = cinemaNow();
      const startMinutes = now.getHours() * 60 + now.getMinutes() - 10;
      st.showDate = dateISO(now);
      st.startTime = minutesToTime(startMinutes);
      st.endTime = minutesToTime(startMinutes + 100);
      st.status = 'closed';
      const b = db.bookings.find((row) => row.code === booking.code)!;
      b.status = 'confirmed';
    });

    setActor('u-staff');
    const ticket = approval.booking.tickets[0];
    const firstScan = await checkin({ ticketCode: ticket.code, idVerified: true });
    expect(firstScan.result).toBe('OK');
    const secondScan = await checkin({ ticketCode: ticket.code, idVerified: true });
    expect(secondScan.result).toBe('ALREADY_USED');
    expect(secondScan.ticketsRemaining).toBe(1);

    const stats = await checkinStats(showtime.id);
    expect(stats.checkedIn).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('expires holds and releases seats via the maintenance job', async () => {
    setActor('u-customer');
    const showtime = await pickShowtime(() => true);
    const map = await getShowtimeSeats(showtime.id);
    const seat = map.seats.find((s) => s.status === 'available' && s.type === 'standard');
    if (!seat) throw new Error('No seat');
    const created = await createBooking({ showtimeId: showtime.id, seatIds: [seat.id], acceptAgeNotice: true });
    expect(created.status).toBe('holding');

    await writeDb((db) => {
      const booking = db.bookings.find((b) => b.id === created.id)!;
      booking.holdExpiresAt = new Date(Date.now() - 60_000).toISOString();
    });

    const expired = await getBooking(created.code);
    expect(expired.status).toBe('expired');
    const after = await getShowtimeSeats(showtime.id);
    expect(after.seats.find((s) => s.id === seat.id)?.status).toBe('available');
  }, 60_000);

  it('sells at the counter and completes a full refund', async () => {
    setActor('u-staff');
    const shift = await currentShift();
    expect(shift.shift?.status).toBe('open');
    const showtimes = await listShowtimes({ cinemaId: 1 });
    const showtime = showtimes.find((s) => s.saleState === 'selling' && s.availableSeats > 3);
    if (!showtime) throw new Error('No POS showtime');
    const map = await getShowtimeSeats(showtime.id);
    const seats = map.seats.filter((s) => s.status === 'available' && s.type === 'standard').slice(0, 2);
    const posBooking = await posCreateBooking({ showtimeId: showtime.id, seatIds: seats.map((s) => s.id), customerName: 'Khách lẻ', customerPhone: '0900000000' });
    expect(posBooking.status).toBe('holding');
    const paid = await posPay(posBooking.code, { method: 'cash', amountReceived: posBooking.finalAmount + 50000 });
    expect(paid.booking.status).toBe('confirmed');
    expect(paid.change).toBe(50000);
    expect(paid.booking.tickets).toHaveLength(2);

    setActor('u-manager');
    const refund = await createRefund({ bookingId: posBooking.id, scope: 'full', reason: 'Khách đổi ý ngay tại quầy, hoàn toàn phần' });
    await approveRefund(refund.id, 'Đã kiểm tra');
    await completeRefund(refund.id, 'FTREFUND001', 'Đã chuyển khoản hoàn');
    const refunded = await getBooking(posBooking.code);
    expect(refunded.status).toBe('cancelled');
    expect(refunded.tickets.every((t) => t.status === 'cancelled')).toBe(true);

    const after = await getShowtimeSeats(showtime.id);
    expect(after.seats.filter((s) => seats.some((seat) => seat.id === s.id)).every((s) => s.status === 'available')).toBe(true);
  }, 60_000);

  it('rejects overlapping showtimes and duplicate receipts', async () => {
    setActor('u-admin');
    const showtimes = await listShowtimes({});
    const existing = showtimes.find((s) => s.saleState === 'selling' && s.showDate > dateISO());
    if (!existing) throw new Error('no showtime');
    const conflicts = await validateShowtime({
      movieId: existing.movieId,
      roomId: existing.roomId,
      showDate: existing.showDate,
      startTime: existing.startTime,
    });
    expect(conflicts.valid).toBe(false);
    expect(conflicts.conflicts.length).toBeGreaterThan(0);

    await expect(createShowtime({
      movieId: existing.movieId,
      roomId: existing.roomId,
      showDate: existing.showDate,
      startTime: minutesToTime(timeToMinutes(existing.startTime) + 1),
    })).rejects.toMatchObject({ code: 'SHOWTIME_OVERLAP' });

    // Duplicate proof image is rejected across different orders.
    setActor('u-customer');
    const st = await pickShowtime(() => true);
    const map = await getShowtimeSeats(st.id);
    const available = map.seats.filter((s) => s.status === 'available').slice(0, 2);
    if (available.length < 2) return;
    const first = await createBooking({ showtimeId: st.id, seatIds: [available[0].id], acceptAgeNotice: true });
    await confirmBooking(first.code);
    await submitPaymentProof(first.code, {
      dataUrl: 'data:image/png;base64,AAAA', fileName: 'a.png', mimeType: 'image/png', size: 100, hash: 'duplicate-hash',
    });

    setActor('u-c2');
    const second = await createBooking({ showtimeId: st.id, seatIds: [available[1].id], acceptAgeNotice: true });
    await confirmBooking(second.code);
    await expect(submitPaymentProof(second.code, {
      dataUrl: 'data:image/png;base64,BBBB', fileName: 'b.png', mimeType: 'image/png', size: 100, hash: 'duplicate-hash',
    })).rejects.toMatchObject({ code: 'PAYMENT_PROOF_DUPLICATE' });
  }, 60_000);
});
