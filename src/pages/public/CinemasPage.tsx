import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Phone, Ticket } from 'lucide-react';
import { getRoomSeats, listCinemas, listRooms } from '@/api';
import { useDocumentTitle } from '@/hooks';
import { number } from '@/lib/format';
import type { Cinema, RoomType } from '@/types/domain';
import { Badge, Chip, EmptyState, LogoMark, Skeleton } from '@/components/ui';
import { PageHero } from './components/PageHero';
import { ActionLink } from './components/ActionLink';
import { SectionError } from './components/States';

interface CinemaOverview {
  cinema: Cinema;
  roomCount: number;
  seatCount: number;
  roomTypes: RoomType[];
}

export default function CinemasPage() {
  useDocumentTitle('Hệ thống rạp');
  const [city, setCity] = useState('');

  const cinemasQuery = useQuery({
    queryKey: ['public', 'cinemas', 'overview'],
    queryFn: async (): Promise<CinemaOverview[]> => {
      const [cinemas, rooms] = await Promise.all([listCinemas(), listRooms()]);
      const seatCounts = await Promise.all(rooms.map(async (room) => {
        const seats = await getRoomSeats(room.id);
        const sellable = seats.filter((seat) => seat.type === 'standard' || seat.type === 'vip' || seat.type === 'couple').length;
        return [room.id, sellable] as const;
      }));
      const seatByRoom = new Map(seatCounts);
      return cinemas.map((cinema) => {
        const cinemaRooms = rooms.filter((room) => room.cinemaId === cinema.id);
        return {
          cinema,
          roomCount: cinemaRooms.length,
          seatCount: cinemaRooms.reduce((sum, room) => sum + (seatByRoom.get(room.id) ?? 0), 0),
          roomTypes: Array.from(new Set(cinemaRooms.map((room) => room.type))),
        };
      });
    },
  });

  const overview = cinemasQuery.data ?? [];
  const cities = Array.from(new Set(overview.map((item) => item.cinema.city))).sort((a, b) => a.localeCompare(b, 'vi'));
  const visible = overview.filter((item) => !city || item.cinema.city === city);

  return (
    <div>
      <PageHero
        eyebrow="Hệ thống rạp"
        title="PXU Cinema trên toàn quốc"
        description="Tìm cụm rạp gần bạn, xem thông tin phòng chiếu và chuyển thẳng tới lịch chiếu đang mở bán."
        breadcrumb={<nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted"><Link to="/" className="hover:text-ink">Trang chủ</Link><span aria-hidden>›</span><span className="text-ink2">Rạp</span></nav>}
        actions={<ActionLink to="/lich-chieu" variant="secondary" icon={<Ticket className="h-4 w-4" />}>Xem lịch chiếu</ActionLink>}
      />

      <div className="container-page py-8 sm:py-10">
        {cinemasQuery.isLoading ? (
          <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-80 w-full rounded-card" />)}
          </div>
        ) : cinemasQuery.isError ? (
          <SectionError error={cinemasQuery.error} onRetry={() => void cinemasQuery.refetch()} title="Không tải được danh sách rạp" />
        ) : overview.length === 0 ? (
          <EmptyState title="Chưa có cụm rạp" description="Thông tin cụm rạp PXU Cinema sẽ được cập nhật sớm." />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              <Chip active={!city} onClick={() => setCity('')}>Tất cả thành phố</Chip>
              {cities.map((item) => (
                <Chip key={item} active={city === item} onClick={() => setCity(city === item ? '' : item)}>{item}</Chip>
              ))}
            </div>

            {visible.length === 0 ? (
              <EmptyState
                title="Chưa có rạp tại khu vực này"
                description="Chọn thành phố khác hoặc xem toàn bộ hệ thống rạp PXU Cinema."
                action={<button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setCity('')}>Xem tất cả thành phố</button>}
              />
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {visible.map(({ cinema, roomCount, seatCount, roomTypes }) => (
                  <article
                    key={cinema.id}
                    className="group overflow-hidden rounded-card border border-line/70 bg-surface/80 shadow-card transition duration-300 ease-cinema hover:border-brand/40 hover:shadow-lift"
                  >
                    <div
                      className="relative h-36 overflow-hidden sm:h-40"
                      style={{ background: `linear-gradient(125deg, ${cinema.imageTone} 0%, #0b0f19 92%)` }}
                    >
                      {cinema.imageUrl && (
                        <img
                          src={cinema.imageUrl}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-cinema group-hover:scale-[1.04]"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="poster-grain absolute inset-0" aria-hidden />
                      {cinema.imageUrl ? (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" aria-hidden />
                      ) : (
                        <>
                          <div className="absolute -right-6 -top-10 h-36 w-36 rounded-full border border-white/20" aria-hidden />
                          <div className="absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-black/20 blur-2xl" aria-hidden />
                        </>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div>
                          <Badge tone="brand">{cinema.city}</Badge>
                          <h2 className="mt-2 font-display text-xl font-bold uppercase leading-tight tracking-wide text-white">{cinema.name}</h2>
                        </div>
                        <LogoMark className="h-9 w-9 shrink-0 opacity-80" />
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="flex items-start gap-2 text-sm leading-relaxed text-ink2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span>{cinema.address}, {cinema.city}</span>
                      </p>
                      <a href={`tel:${cinema.hotline.replace(/\s+/g, '')}`} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-ink2 transition hover:text-brand">
                        <Phone className="h-4 w-4 text-brand" /> {cinema.hotline}
                      </a>

                      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line/60 bg-base/40 p-3 text-center">
                        <div>
                          <p className="font-display text-2xl font-bold leading-none text-ink">{roomCount}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Phòng chiếu</p>
                        </div>
                        <div className="border-l border-line/60">
                          <p className="font-display text-2xl font-bold leading-none text-ink">{number(seatCount)}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Ghế ngồi</p>
                        </div>
                      </div>

                      {roomTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {roomTypes.map((type) => <Badge key={type} tone="outline">{type}</Badge>)}
                        </div>
                      )}

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <ActionLink to={`/lich-chieu?cinemaId=${cinema.id}`} size="sm" icon={<Ticket className="h-3.5 w-3.5" />}>
                          Xem lịch chiếu
                        </ActionLink>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cinema.address}, ${cinema.city}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-muted transition hover:text-brand"
                        >
                          Chỉ đường
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
