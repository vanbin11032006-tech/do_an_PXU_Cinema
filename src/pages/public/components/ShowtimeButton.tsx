import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn, money } from '@/lib/format';
import type { Movie } from '@/types/domain';
import type { ShowtimePublic } from '@/api';
import { useAuthStore } from '@/store/auth';
import { AuthPromptModal } from './AuthPromptModal';
import { AgeGateModal } from './AgeGateModal';

export function ShowtimeButton({ showtime, movie, showCinema = false, className }: {
  showtime: ShowtimePublic;
  movie: Movie;
  showCinema?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const [authOpen, setAuthOpen] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);

  const soldOut = showtime.availableSeats <= 0;
  const disabledReason = showtime.saleState === 'past'
    ? 'Đã kết thúc'
    : showtime.saleState === 'closed'
      ? 'Đã đóng bán'
      : soldOut
        ? 'Hết ghế'
        : null;
  const needsAgeGate = movie.age === 'T16' || movie.age === 'T18';
  const bookingPath = `/dat-ve/${showtime.id}/ghe`;

  const proceed = () => navigate(bookingPath);

  const handleClick = () => {
    if (disabledReason) return;
    if (authStatus !== 'authenticated') {
      setAuthOpen(true);
      return;
    }
    if (needsAgeGate) {
      setAgeOpen(true);
      return;
    }
    proceed();
  };

  return (
    <>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        onClick={handleClick}
        title={`${showtime.startTime} · ${showtime.format} · ${showtime.cinema.name} · ${money(showtime.minPrice)}`}
        aria-label={`Đặt vé suất ${showtime.startTime} tại ${showtime.cinema.name}${disabledReason ? `, ${disabledReason}` : ''}`}
        className={cn(
          'group flex min-w-0 flex-col rounded-lg border px-3 py-2 text-left transition duration-200 ease-cinema',
          disabledReason
            ? 'cursor-not-allowed border-line/50 bg-base/30 opacity-65'
            : 'border-line/70 bg-base/50 hover:border-brand/60 hover:bg-brand/10 focus-visible:border-brand',
          className,
        )}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <span className={cn('font-display text-lg font-bold leading-tight tracking-wide', disabledReason ? 'text-muted' : 'text-ink group-hover:text-brand')}>
            {showtime.startTime}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{showtime.room.type}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted">
          <span className="text-money font-semibold text-ink2">{money(showtime.minPrice)}</span>
          <span aria-hidden>·</span>
          <span className={soldOut ? 'text-danger' : undefined}>{showtime.availableSeats} ghế</span>
        </span>
        {showCinema && (
          <span className="mt-1 line-clamp-1 text-[10px] text-muted/90">{showtime.cinema.name} · {showtime.room.name}</span>
        )}
        {disabledReason && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{disabledReason}</span>
        )}
      </button>

      <AuthPromptModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        returnTo={bookingPath}
        title="Đăng nhập để giữ ghế"
        description={`Suất ${showtime.startTime} tại ${showtime.cinema.name} đang mở bán. Đăng nhập để chọn ghế và giữ chỗ trong 10 phút.`}
      />
      <AgeGateModal
        open={ageOpen}
        onClose={() => setAgeOpen(false)}
        age={movie.age}
        movieTitle={movie.title}
        onConfirm={() => { setAgeOpen(false); proceed(); }}
      />
    </>
  );
}
