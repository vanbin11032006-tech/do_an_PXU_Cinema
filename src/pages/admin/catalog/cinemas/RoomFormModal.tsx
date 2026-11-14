import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Room } from '@/types/domain';
import { saveRoom } from '@/api';
import { errorMessage } from '@/lib/errors';
import { Button, Field, Input, Modal, Select, toast } from '@/components/ui';
import { ROOM_TYPE_OPTIONS } from '../shared';

export function RoomFormModal({ open, onClose, cinemaId, cinemaName, room }: {
  open: boolean; onClose: () => void;
  cinemaId: number; cinemaName: string; room: Room | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<Room['type']>('2D');
  const [status, setStatus] = useState<Room['status']>('active');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(room?.name ?? '');
    setType(room?.type ?? '2D');
    setStatus(room?.status ?? 'active');
    setError(null);
  }, [open, room]);

  const mutation = useMutation({
    mutationFn: () => saveRoom({ id: room?.id, cinemaId, name: name.trim(), type, status }),
    onSuccess: (saved) => {
      toast.success(room ? 'Đã cập nhật phòng' : 'Đã thêm phòng', `${saved.name} · ${cinemaName}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'room-seat-counts'] });
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không lưu được phòng', errorMessage(mutationError));
    },
  });

  const invalid = !name.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Sửa phòng chiếu' : 'Thêm phòng chiếu'}
      description={cinemaName}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button disabled={invalid} loading={mutation.isPending} onClick={() => mutation.mutate()}>{room ? 'Lưu thay đổi' : 'Thêm phòng'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Tên phòng" htmlFor="room-name" required>
          <Input id="room-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cinema 01" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại phòng" htmlFor="room-type">
            <Select id="room-type" value={type} onChange={(event) => setType(event.target.value as Room['type'])}>
              {ROOM_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
          <Field label="Trạng thái" htmlFor="room-status" hint="Phòng bảo trì sẽ bị chặn khi xếp suất chiếu.">
            <Select id="room-status" value={status} onChange={(event) => setStatus(event.target.value as Room['status'])}>
              <option value="active">Hoạt động</option>
              <option value="maintenance">Bảo trì</option>
            </Select>
          </Field>
        </div>
        {room && (
          <p className="rounded-lg border border-line bg-base/40 p-3 text-[11px] text-muted">
            Đổi loại phòng ảnh hưởng tới phụ thu giá vé của các suất chiếu mới. Sơ đồ ghế được quản lý riêng trong trang thiết kế ghế.
          </p>
        )}
        {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
