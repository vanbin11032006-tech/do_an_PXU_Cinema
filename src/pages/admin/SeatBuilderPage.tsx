import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Armchair, Building2, Info, Wand2 } from 'lucide-react';
import type { Room } from '@/types/domain';
import type { SeatLayoutCell } from '@/api';
import { ApiError } from '@/types/domain';
import { errorCode, errorMessage } from '@/lib/errors';
import { getRoomSeats, listCinemasAdmin, listRooms, saveSeatLayout } from '@/api';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, toast } from '@/components/ui';
import { ScreenBar, SeatLegend, SeatMap, type SeatLike } from '@/components/common';
import { SeatGridEditor } from './catalog/seat/SeatGridEditor';
import { GenerateSeatsModal } from './catalog/seat/GenerateSeatsModal';
import { LayoutConflictModal } from './catalog/seat/LayoutConflictModal';

export default function SeatBuilderPage() {
  const { id } = useParams();
  const roomId = Number(id);
  const validId = Number.isFinite(roomId) && roomId > 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editorVersion, setEditorVersion] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [conflictShowtimes, setConflictShowtimes] = useState<number[] | null>(null);
  const [previewCells, setPreviewCells] = useState<SeatLayoutCell[] | null>(null);

  const roomsQuery = useQuery({ queryKey: ['admin', 'rooms'], queryFn: () => listRooms(), staleTime: 120_000 });
  const cinemasQuery = useQuery({ queryKey: ['admin', 'cinemas'], queryFn: listCinemasAdmin, staleTime: 120_000 });
  const seatsQuery = useQuery({
    queryKey: ['admin', 'room-seats', roomId],
    queryFn: () => getRoomSeats(roomId),
    enabled: validId,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => { setPreviewCells(null); }, [editorVersion, roomId]);

  const room: Room | undefined = roomsQuery.data?.find((item) => item.id === roomId);
  const cinema = cinemasQuery.data?.find((item) => item.id === room?.cinemaId);

  const saveMutation = useMutation({
    mutationFn: (cells: SeatLayoutCell[]) => saveSeatLayout(roomId, cells),
    onSuccess: (result) => {
      queryClient.setQueryData(['admin', 'room-seats', roomId], result.seats);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'room-seat-counts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      toast.success('Đã lưu sơ đồ ghế', `${result.seats.length} ô ghế · ${room?.name ?? `Phòng #${roomId}`}`);
      setEditorVersion((version) => version + 1);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && errorCode(error) === 'SEAT_LAYOUT_CONFLICT') {
        const ids = Array.isArray(error.details?.affectedShowtimes)
          ? error.details.affectedShowtimes.filter((item): item is number => typeof item === 'number')
          : [];
        setConflictShowtimes(ids);
        return;
      }
      toast.error('Không lưu được sơ đồ ghế', errorMessage(error));
    },
  });

  const previewSeats: SeatLike[] = useMemo(() => {
    const cells = previewCells ?? seatsQuery.data ?? [];
    return cells
      .filter((cell) => cell.type !== 'aisle' && cell.type !== 'blank')
      .map((cell, index) => ({
        id: index + 1,
        code: cell.code || `${cell.row}${cell.col}`,
        row: cell.row,
        col: cell.col,
        x: cell.x,
        y: cell.y,
        span: cell.span,
        type: cell.type,
        status: 'available' as const,
      }));
  }, [previewCells, seatsQuery.data]);

  if (!validId) {
    return (
      <div>
        <PageHeader title="Thiết kế sơ đồ ghế" />
        <ErrorState title="Mã phòng không hợp lệ" message="Đường dẫn cần mã phòng chiếu hợp lệ." />
      </div>
    );
  }

  if (roomsQuery.isLoading || cinemasQuery.isLoading || seatsQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Thiết kế sơ đồ ghế" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-[560px] w-full" />
          <div className="space-y-3"><Skeleton className="h-64 w-full" /><Skeleton className="h-40 w-full" /></div>
        </div>
      </div>
    );
  }

  if (roomsQuery.isError || cinemasQuery.isError || seatsQuery.isError) {
    return (
      <div>
        <PageHeader title="Thiết kế sơ đồ ghế" />
        <ErrorState
          message={errorMessage(roomsQuery.error ?? cinemasQuery.error ?? seatsQuery.error)}
          onRetry={() => { void roomsQuery.refetch(); void cinemasQuery.refetch(); void seatsQuery.refetch(); }}
        />
      </div>
    );
  }

  if (!room) {
    return (
      <div>
        <PageHeader title="Thiết kế sơ đồ ghế" />
        <ErrorState title="Không tìm thấy phòng" message={`Phòng #${roomId} không tồn tại hoặc bạn không có quyền truy cập.`} />
      </div>
    );
  }

  const seats = seatsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title={`Sơ đồ ghế · ${room.name}`}
        description={`${cinema?.name ?? 'Rạp'} · ${room.type} · ${seats.length} ô ghế hiện tại`}
        breadcrumb={<Link to="/admin/rap" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" />Rạp &amp; phòng chiếu</Link>}
        actions={
          <>
            <Button variant="secondary" icon={<Building2 className="h-4 w-4" />} onClick={() => navigate('/admin/rap')}>Danh sách rạp</Button>
            <Button variant="gold" icon={<Wand2 className="h-4 w-4" />} onClick={() => setGenerateOpen(true)}>Tạo tự động</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/25 bg-brand/10 text-brand"><Armchair className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Sức chứa</p>
            <p className="font-display text-lg font-bold text-ink">{seats.filter((seat) => seat.type === 'standard' || seat.type === 'vip' || seat.type === 'couple').length} ghế</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-info/25 bg-info/10 text-info"><Info className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Loại phòng</p>
            <div className="mt-0.5 flex items-center gap-1.5"><Badge tone="outline">{room.type}</Badge><StatusBadge status={room.status} /></div>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-warning/25 bg-warning/10 text-warning"><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Lưu ý</p>
            <p className="text-xs text-ink2">Thay đổi ảnh hưởng suất chiếu sắp tới</p>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <SeatGridEditor
            key={`${roomId}-${editorVersion}`}
            roomName={room.name}
            seats={seats}
            saving={saveMutation.isPending}
            onSave={(cells) => saveMutation.mutate(cells)}
            onCellsChange={setPreviewCells}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card className="overflow-hidden">
            <div className="border-b border-line/70 px-4 py-3">
              <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">Xem trước sơ đồ</p>
              <p className="text-[11px] text-muted">Cập nhật trực tiếp theo thao tác tô ghế.</p>
            </div>
            <div className="p-4">
              {previewSeats.length ? (
                <>
                  <ScreenBar label="MÀN HÌNH" />
                  <SeatMap seats={previewSeats} readOnly className="mx-auto max-w-full" />
                  <SeatLegend className="mt-4 justify-center" />
                </>
              ) : (
                <EmptyState
                  icon={<Armchair className="h-6 w-6" />}
                  title="Sơ đồ trống"
                  description="Tô ghế trực tiếp hoặc dùng tạo tự động để bắt đầu."
                  className="border-0 bg-transparent px-2 py-8"
                />
              )}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Quy tắc nghiệp vụ</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Ghế đôi luôn chiếm đúng 2 ô liền nhau.</li>
              <li>• Nhãn ghế phải duy nhất trong phòng.</li>
              <li>• Không thể xóa hoặc khóa ghế đã bán/giữ ở suất chiếu sắp tới.</li>
              <li>• Lối đi và ô trống được bỏ qua khi tính sức chứa.</li>
            </ul>
          </Card>
        </aside>
      </div>

      <GenerateSeatsModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => setEditorVersion((version) => version + 1)}
        roomId={roomId}
        roomName={room.name}
      />

      <LayoutConflictModal open={Boolean(conflictShowtimes)} onClose={() => setConflictShowtimes(null)} affected={conflictShowtimes ?? []} />
    </div>
  );
}
