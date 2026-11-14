import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Crown, Pencil, Search, SlidersHorizontal, Users, Wallet } from 'lucide-react';
import { adjustMemberPoints, listMembers, listMembershipTiers, saveMembershipTiers } from '@/api';
import type { MemberRow } from '@/api';
import type { MembershipTier } from '@/types/domain';
import { errorMessage } from '@/lib/errors';
import { formatDate, money, number } from '@/lib/format';
import { useDebounce } from '@/hooks';
import {
  Avatar, Button, Card, DataTable, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Skeleton,
  Textarea, TierBadge, toast, type Column,
} from '@/components/ui';
import { StatCard } from './system/StatCard';

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [pointsMember, setPointsMember] = useState<MemberRow | null>(null);
  const [tierEditing, setTierEditing] = useState<MembershipTier | null>(null);

  const membersQuery = useQuery({
    queryKey: ['admin', 'members', debouncedSearch],
    queryFn: () => listMembers(debouncedSearch),
  });
  const tiersQuery = useQuery({ queryKey: ['admin', 'membership-tiers'], queryFn: listMembershipTiers });

  const rows = membersQuery.data ?? [];
  const tiers = tiersQuery.data ?? [];

  const stats = useMemo(() => {
    const spend = rows.reduce((sum, row) => sum + row.totalSpend, 0);
    const bookings = rows.reduce((sum, row) => sum + row.bookingsCount, 0);
    return { spend, bookings, average: rows.length ? Math.round(spend / rows.length) : 0 };
  }, [rows]);

  const columns: Column<MemberRow>[] = [
    {
      key: 'member',
      header: 'Thành viên',
      sortValue: (row) => row.user.name,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={row.user.name} seed={row.user.avatarSeed} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{row.user.name}</p>
            <p className="truncate text-xs text-muted">{row.user.email}</p>
            <p className="text-xs text-muted">{row.user.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Hạng',
      sortValue: (row) => row.tier.minSpend,
      render: (row) => <TierBadge tier={row.tier.key} label={row.tier.label} />,
    },
    {
      key: 'points',
      header: 'Điểm',
      align: 'right',
      sortValue: (row) => row.user.points,
      render: (row) => <span className="text-money font-semibold text-gold">{number(row.user.points)}</span>,
    },
    {
      key: 'spend',
      header: 'Tổng chi',
      align: 'right',
      sortValue: (row) => row.totalSpend,
      render: (row) => <span className="text-money font-semibold text-ink">{money(row.totalSpend)}</span>,
    },
    {
      key: 'bookings',
      header: 'Số đơn',
      align: 'right',
      sortValue: (row) => row.bookingsCount,
      render: (row) => <span className="text-ink2">{number(row.bookingsCount)}</span>,
    },
    {
      key: 'lastVisit',
      header: 'Lần ghé gần nhất',
      sortValue: (row) => row.lastVisit ?? '',
      render: (row) => (
        <span className="text-xs text-ink2">
          {row.lastVisit ? `${formatDate(row.lastVisit)} · ${row.lastVisit.slice(11, 16)}` : 'Chưa có'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          onClick={() => setPointsMember(row)}
        >
          Điểm
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thành viên"
        description="Theo dõi hạng thành viên, điểm tích lũy và điều chỉnh điểm thủ công có ghi nhật ký."
        actions={(
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, email hoặc số điện thoại…"
              className="pl-9"
              aria-label="Tìm thành viên"
            />
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Thành viên"
          value={membersQuery.isLoading ? <Skeleton className="h-6 w-16" /> : number(rows.length)}
          hint="Khách hàng đã đăng ký"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Tổng chi tiêu"
          value={membersQuery.isLoading ? <Skeleton className="h-6 w-24" /> : money(stats.spend)}
          hint="Đơn đã thanh toán"
          icon={<Wallet className="h-4 w-4" />}
          tone="gold"
        />
        <StatCard
          label="Lượt đặt vé"
          value={membersQuery.isLoading ? <Skeleton className="h-6 w-16" /> : number(stats.bookings)}
          hint="Không gồm đơn hủy"
          icon={<CalendarCheck className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Chi tiêu trung bình"
          value={membersQuery.isLoading ? <Skeleton className="h-6 w-24" /> : money(stats.average)}
          hint="Trên mỗi thành viên"
          icon={<Crown className="h-4 w-4" />}
          tone="success"
        />
      </div>

      <section aria-labelledby="tier-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="tier-heading" className="section-title text-xl">Hạng thành viên</h2>
            <p className="text-sm text-muted">Ngưỡng chi tiêu tích lũy và quyền lợi áp dụng cho toàn hệ thống.</p>
          </div>
          {tiersQuery.isError && (
            <Button variant="ghost" size="sm" onClick={() => { void tiersQuery.refetch(); }}>Thử tải lại hạng</Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiersQuery.isLoading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44 w-full" />)
            : tiers.length === 0
              ? (
                <div className="sm:col-span-2 xl:col-span-4">
                  <EmptyState title="Chưa có cấu hình hạng" description="Tải lại trang để khởi tạo bốn hạng thành viên mặc định." />
                </div>
              )
              : tiers.map((tier) => {
              const count = rows.filter((row) => row.tier.key === tier.key).length;
              return (
                <Card key={tier.key} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tier.color }} aria-hidden />
                      <TierBadge tier={tier.key} label={tier.label} />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Sửa hạng ${tier.label}`}
                      onClick={() => setTierEditing(tier)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-3 font-display text-xl font-semibold text-ink">
                    {tier.minSpend > 0 ? `Từ ${money(tier.minSpend)}` : 'Mặc định'}
                  </p>
                  <p className="text-xs text-muted">Chi tiêu tích lũy tối thiểu</p>
                  <p className="mt-2 text-xs font-semibold text-brand">{number(count)} thành viên</p>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink2">
                    {tier.perks.slice(0, 3).map((perk, index) => <li key={`${perk}-${index}`}>• {perk}</li>)}
                    {tier.perks.length > 3 && <li className="text-muted">+{tier.perks.length - 3} quyền lợi khác</li>}
                  </ul>
                </Card>
              );
            })}
        </div>
      </section>

      {membersQuery.isError ? (
        <ErrorState message={errorMessage(membersQuery.error)} onRetry={() => { void membersQuery.refetch(); }} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.user.id}
          loading={membersQuery.isLoading}
          empty={search ? 'Không tìm thấy thành viên phù hợp.' : 'Chưa có thành viên nào.'}
          emptyAction={search ? <Button variant="outline" size="sm" onClick={() => setSearch('')}>Xóa tìm kiếm</Button> : undefined}
          mobileCard={(row) => (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar name={row.user.name} seed={row.user.avatarSeed} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{row.user.name}</p>
                  <p className="truncate text-xs text-muted">{row.user.email}</p>
                  <div className="mt-1"><TierBadge tier={row.tier.key} label={row.tier.label} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted">Điểm</p><p className="text-money font-semibold text-gold">{number(row.user.points)}</p></div>
                <div><p className="text-muted">Tổng chi</p><p className="text-money font-semibold text-ink">{money(row.totalSpend)}</p></div>
                <div><p className="text-muted">Số đơn</p><p className="text-ink2">{number(row.bookingsCount)}</p></div>
                <div><p className="text-muted">Gần nhất</p><p className="text-ink2">{row.lastVisit ? formatDate(row.lastVisit) : 'Chưa có'}</p></div>
              </div>
              <Button variant="secondary" size="sm" full onClick={() => setPointsMember(row)}>Điều chỉnh điểm</Button>
            </div>
          )}
        />
      )}

      {pointsMember && (
        <AdjustPointsModal member={pointsMember} onClose={() => setPointsMember(null)} />
      )}
      {tierEditing && (
        <TierEditModal tier={tierEditing} tiers={tiers} onClose={() => setTierEditing(null)} />
      )}
    </div>
  );
}

function AdjustPointsModal({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsedDelta = Number(delta);
  const resultingPoints = member.user.points + (Number.isFinite(parsedDelta) ? parsedDelta : 0);

  const mutation = useMutation({
    mutationFn: () => adjustMemberPoints(member.user.id, parsedDelta, reason.trim()),
    onSuccess: (result) => {
      toast.success('Đã điều chỉnh điểm', result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
      onClose();
    },
    onError: (error) => toast.error('Không điều chỉnh được điểm', errorMessage(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!Number.isInteger(parsedDelta) || parsedDelta === 0) next.delta = 'Nhập số nguyên khác 0.';
    if (Number.isInteger(parsedDelta) && resultingPoints < 0) next.delta = 'Số điểm sau điều chỉnh không được âm.';
    if (reason.trim().length < 5) next.reason = 'Nhập lý do tối thiểu 5 ký tự.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Điều chỉnh điểm"
      description={`${member.user.name} · ${member.user.email}`}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>Xác nhận</Button>
        </div>
      )}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-base/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted">Điểm hiện tại</p>
            <p className="text-money mt-1 font-display text-xl font-semibold text-ink">{number(member.user.points)}</p>
          </div>
          <div className={`rounded-lg border p-3 ${resultingPoints < 0 ? 'border-danger/40 bg-danger/10' : 'border-brand/30 bg-brand/10'}`}>
            <p className="text-[11px] uppercase tracking-wider text-muted">Sau điều chỉnh</p>
            <p className={`text-money mt-1 font-display text-xl font-semibold ${resultingPoints < 0 ? 'text-danger' : 'text-brand'}`}>{number(resultingPoints)}</p>
          </div>
        </div>
        <Field label="Số điểm thay đổi" htmlFor="points-delta" required error={errors.delta} hint="Dùng số âm để trừ điểm.">
          <Input
            id="points-delta"
            type="number"
            step={1}
            value={delta}
            error={Boolean(errors.delta)}
            autoFocus
            placeholder="VD: 100 hoặc -50"
            onChange={(e) => setDelta(e.target.value)}
          />
        </Field>
        <Field label="Lý do" htmlFor="points-reason" required error={errors.reason}>
          <Textarea
            id="points-reason"
            value={reason}
            error={Boolean(errors.reason)}
            placeholder="VD: Bù điểm do sự cố suất chiếu…"
            maxLength={240}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
          Mọi thay đổi điểm đều được ghi vào nhật ký hệ thống kèm người thực hiện và lý do.
        </p>
      </form>
    </Modal>
  );
}

function TierEditModal({ tier, tiers, onClose }: { tier: MembershipTier; tiers: MembershipTier[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [minSpend, setMinSpend] = useState(String(tier.minSpend));
  const [perks, setPerks] = useState(tier.perks.join('\n'));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (next: MembershipTier[]) => saveMembershipTiers(next),
    onSuccess: () => {
      toast.success('Đã cập nhật hạng thành viên', `Quyền lợi hạng ${tier.label} đã được lưu.`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'membership-tiers'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
      onClose();
    },
    onError: (error) => toast.error('Không lưu được hạng thành viên', errorMessage(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const spend = Number(minSpend);
    const perksList = perks.split('\n').map((line) => line.trim()).filter(Boolean);

    if (!Number.isFinite(spend) || spend < 0) next.minSpend = 'Ngưỡng chi tiêu không được âm.';
    if (!perksList.length) next.perks = 'Nhập ít nhất một quyền lợi.';
    if (perksList.length > 8) next.perks = 'Tối đa 8 quyền lợi.';

    const updated = tiers.map((item) => item.key === tier.key ? { ...item, minSpend: spend, perks: perksList } : item);
    for (let index = 1; index < updated.length; index += 1) {
      if (updated[index].minSpend <= updated[index - 1].minSpend) {
        next.minSpend = 'Ngưỡng chi tiêu phải tăng dần theo thứ tự hạng.';
      }
    }

    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate(updated);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`Sửa hạng ${tier.label}`}
      description="Thay đổi ngưỡng chi tiêu và danh sách quyền lợi hiển thị cho khách hàng."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>Lưu thay đổi</Button>
        </div>
      )}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <div className="flex items-center gap-2 rounded-lg border border-line bg-base/40 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tier.color }} aria-hidden />
          <TierBadge tier={tier.key} label={tier.label} />
          <span className="ml-auto text-xs text-muted">Mã hạng: {tier.key}</span>
        </div>
        <Field label="Chi tiêu tích lũy tối thiểu (VNĐ)" htmlFor="tier-min" required error={errors.minSpend}>
          <Input
            id="tier-min"
            type="number"
            min={0}
            step={100000}
            value={minSpend}
            error={Boolean(errors.minSpend)}
            onChange={(e) => setMinSpend(e.target.value)}
          />
        </Field>
        <Field label="Quyền lợi" htmlFor="tier-perks" required error={errors.perks} hint="Mỗi dòng là một quyền lợi.">
          <Textarea
            id="tier-perks"
            value={perks}
            error={Boolean(errors.perks)}
            className="min-h-[140px]"
            onChange={(e) => setPerks(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
