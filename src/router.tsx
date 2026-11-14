import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, useRouteError } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { BookingLayout } from '@/components/layout/BookingLayout';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { Button, Skeleton } from '@/components/ui';

const HomePage = lazy(() => import('@/pages/public/HomePage'));
const MovieListPage = lazy(() => import('@/pages/public/MovieListPage'));
const MovieDetailPage = lazy(() => import('@/pages/public/MovieDetailPage'));
const ShowtimesPage = lazy(() => import('@/pages/public/ShowtimesPage'));
const CinemasPage = lazy(() => import('@/pages/public/CinemasPage'));
const CombosPublicPage = lazy(() => import('@/pages/public/CombosPublicPage'));
const NewsListPage = lazy(() => import('@/pages/public/NewsListPage'));
const NewsDetailPage = lazy(() => import('@/pages/public/NewsDetailPage'));
const StaticPage = lazy(() => import('@/pages/public/StaticPage'));
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'));
const ForbiddenPage = lazy(() => import('@/pages/public/ForbiddenPage'));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));

const SeatsPage = lazy(() => import('@/pages/booking/SeatsPage'));
const CombosPage = lazy(() => import('@/pages/booking/CombosPage'));
const ReviewPage = lazy(() => import('@/pages/booking/ReviewPage'));
const PaymentPage = lazy(() => import('@/pages/booking/PaymentPage'));
const TicketPage = lazy(() => import('@/pages/booking/TicketPage'));

const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const MyTicketsPage = lazy(() => import('@/pages/account/MyTicketsPage'));
const PointsPage = lazy(() => import('@/pages/account/PointsPage'));
const NotificationsPage = lazy(() => import('@/pages/account/NotificationsPage'));

const ScannerPage = lazy(() => import('@/pages/staff/ScannerPage'));
const PosPage = lazy(() => import('@/pages/staff/PosPage'));
const TodayTicketsPage = lazy(() => import('@/pages/staff/TodayTicketsPage'));
const ShiftPage = lazy(() => import('@/pages/staff/ShiftPage'));

const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const MoviesAdminPage = lazy(() => import('@/pages/admin/MoviesAdminPage'));
const MovieFormPage = lazy(() => import('@/pages/admin/MovieFormPage'));
const ShowtimesAdminPage = lazy(() => import('@/pages/admin/ShowtimesAdminPage'));
const CinemasAdminPage = lazy(() => import('@/pages/admin/CinemasAdminPage'));
const SeatBuilderPage = lazy(() => import('@/pages/admin/SeatBuilderPage'));
const PricingAdminPage = lazy(() => import('@/pages/admin/PricingAdminPage'));
const CombosAdminPage = lazy(() => import('@/pages/admin/CombosAdminPage'));
const OrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/admin/OrderDetailPage'));
const ReceiptsPage = lazy(() => import('@/pages/admin/ReceiptsPage'));
const RefundsPage = lazy(() => import('@/pages/admin/RefundsPage'));
const ExceptionsPage = lazy(() => import('@/pages/admin/ExceptionsPage'));
const VouchersPage = lazy(() => import('@/pages/admin/VouchersPage'));
const MembersPage = lazy(() => import('@/pages/admin/MembersPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const PaymentSettingsPage = lazy(() => import('@/pages/admin/PaymentSettingsPage'));
const ContentPage = lazy(() => import('@/pages/admin/ContentPage'));
const ReviewsAdminPage = lazy(() => import('@/pages/admin/ReviewsAdminPage'));
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'));
const AuditPage = lazy(() => import('@/pages/admin/AuditPage'));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));

