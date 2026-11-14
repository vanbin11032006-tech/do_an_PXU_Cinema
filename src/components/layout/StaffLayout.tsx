import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, LayoutDashboard, ScanLine, ShoppingCart, Ticket, Wallet } from 'lucide-react';
import { cn } from '@/lib/format';
import { currentShift } from '@/api';
import { useAuthStore } from '@/store/auth';
import { Avatar, Badge } from '@/components/ui';
import { Logo } from '@/components/common/Logo';

const LINKS = [
  { to: '/staff/quet-ve', label: 'Quét vé', icon: ScanLine },
  { to: '/staff/ban-ve', label: 'Bán vé (POS)', icon: ShoppingCart },
  { to: '/staff/ve-trong-ngay', label: 'Vé trong ngày', icon: Ticket },
  { to: '/staff/ca-lam-viec', label: 'Ca làm việc', icon: Wallet },
];

export function StaffLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  const { data } = useQuery({
    queryKey: ['staff', 'current-shift'],
    queryFn: currentShift,
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
  return (
    <div className="flex min-h-[100dvh] flex-col bg-base">
      <header className="sticky top-0 z-50 border-b border-line/60 bg-surface/90 backdrop-blur no-print">
        <div className="container-page flex h-14 items-center gap-3">
          <Link to="/staff/quet-ve" aria-label="PXU Staff"><Logo compact /></Link>
          <Badge tone="brand">STAFF</Badge>
          <nav className="ml-3 hidden items-center gap-1 md:flex" aria-label="Nhân viên">
            {LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
                  isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-elevated',
                )}
              >
                <item.icon className="h-3.5 w-3.5" /> {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {data?.shift ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success sm:inline-flex">
                <CalendarClock className="h-3 w-3" /> Ca mở · {data.transactions} giao dịch
              </span>
            ) : (
              <Link to="/staff/ca-lam-viec" className="hidden rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold text-warning sm:inline-flex">Chưa mở ca</Link>
            )}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <Link to="/admin" className="hidden items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink2 hover:text-ink sm:inline-flex">
                <LayoutDashboard className="h-3.5 w-3.5" /> Quản trị
              </Link>
            )}
            <Link to="/" className="hidden text-[11px] text-muted hover:text-brand sm:block">Về trang khách</Link>
            {user && (
              <div className="flex items-center gap-2 border-l border-line/60 pl-2">
                <Avatar name={user.name} seed={user.avatarSeed} size="xs" />
                <div className="hidden leading-tight sm:block">
                  <p className="text-[11px] font-semibold text-ink">{user.name}</p>
                  <button type="button" onClick={logout} className="text-[10px] text-muted hover:text-danger">Đăng xuất</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <nav className="flex overflow-x-auto border-t border-line/50 px-2 md:hidden no-scrollbar" aria-label="Nhân viên di động">
          {LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold', isActive ? 'border-b-2 border-brand text-brand' : 'text-muted')}
            >
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
