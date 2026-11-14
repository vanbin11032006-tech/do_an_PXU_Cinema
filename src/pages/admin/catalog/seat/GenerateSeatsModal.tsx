import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Wand2 } from 'lucide-react';
import { generateRoomSeats } from '@/api';
import { errorMessage } from '@/lib/errors';
import { Button, Field, Input, Modal, toast } from '@/components/ui';

const splitList = (value: string) => value.split(/[,;\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean);

export function GenerateSeatsModal({ open, onClose, onGenerated, roomId, roomName }: {
  open: boolean; onClose: () => void; onGenerated: () => void; roomId: number; roomName: string;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState('8');
  const [cols, setCols] = useState('14');
  const [vipRows, setVipRows] = useState('E,F');
  const [coupleRows, setCoupleRows] = useState('H');
  const [disabledCells, setDisabledCells] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows('8');
    setCols('14');
    setVipRows('E,F');
    setCoupleRows('H');
    setDisabledCells('');
    setError(null);
  }, [open]);

  const rowCount = Number(rows);
  const colCount = Number(cols);
  const rowLabels = Array.from({ length: Number.isFinite(rowCount) ? Math.max(0, Math.min(20, rowCount)) : 0 }, (_, index) => String.fromCharCode(65 + index));
  const vipList = splitList(vipRows);
  const coupleList = splitList(coupleRows);
  const invalidVip = vipList.filter((row) => !rowLabels.includes(row));
  const invalidCouple = coupleList.filter((row) => !rowLabels.includes(row));
  const invalidConfig = !Number.isInteger(rowCount) || rowCount < 1 || rowCount > 20
    || !Number.isInteger(colCount) || colCount < 2 || colCount > 30
    || invalidVip.length > 0 || invalidCouple.length > 0;

  const mutation = useMutation({
    mutationFn: () => generateRoomSeats(roomId, {
      rows: rowCount,
      cols: colCount,
      vipRows: vipList,
      coupleRows: coupleList,
      disabledCells: splitList(disabledCells).map((cell) => cell.replace(/^([A-Z])0+(\d+)$/, '$1$2')),
    }),
    onSuccess: async (generated) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'room-seats', roomId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'room-seat-counts'] });
      toast.success('Đã tạo sơ đồ ghế', `${generated.length} ô ghế cho ${roomName}.`);
      onGenerated();
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không tạo được sơ đồ', errorMessage(mutationError));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo sơ đồ ghế tự động"
      description={`${roomName} · Thao tác này thay thế toàn bộ sơ đồ hiện tại.`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button
            variant="danger"
            icon={<Wand2 className="h-4 w-4" />}
            disabled={invalidConfig}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Tạo sơ đồ mới
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Chỉ dùng khi phòng chưa có đơn đặt vé.</p>
            <p className="mt-0.5 text-ink2">Sơ đồ mới sẽ thay thế toàn bộ ghế hiện tại, bao gồm ghế đã bán hoặc đang giữ ở các suất chiếu. Hãy kiểm tra lịch chiếu trước khi tạo.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số hàng" htmlFor="generate-rows" required hint="Tối đa 20 hàng (A–T).">
            <Input id="generate-rows" type="number" min={1} max={20} value={rows} onChange={(event) => setRows(event.target.value)} />
          </Field>
          <Field label="Số cột" htmlFor="generate-cols" required hint="Tối đa 30 cột.">
            <Input id="generate-cols" type="number" min={2} max={30} value={cols} onChange={(event) => setCols(event.target.value)} />
          </Field>
          <Field label="Hàng VIP" htmlFor="generate-vip" hint="Ví dụ: E,F. Phân tách bằng dấu phẩy.">
            <Input id="generate-vip" value={vipRows} onChange={(event) => setVipRows(event.target.value)} placeholder="E,F" />
          </Field>
          <Field label="Hàng ghế đôi" htmlFor="generate-couple" hint="Mỗi ô đôi chiếm 2 cột liền nhau.">
            <Input id="generate-couple" value={coupleRows} onChange={(event) => setCoupleRows(event.target.value)} placeholder="H" />
          </Field>
          <Field label="Ghế khóa" htmlFor="generate-disabled" hint="Ví dụ: D1, G14. Không áp dụng cho hàng ghế đôi." className="sm:col-span-2">
            <Input id="generate-disabled" value={disabledCells} onChange={(event) => setDisabledCells(event.target.value)} placeholder="D1, G14" />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-base/40 p-3 text-xs text-ink2">
          <p className="font-semibold text-ink">Xem nhanh cấu hình</p>
          <p className="mt-1">{rowCount || 0} hàng × {colCount || 0} cột · VIP: {vipList.join(', ') || 'không'} · Ghế đôi: {coupleList.join(', ') || 'không'}</p>
          <p className="mt-1 text-muted">Hàng ghế đôi sẽ lấy số cột chẵn; nếu số cột lẻ, cột cuối không được tạo ở hàng đó.</p>
          {invalidVip.length > 0 && <p className="mt-1 text-danger">Hàng VIP không hợp lệ: {invalidVip.join(', ')}</p>}
          {invalidCouple.length > 0 && <p className="mt-1 text-danger">Hàng ghế đôi không hợp lệ: {invalidCouple.join(', ')}</p>}
        </div>

        {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
