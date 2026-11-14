import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, CalendarClock, Clock, LockKeyhole, Printer, RefreshCw, TrendingUp, Wallet,
} from 'lucide-react';
import { closeShift, currentShift, listCinemas, openShift } from '@/api';
import type { Shift } from '@/types/domain';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { cn, formatDate, formatDateTime, money } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import {
  Badge, Button, Card, ConfirmDialog, ErrorState, Field, Input, PageHeader, Select, Skeleton, Textarea, toast,
} from '@/components/ui';
import { DenominationCounter } from './components/DenominationCounter';

const OPENING_PRESETS = [0, 500_000, 1_000_000, 2_000_000];

interface ClosedSummary {
  shift: Shift;
  countedCash: number;
  expectedCash: number;
  difference: number;
  note: string;
  closedAt: string;
  cinemaName: string;
}

export default function ShiftPage() {
  useDocumentTitle('Ca làm việc');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [openingCash, setOpeningCash] = useState('1000000');
  const [cinemaId, setCinemaId] = useState(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closed, setClosed] = useState<ClosedSummary | null>(null);

  const shiftQuery = useQuery({ queryKey: ['staff', 'current-shift'], queryFn: currentShift, refetchInterval: 60_000 });
  const cinemasQuery = useQuery({ queryKey: ['cinemas'], queryFn: listCinemas });

  const shift = shiftQuery.data?.shift ?? null;
  const cinemaName = useMemo(() => {
    if (!shift) return '';
    return cinemasQuery.data?.find((cinema) => cinema.id === shift.cinemaId)?.name ?? `Rạp #${shift.cinemaId}`;
  }, [shift, cinemasQuery.data]);

  useEffect(() => {
    if (cinemaId) return;
    const preferred = user?.cinemaIds[0] ?? cinemasQuery.data?.[0]?.id ?? 0;
    if (preferred) setCinemaId(preferred);
  }, [cinemaId, user, cinemasQuery.data]);

  useEffect(() => {
    setCounts({});
    setNote('');
    setNoteError(null);
  }, [shift?.id]);

  const countedCash = useMemo(
    () => Object.entries(counts).reduce((sum, [denomination, count]) => sum + Number(denomination) * count, 0),
    [counts],
  );
  const expectedCash = shift ? shift.expectedCash ?? shift.openingCash + shift.totalSales : 0;
  const difference = countedCash - expectedCash;

  const openMutation = useMutation({
    mutationFn: () => openShift(Number(openingCash || 0), cinemaId),
    onSuccess: (result) => {
      toast.success('Đã mở ca làm việc', result.message);
      setClosed(null);
      queryClient.invalidateQueries({ queryKey: ['staff', 'current-shift'] });
    },
    onError: (error) => toast.error('Không mở được ca', errorMessage(error)),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeShift(shift!.id, countedCash, note.trim()),
    onSuccess: (result) => {
      if (shift) {
        setClosed({
          shift: { ...shift, closedAt: new Date().toISOString(), countedCash, expectedCash: countedCash - result.difference, difference: result.difference, note: note.trim(), status: 'closed' },
          countedCash,
          expectedCash: countedCash - result.difference,
          difference: result.difference,
          note: note.trim(),
          closedAt: new Date().toISOString(),
          cinemaName,
        });
      }
      toast.success('Đã đóng ca làm việc', result.message);
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff', 'current-shift'] });
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error('Không đóng được ca', errorMessage(error));
    },
  });

  const requestClose = () => {
    if (difference !== 0 && note.trim().length < 5) {
      setNoteError('Vui lòng ghi chú chênh lệch tiền mặt (tối thiểu 5 ký tự).');
      return;
    }
    setNoteError(null);
    setConfirmOpen(true);
  };

  const submitOpen = () => {
    if (!cinemaId) {
      toast.warning('Chưa chọn rạp', 'Vui lòng chọn rạp làm việc trước khi mở ca.');
      return;
    }
    if (openingCash === '' || Number(openingCash) < 0) {
      toast.warning('Tiền đầu ca không hợp lệ');
      return;
    }
    openMutation.mutate();
  };

  return (
    <div className="container-page py-6">
      <div className="print:hidden">
        <PageHeader
          title="Ca làm việc"
          description="Mở ca với tiền mặt đầu ca, theo dõi doanh thu và đóng ca với kiểm đếm mệnh giá."
          actions={
            <Button
              size="sm"
              variant="secondary"
              loading={shiftQuery.isFetching}
              onClick={() => void shiftQuery.refetch()}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Làm mới
            </Button>
          }
        />

        {shiftQuery.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-44 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
        )}

        {shiftQuery.isError && (
          <ErrorState
            title="Không tải được ca làm việc"
            message={errorMessage(shiftQuery.error)}
            onRetry={() => void shiftQuery.refetch()}
          />
        )}

        {!shiftQuery.isLoading && !shiftQuery.isError && (
          <div className="space-y-4">
            {closed && (
              <Card className="border-success/30 bg-success/[0.05] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Ca đã đóng</p>
                    <h2 className="mt-1 font-display text-xl font-bold uppercase tracking-wide text-ink">
                      Biên bản ca #{closed.shift.id} · {closed.cinemaName}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Đóng lúc {formatDateTime(closed.closedAt)} · Nhân viên {closed.shift.staffName}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer className="h-3.5 w-3.5" />}>
                    In biên bản ca
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Tiền đầu ca</p>
                    <p className="text-money mt-1 font-bold text-ink">{money(closed.shift.openingCash)}</p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Doanh thu tiền mặt</p>
                    <p className="text-money mt-1 font-bold text-ink">{money(closed.shift.totalSales)}</p>
                  </div>
                  <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Dự kiến</p>
                    <p className="text-money mt-1 font-bold text-ink">{money(closed.expectedCash)}</p>
                  </div>
                  <div className={cn('rounded-lg border p-3', closed.difference === 0 ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10')}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Chênh lệch</p>
                    <p className={cn('text-money mt-1 font-bold', closed.difference === 0 ? 'text-success' : 'text-danger')}>
                      {closed.difference > 0 ? '+' : ''}{money(closed.difference)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink2">
                  <span className="text-muted">Thực đếm: </span>
                  <span className="text-money font-semibold text-ink">{money(closed.countedCash)}</span>
                  <span className="mx-2 text-line">·</span>
                  <span className="text-muted">Số giao dịch: </span>
                  <span className="font-semibold text-ink">{closed.shift.transactions}</span>
                </p>
                {closed.note && <p className="mt-3 text-xs text-ink2"><span className="text-muted">Ghi chú: </span>{closed.note}</p>}
              </Card>
            )}

            {shift ? (
              <>
                <Card className="relative overflow-hidden p-5">
                  <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-brand/10 blur-3xl" aria-hidden />
                  <div className="relative flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Ca đang mở</p>
                      <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-ink">Ca #{shift.id}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Mở lúc {formatDateTime(shift.openedAt)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {shift.staffName}</span>
                      </p>
                      <p className="mt-1 text-xs text-ink2">{cinemaName || `Rạp #${shift.cinemaId}`}</p>
                    </div>
                    <Badge tone="success">Đang mở</Badge>
                  </div>

                  <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted"><Banknote className="h-3 w-3" /> Tiền đầu ca</p>
                      <p className="text-money mt-1 text-base font-bold text-ink">{money(shift.openingCash)}</p>
                    </div>
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted"><TrendingUp className="h-3 w-3" /> Doanh thu ca</p>
                      <p className="text-money mt-1 text-base font-bold text-success">{money(shift.totalSales)}</p>
                    </div>
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Giao dịch</p>
                      <p className="text-money mt-1 text-base font-bold text-ink">{shift.transactions}</p>
                    </div>
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Tiền mặt dự kiến</p>
                      <p className="text-money mt-1 text-base font-bold text-brand">{money(expectedCash)}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="flex items-center gap-1.5 font-display text-lg font-bold uppercase tracking-wide text-ink">
                        <LockKeyhole className="h-4 w-4 text-brand" /> Đóng ca & kiểm đếm
                      </h2>
                      <p className="mt-1 text-xs text-muted">Nhập số tờ theo từng mệnh giá. Hệ thống tự tính tổng và đối soát với tiền mặt dự kiến.</p>
                    </div>
                    <Badge tone="neutral">Dự kiến {money(expectedCash)}</Badge>
                  </div>

                  <div className="mt-4">
                    <DenominationCounter
                      counts={counts}
                      onChange={(denomination, value) => setCounts((current) => ({ ...current, [denomination]: value }))}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Thực đếm</p>
                      <p className="text-money mt-1 text-lg font-bold text-ink">{money(countedCash)}</p>
                    </div>
                    <div className="rounded-lg border border-line/70 bg-base/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Dự kiến</p>
                      <p className="text-money mt-1 text-lg font-bold text-ink">{money(expectedCash)}</p>
                    </div>
                    <div className={cn('rounded-lg border p-3', difference === 0 ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10')}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Chênh lệch</p>
                      <p className={cn('text-money mt-1 text-lg font-bold', difference === 0 ? 'text-success' : 'text-danger')}>
                        {difference > 0 ? '+' : ''}{money(difference)}
                      </p>
                    </div>
                  </div>

                  <Field
                    className="mt-4"
                    label={difference !== 0 ? 'Ghi chú chênh lệch' : 'Ghi chú ca (tùy chọn)'}
                    htmlFor="shift-note"
                    required={difference !== 0}
                    error={noteError ?? undefined}
                    hint={difference !== 0 ? 'Bắt buộc giải trình khi tiền thực đếm khác dự kiến.' : 'Ghi lại bàn giao ca nếu cần.'}
                  >
                    <Textarea
                      id="shift-note"
                      value={note}
                      onChange={(event) => { setNote(event.target.value); setNoteError(null); }}
                      placeholder={difference !== 0 ? 'VD: Chênh lệch do thối nhầm tiền cho khách…' : 'VD: Bàn giao két đầy đủ…'}
                      error={Boolean(noteError)}
                      maxLength={300}
                    />
                  </Field>

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={() => { setCounts({}); setNote(''); setNoteError(null); }}>
                      Xóa kiểm đếm
                    </Button>
                    <Button
                      variant={difference === 0 ? 'primary' : 'danger'}
                      onClick={requestClose}
                      loading={closeMutation.isPending}
                      icon={<LockKeyhole className="h-4 w-4" />}
                    >
                      Đóng ca
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Mở ca làm việc</h2>
                    <p className="mt-1 text-xs text-muted">Khai báo tiền mặt đầu ca để hệ thống đối soát khi đóng ca.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Rạp làm việc" htmlFor="shift-cinema" required>
                    <Select
                      id="shift-cinema"
                      value={cinemaId || ''}
                      onChange={(event) => setCinemaId(Number(event.target.value))}
                      disabled={(user?.cinemaIds.length ?? 0) === 1}
                    >
                      <option value="">Chọn rạp</option>
                      {(cinemasQuery.data ?? [])
                        .filter((cinema) => (user?.role === 'admin' || user?.cinemaIds.length === 0 ? true : user?.cinemaIds.includes(cinema.id)))
                        .map((cinema) => (
                          <option key={cinema.id} value={cinema.id}>{cinema.name}</option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Tiền mặt đầu ca" htmlFor="shift-opening-cash" required hint="Số tiền có sẵn trong ngăn kéo.">
                    <Input
                      id="shift-opening-cash"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1000}
                      value={openingCash}
                      onChange={(event) => setOpeningCash(event.target.value)}
                    />
                  </Field>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {OPENING_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningCash(String(preset))}
                      className="rounded-full border border-line bg-surface/60 px-3 py-1 text-[11px] font-semibold text-ink2 transition hover:border-brand/50 hover:text-brand"
                    >
                      {preset === 0 ? '0đ' : money(preset)}
                    </button>
                  ))}
                </div>

                <Button
                  className="mt-5"
                  size="lg"
                  loading={openMutation.isPending}
                  onClick={submitOpen}
                  icon={<Wallet className="h-4 w-4" />}
                >
                  Mở ca
                </Button>
                <p className="mt-2 text-[11px] text-muted">Mỗi nhân viên chỉ có một ca mở tại một thời điểm.</p>
              </Card>
            )}
          </div>
        )}
      </div>

      {closed && <ShiftPrintout summary={closed} />}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Xác nhận đóng ca?"
        description={
          <div className="space-y-1.5 text-sm">
            <p>Ca <span className="font-mono text-ink">#{shift?.id}</span> sẽ được đóng và không thể mở lại.</p>
            <div className="rounded-md border border-line/70 bg-base/40 p-2.5 text-xs">
              <p className="flex justify-between"><span className="text-muted">Thực đếm</span><span className="text-money text-ink">{money(countedCash)}</span></p>
              <p className="mt-1 flex justify-between"><span className="text-muted">Dự kiến</span><span className="text-money text-ink">{money(expectedCash)}</span></p>
              <p className={cn('mt-1 flex justify-between border-t border-line/60 pt-1.5 font-semibold', difference === 0 ? 'text-success' : 'text-danger')}>
                <span>Chênh lệch</span><span className="text-money">{difference > 0 ? '+' : ''}{money(difference)}</span>
              </p>
            </div>
            {note.trim() && <p className="text-xs text-muted">Ghi chú: {note.trim()}</p>}
          </div>
        }
        confirmText="Đóng ca"
        danger={difference !== 0}
        loading={closeMutation.isPending}
      />
    </div>
  );
}

function ShiftPrintout({ summary }: { summary: ClosedSummary }) {
  return (
    <div className="hidden print:block print:text-black">
      <div className="mx-auto max-w-md font-mono text-xs leading-relaxed">
        <h1 className="text-center text-xl font-bold">PXU CINEMA</h1>
        <p className="text-center">Biên bản bàn giao ca làm việc</p>
        <p className="mt-2 border-t border-dashed border-black pt-2">Ca số: #{summary.shift.id}</p>
        <p>Rạp: {summary.cinemaName}</p>
        <p>Nhân viên: {summary.shift.staffName}</p>
        <p>Mở ca: {formatDateTime(summary.shift.openedAt)}</p>
        <p>Đóng ca: {formatDateTime(summary.closedAt)}</p>
        <p className="mt-2 border-t border-dashed border-black pt-2">Tiền đầu ca: {money(summary.shift.openingCash)}</p>
        <p>Doanh thu ca: {money(summary.shift.totalSales)}</p>
        <p>Số giao dịch: {summary.shift.transactions}</p>
        <p>Tiền mặt dự kiến: {money(summary.expectedCash)}</p>
        <p>Tiền mặt thực đếm: {money(summary.countedCash)}</p>
        <p className="font-bold">Chênh lệch: {summary.difference > 0 ? '+' : ''}{money(summary.difference)}</p>
        <p className="mt-2">Ngày in: {formatDate(new Date().toISOString())}</p>
        {summary.note && <p className="mt-2">Ghi chú: {summary.note}</p>}
        <div className="mt-8 flex justify-between">
          <span>Nhân viên bàn giao</span>
          <span>Quản lý xác nhận</span>
        </div>
      </div>
    </div>
  );
}
