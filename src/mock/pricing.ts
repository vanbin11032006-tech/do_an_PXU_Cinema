import type { AppSettings, PriceRule, RoomType, SeatType, Voucher } from '@/types/domain';
import { ApiError } from '@/types/domain';
import { isWeekend, timeToMinutes } from '@/lib/datetime';

export const ROOM_TYPE_SURCHARGE: Record<RoomType, number> = {
  '2D': 0,
  '3D': 0,
  IMAX: 0,
  '4DX': 0,
  'Gold Class': 0,
};

export function roundPrice(value: number, rounding: number): number {
  if (rounding <= 1) return Math.max(0, Math.round(value));
  return Math.max(0, Math.round(value / rounding) * rounding);
}

export function slotOf(startTime: string): PriceRule['slot'] {
  const mins = timeToMinutes(startTime);
  if (mins < 11 * 60) return 'early';
  if (mins < 17 * 60) return 'day';
  if (mins < 23 * 60) return 'prime';
  return 'late';
}

export function basePriceFor(date: string, startTime: string, roomType: RoomType, rules: PriceRule[], rounding: number): number {
  const dayType: PriceRule['dayType'] = isWeekend(date) ? 'weekend' : 'weekday';
  const slot = slotOf(startTime);
  const exact = rules.find((r) => r.active && r.dayType === dayType && r.slot === slot && r.roomType === roomType);
  const dayFallback = rules.find((r) => r.active && r.dayType === dayType && r.slot === slot && r.roomType === '2D');
  const base = exact?.price ?? dayFallback?.price ?? 50000;
  return roundPrice(base + ROOM_TYPE_SURCHARGE[roomType], rounding);
}

/** Seat pricing: VIP adds a surcharge; couple is sold as one logical seat for two people. */
export function seatPrice(basePrice: number, type: SeatType, settings: AppSettings): number {
  const surcharge = settings.seatSurcharge;
  const raw =
    type === 'vip'
      ? basePrice + surcharge.vip
      : type === 'couple'
        ? basePrice * 2 + surcharge.couple
        : basePrice + surcharge.standard;
  return roundPrice(raw, settings.priceRounding);
}

export function includedTax(amount: number, vatPercent: number): number {
  if (vatPercent <= 0) return 0;
  return Math.round(amount - (amount * 100) / (100 + vatPercent));
}

export interface VoucherContext {
  ticketsSubtotal: number;
  combosSubtotal: number;
  userId: string;
  usesByUser: number;
}

export function computeVoucherDiscount(voucher: Voucher, ctx: VoucherContext): number {
  const now = Date.now();
  if (voucher.status !== 'active') throw new ApiError('VOUCHER_INVALID', 'Mã giảm giá không còn hiệu lực.', {}, 422);
  if (new Date(voucher.startsAt).getTime() > now || new Date(voucher.expiresAt).getTime() < now) {
    throw new ApiError('VOUCHER_EXPIRED', 'Mã giảm giá đã hết hạn.', {}, 422);
  }
  if (voucher.usedCount >= voucher.totalUses) {
    throw new ApiError('VOUCHER_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng.', {}, 422);
  }
  if (ctx.usesByUser >= voucher.perUser) {
    throw new ApiError('VOUCHER_ALREADY_USED', 'Bạn đã sử dụng mã này rồi.', {}, 422);
  }
  const base = voucher.applyTo === 'tickets' ? ctx.ticketsSubtotal : ctx.ticketsSubtotal + ctx.combosSubtotal;
  if (base < voucher.minOrder) {
    throw new ApiError('VOUCHER_MIN_ORDER', `Đơn hàng tối thiểu ${voucher.minOrder.toLocaleString('vi-VN')}đ để dùng mã này.`, { min_order: voucher.minOrder }, 422);
  }
  const raw = voucher.type === 'percent' ? (base * voucher.value) / 100 : voucher.value;
  return Math.min(Math.round(raw), voucher.maxDiscount > 0 ? voucher.maxDiscount : raw, base);
}
