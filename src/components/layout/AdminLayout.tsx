import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, BadgeCheck, BarChart3, Building2, CalendarDays, ChevronLeft, ChevronRight,
  Clapperboard, Film, Image, LayoutDashboard, LogOut, Menu, Moon, Popcorn, QrCode,
  ReceiptText, RotateCcw, Search, ScrollText, Settings, ShieldCheck, Star, Sun, Tags, TicketPercent,
  UserCog, UsersRound, Wallet, X, PanelLeftClose, PanelLeftOpen, ArrowUpRight, Command,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/format';
import { useAuthStore } from '@/store/auth';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { useUiStore } from '@/store/ui';
import { getAdminBadges, listCinemasAdmin, searchEverything } from '@/api';
import { Avatar, Badge, IconButton, Input, Modal } from '@/components/ui';
import { Logo } from '@/components/common/Logo';

interface MenuItem {
  to: string; label: string; icon: LucideIcon; permission: string; end?: boolean; badge?: 'receipts' | 'refunds' | 'exceptions';
}
interface MenuGroup { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  {
    title: 'Tổng quan',
    items: [
      { to: '/admin', label: 'Bảng điều khiển', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
    ],
  },
  {
    title: 'Bán hàng',
    items: [
      { to: '/admin/don-hang', label: 'Đơn hàng', icon: ReceiptText, permission: 'booking.read' },
      { to: '/admin/duyet-bien-lai', label: 'Duyệt biên lai', icon: BadgeCheck, permission: 'payment.review', badge: 'receipts' },
      { to: '/admin/hoan-tien', label: 'Hoàn tiền', icon: RotateCcw, permission: 'refund.request', badge: 'refunds' },
      { to: '/admin/giao-dich-bat-thuong', label: 'Giao dịch bất thường', icon: AlertTriangle, permission: 'payment.exception.manage', badge: 'exceptions' },
    ],
  },
  {
    title: 'Danh mục',
    items: [
      { to: '/admin/phim', label: 'Phim', icon: Film, permission: 'movie.read' },
      { to: '/admin/suat-chieu', label: 'Suất chiếu', icon: CalendarDays, permission: 'showtime.read' },
      { to: '/admin/rap', label: 'Rạp & phòng', icon: Building2, permission: 'room.read' },
      { to: '/admin/bang-gia', label: 'Bảng giá', icon: Tags, permission: 'pricing.read' },
      { to: '/admin/combo', label: 'Bắp nước', icon: Popcorn, permission: 'combo.read' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { to: '/admin/voucher', label: 'Voucher', icon: TicketPercent, permission: 'voucher.read' },
      { to: '/admin/thanh-vien', label: 'Thành viên', icon: UsersRound, permission: 'member.read' },
      { to: '/admin/banner-tin-tuc', label: 'Banner & tin tức', icon: Image, permission: 'content.write' },
      { to: '/admin/danh-gia', label: 'Đánh giá', icon: Star, permission: 'review.moderate' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { to: '/admin/nguoi-dung', label: 'Người dùng', icon: UserCog, permission: 'user.read' },
      { to: '/admin/thanh-toan-qr', label: 'Thanh toán QR', icon: QrCode, permission: 'paymentsetting.read' },
      { to: '/admin/bao-cao', label: 'Báo cáo', icon: BarChart3, permission: 'report.view' },
      { to: '/admin/nhat-ky', label: 'Nhật ký', icon: ScrollText, permission: 'audit.view' },
      { to: '/admin/cai-dat', label: 'Cài đặt', icon: Settings, permission: 'setting.read' },
    ],
  },
];

const TITLES: { match: RegExp; label: string }[] = [
  { match: /^\/admin\/phim\/\d+/, label: 'Chi tiết phim' },
  { match: /^\/admin\/don-hang\/\d+/, label: 'Chi tiết đơn hàng' },
  { match: /^\/admin\/phong\/\d+\/so-do-ghe/, label: 'Thiết kế sơ đồ ghế' },
  { match: /^\/admin\/phim/, label: 'Quản lý phim' },
  { match: /^\/admin\/suat-chieu/, label: 'Suất chiếu' },
  { match: /^\/admin\/rap/, label: 'Rạp & phòng' },
  { match: /^\/admin\/bang-gia/, label: 'Bảng giá' },
  { match: /^\/admin\/combo/, label: 'Bắp nước' },
  { match: /^\/admin\/don-hang/, label: 'Đơn hàng' },
  { match: /^\/admin\/duyet-bien-lai/, label: 'Duyệt biên lai' },
  { match: /^\/admin\/hoan-tien/, label: 'Hoàn tiền' },
  { match: /^\/admin\/giao-dich-bat-thuong/, label: 'Giao dịch bất thường' },
  { match: /^\/admin\/voucher/, label: 'Voucher' },
  { match: /^\/admin\/thanh-vien/, label: 'Thành viên' },
  { match: /^\/admin\/nguoi-dung/, label: 'Người dùng & phân quyền' },
  { match: /^\/admin\/thanh-toan-qr/, label: 'Cấu hình thanh toán QR' },
  { match: /^\/admin\/banner-tin-tuc/, label: 'Banner & tin tức' },
  { match: /^\/admin\/danh-gia/, label: 'Kiểm duyệt đánh giá' },
  { match: /^\/admin\/bao-cao/, label: 'Báo cáo' },
  { match: /^\/admin\/nhat-ky/, label: 'Nhật ký hệ thống' },
  { match: /^\/admin\/cai-dat/, label: 'Cài đặt hệ thống' },
  { match: /^\/admin$/, label: 'Bảng điều khiển' },
];

export function AdminLayout() {
  const { user, logout, can } = useAuthStore();
  const { theme, toggleTheme, adminCinemaId, setAdminCinemaId, sidebarCollapsed, toggleSidebar } = useUiStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const title = TITLES.find((t) => t.match.test(location.pathname))?.label ?? 'Quản trị';
  useDocumentTitle(title);

  const visibleGroups = MENU
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0);

  const { data: badges } = useQuery({ queryKey: ['admin', 'badges'], queryFn: getAdminBadges, refetchInterval: 30_000 });
  const { data: cinemas } = useQuery({ queryKey: ['admin', 'cinemas'], queryFn: listCinemasAdmin, staleTime: 120_000 });

  useEffect(() => { setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function badgeValue(item: MenuItem): number | undefined {
    if (!badges || !item.badge) return undefined;
    if (item.badge === 'receipts') return badges.receipts;
    if (item.badge === 'refunds') return badges.refunds;
    return badges.exceptions;
  }

  const navContent = (
    <>
      <div className="flex h-14 items-center justify-between border-b border-line/60 px-4">
        <Link to="/admin" className="flex items-center gap-2" aria-label="PXU Admin">
          <Logo compact />
          {!sidebarCollapsed && <Badge tone="brand" className="ml-1">Admin</Badge>}
        </Link>
        <button type="button" onClick={toggleSidebar} className="hidden rounded-md p-1 text-muted hover:bg-elevated hover:text-ink lg:block" aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4" aria-label="Quản trị">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            {!sidebarCollapsed && <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-muted/70">{group.title}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const count = badgeValue(item);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) => cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition',
                        sidebarCollapsed && 'justify-center px-0',
                        isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-elevated hover:text-ink',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!sidebarCollapsed && Boolean(count) && (
                        <span className="rounded-full bg-brand px-1.5 text-[9px] font-bold leading-4 text-white">{count! > 9 ? '9+' : count}</span>
                      )}
                      {sidebarCollapsed && Boolean(count) && (
                        <span className="absolute ml-6 -mt-4 h-2 w-2 rounded-full bg-brand" />
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line/60 p-2.5">
        <Link to="/" className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-muted transition hover:bg-elevated hover:text-ink', sidebarCollapsed && 'justify-center px-0')}>
          <ArrowUpRight className="h-4 w-4" /> {!sidebarCollapsed && 'Về trang khách hàng'}
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-base">
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line/60 bg-surface/60 backdrop-blur lg:flex', sidebarCollapsed ? 'w-[74px]' : 'w-[248px]')}>
        {navContent}
      </aside>

      <div className={cn('transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-[74px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 border-b border-line/60 glass no-print">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => setMobileOpen(true)} className="lg:hidden" aria-label="Mở menu quản trị">
              <IconButton label="Mở menu"><Menu className="h-5 w-5" /></IconButton>
            </button>
            <div className="hidden min-w-0 items-center gap-2 text-xs text-muted sm:flex">
              <Link to="/admin" className="transition hover:text-ink">Quản trị</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="truncate font-semibold text-ink">{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto hidden h-9 w-64 items-center gap-2 rounded-lg border border-line bg-base/50 px-3 text-left text-[11px] text-muted transition hover:border-brand/40 md:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1">Tìm nhanh…</span>
              <kbd className="rounded border border-line bg-surface px-1.5 text-[9px]">⌘K</kbd>
            </button>
            {cinemas && cinemas.length > 0 && (
              <select
                aria-label="Chọn rạp làm việc"
                value={adminCinemaId ?? ''}
                onChange={(e) => setAdminCinemaId(e.target.value ? Number(e.target.value) : null)}
                className="h-8 max-w-[190px] rounded-lg border-line bg-base/60 text-[11px] text-ink2 focus:border-brand focus:ring-brand/30"
              >
                <option value="">Tất cả rạp</option>
                {cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name.replace('PXU Cinema ', '')}</option>)}
              </select>
            )}
            <Link to="/admin/duyet-bien-lai" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-base/50 text-ink2 hover:text-ink" aria-label={`Biên lai chờ duyệt${badges?.receipts ? `: ${badges.receipts}` : ''}`}>
              <Wallet className="h-4 w-4" />
              {Boolean(badges?.receipts) && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">{badges!.receipts}</span>}
            </Link>
            <IconButton label={theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
            <div className="relative" ref={userMenuRef}>
              <button type="button" onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-full p-0.5 pr-1.5 hover:bg-elevated" aria-haspopup="menu" aria-expanded={userMenu}>
                {user && <Avatar name={user.name} seed={user.avatarSeed} size="xs" />}
                <ChevronLeft className={cn('h-3.5 w-3.5 -rotate-90 text-muted transition', userMenu && 'rotate-90')} />
              </button>
              {userMenu && user && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 animate-scale-in overflow-hidden rounded-card border border-line bg-surface shadow-lift" role="menu">
                  <div className="border-b border-line/60 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-muted">{user.email}</p>
                    <Badge tone="brand" className="mt-2 capitalize">{user.role}</Badge>
                  </div>
                  <div className="p-1.5">
                    <Link to="/" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink2 hover:bg-elevated"><Clapperboard className="h-3.5 w-3.5" /> Về trang khách</Link>
                    <Link to="/staff/quet-ve" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink2 hover:bg-elevated"><ShieldCheck className="h-3.5 w-3.5" /> Khu vực nhân viên</Link>
                    <button type="button" onClick={() => { logout(); navigate('/'); }} className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-line/60 px-2.5 py-2 pt-3 text-left text-xs text-danger hover:bg-danger/10">
                      <LogOut className="h-3.5 w-3.5" /> Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[270px] animate-fade-in flex-col border-r border-line bg-surface" role="dialog" aria-modal="true" aria-label="Menu quản trị">
            <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
              <Logo compact />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Đóng"><X className="h-5 w-5 text-muted" /></button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">{navContent}</div>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} groups={visibleGroups} />
    </div>
  );
}

function CommandPalette({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: MenuGroup[] }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['admin', 'search', debounced],
    queryFn: () => searchEverything(debounced),
    enabled: open && debounced.trim().length >= 2,
  });
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const links = groups.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const go = (path: string) => { onClose(); navigate(path); };
  return (
    <Modal open={open} onClose={onClose} title="Tìm nhanh" size="lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trang, phim hoặc mã đơn…" className="pl-9" />
      </div>
      <div className="mt-4 space-y-4">
        {links.length > 0 && (
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Trang quản trị</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {links.slice(0, 8).map((item) => (
                <button key={item.to} type="button" onClick={() => go(item.to)} className="flex items-center gap-2 rounded-lg border border-line/60 bg-base/40 px-3 py-2 text-left text-xs text-ink2 hover:border-brand/40 hover:text-ink">
                  <item.icon className="h-3.5 w-3.5 text-brand" /> {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {data?.movies.length ? (
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Phim</p>
            {data.movies.map((movie) => (
              <button key={movie.id} type="button" onClick={() => go(`/admin/phim/${movie.id}`)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-ink2 hover:bg-elevated hover:text-ink">
                <span>{movie.title}</span><ChevronRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        ) : null}
        {data?.orders.length ? (
          <div>
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Đơn hàng</p>
            {data.orders.map((order) => (
              <button key={order.id} type="button" onClick={() => go(`/admin/don-hang/${order.id}`)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-ink2 hover:bg-elevated hover:text-ink">
                <span className="font-mono">{order.code}</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {debounced.trim().length >= 2 && !data?.movies.length && !data?.orders.length && (
          <p className="py-3 text-center text-xs text-muted">Không tìm thấy kết quả cho “{debounced}”.</p>
        )}
        {!q && <p className="flex items-center gap-1.5 text-[10px] text-muted"><Command className="h-3 w-3" /> Mẹo: dùng ⌘K / Ctrl+K để mở tìm kiếm nhanh.</p>}
      </div>
    </Modal>
  );
}


