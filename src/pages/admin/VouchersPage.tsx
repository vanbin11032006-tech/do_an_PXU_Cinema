import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  History, Pause, Pencil, Play, Plus, Search, TicketPercent, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { listVouchers, saveVoucher, voucherUsages } from '@/api';
import type { Voucher, VoucherType, VoucherUsage } from '@/types/domain';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate, formatDateTime, money, number, todayISO } from '@/lib/format';
import { addDaysISO } from '@/lib/datetime';
import {
  Badge, Button, Chip, DataTable, Drawer, EmptyState, ErrorState, Field, Input, Modal, PageHeader,
  Progress, Select, Skeleton, StatusBadge, toast, type Column,
} from '@/components/ui';
import { StatCard } from './system/StatCard';

type VoucherRow = Voucher & { usageCount: number; revenue: number };
interface VoucherUsageRow extends VoucherUsage {
  bookingCode: string;
  customerName: string;
}
type StatusFilter = 'all' | 'active' | 'paused' | 'expired';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Tất cả',
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  expired: 'Hết hạn',
};

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);
  const [usageCode, setUsageCode] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['admin', 'vouchers'], queryFn: listVouchers });

  const toggle = useMutation({
    mutationFn: (voucher: VoucherRow) => saveVoucher({
      id: voucher.id,
      code: voucher.code,
      label: voucher.label,
      type: voucher.type,
      value: voucher.value,
      minOrder: voucher.minOrder,
      maxDiscount: voucher.maxDiscount,
      startsAt: voucher.startsAt,
      expiresAt: voucher.expiresAt,
      totalUses: voucher.totalUses,
      perUser: voucher.perUser,
      applyTo: voucher.applyTo,
      status: voucher.status === 'active' ? 'paused' : 'active',
    }),
    onSuccess: (voucher) => {
      toast.success(
        voucher.status === 'active' ? 'Đã kích hoạt voucher' : 'Đã tạm dừng voucher',
        `Mã ${voucher.code} đã được cập nhật.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
    onError: (error) => toast.error('Không cập nhật được voucher', errorMessage(error)),
  });

  const rows = query.data ?? [];
  const summary = useMemo(() => {
    const active = rows.filter((v) => v.status === 'active' && new Date(v.expiresAt).getTime() >= Date.now());
    return {
      total: rows.length,
      active: active.length,
      usages: rows.reduce((sum, v) => sum + v.usageCount, 0),
      revenue: rows.reduce((sum, v) => sum + v.revenue, 0),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((voucher) => {
      const expired = new Date(voucher.expiresAt).getTime() < Date.now();
      if (statusFilter === 'active' && (voucher.status !== 'active' || expired)) return false;
      if (statusFilter === 'paused' && voucher.status !== 'paused') return false;
      if (statusFilter === 'expired' && !expired) return false;
      if (!needle) return true;
      return voucher.code.toLowerCase().includes(needle) || voucher.label.toLowerCase().includes(needle);
    });
  }, [rows, search, statusFilter]);

  const columns: Column<VoucherRow>[] = [
    {
      key: 'code',
      header: 'Mã / Chương trình',
      sortValue: (v) => v.code,
      render: (v) => (
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold tracking-wide text-brand">{v.code}</p>
          <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted" title={v.label}>{v.label}</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Giá trị',
      sortValue: (v) => v.value,
      render: (v) => (
        <div>
          <p className="font-semibold text-ink">{v.type === 'percent' ? `${v.value}%` : money(v.value)}</p>
          {v.type === 'percent' && v.maxDiscount > 0 && (
            <p className="text-[11px] text-muted">tối đa {money(v.maxDiscount)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'minOrder',
      header: 'Đơn tối thiểu',
      align: 'right',
      sortValue: (v) => v.minOrder,
      render: (v) => <span className="text-money text-ink2">{v.minOrder > 0 ? money(v.minOrder) : 'Không yêu cầu'}</span>,
    },
    {
      key: 'usage',
      header: 'Đã dùng',
      render: (v) => {
        const pct = v.totalUses > 0 ? Math.round((v.usedCount / v.totalUses) * 100) : 0;
        return (
          <div className="min-w-[128px]">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted">
              <span className="text-money">{number(v.usedCount)}/{number(v.totalUses)}</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} tone={pct >= 90 ? 'gold' : 'brand'} />
            <p className="mt-1 text-[11px] text-muted">{v.perUser} lượt/khách</p>
          </div>
        );
      },
    },
    {
      key: 'validity',
      header: 'Hiệu lực',
      sortValue: (v) => v.expiresAt,
      render: (v) => {
        const expired = new Date(v.expiresAt).getTime() < Date.now();
        return (
          <div className="text-xs">
            <p className="text-ink2">{formatDate(v.startsAt)} → {formatDate(v.expiresAt)}</p>
            <p className={expired ? 'text-danger' : 'text-muted'}>
              {expired ? 'Đã hết hạn' : `Còn ${Math.max(0, Math.ceil((new Date(v.expiresAt).getTime() - Date.now()) / 86_400_000))} ngày`}
            </p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (v) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={v.status} />
          {new Date(v.expiresAt).getTime() < Date.now() && <Badge tone="danger">Hết hạn</Badge>}
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Doanh thu',
      align: 'right',
      sortValue: (v) => v.revenue,
      render: (v) => (
        <div className="text-right">
          <p className="text-money font-semibold text-gold">{money(v.revenue)}</p>
          <p className="text-[11px] text-muted">{number(v.usageCount)} lượt áp dụng</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (v) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Sửa voucher ${v.code}`} onClick={() => { setEditing(v); setFormOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={v.status === 'active' ? `Tạm dừng voucher ${v.code}` : `Kích hoạt voucher ${v.code}`}
            disabled={toggle.isPending && toggle.variables?.id === v.id}
            onClick={() => toggle.mutate(v)}
          >
            {v.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Xem lượt dùng voucher ${v.code}`} onClick={() => setUsageCode(v.code)}>
            <History className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Voucher & khuyến mãi"
        description="Quản lý mã giảm giá, hạn mức sử dụng và theo dõi doanh thu theo từng chương trình."
        actions={(
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
            Tạo voucher
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tổng voucher" value={number(summary.total)} hint={`${number(summary.active)} đang hoạt động`} icon={<TicketPercent className="h-4 w-4" />} />
        <StatCard label="Lượt áp dụng" value={number(summary.usages)} hint="Các lượt chưa hoàn" icon={<Users className="h-4 w-4" />} tone="info" />
        <StatCard label="Doanh thu mang lại" value={money(summary.revenue)} hint="Theo đơn đã áp dụng" icon={<Wallet className="h-4 w-4" />} tone="gold" />
        <StatCard label="Hiệu suất" value={`${summary.total ? Math.round((summary.active / summary.total) * 100) : 0}%`} hint="Tỷ lệ voucher đang chạy" icon={<TrendingUp className="h-4 w-4" />} tone="success" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
            <Chip key={key} active={statusFilter === key} onClick={() => setStatusFilter(key)}>{STATUS_LABEL[key]}</Chip>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã hoặc tên chương trình…" className="pl-9" aria-label="Tìm voucher" />
        </div>
      </div>

      {query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(v) => v.id}
          loading={query.isLoading}
          empty={rows.length ? 'Không có voucher phù hợp bộ lọc.' : 'Chưa có voucher nào.'}
          emptyAction={!rows.length ? <Button variant="outline" size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>Tạo voucher đầu tiên</Button> : undefined}
          mobileCard={(v) => {
            const pct = v.totalUses > 0 ? Math.round((v.usedCount / v.totalUses) * 100) : 0;
            return (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-base font-bold text-brand">{v.code}</p>
                    <p className="truncate text-xs text-muted">{v.label}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted">Giá trị</p>
                    <p className="font-semibold text-ink">{v.type === 'percent' ? `${v.value}%` : money(v.value)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Đơn tối thiểu</p>
                    <p className="text-ink2">{v.minOrder > 0 ? money(v.minOrder) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted">Hiệu lực</p>
                    <p className="text-ink2">{formatDate(v.startsAt)} → {formatDate(v.expiresAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted">Doanh thu</p>
                    <p className="text-money font-semibold text-gold">{money(v.revenue)}</p>
                  </div>
                </div>
                <Progress value={pct} tone={pct >= 90 ? 'gold' : 'brand'} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">{number(v.usedCount)}/{number(v.totalUses)} lượt · {v.perUser}/khách</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setFormOpen(true); }}>Sửa</Button>
                    <Button variant="ghost" size="sm" disabled={toggle.isPending && toggle.variables?.id === v.id} onClick={() => toggle.mutate(v)}>
                      {v.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUsageCode(v.code)}>Lượt dùng</Button>
                  </div>
                </div>
              </div>
            );
          }}
        />
      )}

      {formOpen && (
        <VoucherFormModal
          voucher={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
      <VoucherUsagesDrawer code={usageCode} onClose={() => setUsageCode(null)} />
    </div>
  );
}

interface VoucherFormState {
  code: string;
  label: string;
  type: VoucherType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  totalUses: string;
  perUser: string;
  applyTo: Voucher['applyTo'];
  status: Voucher['status'];
}

function VoucherFormModal({ voucher, onClose }: { voucher: VoucherRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<VoucherFormState>(() => ({
    code: voucher?.code ?? '',
    label: voucher?.label ?? '',
    type: voucher?.type ?? 'percent',
    value: voucher ? String(voucher.value) : '10',
    minOrder: voucher ? String(voucher.minOrder) : '0',
    maxDiscount: voucher ? String(voucher.maxDiscount) : '0',
    startsAt: voucher?.startsAt.slice(0, 10) ?? todayISO(),
    expiresAt: voucher?.expiresAt.slice(0, 10) ?? addDaysISO(todayISO(), 30),
    totalUses: voucher ? String(voucher.totalUses) : '100',
    perUser: voucher ? String(voucher.perUser) : '1',
    applyTo: voucher?.applyTo ?? 'all',
    status: voucher?.status ?? 'active',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const update = (changes: Partial<VoucherFormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const mutation = useMutation({
    mutationFn: saveVoucher,
    onSuccess: (saved) => {
      toast.success(voucher ? 'Đã cập nhật voucher' : 'Đã tạo voucher', `Mã ${saved.code} đã được lưu.`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
      onClose();
    },
    onError: (error) => {
      setErrors((prev) => ({ ...prev, ...fieldErrors(error) }));
      setFormError(errorMessage(error));
      toast.error('Không lưu được voucher', errorMessage(error));
    },
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    const minOrder = Number(form.minOrder);
    const maxDiscount = Number(form.maxDiscount);
    const totalUses = Number(form.totalUses);
    const perUser = Number(form.perUser);

    if (!/^[A-Z0-9]{3,20}$/.test(code)) next.code = 'Mã gồm 3–20 ký tự chữ và số.';
    if (form.label.trim().length < 3) next.label = 'Nhập tên chương trình tối thiểu 3 ký tự.';
    if (form.type === 'percent' && (!Number.isFinite(value) || value <= 0 || value > 100)) next.value = 'Phần trăm giảm phải từ 1–100.';
    if (form.type === 'fixed' && (!Number.isFinite(value) || value <= 0)) next.value = 'Giá trị giảm phải lớn hơn 0.';
    if (!Number.isFinite(minOrder) || minOrder < 0) next.minOrder = 'Không được âm.';
    if (!Number.isFinite(maxDiscount) || maxDiscount < 0) next.maxDiscount = 'Không được âm.';
    if (!Number.isInteger(totalUses) || totalUses < 1) next.totalUses = 'Tối thiểu 1 lượt.';
    if (!Number.isInteger(perUser) || perUser < 1 || perUser > totalUses) next.perUser = 'Từ 1 đến tổng số lượt.';
    if (!form.startsAt) next.startsAt = 'Chọn ngày bắt đầu.';
    if (!form.expiresAt) next.expiresAt = 'Chọn ngày kết thúc.';
    if (form.startsAt && form.expiresAt && form.expiresAt <= form.startsAt) next.expiresAt = 'Phải sau ngày bắt đầu.';

    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    mutation.mutate({
      id: voucher?.id,
      code,
      label: form.label.trim(),
      type: form.type,
      value,
      minOrder,
      maxDiscount,
      startsAt: `${form.startsAt}T00:00:00.000Z`,
      expiresAt: `${form.expiresAt}T23:59:59.000Z`,
      totalUses,
      perUser,
      applyTo: form.applyTo,
      status: form.status,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={voucher ? `Sửa voucher ${voucher.code}` : 'Tạo voucher mới'}
      description="Thiết lập giá trị giảm, điều kiện áp dụng và giới hạn sử dụng."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button form="voucher-form" type="submit" loading={mutation.isPending}>
            {voucher ? 'Lưu thay đổi' : 'Tạo voucher'}
          </Button>
        </div>
      )}
    >
      <form
        id="voucher-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <Field label="Mã voucher" htmlFor="voucher-code" required error={errors.code} hint="Chữ và số, không dấu cách.">
          <Input
            id="voucher-code"
            value={form.code}
            error={Boolean(errors.code)}
            maxLength={20}
            autoComplete="off"
            placeholder="VD: PXU10"
            onChange={(e) => update({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
        </Field>
        <Field label="Tên chương trình" htmlFor="voucher-label" required error={errors.label}>
          <Input id="voucher-label" value={form.label} error={Boolean(errors.label)} placeholder="VD: Giảm 10% tối đa 50K" onChange={(e) => update({ label: e.target.value })} />
        </Field>
        <Field label="Loại giảm giá" htmlFor="voucher-type" required>
          <Select id="voucher-type" value={form.type} onChange={(e) => update({ type: e.target.value as VoucherType })}>
            <option value="percent">Phần trăm (%)</option>
            <option value="fixed">Số tiền cố định</option>
          </Select>
        </Field>
        <Field
          label={form.type === 'percent' ? 'Phần trăm giảm' : 'Số tiền giảm'}
          htmlFor="voucher-value"
          required
          error={errors.value}
          hint={form.type === 'percent' ? 'Từ 1 đến 100.' : 'Đơn vị VNĐ.'}
        >
          <Input
            id="voucher-value"
            type="number"
            min={form.type === 'percent' ? 1 : 1000}
            max={form.type === 'percent' ? 100 : undefined}
            step={form.type === 'percent' ? 1 : 1000}
            value={form.value}
            error={Boolean(errors.value)}
            onChange={(e) => update({ value: e.target.value })}
          />
        </Field>
        <Field label="Đơn tối thiểu (VNĐ)" htmlFor="voucher-min" error={errors.minOrder} hint="0 = không yêu cầu.">
          <Input id="voucher-min" type="number" min={0} step={1000} value={form.minOrder} error={Boolean(errors.minOrder)} onChange={(e) => update({ minOrder: e.target.value })} />
        </Field>
        <Field label="Giảm tối đa (VNĐ)" htmlFor="voucher-max" error={errors.maxDiscount} hint="0 = không giới hạn mức giảm.">
          <Input id="voucher-max" type="number" min={0} step={1000} value={form.maxDiscount} error={Boolean(errors.maxDiscount)} onChange={(e) => update({ maxDiscount: e.target.value })} />
        </Field>
        <Field label="Bắt đầu" htmlFor="voucher-start" required error={errors.startsAt}>
          <Input id="voucher-start" type="date" value={form.startsAt} error={Boolean(errors.startsAt)} onChange={(e) => update({ startsAt: e.target.value })} />
        </Field>
        <Field label="Kết thúc" htmlFor="voucher-end" required error={errors.expiresAt}>
          <Input id="voucher-end" type="date" value={form.expiresAt} error={Boolean(errors.expiresAt)} onChange={(e) => update({ expiresAt: e.target.value })} />
        </Field>
        <Field label="Tổng lượt sử dụng" htmlFor="voucher-total" required error={errors.totalUses}>
          <Input id="voucher-total" type="number" min={1} step={1} value={form.totalUses} error={Boolean(errors.totalUses)} onChange={(e) => update({ totalUses: e.target.value })} />
        </Field>
        <Field label="Lượt mỗi khách" htmlFor="voucher-per-user" required error={errors.perUser}>
          <Input id="voucher-per-user" type="number" min={1} step={1} value={form.perUser} error={Boolean(errors.perUser)} onChange={(e) => update({ perUser: e.target.value })} />
        </Field>
        <Field label="Phạm vi áp dụng" htmlFor="voucher-scope">
          <Select id="voucher-scope" value={form.applyTo} onChange={(e) => update({ applyTo: e.target.value as Voucher['applyTo'] })}>
            <option value="all">Toàn bộ đơn hàng</option>
            <option value="tickets">Chỉ tiền vé</option>
          </Select>
        </Field>
        <Field label="Trạng thái" htmlFor="voucher-status">
          <Select id="voucher-status" value={form.status} onChange={(e) => update({ status: e.target.value as Voucher['status'] })}>
            <option value="active">Đang chạy</option>
            <option value="paused">Tạm dừng</option>
          </Select>
        </Field>
        <div className="sm:col-span-2 rounded-lg border border-brand/25 bg-brand/5 p-3 text-sm text-ink2">
          <p className="font-semibold text-brand">Tóm tắt ưu đãi</p>
          <p className="mt-1 leading-relaxed">
            Giảm {form.type === 'percent' ? `${form.value || 0}%` : money(Number(form.value) || 0)}
            {form.type === 'percent' && Number(form.maxDiscount) > 0 ? ` (tối đa ${money(Number(form.maxDiscount))})` : ''}
            {' '}cho đơn từ {money(Number(form.minOrder) || 0)}. Mỗi khách dùng tối đa {form.perUser || 0} lượt,
            tổng cộng {form.totalUses || 0} lượt.
          </p>
        </div>
        {formError && Object.keys(errors).length === 0 && (
          <p className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>
        )}
      </form>
    </Modal>
  );
}

function VoucherUsagesDrawer({ code, onClose }: { code: string | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['admin', 'vouchers', code, 'usages'],
    queryFn: () => voucherUsages(code ?? ''),
    enabled: Boolean(code),
  });

  const usageColumns: Column<VoucherUsageRow>[] = [
    {
      key: 'booking',
      header: 'Đơn hàng',
      render: (usage) => (
        <Link to={`/admin/don-hang/${usage.bookingId}`} className="font-mono text-sm font-semibold text-brand hover:underline">
          {usage.bookingCode}
        </Link>
      ),
    },
    { key: 'customer', header: 'Khách hàng', render: (usage) => <span className="text-ink2">{usage.customerName}</span> },
    { key: 'discount', header: 'Giảm giá', align: 'right', render: (usage) => <span className="text-money font-semibold text-gold">{money(usage.discount)}</span> },
    { key: 'at', header: 'Thời điểm', align: 'right', render: (usage) => <span className="text-xs text-muted">{formatDateTime(usage.at)}</span> },
    {
      key: 'state',
      header: 'Trạng thái',
      align: 'right',
      render: (usage) => (usage.reverted ? <Badge tone="warning">Đã hoàn</Badge> : <Badge tone="success">Đã áp dụng</Badge>),
    },
  ];

  return (
    <Drawer
      open={Boolean(code)}
      onClose={onClose}
      width="lg"
      title={`Lượt sử dụng ${code ?? ''}`}
      footer={<Button variant="secondary" full onClick={onClose}>Đóng</Button>}
    >
      {query.isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
      ) : !query.data?.length ? (
        <EmptyState title="Chưa có lượt sử dụng" description="Voucher này chưa được áp dụng cho đơn hàng nào." />
      ) : (
        <DataTable
          columns={usageColumns}
          rows={query.data}
          rowKey={(usage) => usage.id}
          empty="Chưa có lượt sử dụng."
          mobileCard={(usage) => (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/admin/don-hang/${usage.bookingId}`} className="font-mono font-semibold text-brand">{usage.bookingCode}</Link>
                {usage.reverted ? <Badge tone="warning">Đã hoàn</Badge> : <Badge tone="success">Đã áp dụng</Badge>}
              </div>
              <p className="text-ink2">{usage.customerName}</p>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{formatDateTime(usage.at)}</span>
                <span className="text-money font-semibold text-gold">{money(usage.discount)}</span>
              </div>
            </div>
          )}
        />
      )}
    </Drawer>
  );
}
