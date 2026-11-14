import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Info, Popcorn, ShoppingBag } from 'lucide-react';
import { listCombos } from '@/api';
import { useDocumentTitle } from '@/hooks';
import type { Combo } from '@/types/domain';
import { EmptyState, Tabs } from '@/components/ui';
import { PageHero } from './components/PageHero';
import { ComboCard } from './components/ComboCard';
import { ActionLink } from './components/ActionLink';
import { CardGridSkeleton, SectionError } from './components/States';

type CategoryTab = 'all' | Combo['category'];

const CATEGORY_LABEL: Record<Combo['category'], string> = {
  combo: 'Combo tiết kiệm',
  popcorn: 'Bắp',
  drink: 'Nước',
  snack: 'Ăn vặt',
};

export default function CombosPublicPage() {
  useDocumentTitle('Bắp nước & combo');
  const [category, setCategory] = useState<CategoryTab>('all');

  const combosQuery = useQuery({ queryKey: ['public', 'combos'], queryFn: listCombos });
  const combos = combosQuery.data ?? [];
  const visible = category === 'all' ? combos : combos.filter((combo) => combo.category === category);

  const tabs: { value: CategoryTab; label: string; count: number }[] = [
    { value: 'all', label: 'Tất cả', count: combos.length },
    ...(Object.keys(CATEGORY_LABEL) as Combo['category'][]).map((key) => ({
      value: key,
      label: CATEGORY_LABEL[key],
      count: combos.filter((combo) => combo.category === key).length,
    })),
  ];

  return (
    <div>
      <PageHero
        eyebrow="Bắp nước & combo"
        title="Trọn vị cho buổi xem phim"
        description="Chọn combo trước khi thanh toán để nhận nhanh tại quầy, tiết kiệm thời gian và giữ trọn khoảnh khắc trong rạp."
        breadcrumb={<nav aria-label="Đường dẫn" className="flex items-center gap-1.5 text-xs text-muted"><Link to="/" className="hover:text-ink">Trang chủ</Link><span aria-hidden>›</span><span className="text-ink2">Bắp nước</span></nav>}
        actions={<ActionLink to="/lich-chieu" icon={<Popcorn className="h-4 w-4" />}>Đặt vé & chọn combo</ActionLink>}
      />

      <div className="container-page py-8 sm:py-10">
        <Tabs items={tabs} value={category} onChange={setCategory} variant="pill" className="mb-6 w-fit max-w-full" />

        <div className="mb-5 flex items-start gap-3 rounded-card border border-info/30 bg-info/5 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            <p className="text-sm font-semibold text-ink">Nhận combo tại quầy bắp nước</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Sau khi hoàn tất thanh toán, xuất trình mã đơn hàng trong mục “Vé của tôi” tại quầy để nhận combo. Combo chỉ nhận một lần
              và không hoàn tiền sau khi đã nhận.
            </p>
          </div>
        </div>

        {combosQuery.isLoading ? (
          <CardGridSkeleton count={8} className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
        ) : combosQuery.isError ? (
          <SectionError error={combosQuery.error} onRetry={() => void combosQuery.refetch()} title="Không tải được combo" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Chưa có combo trong nhóm này"
            description="Các combo bắp nước và đồ ăn nhẹ đang được cập nhật. Hãy chọn nhóm khác để xem ưu đãi hiện có."
            action={<button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setCategory('all')}>Xem tất cả combo</button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((combo) => (
              <ComboCard
                key={combo.id}
                combo={combo}
                action={combo.stock > 0 ? (
                  <ActionLink to="/lich-chieu" size="sm" variant="outline">Đặt vé & chọn</ActionLink>
                ) : (
                  <span className="text-xs font-semibold text-danger">Tạm hết hàng</span>
                )}
              />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-card border border-line/60 bg-surface/50 px-6 py-7 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">Muốn đổi combo sau khi đặt vé?</p>
            <p className="mt-1 text-sm text-muted">Bạn có thể thêm hoặc thay đổi combo trong thời gian giữ ghế ở bước thanh toán.</p>
          </div>
          <ActionLink to="/lich-chieu" variant="secondary">Xem lịch chiếu</ActionLink>
        </div>
      </div>
    </div>
  );
}
