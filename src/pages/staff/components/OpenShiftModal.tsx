import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Wallet } from 'lucide-react';
import { listCinemas, openShift } from '@/api';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { money } from '@/lib/format';
import { Button, Field, Input, Modal, Select, Skeleton, toast } from '@/components/ui';

const PRESETS = [0, 500_000, 1_000_000, 2_000_000];

export function OpenShiftModal({ open, onClose, onOpened }: {
  open: boolean;
  onClose: () => void;
  onOpened?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const cinemasQuery = useQuery({ queryKey: ['cinemas'], queryFn: listCinemas, enabled: open });
  const [cinemaId, setCinemaId] = useState<number>(0);
  const [cash, setCash] = useState('1000000');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCash('1000000');
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open || cinemaId) return;
    const preferred = user?.cinemaIds[0] ?? cinemasQuery.data?.[0]?.id ?? 0;
    if (preferred) setCinemaId(preferred);
  }, [open, cinemaId, user, cinemasQuery.data]);

  const mutation = useMutation({
    mutationFn: () => openShift(Number(cash || 0), cinemaId),
    onSuccess: (result) => {
      toast.success('Đã mở ca làm việc', result.message);
      queryClient.invalidateQueries({ queryKey: ['staff', 'current-shift'] });
      onOpened?.();
      onClose();
    },
    onError: (err) => {
      const message = errorMessage(err);
      setError(message);
      toast.error('Không mở được ca', message);
    },
  });

  const submit = () => {
    if (!cinemaId) {
      setError('Vui lòng chọn rạp làm việc.');
      return;
    }
    if (cash === '' || Number(cash) < 0) {
      setError('Tiền đầu ca không hợp lệ.');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mở ca làm việc"
      description="Bạn cần mở ca trước khi bán vé tại quầy để hệ thống ghi nhận doanh thu và tiền mặt."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Để sau</Button>
          <Button onClick={submit} loading={mutation.isPending} icon={<Wallet className="h-4 w-4" />}>
            Mở ca
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {cinemasQuery.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <Field label="Rạp làm việc" htmlFor="open-shift-cinema" required>
            <Select
              id="open-shift-cinema"
              value={cinemaId || ''}
              onChange={(event) => setCinemaId(Number(event.target.value))}
              disabled={(user?.cinemaIds.length ?? 0) === 1}
            >
              <option value="">Chọn rạp</option>
              {(cinemasQuery.data ?? []).map((cinema) => (
                <option key={cinema.id} value={cinema.id}>{cinema.name}</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Tiền mặt đầu ca" htmlFor="open-shift-cash" required hint="Số tiền có sẵn trong ngăn kéo khi bắt đầu ca.">
          <Input
            id="open-shift-cash"
            type="number"
            min={0}
            step={1000}
            value={cash}
            onChange={(event) => setCash(event.target.value)}
            inputMode="numeric"
            error={Boolean(error)}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setCash(String(preset))}
              className="rounded-full border border-line bg-surface/60 px-3 py-1 text-[11px] font-semibold text-ink2 transition hover:border-brand/50 hover:text-brand"
            >
              {preset === 0 ? '0đ' : money(preset)}
            </button>
          ))}
        </div>

        {error && <p className="text-xs font-medium text-danger" role="alert">{error}</p>}

        <p className="flex items-start gap-2 rounded-md border border-info/25 bg-info/10 p-2.5 text-[11px] leading-relaxed text-sky-300">
          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Doanh thu tiền mặt của ca sẽ được đối soát khi đóng ca tại trang Ca làm việc.
        </p>
      </div>
    </Modal>
  );
}
