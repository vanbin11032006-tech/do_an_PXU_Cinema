import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BadgeCheck, CalendarDays, Gift, KeyRound, Mail, MailWarning, Phone, Save, ShieldCheck, UserRound,
} from 'lucide-react';
import { getPointsSummary, resendVerification, updateProfile } from '@/api';
import { useAuthStore } from '@/store/auth';
import { errorMessage } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { useDocumentTitle } from '@/hooks';
import {
  Avatar, Badge, Button, Card, Field, Input, PageHeader, Progress, Skeleton, TierBadge, toast,
} from '@/components/ui';
import { ChangePasswordModal } from './components/ChangePasswordModal';

const PHONE_RE = /^(0|\+84)\d{9}$/;

export default function ProfilePage() {
  useDocumentTitle('Hồ sơ của tôi');
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordOpen, setPasswordOpen] = useState(false);

  const userId = user?.id;
  const storedName = user?.name ?? '';
  const storedPhone = user?.phone ?? '';
  const storedDob = user?.dob ?? '';

  useEffect(() => {
    setName(storedName);
    setPhone(storedPhone);
    setDob(storedDob ? storedDob.slice(0, 10) : '');
    setErrors({});
  }, [userId, storedName, storedPhone, storedDob]);

  const pointsQuery = useQuery({ queryKey: ['account', 'points-summary'], queryFn: getPointsSummary, enabled: Boolean(user), refetchOnMount: 'always' });

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ name, phone, dob: dob || undefined }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Đã cập nhật hồ sơ', 'Thông tin cá nhân của bạn đã được lưu.');
    },
    onError: (error) => toast.error('Không lưu được hồ sơ', errorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: resendVerification,
    onSuccess: (result) => toast.success('Đã gửi email xác thực', result.message),
    onError: (error) => toast.error('Không gửi được email xác thực', errorMessage(error)),
  });

  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const dirty = name.trim() !== user.name || phone.trim() !== user.phone || (dob ? dob.slice(0, 10) : '') !== (user.dob?.slice(0, 10) ?? '');

  const submit = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Vui lòng nhập họ tên.';
    else if (name.trim().length < 2) next.name = 'Họ tên tối thiểu 2 ký tự.';
    if (!PHONE_RE.test(phone.replace(/\s/g, ''))) next.phone = 'Số điện thoại không hợp lệ (VD: 0901234567).';
    if (dob && new Date(dob).getTime() > Date.now()) next.dob = 'Ngày sinh không hợp lệ.';
    setErrors(next);
    if (Object.keys(next).length) return;
    profileMutation.mutate();
  };

  const summary = pointsQuery.data;

  return (
    <div>
      <PageHeader
        title="Hồ sơ của tôi"
        description="Quản lý thông tin cá nhân, bảo mật tài khoản và theo dõi hạng thành viên."
        actions={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)} icon={<KeyRound className="h-4 w-4" />}>
            Đổi mật khẩu
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-brand/15 blur-3xl" aria-hidden />
            <div className="relative flex flex-col items-center text-center">
              <Avatar name={user.name} seed={user.avatarSeed} size="lg" />
              <h2 className="mt-3 font-display text-xl font-bold uppercase tracking-wide text-ink">{user.name}</h2>
              <p className="mt-0.5 w-full truncate text-xs text-muted">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <TierBadge tier={user.tier} />
                <Badge tone={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? <BadgeCheck className="h-3 w-3" /> : <MailWarning className="h-3 w-3" />}
                  {user.emailVerified ? 'Email đã xác thực' : 'Email chưa xác thực'}
                </Badge>
              </div>

              <div className="mt-4 w-full space-y-1.5 border-t border-line/70 pt-4 text-left text-xs">
                <p className="flex items-center gap-2 text-ink2"><Phone className="h-3.5 w-3.5 text-muted" /> {user.phone || 'Chưa cập nhật'}</p>
                <p className="flex items-center gap-2 text-ink2"><CalendarDays className="h-3.5 w-3.5 text-muted" /> Thành viên từ {formatDate(user.createdAt)}</p>
                <p className="flex items-center gap-2 text-ink2">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted" /> Vai trò:{' '}
                  {user.role === 'customer' ? 'Khách hàng' : user.role === 'staff' ? 'Nhân viên' : user.role === 'manager' ? 'Quản lý' : 'Quản trị'}
                </p>
              </div>

              {!user.emailVerified && (
                <Button
                  variant="outline"
                  size="sm"
                  full
                  className="mt-4"
                  loading={resendMutation.isPending}
                  onClick={() => resendMutation.mutate()}
                  icon={<Mail className="h-3.5 w-3.5" />}
                >
                  Gửi lại email xác thực
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Điểm thưởng</p>
                <p className="mt-1 text-money text-2xl font-bold text-gold">{user.points.toLocaleString('vi-VN')}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold"><Gift className="h-5 w-5" /></span>
            </div>

            {pointsQuery.isLoading ? (
              <Skeleton className="mt-4 h-12 w-full" />
            ) : summary ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
                  <span>Hạng {summary.tier.label}</span>
                  <span className="text-right">
                    {summary.nextTier
                      ? `Còn ${money(Math.max(0, summary.nextTier.minSpend - summary.twelveMonthSpend))} đến ${summary.nextTier.label}`
                      : 'Hạng cao nhất'}
                  </span>
                </div>
                <Progress value={summary.progress} tone="gold" className="mt-1.5" />
                <p className="mt-2 text-[11px] text-muted">
                  Chi tiêu 12 tháng: <span className="font-semibold text-ink2">{money(summary.twelveMonthSpend)}</span>
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-muted">Không tải được thông tin hạng thành viên.</p>
                <button
                  type="button"
                  onClick={() => void pointsQuery.refetch()}
                  className="mt-1 text-xs font-semibold text-brand hover:underline"
                >
                  Thử lại
                </button>
              </div>
            )}

            <Link to="/tai-khoan/diem-thuong" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
              Xem chi tiết điểm thưởng
            </Link>
          </Card>
        </div>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-brand" />
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Thông tin cá nhân</h2>
          </div>
          <p className="mt-1 text-xs text-muted">Email dùng để đăng nhập và nhận vé, không thể thay đổi tại đây.</p>

          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Field label="Họ và tên" htmlFor="profile-name" required error={errors.name} className="sm:col-span-2">
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={Boolean(errors.name)}
                autoComplete="name"
                maxLength={80}
              />
            </Field>

            <Field label="Email" htmlFor="profile-email" hint={user.emailVerified ? 'Email đã được xác thực.' : 'Vui lòng xác thực email để nhận vé.'}>
              <div className="relative">
                <Input id="profile-email" value={user.email} readOnly disabled className="pr-28" />
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider ${user.emailVerified ? 'text-success' : 'text-warning'}`}>
                  {user.emailVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                </span>
              </div>
            </Field>

            <Field label="Số điện thoại" htmlFor="profile-phone" required error={errors.phone} hint="Dùng để liên hệ khi cần thiết.">
              <Input
                id="profile-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={Boolean(errors.phone)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="0901234567"
              />
            </Field>

            <Field label="Ngày sinh" htmlFor="profile-dob" error={errors.dob} hint="Nhận ưu đãi vào tháng sinh nhật.">
              <Input
                id="profile-dob"
                type="date"
                value={dob}
                max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}
                onChange={(event) => setDob(event.target.value)}
                error={Boolean(errors.dob)}
              />
            </Field>

            <Field label="Hạng thành viên" htmlFor="profile-tier">
              <div id="profile-tier" className="flex h-10 items-center gap-2 rounded-lg border border-line/70 bg-base/40 px-3">
                <TierBadge tier={user.tier} />
                <span className="text-xs text-muted">{user.points.toLocaleString('vi-VN')} điểm tích lũy</span>
              </div>
            </Field>

            <div className="flex flex-col-reverse items-stretch gap-2 pt-1 sm:col-span-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                disabled={!dirty || profileMutation.isPending}
                onClick={() => {
                  setName(user.name);
                  setPhone(user.phone);
                  setDob(user.dob ? user.dob.slice(0, 10) : '');
                  setErrors({});
                }}
              >
                Hoàn tác
              </Button>
              <Button type="submit" loading={profileMutation.isPending} disabled={!dirty} icon={<Save className="h-4 w-4" />}>
                Lưu thay đổi
              </Button>
            </div>
          </form>

          <div className="mt-6 rounded-lg border border-line/70 bg-base/40 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-success" /> Bảo mật tài khoản
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Đổi mật khẩu định kỳ và không chia sẻ thông tin đăng nhập. Mọi giao dịch đều được ghi nhận trong mục Vé của tôi.
            </p>
            <Button className="mt-3" variant="secondary" size="sm" onClick={() => setPasswordOpen(true)} icon={<KeyRound className="h-3.5 w-3.5" />}>
              Đổi mật khẩu
            </Button>
          </div>
        </Card>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
