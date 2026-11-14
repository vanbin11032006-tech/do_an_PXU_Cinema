import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarDays, CalendarPlus, FilterX, List, Pencil, Plus, Rows3, X } from 'lucide-react';
import type { Movie, ShowtimeStatus } from '@/types/domain';
import type { ShowtimePublic } from '@/api';
import { adminListMovies, listCinemasAdmin, listRooms, listShowtimesAdmin } from '@/api';
import { errorMessage } from '@/lib/errors';
import { cinemaNow, dateISO } from '@/lib/datetime';
import { formatDate, money } from '@/lib/format';
import { useUiStore } from '@/store/ui';
import {
  Button, Card, DataTable, EmptyState, ErrorState, IconButton, Input, PageHeader, Select,
  Skeleton, StatusBadge, Tabs, toast, type Column,
} from '@/components/ui';
import { PosterArt } from '@/components/common';
import { ShowtimeTimeline } from './catalog/showtimes/Timeline';
import { ShowtimeFormModal } from './catalog/showtimes/ShowtimeFormModal';
import { BulkShowtimeModal } from './catalog/showtimes/BulkShowtimeModal';
import { CancelShowtimeModal } from './catalog/showtimes/CancelShowtimeModal';
import { StatTile } from './catalog/shared';

const STATUS_OPTIONS: { value: ShowtimeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Mọi trạng thái' },
  { value: 'selling', label: 'Đang bán' },
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'closed', label: 'Đóng bán' },
  { value: 'finished', label: 'Đã chiếu' },
  { value: 'cancelled', label: 'Đã hủy' },
];

