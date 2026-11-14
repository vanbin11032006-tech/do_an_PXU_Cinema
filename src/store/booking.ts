import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ContactForm {
  name: string;
  email: string;
  phone: string;
}

interface BookingDraft {
  showtimeId: number | null;
  selectedSeatIds: number[];
  ackAge: boolean;
  contact: ContactForm | null;
  idempotencyKey: string | null;
  setSelection: (showtimeId: number, seatIds: number[], ackAge: boolean) => void;
  setContact: (contact: ContactForm) => void;
  ensureIdempotencyKey: () => string;
  reset: () => void;
}

function newKey(): string {
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useBookingDraft = create<BookingDraft>()(
  persist(
    (set, get) => ({
      showtimeId: null,
      selectedSeatIds: [],
      ackAge: false,
      contact: null,
      idempotencyKey: null,
      setSelection: (showtimeId, seatIds, ackAge) => set({
        showtimeId,
        selectedSeatIds: seatIds,
        ackAge,
        idempotencyKey: get().showtimeId === showtimeId ? get().idempotencyKey : newKey(),
      }),
      setContact: (contact) => set({ contact }),
      ensureIdempotencyKey: () => {
        const key = get().idempotencyKey ?? newKey();
        if (!get().idempotencyKey) set({ idempotencyKey: key });
        return key;
      },
      reset: () => set({ showtimeId: null, selectedSeatIds: [], ackAge: false, contact: null, idempotencyKey: null }),
    }),
    {
      name: 'pxu.booking.draft',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
