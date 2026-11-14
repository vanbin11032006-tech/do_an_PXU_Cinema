import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Save, Tags } from 'lucide-react';
import type { PriceRule, RoomType } from '@/types/domain';
import { listCinemasAdmin, listPriceRules, listRooms, savePriceRules } from '@/api';
import { errorMessage } from '@/lib/errors';
import { money } from '@/lib/format';
import { Button, Card, ErrorState, PageHeader, Skeleton, toast } from '@/components/ui';
import { PriceMatrix } from './catalog/pricing/PriceMatrix';
import { PriceSimulator } from './catalog/pricing/PriceSimulator';
import { ROOM_TYPES, StatTile } from './catalog/shared';

function signatureOfRules(rules: PriceRule[]): string {
  return rules
    .map((rule) => `${rule.dayType}:${rule.slot}:${rule.roomType}:${rule.price}:${rule.active ? 1 : 0}`)
    .sort()
    .join('|');
}

export default function PricingAdminPage() {
  const queryClient = useQueryClient();
  const [roomType, setRoomType] = useState<RoomType>('2D');
  const [draft, setDraft] = useState<PriceRule[] | null>(null);
  const [baseline, setBaseline] = useState<PriceRule[] | null>(null);
  const [initialSignature, setInitialSignature] = useState('');

  const rulesQuery = useQuery({ queryKey: ['admin', 'price-rules'], queryFn: listPriceRules, refetchOnWindowFocus: false });
  const roomsQuery = useQuery({ queryKey: ['admin', 'rooms'], queryFn: () => listRooms(), staleTime: 120_000 });
  const cinemasQuery = useQuery({ queryKey: ['admin', 'cinemas'], queryFn: listCinemasAdmin, staleTime: 120_000 });

  useEffect(() => {
    if (!rulesQuery.data) return;
    const snapshot = rulesQuery.data.map((rule) => ({ ...rule }));
    setDraft(snapshot);
    setBaseline(snapshot);
    setInitialSignature(signatureOfRules(rulesQuery.data));
  }, [rulesQuery.data]);

  const mutation = useMutation({
    mutationFn: (rules: PriceRule[]) => savePriceRules(rules),
    onSuccess: (saved) => {
      const snapshot = saved.map((rule) => ({ ...rule }));
      setDraft(snapshot);
      setBaseline(snapshot);
      setInitialSignature(signatureOfRules(saved));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'price-rules'] });
      toast.success('Đã lưu bảng giá', `${saved.length} khung giá được cập nhật.`);
    },
    onError: (error: unknown) => toast.error('Không lưu được bảng giá', errorMessage(error)),
  });

  const currentSig = draft ? signatureOfRules(draft) : '';
  const dirty = Boolean(draft) && currentSig !== initialSignature;
  const invalidRules = useMemo(() => (draft ?? []).filter((rule) => rule.active && (!Number.isFinite(rule.price) || rule.price <= 0)), [draft]);
  const visibleRules = (draft ?? []).filter((rule) => rule.roomType === roomType && rule.active && rule.price > 0);
  const minPrice = visibleRules.length ? Math.min(...visibleRules.map((rule) => rule.price)) : 0;
  const maxPrice = visibleRules.length ? Math.max(...visibleRules.map((rule) => rule.price)) : 0;
  const holidayCount = (draft ?? []).filter((rule) => rule.dayType === 'holiday').length;

  const resetDraft = () => {
    if (!baseline) return;
    setDraft(baseline.map((rule) => ({ ...rule })));
    setInitialSignature(signatureOfRules(baseline));
  };

  if (rulesQuery.isLoading) {
    return (
      <div>
        <PageHeader title="Bảng giá" description="Cấu hình giá theo ngày, khung giờ và loại phòng." />
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
      </div>
    );
  }

  if (rulesQuery.isError) {
    return (
      <div>
        <PageHeader title="Bảng giá" />
        <ErrorState message={errorMessage(rulesQuery.error)} onRetry={() => void rulesQuery.refetch()} />
      </div>
    );
  }

  if (!draft) {
    return (
      <div>
        <PageHeader title="Bảng giá" description="Cấu hình giá theo ngày, khung giờ và loại phòng." />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bảng giá vé"
        description="Giá gốc theo khung giờ, phụ thu phòng và ghế được áp dụng tự động khi tạo suất chiếu."
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} disabled={!dirty || mutation.isPending} onClick={resetDraft}>Hoàn tác</Button>
            <Button
              icon={<Save className="h-4 w-4" />}
              disabled={!dirty || invalidRules.length > 0}
              loading={mutation.isPending}
              onClick={() => mutation.mutate(draft)}
            >
              Lưu bảng giá
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Khung giá đang cấu hình" value={(draft ?? []).length} icon={<Tags className="h-5 w-5" />} hint={`${ROOM_TYPES.length} loại phòng`} />
        <StatTile label={`Giá thấp nhất · ${roomType}`} value={visibleRules.length ? money(minPrice) : '—'} tone="success" hint="Các khung đang bật" />
        <StatTile label={`Giá cao nhất · ${roomType}`} value={visibleRules.length ? money(maxPrice) : '—'} tone="warning" hint="Các khung đang bật" />
        <StatTile label="Khung ngày lễ" value={holidayCount} tone="info" hint="Giữ nguyên khi lưu" />
      </div>

      {invalidRules.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-card border border-danger/35 bg-danger/5 p-3 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{invalidRules.length} khung giá chưa hợp lệ.</p>
            <p className="mt-0.5 text-ink2">Giá vé phải lớn hơn 0 trước khi lưu. Kiểm tra các ô còn trống hoặc đang tắt.</p>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <PriceMatrix rules={draft} onChange={setDraft} roomType={roomType} onRoomTypeChange={setRoomType} />
          <Card className="p-4">
            <p className="text-xs font-semibold text-ink">Quy tắc áp dụng</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Giá ngày thường và cuối tuần áp dụng theo ngày chiếu; ngày lễ giữ cấu hình riêng nếu đã có.</li>
              <li>• Phòng 3D/IMAX/4DX/Gold Class cộng thêm phụ thu loại phòng vào giá cơ bản.</li>
              <li>• Ghế VIP và ghế đôi cộng phụ thu ghế theo cấu hình hệ thống.</li>
              <li>• Giá cuối cùng luôn do API tính; màn hình mô phỏng chỉ để đối chiếu.</li>
            </ul>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4">
          <PriceSimulator rooms={roomsQuery.data ?? []} cinemas={cinemasQuery.data ?? []} />
          {roomsQuery.isError && <p className="text-xs text-danger">Không tải được danh sách phòng: {errorMessage(roomsQuery.error)}</p>}
        </div>
      </div>
    </div>
  );
}