export default function ShowtimesAdminPage() {
  const queryClient = useQueryClient();
  const adminCinemaId = useUiStore((state) => state.adminCinemaId);
  const [date, setDate] = useState(dateISO(cinemaNow()));
  const [cinemaId, setCinemaId] = useState<string>(adminCinemaId ? String(adminCinemaId) : 'all');
  const [roomId, setRoomId] = useState('all');
  const [movieId, setMovieId] = useState('all');
  const [status, setStatus] = useState<ShowtimeStatus | 'all'>('all');
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShowtimePublic | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ShowtimePublic | null>(null);

  useEffect(() => {
    setCinemaId(adminCinemaId ? String(adminCinemaId) : 'all');
  }, [adminCinemaId]);

  useEffect(() => { setRoomId('all'); }, [cinemaId]);

  const cinemasQuery = useQuery({ queryKey: ['admin', 'cinemas'], queryFn: listCinemasAdmin, staleTime: 120_000 });
  const roomsQuery = useQuery({ queryKey: ['admin', 'rooms'], queryFn: () => listRooms(), staleTime: 60_000 });
  const moviesQuery = useQuery({
    queryKey: ['admin', 'movies', 'options'],
    queryFn: () => adminListMovies({ status: 'all', perPage: 200 }),
    staleTime: 120_000,
  });

  const scopeCinema = cinemaId === 'all' ? undefined : Number(cinemaId);
  const showtimesQuery = useQuery({
    queryKey: ['admin', 'showtimes', { date, cinemaId: scopeCinema ?? 'all' }],
    queryFn: () => listShowtimesAdmin({ date, cinemaId: scopeCinema }),
    staleTime: 20_000,
  });

  const cinemas = cinemasQuery.data ?? [];
  const allRooms = roomsQuery.data ?? [];
  const movies: Movie[] = moviesQuery.data?.items ?? [];
  const showtimes = showtimesQuery.data ?? [];

  const rooms = useMemo(
    () => allRooms.filter((room) => (cinemaId === 'all' || String(room.cinemaId) === cinemaId) && (roomId === 'all' || String(room.id) === roomId)),
    [allRooms, cinemaId, roomId],
  );

  const filtered = useMemo(
    () => showtimes.filter((showtime) => (
      (movieId === 'all' || String(showtime.movieId) === movieId)
      && (status === 'all' || showtime.status === status)
      && (roomId === 'all' || String(showtime.roomId) === roomId)
    )),
    [showtimes, movieId, status, roomId],
  );

  const cinemaById = cinemas.reduce<Record<number, string>>((acc, cinema) => { acc[cinema.id] = cinema.name; return acc; }, {});
  const roomById = allRooms.reduce<Record<number, string>>((acc, room) => { acc[room.id] = room.name; return acc; }, {});

  const filterActive = cinemaId !== 'all' || roomId !== 'all' || movieId !== 'all' || status !== 'all';

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'showtimes'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'showtime-impact'] });
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (showtime: ShowtimePublic) => {
    if (showtime.status === 'cancelled') {
      toast.warning('Suất chiếu đã hủy', 'Không thể sửa suất đã hủy. Hãy tạo suất mới nếu cần.');
      return;
    }
    setEditing(showtime);
    setFormOpen(true);
  };

  const columns: Column<ShowtimePublic>[] = [
    {
      key: 'time',
      header: 'Giờ chiếu',
      sortValue: (showtime) => `${showtime.showDate} ${showtime.startTime}`,
      render: (showtime) => (
        <div>
          <p className="font-mono text-sm font-semibold text-ink">{showtime.startTime} – {showtime.endTime}</p>
          <p className="text-[11px] text-muted">{formatDate(showtime.showDate)} · {showtime.format}</p>
        </div>
      ),
    },
    {
      key: 'movie',
      header: 'Phim',
      render: (showtime) => (
        <div className="flex min-w-[180px] items-center gap-2.5">
          <div className="h-12 w-8 shrink-0 overflow-hidden rounded border border-line/60">
            <PosterArt movie={showtime.movie} variant="thumb" showTitle={false} />
          </div>
          <span className="line-clamp-2 text-xs font-medium text-ink">{showtime.movie.title}</span>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Phòng / rạp',
      hideOnMobile: true,
      render: (showtime) => (
        <div>
          <p className="text-xs font-medium text-ink">{roomById[showtime.roomId] ?? showtime.room.name}</p>
          <p className="text-[11px] text-muted">{cinemaById[showtime.cinemaId] ?? showtime.cinema.name}</p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Giá cơ bản',
      align: 'right',
      hideOnMobile: true,
      sortValue: (showtime) => showtime.basePrice,
      render: (showtime) => <span className="text-money text-xs text-ink2">{money(showtime.basePrice)}</span>,
    },
    {
      key: 'seats',
      header: 'Ghế trống',
      align: 'center',
      hideOnMobile: true,
      render: (showtime) => (
        <span className={`text-xs font-semibold ${showtime.availableSeats === 0 ? 'text-danger' : showtime.availableSeats < 20 ? 'text-warning' : 'text-ink2'}`}>
          {showtime.availableSeats}/{showtime.totalSeats}
        </span>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: (showtime) => <StatusBadge status={showtime.status} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (showtime) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton label={`Sửa suất ${showtime.startTime} phòng ${showtime.room.name}`} size="sm" onClick={() => openEdit(showtime)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label={`Hủy hoặc dời suất ${showtime.startTime}`}
            size="sm"
            className="hover:border-danger/50 hover:text-danger"
            disabled={showtime.status === 'cancelled' || showtime.status === 'finished'}
            onClick={() => setCancelTarget(showtime)}
          >
            <Ban className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Suất chiếu"
        description="Xếp lịch theo phòng, kiểm tra trùng giờ và xử lý dời/hủy suất có đơn."
        actions={
          <>
            <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBulkOpen(true)}>Tạo hàng loạt</Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Tạo suất chiếu</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tổng suất trong ngày" value={showtimesQuery.isLoading ? '—' : showtimes.length} icon={<CalendarDays className="h-5 w-5" />} hint={formatDate(date)} />
        <StatTile label="Đang bán" value={showtimes.filter((item) => item.status === 'selling').length} tone="success" hint="Có thể đặt vé" />
        <StatTile label="Đã hủy" value={showtimes.filter((item) => item.status === 'cancelled').length} tone="warning" hint="Cần theo dõi hoàn tiền" />
        <StatTile label="Theo bộ lọc" value={filtered.length} tone="info" hint={filterActive ? 'Đang áp dụng bộ lọc' : 'Không lọc'} />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div>
            <label htmlFor="showtime-date-filter" className="label">Ngày chiếu</label>
            <Input id="showtime-date-filter" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <label htmlFor="showtime-cinema-filter" className="label">Rạp</label>
            <Select id="showtime-cinema-filter" value={cinemaId} onChange={(event) => setCinemaId(event.target.value)}>
              <option value="all">Tất cả rạp</option>
              {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="showtime-room-filter" className="label">Phòng</label>
            <Select id="showtime-room-filter" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="all">Tất cả phòng</option>
              {allRooms.filter((room) => cinemaId === 'all' || String(room.cinemaId) === cinemaId).map((room) => (
                <option key={room.id} value={room.id}>
                  {cinemaId === 'all' ? `${cinemaById[room.cinemaId] ?? 'Rạp'} · ` : ''}{room.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="showtime-movie-filter" className="label">Phim</label>
            <Select id="showtime-movie-filter" value={movieId} onChange={(event) => setMovieId(event.target.value)}>
              <option value="all">Tất cả phim</option>
              {movies.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="showtime-status-filter" className="label">Trạng thái</label>
            <Select id="showtime-status-filter" value={status} onChange={(event) => setStatus(event.target.value as ShowtimeStatus | 'all')}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Tabs
              items={[
                { value: 'timeline', label: 'Dòng thời gian', icon: <Rows3 className="h-3.5 w-3.5" /> },
                { value: 'list', label: 'Danh sách', icon: <List className="h-3.5 w-3.5" /> },
              ]}
              value={view}
              onChange={(value) => setView(value)}
              variant="segment"
              size="sm"
              className="min-w-0 flex-1"
            />
          </div>
        </div>
        {filterActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted"><FilterX className="h-3.5 w-3.5" />Bộ lọc đang áp dụng</span>
            <Button variant="ghost" size="sm" onClick={() => { setCinemaId(adminCinemaId ? String(adminCinemaId) : 'all'); setRoomId('all'); setMovieId('all'); setStatus('all'); }}>
              <X className="h-3.5 w-3.5" /> Xóa bộ lọc
            </Button>
          </div>
        )}
      </Card>

      {showtimesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : showtimesQuery.isError ? (
        <ErrorState message={errorMessage(showtimesQuery.error)} onRetry={() => void showtimesQuery.refetch()} />
      ) : view === 'timeline' ? (
        <ShowtimeTimeline showtimes={filtered} rooms={rooms} cinemas={cinemas} date={date} onSelect={openEdit} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Không có suất chiếu phù hợp"
          description="Thử đổi ngày, rạp hoặc bộ lọc trạng thái."
          action={<Button variant="secondary" onClick={() => { setMovieId('all'); setStatus('all'); setRoomId('all'); }}>Xóa bộ lọc</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(showtime) => showtime.id}
          empty="Không có suất chiếu phù hợp."
          mobileCard={(showtime) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-2.5">
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded border border-line/60">
                    <PosterArt movie={showtime.movie} variant="thumb" showTitle={false} />
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{showtime.movie.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{roomById[showtime.roomId] ?? showtime.room.name} · {cinemaById[showtime.cinemaId] ?? showtime.cinema.name}</p>
                    <p className="mt-1 font-mono text-xs text-ink2">{showtime.startTime} – {showtime.endTime}</p>
                  </div>
                </div>
                <StatusBadge status={showtime.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-2 text-[11px] text-muted">
                <span className="text-money">{money(showtime.basePrice)}</span>
                <span>Ghế trống {showtime.availableSeats}/{showtime.totalSeats}</span>
                <div className="flex gap-1">
                  <IconButton label="Sửa suất chiếu" size="sm" onClick={() => openEdit(showtime)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                  <IconButton label="Hủy hoặc dời suất" size="sm" disabled={showtime.status === 'cancelled' || showtime.status === 'finished'} onClick={() => setCancelTarget(showtime)}>
                    <Ban className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <ShowtimeFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={invalidate}
        initial={editing}
        movies={movies}
        cinemas={cinemas}
        rooms={allRooms}
        defaultCinemaId={scopeCinema ?? cinemas[0]?.id}
        defaultDate={date}
      />

      <BulkShowtimeModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={invalidate}
        movies={movies}
        cinemas={cinemas}
        rooms={allRooms}
        defaultCinemaId={scopeCinema ?? cinemas[0]?.id}
        defaultDate={date}
      />

      <CancelShowtimeModal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onDone={invalidate}
        showtime={cancelTarget}
      />
    </div>
  );
}
