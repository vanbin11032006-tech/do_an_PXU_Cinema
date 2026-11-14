import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Eye, EyeOff, Package, Pencil, Plus, Popcorn, Search, TriangleAlert, X } from 'lucide-react';
import type { Combo } from '@/types/domain';
import { listCombosAdmin, saveCombo } from '@/api';
import { errorMessage } from '@/lib/errors';
import { cn, money } from '@/lib/format';
import {
  Badge, Button, Card, Chip, DataTable, EmptyState, ErrorState, IconButton, Input, PageHeader,
  Select, Skeleton, StatusBadge, toast, type Column,
} from '@/components/ui';
import { ComboFormModal } from './catalog/combos/ComboFormModal';
import { StockAdjustModal } from './catalog/combos/StockAdjustModal';
import { COMBO_CATEGORY_LABELS, LOW_STOCK_THRESHOLD, StatTile } from './catalog/shared';

const CATEGORY_FILTERS: { value: Combo['category'] | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'combo', label: 'Combo' },
  { value: 'popcorn', label: 'Bắp' },
  { value: 'drink', label: 'Nước' },
  { value: 'snack', label: 'Snack' },
];

export default function CombosAdminPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Combo['category'] | 'all'>('all');
  const [status, setStatus] = useState<Combo['status'] | 'all'>('all');
  const [editorCombo, setEditorCombo] = useState<Combo | null | undefined>(undefined);
  const [stockTarget, setStockTarget] = useState<Combo | null>(null);

  const combosQuery = useQuery({ queryKey: ['admin', 'combos'], queryFn: listCombosAdmin });
  const combos = combosQuery.data ?? [];

  const toggleMutation = useMutation({
    mutationFn: (combo: Combo) => saveCombo({
      id: combo.id,
      name: combo.name,
      price: combo.price,
      category: combo.category,
      status: combo.status === 'active' ? 'hidden' : 'active',
    }),
    onSuccess: (saved) => {
      toast.success(saved.status === 'hidden' ? 'Đã ẩn combo' : 'Đã mở bán combo', saved.name);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'combos'] });
      void queryClient.invalidateQueries({ queryKey: ['combos'] });
    },
    onError: (error: unknown) => toast.error('Không đổi được trạng thái', errorMessage(error)),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return combos.filter((combo) => (
      (category === 'all' || combo.category === category)
      && (status === 'all' || combo.status === status)
      && (!needle || combo.name.toLowerCase().includes(needle) || combo.description.toLowerCase().includes(needle))
    ));
  }, [combos, category, status, q]);

  const lowStock = combos.filter((combo) => combo.stock < LOW_STOCK_THRESHOLD);
  const totalSold = combos.reduce((sum, combo) => sum + combo.sold, 0);
  const filterActive = Boolean(q.trim()) || category !== 'all' || status !== 'all';

  const columns: Column<Combo>[] = [
    {
      key: 'combo',
      header: 'Combo',
      sortValue: (combo) => combo.name,
      render: (combo) => (
        <div className="flex min-w-[220px] items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 text-2xl shadow-card" style={{ background: `linear-gradient(135deg, ${combo.art.from} 0%, ${combo.art.to} 100%)` }} aria-hidden>
            {combo.art.imageUrl
              ? <img src={combo.art.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
              : combo.art.emoji}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{combo.name}</p>
            <p className="line-clamp-1 text-[11px] text-muted">{combo.description || '—'}</p>
            <p className="mt-0.5 text-[10px] text-muted">Tối đa {combo.maxPerOrder}/đơn</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Danh mục',
      render: (combo) => <Badge tone="outline">{COMBO_CATEGORY_LABELS[combo.category]}</Badge>,
    },
    {
      key: 'price',
      header: 'Giá bán',
      align: 'right',
      sortValue: (combo) => combo.price,
      render: (combo) => <span className="text-money text-sm font-semibold text-ink">{money(combo.price)}</span>,
    },
    {
      key: 'stock',
      header: 'Tồn kho',
      align: 'center',
      sortValue: (combo) => combo.stock,
      render: (combo) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className={cn('text-sm font-semibold', combo.stock === 0 ? 'text-danger' : combo.stock < LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-ink2')}>{combo.stock}</span>
          {combo.stock === 0 ? <Badge tone="danger">Hết hàng</Badge>
            : combo.stock < LOW_STOCK_THRESHOLD ? <Badge tone="warning">Sắp hết</Badge>
              : null}
        </div>
      ),
    },
    {
      key: 'sold',
      header: 'Đã bán',
      align: 'center',
      hideOnMobile: true,
      sortValue: (combo) => combo.sold,
      render: (combo) => <span className="text-money text-xs text-ink2">{combo.sold}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (combo) => <StatusBadge status={combo.status === 'active' ? 'active' : 'closed'} label={combo.status === 'active' ? 'Đang bán' : 'Đang ẩn'} />,
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (combo) => {
        const toggling = toggleMutation.isPending && toggleMutation.variables?.id === combo.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <IconButton label={`Sửa ${combo.name}`} size="sm" onClick={() => setEditorCombo(combo)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label={`Điều chỉnh kho ${combo.name}`} size="sm" onClick={() => setStockTarget(combo)}>
              <Boxes className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={combo.status === 'active' ? `Ẩn ${combo.name}` : `Mở bán ${combo.name}`}
              size="sm"
              disabled={toggling}
              onClick={() => toggleMutation.mutate(combo)}
            >
              {combo.status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </IconButton>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bắp nước"
        description="Quản lý combo, giá bán, tồn kho và trạng thái mở bán tại quầy."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditorCombo(null)}>Thêm combo</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tổng mặt hàng" value={combos.length} icon={<Popcorn className="h-5 w-5" />} hint="Combo, bắp, nước, snack" />
        <StatTile label="Đang bán" value={combos.filter((combo) => combo.status === 'active').length} tone="success" hint="Hiển thị cho khách" />
        <StatTile label="Sắp hết hàng" value={lowStock.length} tone={lowStock.length ? 'warning' : 'muted'} icon={<TriangleAlert className="h-5 w-5" />} hint={`Dưới ${LOW_STOCK_THRESHOLD} sản phẩm`} />
        <StatTile label="Đã bán" value={totalSold.toLocaleString('vi-VN')} tone="info" icon={<Package className="h-5 w-5" />} hint="Tổng lượt bán" />
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border border-warning/30 bg-warning/5 px-4 py-3">
          <p className="flex items-center gap-2 text-xs text-warning"><TriangleAlert className="h-4 w-4" />{lowStock.length} mặt hàng dưới ngưỡng tồn kho ({LOW_STOCK_THRESHOLD}).</p>
          <div className="flex flex-wrap gap-1.5">
            {lowStock.slice(0, 4).map((combo) => (
              <button key={combo.id} type="button" onClick={() => setStockTarget(combo)} className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold text-warning hover:bg-warning/20">
                {combo.name} · {combo.stock}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_FILTERS.map((item) => (
              <Chip key={item.value} active={category === item.value} onClick={() => setCategory(item.value)} className="h-8 px-3 text-[11px]">
                {item.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm combo…" className="pl-9" aria-label="Tìm combo" />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Xóa tìm kiếm" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value as Combo['status'] | 'all')} className="sm:w-40" aria-label="Lọc trạng thái">
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang bán</option>
              <option value="hidden">Đang ẩn</option>
            </Select>
            {filterActive && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCategory('all'); setStatus('all'); }}>Xóa bộ lọc</Button>}
          </div>
        </div>
      </Card>

      {combosQuery.isLoading ? (
        <div className="space-y-2.5"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
      ) : combosQuery.isError ? (
        <ErrorState message={errorMessage(combosQuery.error)} onRetry={() => void combosQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Popcorn className="h-6 w-6" />}
          title={combos.length ? 'Không có combo phù hợp' : 'Chưa có combo nào'}
          description={combos.length ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Thêm combo bắp nước đầu tiên để bán kèm vé.'}
          action={combos.length
            ? <Button variant="secondary" onClick={() => { setQ(''); setCategory('all'); setStatus('all'); }}>Xóa bộ lọc</Button>
            : <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditorCombo(null)}>Thêm combo</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(combo) => combo.id}
          empty="Không có combo phù hợp."
          mobileCard={(combo) => (
            <div>
              <div className="flex items-start gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 text-3xl" style={{ background: `linear-gradient(135deg, ${combo.art.from} 0%, ${combo.art.to} 100%)` }} aria-hidden>
                  {combo.art.imageUrl
                    ? <img src={combo.art.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                    : combo.art.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-ink">{combo.name}</p>
                    <StatusBadge status={combo.status === 'active' ? 'active' : 'closed'} label={combo.status === 'active' ? 'Đang bán' : 'Đang ẩn'} />
                  </div>
                  <p className="line-clamp-2 text-[11px] text-muted">{combo.description || '—'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge tone="outline">{COMBO_CATEGORY_LABELS[combo.category]}</Badge>
                    <span className="text-money font-semibold text-ink">{money(combo.price)}</span>
                    <span className={cn(combo.stock < LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-muted')}>Kho {combo.stock}</span>
                    <span className="text-muted">Đã bán {combo.sold}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t border-line/50 pt-2">
                <IconButton label={`Sửa ${combo.name}`} size="sm" onClick={() => setEditorCombo(combo)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={`Điều chỉnh kho ${combo.name}`} size="sm" onClick={() => setStockTarget(combo)}><Boxes className="h-3.5 w-3.5" /></IconButton>
                <IconButton label={combo.status === 'active' ? 'Ẩn combo' : 'Mở bán combo'} size="sm" disabled={toggleMutation.isPending && toggleMutation.variables?.id === combo.id} onClick={() => toggleMutation.mutate(combo)}>
                  {combo.status === 'active' ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </IconButton>
              </div>
            </div>
          )}
        />
      )}

      <ComboFormModal
        open={editorCombo !== undefined}
        onClose={() => setEditorCombo(undefined)}
        combo={editorCombo ?? null}
      />
      <StockAdjustModal open={Boolean(stockTarget)} onClose={() => setStockTarget(null)} combo={stockTarget} />
    </div>
  );
}
