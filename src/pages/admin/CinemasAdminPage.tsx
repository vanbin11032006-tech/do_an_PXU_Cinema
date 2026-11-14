import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Building2, DoorOpen, MapPin, Pencil, Phone, Plus, Settings2, Wrench } from 'lucide-react';
import type { Cinema, Room } from '@/types/domain';
import { getRoomSeats, listCinemasAdmin, listRooms } from '@/api';
import { errorMessage } from '@/lib/errors';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { CinemaFormModal } from './catalog/cinemas/CinemaFormModal';
import { RoomFormModal } from './catalog/cinemas/RoomFormModal';
import { CardsSkeleton, StatTile } from './catalog/shared';

interface RoomEditorState { cinemaId: number; cinemaName: string; room: Room | null }

export default function CinemasAdminPage() {
  const [cinemaModalOpen, setCinemaModalOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState<Cinema | null>(null);
  const [roomEditor, setRoomEditor] = useState<RoomEditorState | null>(null);
  const navigate = useNavigate();

  const cinemasQuery = useQuery({ queryKey: ['admin', 'cinemas'], queryFn: listCinemasAdmin });
  const roomsQuery = useQuery({ queryKey: ['admin', 'rooms'], queryFn: () => listRooms() });

  const cinemas = cinemasQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];

  const capacityQuery = useQuery({
    queryKey: ['admin', 'room-seat-counts', rooms.map((room) => room.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(rooms.map(async (room) => {
        const seats = await getRoomSeats(room.id);
        const sellable = seats.filter((seat) => seat.type === 'standard' || seat.type === 'vip' || seat.type === 'couple').length;
        return [room.id, sellable] as const;
      }));
      return entries.reduce<Record<number, number>>((acc, [id, count]) => { acc[id] = count; return acc; }, {});
    },
    enabled: rooms.length > 0,
    staleTime: 60_000,
  });
  const capacities = capacityQuery.data ?? {};

  const roomsByCinema = useMemo(
    () => rooms.reduce<Record<number, Room[]>>((acc, room) => { (acc[room.cinemaId] ??= []).push(room); return acc; }, {}),
    [rooms],
  );
  const totalCapacity = Object.values(capacities).reduce((sum, count) => sum + count, 0);
  const maintenanceCount = rooms.filter((room) => room.status === 'maintenance').length;

  const openCreateCinema = () => { setEditingCinema(null); setCinemaModalOpen(true); };
  const openEditCinema = (cinema: Cinema) => { setEditingCinema(cinema); setCinemaModalOpen(true); };

  if (cinemasQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Rạp & phòng chiếu" description="Quản lý cụm rạp, phòng chiếu và sức chứa." />
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
        </div>
        <CardsSkeleton count={2} />
      </div>
    );
  }

  if (cinemasQuery.isError) {
    return (
      <div>
        <PageHeader title="Rạp & phòng chiếu" />
        <ErrorState message={errorMessage(cinemasQuery.error)} onRetry={() => void cinemasQuery.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Rạp & phòng chiếu"
        description="Theo dõi cụm rạp, loại phòng, sức chứa và trạng thái bảo trì."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreateCinema}>Thêm rạp</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Cụm rạp" value={cinemas.length} icon={<Building2 className="h-5 w-5" />} hint="Trong phạm vi quản lý" />
        <StatTile label="Phòng chiếu" value={rooms.length} tone="info" icon={<DoorOpen className="h-5 w-5" />} hint="Tất cả loại phòng" />
        <StatTile label="Tổng sức chứa" value={capacityQuery.isLoading ? '—' : totalCapacity.toLocaleString('vi-VN')} tone="success" icon={<Armchair className="h-5 w-5" />} hint="Ghế có thể bán" />
        <StatTile label="Đang bảo trì" value={maintenanceCount} tone={maintenanceCount ? 'warning' : 'muted'} icon={<Wrench className="h-5 w-5" />} hint="Bị chặn xếp lịch" />
      </div>

      {capacityQuery.isError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          <span>Không tải được sức chứa phòng: {errorMessage(capacityQuery.error)}</span>
          <Button variant="secondary" size="sm" onClick={() => void capacityQuery.refetch()}>Thử lại</Button>
        </div>
      )}

      {cinemas.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Chưa có rạp nào"
          description="Thêm cụm rạp đầu tiên để bắt đầu cấu hình phòng chiếu và sơ đồ ghế."
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={openCreateCinema}>Thêm rạp</Button>}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {cinemas.map((cinema) => {
            const cinemaRooms = roomsByCinema[cinema.id] ?? [];
            const cinemaCapacity = cinemaRooms.reduce((sum, room) => sum + (capacities[room.id] ?? 0), 0);
            return (
              <Card key={cinema.id} className="overflow-hidden">
                <div
                  className="relative overflow-hidden px-5 py-5"
                  style={{ background: `linear-gradient(125deg, ${cinema.imageTone} 0%, #101722 72%, #0b0f19 100%)` }}
                >
                  {cinema.imageUrl && (
                    <img
                      src={cinema.imageUrl}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  {cinema.imageUrl && <div className="absolute inset-0 bg-slate-950/70" aria-hidden />}
                  <Building2 className="pointer-events-none absolute -bottom-6 -right-3 h-32 w-32 text-white/10" strokeWidth={1} />
                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">Cụm rạp #{cinema.id}</p>
                      <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-white">{cinema.name}</h2>
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-white/75"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{cinema.address}</p>
                      <p className="mt-0.5 pl-5 text-[11px] text-white/60">{cinema.city}</p>
                    </div>
                    <IconButton label={`Sửa ${cinema.name}`} className="border-white/20 bg-black/25 text-white hover:bg-black/40" onClick={() => openEditCinema(cinema)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2.5 py-1"><Phone className="h-3 w-3" />{cinema.hotline}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2.5 py-1"><DoorOpen className="h-3 w-3" />{cinemaRooms.length} phòng</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2.5 py-1"><Armchair className="h-3 w-3" />{capacityQuery.isLoading ? '…' : cinemaCapacity.toLocaleString('vi-VN')} ghế</span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">Phòng chiếu</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => setRoomEditor({ cinemaId: cinema.id, cinemaName: cinema.name, room: null })}
                    >
                      Thêm phòng
                    </Button>
                  </div>

                  {roomsQuery.isLoading ? (
                    <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                  ) : roomsQuery.isError ? (
                    <ErrorState message={errorMessage(roomsQuery.error)} onRetry={() => void roomsQuery.refetch()} className="py-6" />
                  ) : cinemaRooms.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
                      <p className="text-xs text-muted">Rạp chưa có phòng chiếu. Thêm phòng rồi thiết kế sơ đồ ghế.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-line/60">
                      {cinemaRooms.map((room) => (
                        <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-semibold text-ink">{room.name}</p>
                              <Badge tone="outline">{room.type}</Badge>
                              <StatusBadge status={room.status} />
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                              <Armchair className="h-3 w-3" />
                              {capacityQuery.isLoading ? 'Đang tải sức chứa…' : `${capacities[room.id] ?? 0} ghế có thể bán`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button variant="subtle" size="sm" icon={<Armchair className="h-3.5 w-3.5" />} onClick={() => navigate(`/admin/phong/${room.id}/so-do-ghe`)}>Sơ đồ ghế</Button>
                            <IconButton
                              label={`Sửa phòng ${room.name}`}
                              size="sm"
                              onClick={() => setRoomEditor({ cinemaId: cinema.id, cinemaName: cinema.name, room })}
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CinemaFormModal
        open={cinemaModalOpen}
        onClose={() => setCinemaModalOpen(false)}
        cinema={editingCinema}
      />

      <RoomFormModal
        open={Boolean(roomEditor)}
        onClose={() => setRoomEditor(null)}
        cinemaId={roomEditor?.cinemaId ?? 0}
        cinemaName={roomEditor?.cinemaName ?? ''}
        room={roomEditor?.room ?? null}
      />
    </div>
  );
}
