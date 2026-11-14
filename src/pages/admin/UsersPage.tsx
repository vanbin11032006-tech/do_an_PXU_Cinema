import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, KeyRound, Lock, LockOpen, Search, ShieldCheck, UserCog, UserPlus, Users,
} from 'lucide-react';
import {
  changeUserRole, createStaffUser, listCinemasAdmin, listUsers, lockUser, sendUserPasswordReset,
} from '@/api';
import type { Cinema, Role, SessionUser, UserStatus } from '@/types/domain';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDateTime, number } from '@/lib/format';
import { useDebounce } from '@/hooks';
import { useAuthStore } from '@/store/auth';
import {
  Avatar, Badge, Button, Checkbox, ConfirmDialog, DataTable, ErrorState, Field, Input, Modal,
  PageHeader, Select, Skeleton, StatusBadge, Textarea, toast, type Column,
} from '@/components/ui';
import { StatCard } from './system/StatCard';

type RoleFilter = 'all' | Role;
type StatusFilter = 'all' | UserStatus;

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Khách hàng',
  staff: 'Nhân viên',
  manager: 'Quản lý',
  admin: 'Quản trị viên',
};

const ROLE_TONE: Record<Role, 'neutral' | 'info' | 'purple' | 'brand'> = {
  customer: 'neutral',
  staff: 'info',
  manager: 'purple',
  admin: 'brand',
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<SessionUser | null>(null);
  const [lockTarget, setLockTarget] = useState<SessionUser | null>(null);
  const [resetTarget, setResetTarget] = useState<SessionUser | null>(null);

  const query = useQuery({
    queryKey: ['admin', 'users', { q: debouncedSearch, role: roleFilter, status: statusFilter }],
    queryFn: () => listUsers({ q: debouncedSearch, role: roleFilter, status: statusFilter }),
  });
  const cinemasQuery = useQuery({
    queryKey: ['admin', 'cinemas'],
    queryFn: listCinemasAdmin,
  });

  const rows = query.data ?? [];
  const cinemas = cinemasQuery.data ?? [];

  const stats = useMemo(() => ({
    staff: rows.filter((user) => user.role === 'staff' || user.role === 'manager').length,
    admins: rows.filter((user) => user.role === 'admin').length,
    locked: rows.filter((user) => user.status === 'locked').length,
  }), [rows]);

  const lockMutation = useMutation({
    mutationFn: ({ user, lock, reason }: { user: SessionUser; lock: boolean; reason: string }) => lockUser(user.id, lock, reason),
    onSuccess: (result) => {
      toast.success('Đã cập nhật trạng thái tài khoản', result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setLockTarget(null);
    },
    onError: (error) => toast.error('Không cập nhật được tài khoản', errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: (user: SessionUser) => sendUserPasswordReset(user.id),
    onSuccess: (result) => {
      toast.success('Đã gửi email đặt lại mật khẩu', result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setResetTarget(null);
    },
    onError: (error) => toast.error('Không gửi được email', errorMessage(error)),
  });

  const cinemaLabel = (id: number) => cinemas.find((cinema) => cinema.id === id)?.name ?? `Rạp #${id}`;

  const columns: Column<SessionUser>[] = [
    {
      key: 'user',
      header: 'Người dùng',
      sortValue: (user) => user.name,
      render: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.name} seed={user.avatarSeed} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
              {user.name}
              {user.id === currentUser?.id && <Badge tone="brand">Bạn</Badge>}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="text-xs text-muted">{user.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      sortValue: (user) => user.role,
      render: (user) => <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>,
    },
    {
      key: 'scope',
      header: 'Phạm vi rạp',
      render: (user) => {
        if (user.role === 'customer') return <span className="text-xs text-muted">Không áp dụng</span>;
        if (!user.cinemaIds.length) return <span className="text-xs text-ink2">Toàn hệ thống</span>;
        return (
          <span className="block max-w-[200px] text-xs leading-relaxed text-ink2">
            {user.cinemaIds.map(cinemaLabel).join(', ')}
          </span>
        );
      },
    },
    {
      key: 'points',
      header: 'Điểm',
      align: 'right',
      sortValue: (user) => user.points,
      render: (user) => <span className="text-money text-ink2">{number(user.points)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: 'lastLogin',
      header: 'Đăng nhập gần nhất',
      sortValue: (user) => user.lastLoginAt ?? '',
      render: (user) => (
        <span className="text-xs text-muted">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa đăng nhập'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (user) => {
        const isSelf = user.id === currentUser?.id;
        const locked = user.status === 'locked';
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Đổi vai trò ${user.name}`}
              disabled={isSelf}
              title={isSelf ? 'Không thể tự đổi vai trò của mình' : 'Đổi vai trò'}
              onClick={() => setRoleTarget(user)}
            >
              <ShieldCheck className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={locked ? `Mở khóa ${user.name}` : `Khóa ${user.name}`}
              disabled={isSelf}
              title={isSelf ? 'Không thể tự khóa tài khoản của mình' : locked ? 'Mở khóa' : 'Khóa tài khoản'}
              onClick={() => setLockTarget(user)}
            >
              {locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Gửi email đặt lại mật khẩu cho ${user.name}`}
              title="Gửi email đặt lại mật khẩu"
              onClick={() => setResetTarget(user)}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Người dùng & phân quyền"
        description="Quản lý tài khoản nội bộ, phạm vi rạp và trạng thái truy cập hệ thống."
        actions={(
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Thêm nhân sự
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Kết quả"
          value={query.isLoading ? <Skeleton className="h-6 w-14" /> : number(rows.length)}
          hint="Theo bộ lọc hiện tại"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Nhân sự vận hành"
          value={query.isLoading ? <Skeleton className="h-6 w-14" /> : number(stats.staff)}
          hint="Nhân viên và quản lý"
          icon={<UserCog className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Quản trị viên"
          value={query.isLoading ? <Skeleton className="h-6 w-14" /> : number(stats.admins)}
          hint="Toàn quyền hệ thống"
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="gold"
        />
        <StatCard
          label="Đang bị khóa"
          value={query.isLoading ? <Skeleton className="h-6 w-14" /> : number(stats.locked)}
          hint="Không thể đăng nhập"
          icon={<Lock className="h-4 w-4" />}
          tone="danger"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email hoặc số điện thoại…"
            className="pl-9"
            aria-label="Tìm người dùng"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          aria-label="Lọc theo vai trò"
        >
          <option value="all">Mọi vai trò</option>
          <option value="customer">Khách hàng</option>
          <option value="staff">Nhân viên</option>
          <option value="manager">Quản lý</option>
          <option value="admin">Quản trị viên</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="locked">Đã khóa</option>
          <option value="invited">Đã mời</option>
        </Select>
      </div>

      {query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.id}
          loading={query.isLoading}
          empty="Không có người dùng phù hợp."
          emptyAction={search || roleFilter !== 'all' || statusFilter !== 'all'
            ? <Button variant="outline" size="sm" onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>Xóa bộ lọc</Button>
            : undefined}
          mobileCard={(user) => {
            const isSelf = user.id === currentUser?.id;
            const locked = user.status === 'locked';
            return (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={user.name} seed={user.avatarSeed} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
                      {user.name}
                      {isSelf && <Badge tone="brand">Bạn</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                      <StatusBadge status={user.status} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted">Phạm vi</p><p className="text-ink2">{user.cinemaIds.length ? user.cinemaIds.map(cinemaLabel).join(', ') : user.role === 'customer' ? '—' : 'Toàn hệ thống'}</p></div>
                  <div><p className="text-muted">Điểm</p><p className="text-money text-ink2">{number(user.points)}</p></div>
                  <div className="col-span-2"><p className="text-muted">Đăng nhập gần nhất</p><p className="text-ink2">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa đăng nhập'}</p></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="secondary" size="sm" disabled={isSelf} onClick={() => setRoleTarget(user)}>Đổi vai trò</Button>
                  <Button variant="secondary" size="sm" disabled={isSelf} onClick={() => setLockTarget(user)}>{locked ? 'Mở khóa' : 'Khóa'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setResetTarget(user)}>Đặt lại mật khẩu</Button>
                </div>
              </div>
            );
          }}
        />
      )}

      {createOpen && (
        <CreateUserModal cinemas={cinemas} cinemasLoading={cinemasQuery.isLoading} onClose={() => setCreateOpen(false)} />
      )}
      {roleTarget && (
        <ChangeRoleModal user={roleTarget} onClose={() => setRoleTarget(null)} />
      )}

      <ConfirmDialog
        open={Boolean(lockTarget)}
        onClose={() => setLockTarget(null)}
        onConfirm={(reason) => {
          if (!lockTarget) return;
          lockMutation.mutate({ user: lockTarget, lock: lockTarget.status !== 'locked', reason });
        }}
        title={lockTarget?.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
        description={lockTarget ? `${lockTarget.name} · ${lockTarget.email}` : undefined}
        confirmText={lockTarget?.status === 'locked' ? 'Mở khóa' : 'Khóa tài khoản'}
        danger={lockTarget?.status !== 'locked'}
        requireReason
        loading={lockMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={() => { if (resetTarget) resetMutation.mutate(resetTarget); }}
        title="Gửi email đặt lại mật khẩu"
        description={resetTarget ? `Hệ thống sẽ gửi liên kết đặt lại mật khẩu tới ${resetTarget.email}. Người dùng cần đổi mật khẩu ở lần đăng nhập kế tiếp.` : undefined}
        confirmText="Gửi email"
        loading={resetMutation.isPending}
      />
    </div>
  );
}

interface CreateUserForm {
  name: string;
  email: string;
  phone: string;
  role: 'staff' | 'manager';
  cinemaIds: number[];
}

function CreateUserModal({ cinemas, cinemasLoading, onClose }: { cinemas: Cinema[]; cinemasLoading: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateUserForm>({ name: '', email: '', phone: '', role: 'staff', cinemaIds: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => createStaffUser(form),
    onSuccess: (result) => {
      toast.success('Đã gửi lời mời', result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (error) => {
      setErrors((prev) => ({ ...prev, ...fieldErrors(error) }));
      toast.error('Không tạo được tài khoản', errorMessage(error));
    },
  });

  const toggleCinema = (id: number) => setForm((prev) => ({
    ...prev,
    cinemaIds: prev.cinemaIds.includes(id) ? prev.cinemaIds.filter((item) => item !== id) : [...prev.cinemaIds, id],
  }));

  const submit = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = 'Nhập họ tên tối thiểu 3 ký tự.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Email không hợp lệ.';
    if (!/^0\d{9,10}$/.test(form.phone.trim())) next.phone = 'Số điện thoại gồm 10–11 chữ số, bắt đầu bằng 0.';
    if (!form.cinemaIds.length) next.cinemaIds = 'Chọn ít nhất một rạp.';
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Thêm nhân sự"
      description="Tài khoản nhận lời mời qua email để tự đặt mật khẩu. Không hiển thị mật khẩu tạm."
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button loading={mutation.isPending} onClick={submit}>Gửi lời mời</Button>
        </div>
      )}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <Field label="Họ và tên" htmlFor="staff-name" required error={errors.name}>
          <Input id="staff-name" value={form.name} error={Boolean(errors.name)} autoFocus onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="staff-email" required error={errors.email}>
            <Input id="staff-email" type="email" value={form.email} error={Boolean(errors.email)} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </Field>
          <Field label="Số điện thoại" htmlFor="staff-phone" required error={errors.phone}>
            <Input id="staff-phone" inputMode="tel" value={form.phone} error={Boolean(errors.phone)} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value.replace(/[^\d]/g, '') }))} />
          </Field>
        </div>
        <Field label="Vai trò" htmlFor="staff-role" required>
          <Select id="staff-role" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as 'staff' | 'manager' }))}>
            <option value="staff">Nhân viên</option>
            <option value="manager">Quản lý</option>
          </Select>
        </Field>
        <Field label="Phạm vi rạp" error={errors.cinemaIds} required hint="Nhân sự chỉ thao tác trong các rạp được chọn.">
          {cinemasLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : cinemas.length === 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Chưa tải được danh sách rạp. Vui lòng đóng hộp thoại và thử lại.
            </p>
          ) : (
            <div className="space-y-1 rounded-lg border border-line bg-base/40 p-2">
              {cinemas.map((cinema) => (
                <Checkbox
                  key={cinema.id}
                  label={<span><span className="font-medium text-ink">{cinema.name}</span><span className="ml-2 text-xs text-muted">{cinema.city}</span></span>}
                  checked={form.cinemaIds.includes(cinema.id)}
                  onChange={() => toggleCinema(cinema.id)}
                />
              ))}
            </div>
          )}
        </Field>
        <p className="flex items-start gap-2 rounded-lg border border-info/25 bg-info/10 px-3 py-2 text-xs leading-relaxed text-info">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          Nhân sự sẽ nhận email kích hoạt và đặt mật khẩu trước khi đăng nhập lần đầu.
        </p>
      </form>
    </Modal>
  );
}

