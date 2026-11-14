import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popcorn } from 'lucide-react';
import type { Combo } from '@/types/domain';
import { saveCombo } from '@/api';
import { errorMessage } from '@/lib/errors';
import { money } from '@/lib/format';
import { Button, Field, Input, Modal, Select, Textarea, toast } from '@/components/ui';
import { COMBO_CATEGORY_LABELS } from '../shared';

const GRADIENTS: { from: string; to: string; emoji: string; label: string }[] = [
  { from: '#f97316', to: '#7c2d12', emoji: '🍿', label: 'Cam bắp rang' },
  { from: '#ec4899', to: '#831843', emoji: '💞', label: 'Hồng đôi' },
  { from: '#8b5cf6', to: '#4c1d95', emoji: '👨‍👩‍👧', label: 'Tím gia đình' },
  { from: '#3b82f6', to: '#1e3a8a', emoji: '🥤', label: 'Xanh nước' },
  { from: '#facc15', to: '#a16207', emoji: '🧈', label: 'Vàng phô mai' },
  { from: '#10b981', to: '#065f46', emoji: '🥗', label: 'Xanh lá' },
];

export function ComboFormModal({ open, onClose, combo }: {
  open: boolean; onClose: () => void; combo: Combo | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState<Combo['category']>('combo');
  const [stock, setStock] = useState('0');
  const [maxPerOrder, setMaxPerOrder] = useState('10');
  const [status, setStatus] = useState<Combo['status']>('active');
  const [from, setFrom] = useState(GRADIENTS[0].from);
  const [to, setTo] = useState(GRADIENTS[0].to);
  const [emoji, setEmoji] = useState(GRADIENTS[0].emoji);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(combo?.name ?? '');
    setDescription(combo?.description ?? '');
    setPrice(String(combo?.price ?? 0));
    setCategory(combo?.category ?? 'combo');
    setStock(String(combo?.stock ?? 0));
    setMaxPerOrder(String(combo?.maxPerOrder ?? 10));
    setStatus(combo?.status ?? 'active');
    setFrom(combo?.art.from ?? GRADIENTS[0].from);
    setTo(combo?.art.to ?? GRADIENTS[0].to);
    setEmoji(combo?.art.emoji ?? GRADIENTS[0].emoji);
    setImageUrl(combo?.art.imageUrl ?? '');
    setError(null);
  }, [open, combo]);

  const priceValue = Number(price);
  const stockValue = Number(stock);
  const maxValue = Number(maxPerOrder);
  const invalid = !name.trim()
    || !Number.isFinite(priceValue) || priceValue < 0
    || (combo ? false : !Number.isFinite(stockValue) || stockValue < 0)
    || !Number.isFinite(maxValue) || maxValue < 1;

  const mutation = useMutation({
    mutationFn: () => saveCombo({
      id: combo?.id,
      name: name.trim(),
      description: description.trim(),
      price: priceValue,
      category,
      maxPerOrder: maxValue,
      status,
      art: { from, to, emoji: emoji || '🍿', imageUrl: imageUrl.trim() || undefined },
      ...(combo ? {} : { stock: stockValue, sold: 0 }),
    }),
    onSuccess: (saved) => {
      toast.success(combo ? 'Đã cập nhật combo' : 'Đã thêm combo', `${saved.name} · ${money(saved.price)}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'combos'] });
      void queryClient.invalidateQueries({ queryKey: ['combos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] });
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không lưu được combo', errorMessage(mutationError));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={combo ? 'Sửa combo' : 'Thêm combo bắp nước'}
      description={combo ? `${combo.name} · đã bán ${combo.sold}` : 'Tạo món mới trong quầy bắp nước.'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button disabled={invalid} loading={mutation.isPending} onClick={() => mutation.mutate()}>{combo ? 'Lưu thay đổi' : 'Thêm combo'}</Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div>
          <div
            className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 shadow-card"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            {imageUrl.trim() ? (
              <>
                <img src={imageUrl.trim()} alt="" className="absolute inset-0 h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" aria-hidden />
                <span className="relative mt-auto mb-2 line-clamp-2 px-2 text-center text-[11px] font-semibold text-white">{name || 'Tên combo'}</span>
              </>
            ) : (
              <>
                <span className="text-5xl" aria-hidden>{emoji || '🍿'}</span>
                <span className="mt-2 line-clamp-2 px-2 text-center text-[11px] font-semibold text-white">{name || 'Tên combo'}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {GRADIENTS.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                aria-pressed={from === item.from && to === item.to}
                onClick={() => { setFrom(item.from); setTo(item.to); setEmoji(item.emoji); }}
                className={`h-6 w-6 rounded-full border transition ${from === item.from && to === item.to ? 'border-white ring-2 ring-brand' : 'border-transparent hover:scale-105'}`}
                style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Input type="color" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-full p-1" aria-label="Màu bắt đầu" />
            <Input type="color" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 w-full p-1" aria-label="Màu kết thúc" />
          </div>
          <Input value={emoji} onChange={(event) => setEmoji(event.target.value)} maxLength={4} className="mt-1.5 text-center" aria-label="Biểu tượng combo" />
          <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/combos/combo-solo.jpg" className="mt-1.5 text-[11px]" aria-label="Ảnh combo" />
        </div>

        <div className="space-y-3">
          <Field label="Tên combo" htmlFor="combo-name" required>
            <Input id="combo-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Combo Solo" autoFocus />
          </Field>
          <Field label="Mô tả" htmlFor="combo-description">
            <Textarea id="combo-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="1 bắp rang bơ vừa + 1 nước ngọt 22oz" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá bán" htmlFor="combo-price" required>
              <Input id="combo-price" type="number" min={0} step={1000} value={price} onChange={(event) => setPrice(event.target.value)} />
            </Field>
            <Field label="Danh mục" htmlFor="combo-category">
              <Select id="combo-category" value={category} onChange={(event) => setCategory(event.target.value as Combo['category'])}>
                {Object.entries(COMBO_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            {!combo && (
              <Field label="Tồn kho ban đầu" htmlFor="combo-stock">
                <Input id="combo-stock" type="number" min={0} value={stock} onChange={(event) => setStock(event.target.value)} />
              </Field>
            )}
            <Field label="Tối đa mỗi đơn" htmlFor="combo-max">
              <Input id="combo-max" type="number" min={1} value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value)} />
            </Field>
            <Field label="Trạng thái" htmlFor="combo-status" hint={combo ? 'Tồn kho điều chỉnh qua nút Kho.' : undefined}>
              <Select id="combo-status" value={status} onChange={(event) => setStatus(event.target.value as Combo['status'])}>
                <option value="active">Đang bán</option>
                <option value="hidden">Đang ẩn</option>
              </Select>
            </Field>
          </div>
          {combo && (
            <p className="flex items-center gap-1.5 rounded-lg border border-info/25 bg-info/5 p-2.5 text-[11px] text-info">
              <Popcorn className="h-3.5 w-3.5" />Tồn kho hiện tại: {combo.stock}. Dùng chức năng điều chỉnh kho để ghi nhận lý do.
            </p>
          )}
          {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
