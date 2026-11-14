import type { SeatLiveStatus, SeatType } from '@/types/domain';

export interface MathSeat {
  id: number;
  code: string;
  row: string;
  x: number;
  span: number;
  type: SeatType;
  status?: SeatLiveStatus;
  price?: number;
}

export function isSelectable(seat: MathSeat): boolean {
  if (seat.type === 'disabled' || seat.type === 'aisle' || seat.type === 'blank') return false;
  return seat.status === 'available' || seat.status === undefined;
}

export function calcSubtotal(seats: MathSeat[], selectedIds: number[]): number {
  return seats
    .filter((seat) => selectedIds.includes(seat.id))
    .reduce((sum, seat) => sum + (seat.price ?? 0), 0);
}

/**
 * Detects a single available seat trapped between two occupied/selected seats in the same row.
 * Returns the seat code to warn about, or null.
 */
export function detectOrphanSeat(seats: MathSeat[], selectedIds: number[]): string | null {
  const rows = new Map<string, MathSeat[]>();
  for (const seat of seats) {
    if (seat.type === 'aisle' || seat.type === 'blank') continue;
    const list = rows.get(seat.row) ?? [];
    list.push(seat);
    rows.set(seat.row, list);
  }
  const selected = new Set(selectedIds);
  for (const rowSeats of rows.values()) {
    const ordered = [...rowSeats].sort((a, b) => a.x - b.x);
    const blocked = ordered.map((seat) => {
      if (selected.has(seat.id)) return true;
      if (seat.type === 'disabled') return true;
      return seat.status === 'sold' || seat.status === 'held' || seat.status === 'disabled';
    });
    for (let i = 1; i < ordered.length - 1; i++) {
      const involvesSelection = selected.has(ordered[i - 1].id) || selected.has(ordered[i + 1].id) || selected.has(ordered[i].id);
      if (!blocked[i] && blocked[i - 1] && blocked[i + 1] && involvesSelection) return ordered[i].code;
    }
  }
  return null;
}

export function seatsSummary(seats: MathSeat[], selectedIds: number[]): { type: SeatType; count: number; total: number; codes: string[] }[] {
  const groups = new Map<SeatType, { count: number; total: number; codes: string[] }>();
  for (const seat of seats) {
    if (!selectedIds.includes(seat.id)) continue;
    const entry = groups.get(seat.type) ?? { count: 0, total: 0, codes: [] };
    entry.count += 1;
    entry.total += seat.price ?? 0;
    entry.codes.push(seat.code);
    groups.set(seat.type, entry);
  }
  return [...groups.entries()].map(([type, value]) => ({ type, ...value }));
}
