import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Cinema } from '@/types/domain';
import { saveCinema } from '@/api';
import { errorMessage } from '@/lib/errors';
import { Button, Field, Input, Modal, toast } from '@/components/ui';

const TONE_PRESETS = ['#ff6600', '#38bdf8', '#a855f7', '#22c55e', '#f43f5e', '#f59e0b'];

export function CinemaFormModal({ open, onClose, cinema }: {
  open: boolean; onClose: () => void; cinema: Cinema | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [hotline, setHotline] = useState('');
  const [imageTone, setImageTone] = useState(TONE_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(cinema?.name ?? '');
    setAddress(cinema?.address ?? '');
    setCity(cinema?.city ?? '');
    setHotline(cinema?.hotline ?? '');
    setImageTone(cinema?.imageTone ?? TONE_PRESETS[0]);
    setError(null);
  }, [open, cinema]);

  const mutation = useMutation({
    mutationFn: () => saveCinema({
      id: cinema?.id,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      hotline: hotline.trim(),
      imageTone,
    }),
    onSuccess: (saved) => {
      toast.success(cinema ? 'Đã cập nhật rạp' : 'Đã thêm rạp', saved.name);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'cinemas'] });
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không lưu được rạp', errorMessage(mutationError));
    },
  });

  const invalid = !name.trim() || !address.trim() || !city.trim() || !hotline.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cinema ? 'Sửa thông tin rạp' : 'Thêm rạp mới'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button disabled={invalid} loading={mutation.isPending} onClick={() => mutation.mutate()}>{cinema ? 'Lưu thay đổi' : 'Thêm rạp'}</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên rạp" htmlFor="cinema-name" required className="sm:col-span-2">
          <Input id="cinema-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="PXU Cinema Landmark" autoFocus />
        </Field>
        <Field label="Địa chỉ" htmlFor="cinema-address" required className="sm:col-span-2">
          <Input id="cinema-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Tầng 4, Vincom Landmark 81…" />
        </Field>
        <Field label="Thành phố" htmlFor="cinema-city" required>
          <Input id="cinema-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="TP. Hồ Chí Minh" />
        </Field>
        <Field label="Đường dây nóng" htmlFor="cinema-hotline" required>
          <Input id="cinema-hotline" value={hotline} onChange={(event) => setHotline(event.target.value)} placeholder="1900 6363" inputMode="tel" />
        </Field>
        <Field label="Màu nhận diện" htmlFor="cinema-tone" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {TONE_PRESETS.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`Chọn màu ${tone}`}
                aria-pressed={imageTone === tone}
                onClick={() => setImageTone(tone)}
                className={`h-8 w-8 rounded-full border-2 transition ${imageTone === tone ? 'border-white ring-2 ring-brand' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: tone }}
              />
            ))}
            <Input id="cinema-tone" type="color" value={imageTone} onChange={(event) => setImageTone(event.target.value)} className="h-9 w-16 p-1" aria-label="Màu tùy chọn" />
          </div>
        </Field>
        {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger sm:col-span-2" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
