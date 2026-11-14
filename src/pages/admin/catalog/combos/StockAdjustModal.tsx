import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Boxes, PackageMinus, PackagePlus } from 'lucide-react';
import type { Combo } from '@/types/domain';
import { adjustComboStock } from '@/api';
import { errorMessage } from '@/lib/errors';
import { Button, Field, Input, Modal, Textarea, toast } from '@/components/ui';

export function StockAdjustModal({ open, onClose, combo }: {
  open: boolean; onClose: () => void; combo: Combo | null;
}) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDelta('');
    setReason('');
    setError(null);
  }, [open, combo?.id]);

  const deltaValue = Number(delta);
  const validDelta = delta.trim() !== '' && Number.isInteger(deltaValue) && deltaValue !== 0;
  const nextStock = combo && validDelta ? Math.max(0, combo.stock + deltaValue) : combo?.stock ?? 0;
  const invalid = !validDelta || !reason.trim();

  const mutation = useMutation({
    mutationFn: () => adjustComboStock(combo!.id, deltaValue, reason.trim()),
    onSuccess: (saved) => {
      toast.success('Đã điều chỉnh kho', `${saved.name}: còn ${saved.stock} sản phẩm.`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'combos'] });
      void queryClient.invalidateQueries({ queryKey: ['combos'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'badges'] });
      onClose();
    },
    onError: (mutationError: unknown) => {
      setError(errorMessage(mutationError));
      toast.error('Không điều chỉnh được kho', errorMessage(mutationError));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Điều chỉnh tồn kho"
      description={combo ? `${combo.name} · hiện còn ${combo.stock}` : undefined}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button
            variant={deltaValue < 0 ? 'danger' : 'primary'}
            icon={deltaValue < 0 ? <PackageMinus className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
            disabled={invalid}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Xác nhận điều chỉnh
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-line bg-base/40 p-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Hiện tại</p>
            <p className="font-display text-xl font-bold text-ink">{combo?.stock ?? 0}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Thay đổi</p>
            <p className={`font-display text-xl font-bold ${deltaValue > 0 ? 'text-success' : deltaValue < 0 ? 'text-danger' : 'text-ink2'}`}>
              {validDelta ? `${deltaValue > 0 ? '+' : ''}${deltaValue}` : '0'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">Sau điều chỉnh</p>
            <p className="font-display text-xl font-bold text-brand">{nextStock}</p>
          </div>
        </div>

        <Field label="Số lượng thay đổi" htmlFor="stock-delta" required hint="Nhập số âm để giảm, số dương để nhập thêm. Không vượt quá tồn kho hiện tại khi giảm.">
          <Input
            id="stock-delta"
            type="number"
            step={1}
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
            placeholder="Ví dụ: 50 hoặc -10"
            error={delta.trim() !== '' && !validDelta}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[10, 50, 100, -10, -50].map((value) => (
            <Button key={value} type="button" variant="subtle" size="sm" onClick={() => setDelta(String(value))}>
              {value > 0 ? `+${value}` : value}
            </Button>
          ))}
        </div>

        <Field label="Lý do điều chỉnh" htmlFor="stock-reason" required>
          <Textarea
            id="stock-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Nhập thêm hàng từ nhà cung cấp, hao hụt do hết hạn…"
            error={reason.length > 0 && !reason.trim()}
          />
        </Field>
        <p className="flex items-start gap-1.5 text-[11px] text-muted"><Boxes className="mt-0.5 h-3.5 w-3.5 shrink-0" />Lý do được ghi vào nhật ký kho để đối soát sau này.</p>
        {error && <p className="rounded-lg border border-danger/35 bg-danger/5 p-3 text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
