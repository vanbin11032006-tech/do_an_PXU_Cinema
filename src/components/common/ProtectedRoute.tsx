import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { Button, LogoMark } from '@/components/ui';
import type { Role } from '@/types/domain';

export function SplashScreen({ label = 'Đang tải PXU Cinema…' }: { label?: string }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4">
      <div className="relative">
        <LogoMark className="h-14 w-14 animate-pulse-soft" />
        <span className="absolute inset-0 -z-10 rounded-full bg-brand/30 blur-2xl" />
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted">{label}</p>
    </div>
  );
}

export function ProtectedRoute({ roles, permissions, children }: {
  roles?: Role[]; permissions?: string[]; children?: ReactNode;
}) {
  const { user, status, can } = useAuthStore();
  const location = useLocation();

  if (status === 'loading') return <SplashScreen />;
  if (status === 'anonymous' || !user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/dang-nhap?returnTo=${returnTo}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }
  if (permissions && !permissions.every((permission) => can(permission))) {
    return <Navigate to="/403" replace />;
  }
  return <>{children ?? <Outlet />}</>;
}

export function ForbiddenContent() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  return (
    <div className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger"><ShieldAlert className="h-7 w-7" /></div>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">Bạn không có quyền truy cập</h1>
      <p className="mt-3 max-w-md text-sm text-muted">Khu vực này yêu cầu quyền hạn khác. Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên hệ thống.</p>
      {user && (
        <p className="mt-2 text-xs text-ink2">Đang đăng nhập: <strong className="text-ink">{user.email}</strong> · vai trò <strong className="text-ink">{user.role}</strong></p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {user && (
          <Button variant="secondary" onClick={() => { logout(); navigate('/dang-nhap'); }}>Đăng xuất & đổi tài khoản</Button>
        )}
        <a href="/" className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600">Về trang chủ</a>
      </div>
    </div>
  );
}
