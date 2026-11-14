import { QRCodeCanvas } from 'qrcode.react';
import { CalendarDays, Clock, MapPin, Popcorn, ShieldCheck } from 'lucide-react';
import type { BookingDetail, Ticket } from '@/types/domain';
import { cn, formatDate } from '@/lib/format';
import { AgeBadge, Badge, StatusBadge } from '@/components/ui';
import { PosterArt } from './PosterArt';

export function TicketCard({ detail, ticket, className, number }: {
  detail: BookingDetail; ticket: Ticket; className?: string; number?: number;
}) {
  const { movie, showtime, cinema, room } = detail;
  const inactive = ticket.status === 'used' || ticket.status === 'cancelled' || ticket.status === 'expired';
  const noteParts = [
    movie.age === 'T16' || movie.age === 'T18' ? 'Xuất trình giấy tờ khi vào phòng' : '',
    detail.combos.length ? 'Combo nhận tại quầy bắp nước' : '',
  ].filter(Boolean);

  return (
    <article
      className={cn(
        'print-ticket relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
        inactive && 'opacity-80',
        className,
      )}
      aria-label={`Vé ${ticket.seatCode} cho phim ${movie.title}`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative hidden w-28 shrink-0 border-r border-line sm:block">
          <PosterArt movie={movie} variant="poster" showTitle={false} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Ghế</span>
            <p className="font-display text-lg font-bold leading-none text-white">{ticket.seatCode}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-[10px]">Vé điện tử {number ? `· ${String(number).padStart(2, '0')}` : ''}</p>
              <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold uppercase leading-tight tracking-wide text-ink sm:text-xl">{movie.title}</h3>
            </div>
            <StatusBadge status={ticket.status} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <AgeBadge age={movie.age} />
            <Badge tone="outline">{showtime.format}</Badge>
            <Badge tone="neutral">Ghế {ticket.seatCode}</Badge>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="flex items-center gap-1 text-muted"><CalendarDays className="h-3 w-3" /> Ngày chiếu</dt>
              <dd className="mt-0.5 font-semibold text-ink">{formatDate(showtime.showDate)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-muted"><Clock className="h-3 w-3" /> Giờ chiếu</dt>
              <dd className="mt-0.5 font-semibold text-ink">{showtime.startTime}</dd>
            </div>
            <div className="col-span-2">
              <dt className="flex items-center gap-1 text-muted"><MapPin className="h-3 w-3" /> Rạp & phòng</dt>
              <dd className="mt-0.5 font-semibold text-ink">{cinema.name} · {room.name}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-dashed border-line/80 pt-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Mã đơn hàng</p>
            <p className="font-mono text-[11px] font-semibold text-ink">{detail.code}</p>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Mã vé</p>
            <p className="break-all font-mono text-[10px] text-ink2">{ticket.code}</p>
          </div>

          {noteParts.length > 0 && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[10px] leading-relaxed text-warning">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{noteParts.join(' · ')}</span>
            </div>
          )}
          {detail.combos.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
              <Popcorn className="h-3 w-3 text-brand" />
              {detail.combos.map((c) => `${c.quantity}× ${c.name}`).join(', ')}
              {detail.comboPickedUpAt ? ' · Đã nhận' : ' · Nhận tại quầy'}
            </div>
          )}
        </div>

        <div className="relative flex w-full shrink-0 flex-col items-center justify-center gap-2 border-t border-dashed border-line/80 p-3 sm:w-48 sm:border-l sm:border-t-0">
          <span className="pointer-events-none absolute -left-[7px] -top-[7px] hidden h-3.5 w-3.5 rounded-full border border-line bg-base sm:block" aria-hidden />
          <span className="pointer-events-none absolute -bottom-[7px] -left-[7px] hidden h-3.5 w-3.5 rounded-full border border-line bg-base sm:block" aria-hidden />
          <div className="rounded-lg bg-white p-1.5 shadow-sm">
            <QRCodeCanvas value={ticket.code} size={160} level="M" bgColor="#ffffff" fgColor="#0b0f19" />
          </div>
          <p className="text-center font-mono text-[8px] leading-tight text-muted">{ticket.code.slice(-10)}</p>
          <p className="text-center text-[8px] font-semibold uppercase tracking-wider text-muted">Quét mã tại cửa</p>
        </div>
      </div>

      {ticket.status === 'used' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="rotate-[-18deg] rounded border-4 border-slate-400/30 px-6 py-2 font-display text-2xl font-extrabold uppercase tracking-widest text-slate-200/25">Đã sử dụng</span>
        </div>
      )}
      {ticket.status === 'cancelled' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base/30" aria-hidden>
          <span className="rotate-[-18deg] rounded border-4 border-danger/40 px-6 py-2 font-display text-2xl font-extrabold uppercase tracking-widest text-danger/50">Đã hủy</span>
        </div>
      )}
      {ticket.status === 'expired' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base/30" aria-hidden>
          <span className="rotate-[-18deg] rounded border-4 border-slate-400/30 px-6 py-2 font-display text-2xl font-extrabold uppercase tracking-widest text-slate-300/40">Hết hạn</span>
        </div>
      )}
    </article>
  );
}
