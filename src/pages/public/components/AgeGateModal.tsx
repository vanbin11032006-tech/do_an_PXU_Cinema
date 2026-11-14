import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { AgeRating } from '@/types/domain';
import { Button, Checkbox, Modal } from '@/components/ui';

const AGE_COPY: Partial<Record<AgeRating, { min: number; note: string }>> = {
  T16: {
    min: 16,
    note: 'Phim được phân loại T16 – chỉ dành cho khán giả từ 16 tuổi trở lên. Rạp có thể yêu cầu xuất trình giấy tờ tùy thân tại cửa phòng chiếu.',
  },
  T18: {
    min: 18,
    note: 'Phim được phân loại T18 – chỉ dành cho khán giả từ 18 tuổi trở lên. Rạp sẽ kiểm tra giấy tờ tùy thân (CCCD/hộ chiếu) trước khi vào phòng.',
  },
};

export function AgeGateModal({ open, onClose, age, movieTitle, onConfirm }: {
  open: boolean;
  onClose: () => void;
  age: AgeRating;
  movieTitle: string;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const copy = AGE_COPY[age];

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  if (!copy) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Xác nhận độ tuổi · ${age}`}
      description={`Phim "${movieTitle}" yêu cầu xác nhận độ tuổi trước khi đặt vé.`}
      size="sm"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Quay lại</Button>
          <Button disabled={!confirmed} onClick={onConfirm}>Tôi đã đủ tuổi · Tiếp tục</Button>
        </div>
      )}
    >
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm leading-relaxed text-ink2">{copy.note}</p>
        </div>
      </div>
      <Checkbox
        className="mt-4"
        checked={confirmed}
        onChange={(event) => setConfirmed(event.target.checked)}
        label={`Tôi xác nhận mình từ ${copy.min} tuổi trở lên và đồng ý tuân thủ quy chế rạp PXU Cinema.`}
      />
      <p className="mt-3 text-xs text-muted">
        Xem thêm <Link to="/trang/quy-che-rap" className="text-brand hover:underline">quy chế rạp</Link> và{' '}
        <Link to="/trang/dieu-khoan" className="text-brand hover:underline">điều khoản sử dụng</Link>.
      </p>
    </Modal>
  );
}