function ChangeRoleModal({ user, onClose }: { user: SessionUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(user.role);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => changeUserRole(user.id, role, reason.trim()),
    onSuccess: (result) => {
      toast.success('Đã đổi vai trò', result.message);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (error) => toast.error('Không đổi được vai trò', errorMessage(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (role === user.role) next.role = 'Chọn vai trò khác vai trò hiện tại.';
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
      title="Đổi vai trò"
      description={`${user.name} · ${user.email}`}
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
        <div className="flex items-center justify-between rounded-lg border border-line bg-base/40 px-3 py-2 text-sm">
          <span className="text-muted">Vai trò hiện tại</span>
          <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
        </div>
        <Field label="Vai trò mới" htmlFor="role-select" required error={errors.role}>
          <Select id="role-select" value={role} error={Boolean(errors.role)} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="customer">Khách hàng</option>
            <option value="staff">Nhân viên</option>
            <option value="manager">Quản lý</option>
            <option value="admin">Quản trị viên</option>
          </Select>
        </Field>
        {role === 'admin' && user.role !== 'admin' && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-danger">
            Quản trị viên có toàn quyền trên hệ thống, bao gồm cấu hình thanh toán và phân quyền người khác.
          </p>
        )}
        <Field label="Lý do" htmlFor="role-reason" required error={errors.reason} hint="Lý do được lưu vào nhật ký hệ thống.">
          <Textarea
            id="role-reason"
            value={reason}
            error={Boolean(errors.reason)}
            maxLength={240}
            placeholder="VD: Bổ nhiệm quản lý rạp Landmark…"
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
