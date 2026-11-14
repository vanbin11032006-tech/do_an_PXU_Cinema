import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, Clock3, Info } from 'lucide-react';
import type { Cinema, Movie, Room, ShowtimeStatus } from '@/types/domain';
import type { ShowtimePublic } from '@/api';
import { createShowtime, showtimeImpact, updateShowtime, validateShowtime } from '@/api';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useDebounce } from '@/hooks';
import { money } from '@/lib/format';
import {
  Button, Field, Input, Modal, Select, Spinner, StatusBadge, toast,
} from '@/components/ui';

interface ShowtimeDraft {
  movieId: string;
  cinemaId: string;
  roomId: string;
  showDate: string;
  startTime: string;
  format: string;
  basePrice: string;
  status: ShowtimeStatus;
}

const STATUS_OPTIONS: { value: ShowtimeStatus; label: string }[] = [
  { value: 'scheduled', label: 'Đã lên lịch' },
  { value: 'selling', label: 'Đang bán' },
  { value: 'closed', label: 'Đóng bán' },
  { value: 'finished', label: 'Đã chiếu' },
];

export function ShowtimeFormModal({ open, onClose, onSaved, initial, movies, cinemas, rooms, defaultCinemaId, defaultDate }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  initial: ShowtimePublic | null;
  movies: Movie[]; cinemas: Cinema[]; rooms: Room[];
  defaultCinemaId?: number;
  defaultDate: string;
}) {
  const queryClient = useQueryClient();
  const resetKeyRef = useRef('');
  const [form, setForm] = useState<ShowtimeDraft>({
    movieId: '', cinemaId: '', roomId: '', showDate: defaultDate, startTime: '19:00', format: '', basePrice: '', status: 'selling',
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [serverFields, setServerFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { resetKeyRef.current = ''; return; }
    const key = initial ? `edit-${initial.id}` : 'new';
    if (resetKeyRef.current === key) return;
    resetKeyRef.current = key;
    setApiError(null);
    setServerFields({});
    const cinemaId = initial?.cinemaId ?? defaultCinemaId ?? cinemas[0]?.id ?? 0;
    const roomId = initial?.roomId ?? rooms.find((room) => room.cinemaId === cinemaId && room.status === 'active')?.id ?? 0;
    const room = rooms.find((item) => item.id === roomId);
    setForm({
      movieId: String(initial?.movieId ?? movies[0]?.id ?? ''),
      cinemaId: String(cinemaId),
      roomId: String(roomId),
      showDate: initial?.showDate ?? defaultDate,
      startTime: initial?.startTime ?? '19:00',
      format: initial?.format ?? (room ? `${room.type} Phụ đề` : ''),
      basePrice: initial ? String(initial.basePrice) : '',
      status: initial?.status ?? 'selling',
    });
  }, [open, initial, defaultCinemaId, defaultDate, cinemas, rooms, movies]);

  const impactQuery = useQuery({
    queryKey: ['admin', 'showtime-impact', initial?.id],
    queryFn: () => showtimeImpact(initial!.id),
    enabled: open && Boolean(initial),
    retry: false,
  });
  const impactBookings = impactQuery.data?.bookings ?? [];
  const lockedStructure = impactBookings.length > 0;

  const roomOptions = rooms.filter((room) => String(room.cinemaId) === form.cinemaId);
  const debounced = useDebounce(form, 300);
  const validationInput = {
    movieId: Number(debounced.movieId),
    roomId: Number(debounced.roomId),
    showDate: debounced.showDate,
    startTime: debounced.startTime,
  };
  const validationReady = Boolean(
    debounced.movieId && debounced.roomId && debounced.showDate && /^\d{2}:\d{2}$/.test(debounced.startTime),
  );
  const validationQuery = useQuery({
    queryKey: [
      'admin', 'showtime-validation', initial?.id ?? 'new',
      validationInput.movieId, validationInput.roomId, validationInput.showDate, validationInput.startTime,
    ],
    queryFn: () => validateShowtime(validationInput, initial?.id),
    enabled: open && validationReady,
    retry: false,
  });
  const validation = validationQuery.data;
  const validationError = validationQuery.isError ? errorMessage(validationQuery.error) : null;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        movieId: Number(form.movieId),
        roomId: Number(form.roomId),
        showDate: form.showDate,
        startTime: form.startTime,
        format: form.format.trim() || undefined,
        basePrice: form.basePrice.trim() ? Number(form.basePrice) : undefined,
      };
      return initial
        ? updateShowtime(initial.id, { ...payload, status: form.status })
        : createShowtime(payload);
    },
    onSuccess: () => {
      toast.success(initial ? 'Đã cập nhật suất chiếu' : 'Đã tạo suất chiếu', `${form.showDate} · ${form.startTime}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtimes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtime-impact'] });
      onSaved();
      onClose();
    },
    onError: (error: unknown) => {
      setApiError(errorMessage(error));
      setServerFields(fieldErrors(error));
      toast.error('Không lưu được suất chiếu', errorMessage(error));
    },
  });

  const priceValid = form.basePrice.trim() === '' || (Number.isFinite(Number(form.basePrice)) && Number(form.basePrice) >= 0);
  const structuralChanged = !initial
    || Number(form.movieId) !== initial.movieId
    || Number(form.roomId) !== initial.roomId
    || form.showDate !== initial.showDate
    || form.startTime !== initial.startTime;
  const validationSettled = form.movieId === debounced.movieId
    && form.roomId === debounced.roomId
    && form.showDate === debounced.showDate
    && form.startTime === debounced.startTime;
  const canSubmit = priceValid && (structuralChanged
    ? Boolean(validation?.valid) && validationSettled && !validationQuery.isFetching && !validationError
    : Boolean(initial)) && !mutation.isPending;
  const displayEndTime = structuralChanged ? validation?.endTime : initial?.endTime;

  const onCinemaChange = (cinemaId: string) => {
    const room = rooms.find((item) => item.cinemaId === Number(cinemaId) && item.status === 'active') ?? rooms.find((item) => item.cinemaId === Number(cinemaId));
    setForm((current) => ({
      ...current,
      cinemaId,
      roomId: room ? String(room.id) : '',
      format: room ? `${room.type} Phụ đề` : current.format,
    }));
    setApiError(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Sửa suất chiếu' : 'Tạo suất chiếu'}
      description={initial ? `#${initial.id} · ${initial.movie.title}` : 'Kiểm tra trùng giờ tự động trước khi lưu.'}
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-muted" aria-live="polite">
            {structuralChanged ? (!validationSettled || validationQuery.isFetching ? (
              <span className="inline-flex items-center gap-1.5"><Spinner className="h-3 w-3" /> Đang kiểm tra trùng giờ…</span>
            ) : validation ? (
              validation.valid
                ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" />Không trùng giờ · kết thúc {validation.endTime}</span>
                : <span className="inline-flex items-center gap-1 text-danger"><Ban className="h-3.5 w-3.5" />{validation.conflicts.length} suất bị trùng</span>
            ) : 'Chọn phim, phòng, ngày và giờ để kiểm tra.') : (
              <span className="inline-flex items-center gap-1 text-muted">Chỉ sửa giá, format hoặc trạng thái · kết thúc {initial?.endTime}</span>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Hủy</Button>
            <Button disabled={!canSubmit} loading={mutation.isPending} onClick={() => mutation.mutate()}>
              {initial ? 'Lưu thay đổi' : 'Tạo suất chiếu'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {lockedStructure && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/5 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Suất chiếu đã có {impactBookings.length} đơn ({money(impactQuery.data?.totalAmount ?? 0)}).</p>
              <p className="mt-0.5 text-ink2">Không thể đổi phim, phòng, ngày hoặc giờ. Chỉ được sửa giá, format và trạng thái; dùng quy trình Hủy/Dời suất nếu cần thay đổi lịch.</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phim" htmlFor="showtime-movie" required error={serverFields.movieId}>
            <Select
              id="showtime-movie"
              value={form.movieId}
              disabled={lockedStructure}
              onChange={(event) => setForm((current) => ({ ...current, movieId: event.target.value }))}
            >
              {movies.map((movie) => (
                <option key={movie.id} value={movie.id} disabled={movie.status === 'ended'}>
                  {movie.title}{movie.status === 'ended' ? ' (đã kết thúc)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Rạp" htmlFor="showtime-cinema" required>
            <Select id="showtime-cinema" value={form.cinemaId} disabled={lockedStructure} onChange={(event) => onCinemaChange(event.target.value)}>
              {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}
            </Select>
          </Field>

          <Field label="Phòng" htmlFor="showtime-room" required error={serverFields.roomId} hint="Phòng bảo trì sẽ bị chặn.">
            <Select
              id="showtime-room"
              value={form.roomId}
              disabled={lockedStructure}
              onChange={(event) => {
                const room = rooms.find((item) => item.id === Number(event.target.value));
                setForm((current) => ({ ...current, roomId: event.target.value, format: room ? `${room.type} Phụ đề` : current.format }));
              }}
            >
              <option value="">Chọn phòng</option>
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>{room.name} · {room.type}{room.status === 'maintenance' ? ' (bảo trì)' : ''}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày chiếu" htmlFor="showtime-date" required error={serverFields.showDate}>
              <Input
                id="showtime-date"
                type="date"
                value={form.showDate}
                disabled={lockedStructure}
                onChange={(event) => setForm((current) => ({ ...current, showDate: event.target.value }))}
              />
            </Field>
            <Field label="Giờ bắt đầu" htmlFor="showtime-start" required error={serverFields.startTime}>
              <Input
                id="showtime-start"
                type="time"
                step={300}
                value={form.startTime}
                disabled={lockedStructure}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              />
            </Field>
          </div>

          <Field label="Định dạng" htmlFor="showtime-format" hint="Ví dụ: 2D Phụ đề, IMAX Lồng tiếng.">
            <Input id="showtime-format" value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))} placeholder="2D Phụ đề" />
          </Field>

          <Field label="Giá vé cơ bản" htmlFor="showtime-price" hint="Để trống để tính theo bảng giá." error={priceValid ? undefined : 'Giá vé không được âm.'}>
            <Input
              id="showtime-price"
              type="number"
              min={0}
              step={1000}
              value={form.basePrice}
              onChange={(event) => setForm((current) => ({ ...current, basePrice: event.target.value }))}
              placeholder="Tự động"
              error={!priceValid}
            />
          </Field>
        </div>

        {initial && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-base/40 p-3">
            <div>
              <p className="text-xs font-semibold text-ink">Trạng thái suất chiếu</p>
              <p className="text-[11px] text-muted">Hiện tại: <StatusBadge status={initial.status} /></p>
            </div>
            <Select
              value={form.status}
              aria-label="Trạng thái suất chiếu"
              className="w-44"
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ShowtimeStatus }))}
            >
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
        )}

        <div className="rounded-lg border border-line bg-base/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-ink">
              <Clock3 className="h-4 w-4 text-brand" />
              <span>Thời gian chiếu</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-ink">
                {form.startTime || '--:--'} – {displayEndTime ?? '--:--'}
              </p>
              <p className="text-[10px] text-muted">
                {displayEndTime ? 'Đã bao gồm thời gian quảng cáo và dọn phòng theo cấu hình.' : 'Cần kiểm tra hợp lệ để tính giờ kết thúc.'}
              </p>
            </div>
          </div>
          {structuralChanged && validation?.warnings.map((warning) => (
            <p key={warning} className="mt-2 flex items-start gap-1.5 text-[11px] text-warning"><Info className="mt-0.5 h-3 w-3 shrink-0" />{warning}</p>
          ))}
        </div>

        {structuralChanged && validation && validation.conflicts.length > 0 && (
          <div className="rounded-lg border border-danger/35 bg-danger/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-danger"><Ban className="h-3.5 w-3.5" />Trùng giờ với suất chiếu khác</p>
            <ul className="mt-2 space-y-1 text-[11px] text-ink2">
              {validation.conflicts.map((conflict) => (
                <li key={conflict.showtimeId} className="flex flex-wrap items-center justify-between gap-2 rounded border border-line/60 bg-base/40 px-2 py-1.5">
                  <span className="font-medium text-ink">{conflict.movieTitle}</span>
                  <span className="font-mono text-muted">#{conflict.showtimeId} · {conflict.startTime}–{conflict.endTime}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Chọn giờ khác hoặc phòng khác. Thời gian dọn phòng được cộng vào khoảng cách tối thiểu giữa hai suất.</p>
          </div>
        )}

        {structuralChanged && validationError && (
          <div className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">
            <p className="font-semibold">Không kiểm tra được suất chiếu</p>
            <p className="mt-0.5 text-ink2">{validationError}</p>
          </div>
        )}

        {apiError && (
          <div className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">
            <p className="font-semibold">Không lưu được suất chiếu</p>
            <p className="mt-0.5 text-ink2">{apiError}</p>
            {initial && <p className="mt-1 text-muted">Nếu suất đã phát sinh đơn, hãy dùng chức năng Hủy/Dời suất thay vì sửa cấu trúc.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
