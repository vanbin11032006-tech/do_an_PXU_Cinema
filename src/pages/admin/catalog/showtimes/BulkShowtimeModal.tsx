import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Cinema, Movie, Room } from '@/types/domain';
import type { BulkPreviewRow } from '@/api';
import { bulkCreateShowtimes } from '@/api';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Button, Field, Input, Modal, Select, Spinner, toast } from '@/components/ui';

interface BulkDraft {
  movieId: string;
  cinemaId: string;
  roomId: string;
  from: string;
  to: string;
  times: string;
  format: string;
  basePrice: string;
}

export function BulkShowtimeModal({ open, onClose, onDone, movies, cinemas, rooms, defaultCinemaId, defaultDate }: {
  open: boolean; onClose: () => void; onDone: () => void;
  movies: Movie[]; cinemas: Cinema[]; rooms: Room[];
  defaultCinemaId?: number; defaultDate: string;
}) {
  const queryClient = useQueryClient();
  const resetKeyRef = useRef('');
  const [form, setForm] = useState<BulkDraft>({
    movieId: '', cinemaId: '', roomId: '', from: defaultDate, to: defaultDate,
    times: '09:30, 13:00, 16:30, 20:00', format: '', basePrice: '',
  });
  const [preview, setPreview] = useState<BulkPreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { resetKeyRef.current = ''; return; }
    if (resetKeyRef.current === 'open') return;
    resetKeyRef.current = 'open';
    const cinemaId = defaultCinemaId ?? cinemas[0]?.id ?? 0;
    const room = rooms.find((item) => item.cinemaId === cinemaId && item.status === 'active') ?? rooms.find((item) => item.cinemaId === cinemaId);
    setForm({
      movieId: String(movies[0]?.id ?? ''),
      cinemaId: String(cinemaId),
      roomId: String(room?.id ?? ''),
      from: defaultDate,
      to: defaultDate,
      times: '09:30, 13:00, 16:30, 20:00',
      format: room ? `${room.type} Phụ đề` : '',
      basePrice: '',
    });
    setPreview(null);
    setError(null);
  }, [open, defaultCinemaId, defaultDate, cinemas, rooms, movies]);

  const roomOptions = rooms.filter((room) => String(room.cinemaId) === form.cinemaId);

  const parsedTimes = useMemo(
    () => Array.from(new Set(form.times.split(/[,;\s]+/).map((item) => item.trim()).filter(Boolean))),
    [form.times],
  );
  const invalidTimes = parsedTimes.filter((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  const localError = !form.movieId
    ? 'Chọn phim.'
    : !form.roomId
      ? 'Chọn phòng chiếu.'
      : !form.from || !form.to
        ? 'Chọn khoảng ngày.'
        : form.to < form.from
          ? 'Ngày kết thúc phải sau ngày bắt đầu.'
          : !parsedTimes.length
            ? 'Nhập ít nhất một khung giờ.'
            : invalidTimes.length
              ? `Giờ không hợp lệ: ${invalidTimes.join(', ')}`
              : form.basePrice.trim() !== '' && !(Number.isFinite(Number(form.basePrice)) && Number(form.basePrice) >= 0)
                ? 'Giá vé không được âm.'
                : null;

  const buildPayload = () => ({
    movieId: Number(form.movieId),
    roomId: Number(form.roomId),
    from: form.from,
    to: form.to,
    times: parsedTimes,
    format: form.format.trim() || undefined,
    basePrice: form.basePrice.trim() ? Number(form.basePrice) : undefined,
  });

  const previewMutation = useMutation({
    mutationFn: () => bulkCreateShowtimes({ ...buildPayload(), dryRun: true }),
    onSuccess: (result) => { setPreview(result.rows); setError(null); },
    onError: (mutationError: unknown) => { setError(errorMessage(mutationError)); toast.error('Không tạo được bản xem trước', errorMessage(mutationError)); },
  });

  const createMutation = useMutation({
    mutationFn: () => bulkCreateShowtimes({ ...buildPayload(), dryRun: false }),
    onSuccess: (result) => {
      toast.success('Đã tạo suất chiếu', `${result.created} suất chiếu được thêm vào lịch.`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtimes'] });
      onDone();
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không tạo được suất chiếu', errorMessage(mutationError));
    },
  });

  const validCount = preview?.filter((row) => row.valid).length ?? 0;
  const blockedCount = (preview?.length ?? 0) - validCount;

  const update = (patch: Partial<BulkDraft>) => {
    setForm((current) => ({ ...current, ...patch }));
    setPreview(null);
    setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo suất chiếu hàng loạt"
      description="Xem trước toàn bộ lịch trước khi ghi dữ liệu. Chỉ các dòng hợp lệ mới được tạo."
      size="xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted" aria-live="polite">
            {preview ? `${validCount} hợp lệ · ${blockedCount} bị chặn trên ${preview.length} khung giờ` : 'Chưa có bản xem trước.'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button
              variant="secondary"
              icon={<RefreshCw className="h-4 w-4" />}
              disabled={Boolean(localError) || previewMutation.isPending}
              loading={previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              Xem trước
            </Button>
            <Button
              icon={<CalendarPlus className="h-4 w-4" />}
              disabled={validCount === 0 || createMutation.isPending || Boolean(localError)}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {validCount > 0 ? `Tạo ${validCount} suất` : 'Tạo suất chiếu'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phim" htmlFor="bulk-movie" required>
            <Select id="bulk-movie" value={form.movieId} onChange={(event) => update({ movieId: event.target.value })}>
              {movies.map((movie) => (
                <option key={movie.id} value={movie.id} disabled={movie.status === 'ended'}>{movie.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Rạp" htmlFor="bulk-cinema" required>
            <Select
              id="bulk-cinema"
              value={form.cinemaId}
              onChange={(event) => {
                const cinemaId = event.target.value;
                const room = rooms.find((item) => String(item.cinemaId) === cinemaId && item.status === 'active') ?? rooms.find((item) => String(item.cinemaId) === cinemaId);
                update({ cinemaId, roomId: room ? String(room.id) : '', format: room ? `${room.type} Phụ đề` : form.format });
              }}
            >
              {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
            </Select>
          </Field>
          <Field label="Phòng" htmlFor="bulk-room" required>
            <Select
              id="bulk-room"
              value={form.roomId}
              onChange={(event) => {
                const room = rooms.find((item) => item.id === Number(event.target.value));
                update({ roomId: event.target.value, format: room ? `${room.type} Phụ đề` : form.format });
              }}
            >
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>{room.name} · {room.type}{room.status === 'maintenance' ? ' (bảo trì)' : ''}</option>
              ))}
            </Select>
          </Field>
          <Field label="Định dạng" htmlFor="bulk-format">
            <Input id="bulk-format" value={form.format} onChange={(event) => update({ format: event.target.value })} placeholder="2D Phụ đề" />
          </Field>
          <Field label="Từ ngày" htmlFor="bulk-from" required>
            <Input id="bulk-from" type="date" value={form.from} onChange={(event) => update({ from: event.target.value })} />
          </Field>
          <Field label="Đến ngày" htmlFor="bulk-to" required hint="Tối đa 90 ngày kể từ hôm nay.">
            <Input id="bulk-to" type="date" value={form.to} onChange={(event) => update({ to: event.target.value })} />
          </Field>
          <Field label="Các khung giờ" htmlFor="bulk-times" required hint="Phân tách bằng dấu phẩy. Ví dụ: 09:30, 13:00, 20:00" className="sm:col-span-2">
            <Input id="bulk-times" value={form.times} onChange={(event) => update({ times: event.target.value })} placeholder="09:30, 13:00, 16:30, 20:00" />
          </Field>
          <Field label="Giá vé cơ bản" htmlFor="bulk-price" hint="Để trống để áp bảng giá tự động." error={form.basePrice.trim() !== '' && Number(form.basePrice) < 0 ? 'Giá vé không được âm.' : undefined}>
            <Input id="bulk-price" type="number" min={0} step={1000} value={form.basePrice} onChange={(event) => update({ basePrice: event.target.value })} placeholder="Tự động" />
          </Field>
        </div>

        {localError && (
          <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />{localError}
          </p>
        )}

        {previewMutation.isPending && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-line bg-base/40 py-8 text-sm text-muted">
            <Spinner /> Đang tính bản xem trước…
          </div>
        )}

        {preview && (
          <div className="rounded-lg border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-base/40 px-3 py-2">
              <p className="text-xs font-semibold text-ink">Bản xem trước · {preview.length} khung giờ</p>
              <div className="flex gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" />{validCount} hợp lệ</span>
                <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle className="h-3.5 w-3.5" />{blockedCount} bị chặn</span>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line/60 text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Giờ</th>
                    <th className="px-3 py-2">Kết thúc</th>
                    <th className="px-3 py-2">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={`${row.showDate}-${row.startTime}`} className="border-b border-line/40 last:border-0">
                      <td className="px-3 py-2 text-ink2">{formatDate(row.showDate)}</td>
                      <td className="px-3 py-2 font-mono text-ink">{row.startTime}</td>
                      <td className="px-3 py-2 font-mono text-ink2">{row.endTime}</td>
                      <td className="px-3 py-2">
                        {row.valid
                          ? <span className="text-success">Hợp lệ</span>
                          : <span className="text-danger">{row.reason ?? 'Trùng giờ'}{row.conflicts.length ? ` · ${row.conflicts.length} xung đột` : ''}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {blockedCount > 0 && (
              <p className="border-t border-line/60 px-3 py-2 text-[11px] text-muted">
                Các khung giờ bị chặn sẽ không được tạo. Bạn có thể đổi phòng hoặc giờ rồi xem trước lại.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>
        )}
      </div>
    </Modal>
  );
}
