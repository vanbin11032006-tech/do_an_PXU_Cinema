import { NavLink, Outlet } from 'react-router-dom';
import { Bell, Gift, Ticket, UserRound } from 'lucide-react';
import { cn, formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { Avatar, TierBadge } from '@/components/ui';

const LINKS = [
  { to: '/tai-khoan', label: 'Hồ sơ', icon: UserRound, end: true },
  { to: '/tai-khoan/ve-cua-toi', label: 'Vé của tôi', icon: Ticket },
  { to: '/tai-khoan/diem-thuong', label: 'Điểm thưởng', icon: Gift },
  { to: '/tai-khoan/thong-bao', label: 'Thông báo', icon: Bell },
];

export function AccountLayout() {
  const { user } = useAuthStore();
  if (!user) return <Outlet />;
  return (
    <div className="container-page py-8">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <div className="rounded-card border border-line/80 bg-surface/70 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} seed={user.avatarSeed} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[11px] text-muted">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <TierBadge tier={user.tier} />
              <span className="text-[11px] font-semibold text-gold">{user.points.toLocaleString('vi-VN')} điểm</span>
            </div>
            {user.dob && <p className="mt-2 text-[10px] text-muted">Thành viên từ {formatDate(user.createdAt)}</p>}
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto rounded-card border border-line/80 bg-surface/70 p-1.5 lg:flex-col no-scrollbar" aria-label="Tài khoản">
            {LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition',
                  isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-elevated hover:text-ink',
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
