import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock } from 'lucide-react';
import type { ShowtimePublic } from '@/api';
import { listShowtimesAdmin } from '@/api';
import { dateISO, cinemaNow } from '@/lib/datetime';
import { formatDate } from '@/lib/format';
import { Button, Modal, Spinner } from '@/components/ui';

export function LayoutConflictModal({ open, onClose, affected }: {
  open: boolean; onClose: () => void; affected: number[];
}) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['admin', 'showtimes', 'layout-conflicts'],
    queryFn: () => listShowtimesAdmin({ from: dateISO(cinemaNow()), status: 'all' }),
    enabled: open,
    staleTime: 20_000,
  });
  const affectedSet = new Set(affected);
  const matched: ShowtimePublic[] = (query.data ?? []).filter((showtime) => affectedSet.has(showtime.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Không thể lưu sơ đồ ghế"
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { onClose(); navigate('/admin/suat-chieu'); }}>Mở quản lý suất chiếu</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-danger/35 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="text-sm leading-relaxed text-ink2">
            <p className="font-semibold text-ink">Bạn đang xóa hoặc khóa ghế đã được bán/giữ cho suất chiếu sắp tới.</p>
            <p className="mt-1">Để bảo vệ khách hàng, hệ thống chặn lưu sơ đồ. Hãy xử lý đổi ghế hoặc hoàn tiền cho các đơn liên quan, hoặc chỉ khóa ghế sau khi suất chiếu kết thúc.</p>
          </div>
        </div>

        <div className="rounded-lg border border-line">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 bg-base/40 px-3 py-2">
            <p className="text-xs font-semibold text-ink">Suất chiếu bị ảnh hưởng</p>
            <span className="text-[11px] text-muted">{affected.length} suất</span>
          </div>
          {query.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : matched.length ? (
            <ul className="max-h-64 divide-y divide-line/50 overflow-y-auto">
              {matched.map((showtime) => (
                <li key={showtime.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{showtime.movie.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatDate(showtime.showDate)} · {showtime.startTime}–{showtime.endTime} · {showtime.room.name}
                    </p>
                  </div>
                  <span className="font-mono text-muted">#{showtime.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-4 text-xs text-ink2">
              <p>Các suất chiếu bị ảnh hưởng: {affected.map((id) => `#${id}`).join(', ')}</p>
              {query.isError && <p className="mt-1 text-danger">Không tải được chi tiết suất chiếu.</p>}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-base/40 p-3">
          <p className="text-xs font-semibold text-ink">Gợi ý xử lý</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-ink2">
            <li className="flex gap-1.5"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" />Đổi ghế cho khách trong trang chi tiết đơn hàng.</li>
            <li className="flex gap-1.5"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" />Tạo hoàn tiền nếu khách không thể đổi ghế.</li>
            <li className="flex gap-1.5"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-brand" />Dời suất chiếu sang phòng/suất khác trước khi thay đổi sơ đồ.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