function PageFallback() {
  return (
    <div className="container-page py-8">
      <Skeleton className="mb-4 h-9 w-64" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Trang này gặp sự cố không mong muốn.';
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-base px-6 text-center">
      <p className="font-display text-6xl font-extrabold text-brand">PXU</p>
      <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-wide text-ink">Không thể hiển thị trang</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        <Button variant="secondary" onClick={() => { window.location.href = '/'; }}>Về trang chủ</Button>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <P><HomePage /></P> },
      { path: 'phim', element: <P><MovieListPage /></P> },
      { path: 'phim/:slug', element: <P><MovieDetailPage /></P> },
      { path: 'lich-chieu', element: <P><ShowtimesPage /></P> },
      { path: 'rap', element: <P><CinemasPage /></P> },
      { path: 'bap-nuoc', element: <P><CombosPublicPage /></P> },
      { path: 'khuyen-mai', element: <P><NewsListPage /></P> },
      { path: 'khuyen-mai/:slug', element: <P><NewsDetailPage /></P> },
      { path: 'trang/:slug', element: <P><StaticPage /></P> },
      {
        path: 'tai-khoan',
        element: <ProtectedRoute><AccountLayout /></ProtectedRoute>,
        children: [
          { index: true, element: <P><ProfilePage /></P> },
          { path: 've-cua-toi', element: <P><MyTicketsPage /></P> },
          { path: 'diem-thuong', element: <P><PointsPage /></P> },
          { path: 'thong-bao', element: <P><NotificationsPage /></P> },
        ],
      },
      { path: '403', element: <P><ForbiddenPage /></P> },
      { path: '*', element: <P><NotFoundPage /></P> },
    ],
  },
  { path: '/dang-nhap', element: <P><LoginPage /></P>, errorElement: <RouteErrorPage /> },
  { path: '/dang-ky', element: <P><RegisterPage /></P>, errorElement: <RouteErrorPage /> },
  { path: '/quen-mat-khau', element: <P><ForgotPasswordPage /></P>, errorElement: <RouteErrorPage /> },
  { path: '/dat-lai-mat-khau/:token', element: <P><ResetPasswordPage /></P>, errorElement: <RouteErrorPage /> },
  { path: '/xac-thuc-email/:token', element: <P><VerifyEmailPage /></P>, errorElement: <RouteErrorPage /> },
  {
    path: '/dat-ve',
    element: <ProtectedRoute><BookingLayout /></ProtectedRoute>,
    errorElement: <RouteErrorPage />,
    children: [
      { path: ':showtimeId/ghe', element: <P><SeatsPage /></P> },
      { path: ':bookingCode/bap-nuoc', element: <P><CombosPage /></P> },
      { path: ':bookingCode/xac-nhan', element: <P><ReviewPage /></P> },
    ],
  },
  {
    path: '/thanh-toan',
    element: <ProtectedRoute><BookingLayout /></ProtectedRoute>,
    errorElement: <RouteErrorPage />,
    children: [{ path: ':bookingCode', element: <P><PaymentPage /></P> }],
  },
  {
    path: '/ve',
    element: <ProtectedRoute><BookingLayout /></ProtectedRoute>,
    errorElement: <RouteErrorPage />,
    children: [{ path: ':bookingCode', element: <P><TicketPage /></P> }],
  },
  {
    path: '/staff',
    element: <ProtectedRoute roles={['staff', 'manager', 'admin']}><StaffLayout /></ProtectedRoute>,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/staff/quet-ve" replace /> },
      { path: 'quet-ve', element: <P><ScannerPage /></P> },
      { path: 'ban-ve', element: <P><PosPage /></P> },
      { path: 've-trong-ngay', element: <P><TodayTicketsPage /></P> },
      { path: 'ca-lam-viec', element: <P><ShiftPage /></P> },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute roles={['manager', 'admin']}><AdminLayout /></ProtectedRoute>,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <P><DashboardPage /></P> },
      { path: 'phim', element: <P><MoviesAdminPage /></P> },
      { path: 'phim/:id', element: <P><MovieFormPage /></P> },
      { path: 'suat-chieu', element: <P><ShowtimesAdminPage /></P> },
      { path: 'rap', element: <P><CinemasAdminPage /></P> },
      { path: 'phong', element: <Navigate to="/admin/rap" replace /> },
      { path: 'phong/:id/so-do-ghe', element: <P><SeatBuilderPage /></P> },
      { path: 'bang-gia', element: <P><PricingAdminPage /></P> },
      { path: 'combo', element: <P><CombosAdminPage /></P> },
      { path: 'don-hang', element: <P><OrdersPage /></P> },
      { path: 'don-hang/:id', element: <P><OrderDetailPage /></P> },
      { path: 'duyet-bien-lai', element: <P><ReceiptsPage /></P> },
      { path: 'hoan-tien', element: <P><RefundsPage /></P> },
      { path: 'giao-dich-bat-thuong', element: <P><ExceptionsPage /></P> },
      { path: 'voucher', element: <P><VouchersPage /></P> },
      { path: 'thanh-vien', element: <P><MembersPage /></P> },
      { path: 'nguoi-dung', element: <P><UsersPage /></P> },
      { path: 'thanh-toan-qr', element: <P><PaymentSettingsPage /></P> },
      { path: 'banner-tin-tuc', element: <P><ContentPage /></P> },
      { path: 'danh-gia', element: <P><ReviewsAdminPage /></P> },
      { path: 'bao-cao', element: <P><ReportsPage /></P> },
      { path: 'nhat-ky', element: <P><AuditPage /></P> },
      { path: 'cai-dat', element: <P><SettingsPage /></P> },
    ],
  },
]);
