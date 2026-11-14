import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, CalendarDays, ChevronRight, Clapperboard, Film, Heart, Home, LayoutDashboard, LogIn,
  LogOut, Mail, MapPin, Menu, Phone, Search, ShieldCheck, Sparkles, Store, Ticket, User, X,
} from 'lucide-react';
import { cn } from '@/lib/format';
import { useAuthStore, homeRouteFor } from '@/store/auth';
import { useDebounce, useOnline } from '@/hooks';
import { listMovies, unreadNotificationCount, getPublicSettings } from '@/api';
import type { Movie } from '@/types/domain';
import { Avatar, Badge, Button, IconButton, Input, Modal, TierBadge } from '@/components/ui';
import { PosterArt } from '@/components/common/PosterArt';
import { Logo } from '@/components/common/Logo';

const NAV_LINKS = [
  { to: '/phim', label: 'Phim' },
  { to: '/lich-chieu', label: 'Lịch chiếu' },
  { to: '/rap', label: 'Rạp' },
  { to: '/bap-nuoc', label: 'Bắp nước' },
  { to: '/khuyen-mai', label: 'Khuyến mãi' },
];

export function NotificationBell() {
  const { status } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: unreadNotificationCount,
    enabled: status === 'authenticated',
    refetchInterval: 45_000,
  });
  if (status !== 'authenticated') return null;
  return (
    <Link to="/tai-khoan/thong-bao" className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line/70 bg-surface/70 text-ink2 transition hover:border-brand/50 hover:text-ink" aria-label={`Thông báo${data ? `, ${data} chưa đọc` : ''}`}>
      <Bell className="h-4 w-4" />
      {Boolean(data) && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
          {data! > 9 ? '9+' : data}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/dang-nhap" className="hidden text-xs font-semibold text-ink2 transition hover:text-brand sm:block">Đăng nhập</Link>
        <Link to="/dang-ky">
          <Button size="sm" className="hidden sm:inline-flex">Đăng ký</Button>
        </Link>
        <Link to="/dang-nhap" className="sm:hidden" aria-label="Đăng nhập">
          <IconButton label="Đăng nhập"><LogIn className="h-4 w-4" /></IconButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-elevated"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.name} seed={user.avatarSeed} size="sm" />
        <span className="hidden max-w-[110px] truncate text-xs font-semibold text-ink md:block">{user.name.split(' ').slice(-2).join(' ')}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 animate-scale-in overflow-hidden rounded-card border border-line bg-surface shadow-lift" role="menu">
          <div className="border-b border-line/70 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={user.tier} />
              <span className="text-[10px] text-muted">{user.points.toLocaleString('vi-VN')} điểm</span>
            </div>
          </div>
          <div className="p-1.5">
            {[
              { to: '/tai-khoan', label: 'Hồ sơ của tôi', icon: User },
              { to: '/tai-khoan/ve-cua-toi', label: 'Vé của tôi', icon: Ticket },
              { to: '/tai-khoan/diem-thuong', label: 'Điểm thưởng', icon: Sparkles },
              { to: '/tai-khoan/thong-bao', label: 'Thông báo', icon: Bell },
            ].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-ink2 transition hover:bg-elevated hover:text-ink" role="menuitem">
                <item.icon className="h-3.5 w-3.5 text-muted" /> {item.label}
              </Link>
            ))}
            {user.role !== 'customer' && (
              <>
                <div className="my-1 border-t border-line/60" />
                {['admin', 'manager'].includes(user.role) && (
                  <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-ink2 hover:bg-elevated hover:text-ink" role="menuitem">
                    <LayoutDashboard className="h-3.5 w-3.5 text-brand" /> Quản trị hệ thống
                  </Link>
                )}
                {['staff', 'manager', 'admin'].includes(user.role) && (
                  <Link to="/staff/quet-ve" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-ink2 hover:bg-elevated hover:text-ink" role="menuitem">
                    <ShieldCheck className="h-3.5 w-3.5 text-info" /> Khu vực nhân viên
                  </Link>
                )}
              </>
            )}
            <div className="my-1 border-t border-line/60" />
            <button
              type="button"
              onClick={() => { setOpen(false); logout(); navigate('/'); }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs text-danger transition hover:bg-danger/10"
              role="menuitem"
            >
              <LogOut className="h-3.5 w-3.5" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const navigate = useNavigate();
  const { data, isFetching } = useQuery({
    queryKey: ['movies', 'search', debounced],
    queryFn: () => listMovies({ q: debounced, perPage: 5 }),
    enabled: open && debounced.trim().length >= 2,
  });
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const go = (path: string) => { onClose(); navigate(path); };

  return (
    <Modal open={open} onClose={onClose} title="Tìm kiếm" size="lg">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(`/phim?q=${encodeURIComponent(q.trim())}`); }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên phim, thể loại, đạo diễn…" className="pl-9" />
        </div>
      </form>
      <div className="mt-4">
        {debounced.trim().length < 2 ? (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Truy cập nhanh</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {[
                { to: '/phim', label: 'Phim đang chiếu', icon: Film },
                { to: '/lich-chieu', label: 'Lịch chiếu hôm nay', icon: CalendarDays },
                { to: '/bap-nuoc', label: 'Menu bắp nước', icon: Store },
                { to: '/khuyen-mai', label: 'Ưu đãi thành viên', icon: Heart },
              ].map((item) => (
                <button key={item.to} type="button" onClick={() => go(item.to)} className="flex items-center gap-2.5 rounded-lg border border-line/70 bg-base/40 px-3 py-2.5 text-left text-xs text-ink2 transition hover:border-brand/40 hover:text-ink">
                  <item.icon className="h-4 w-4 text-brand" /> {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : isFetching ? (
          <div className="space-y-2"><div className="skeleton h-16" /><div className="skeleton h-16" /></div>
        ) : data?.items.length ? (
          <div className="space-y-1.5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Phim ({data.total})</p>
            {data.items.map((movie: Movie) => (
              <button key={movie.id} type="button" onClick={() => go(`/phim/${movie.slug}`)} className="flex w-full items-center gap-3 rounded-lg border border-line/60 bg-base/40 p-2 text-left transition hover:border-brand/40 hover:bg-elevated">
                <div className="h-16 w-11 shrink-0 overflow-hidden rounded">
                  <PosterArt movie={movie} variant="thumb" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{movie.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">{movie.genres.join(' · ')} · {movie.duration} phút</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted" />
              </button>
            ))}
            <button type="button" onClick={() => go(`/phim?q=${encodeURIComponent(debounced.trim())}`)} className="mt-2 text-xs font-semibold text-brand hover:underline">Xem tất cả kết quả →</button>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Không tìm thấy phim phù hợp với “{debounced}”.</p>
        )}
      </div>
    </Modal>
  );
}

function Footer() {
  const { data: settings } = useQuery({ queryKey: ['settings', 'public'], queryFn: getPublicSettings, staleTime: 300_000 });
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  return (
    <footer className="mt-16 border-t border-line/60 bg-surface/40 pb-16 sm:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">
            Trải nghiệm điện ảnh đỉnh cao với ghế ngồi thoải mái, âm thanh vòm và dịch vụ tận tâm. Đặt vé trực tuyến, nhận vé điện tử tức thì.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge tone="outline">VietQR</Badge>
            <Badge tone="outline">Visa</Badge>
            <Badge tone="outline">Mastercard</Badge>
            <Badge tone="outline">Tiền mặt</Badge>
          </div>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-ink">Khám phá</h3>
          <ul className="mt-3 space-y-2 text-xs text-muted">
            {NAV_LINKS.map((link) => (
              <li key={link.to}><Link to={link.to} className="transition hover:text-brand">{link.label}</Link></li>
            ))}
            <li><Link to="/tai-khoan/ve-cua-toi" className="transition hover:text-brand">Vé của tôi</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-ink">Hỗ trợ</h3>
          <ul className="mt-3 space-y-2 text-xs text-muted">
            <li><Link to="/trang/faq" className="transition hover:text-brand">Câu hỏi thường gặp</Link></li>
            <li><Link to="/trang/dieu-khoan" className="transition hover:text-brand">Điều khoản sử dụng</Link></li>
            <li><Link to="/trang/chinh-sach-hoan-huy" className="transition hover:text-brand">Chính sách hoàn hủy</Link></li>
            <li><Link to="/trang/bao-mat" className="transition hover:text-brand">Chính sách bảo mật</Link></li>
            <li><Link to="/trang/quy-che-rap" className="transition hover:text-brand">Quy chế rạp</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-ink">Liên hệ</h3>
          <ul className="mt-3 space-y-2.5 text-xs text-muted">
            <li className="flex items-start gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 text-brand" /> Hotline: {settings?.hotline ?? '1900 6363'}</li>
            <li className="flex items-start gap-2"><Mail className="mt-0.5 h-3.5 w-3.5 text-brand" /> {settings?.email ?? 'hotro@pxucinema.vn'}</li>
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-brand" /> {settings?.address ?? 'Landmark 81, TP.HCM'}</li>
          </ul>
          <form
            className="mt-4"
            onSubmit={(e) => { e.preventDefault(); if (email.includes('@')) { setSubscribed(true); setEmail(''); } }}
          >
            <label htmlFor="newsletter" className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Nhận tin khuyến mãi</label>
            <div className="mt-1.5 flex gap-1.5">
              <Input id="newsletter" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email của bạn" className="h-9 text-xs" required />
              <Button type="submit" size="sm" variant="secondary">Gửi</Button>
            </div>
            {subscribed && <p className="mt-1 text-[10px] text-success">Đã đăng ký nhận tin. Cảm ơn bạn!</p>}
          </form>
        </div>
      </div>
      <div className="border-t border-line/60">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-4 text-[10px] text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} PXU Cinema. Bảo lưu mọi quyền.</p>
          <p className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-success" /> Thanh toán an toàn · Bảo mật dữ liệu theo Nghị định 13/2023/NĐ-CP</p>
        </div>
      </div>
    </footer>
  );
}

function MobileTabBar() {
  const items = [
    { to: '/', label: 'Trang chủ', icon: Home, end: true },
    { to: '/phim', label: 'Phim', icon: Film },
    { to: '/tai-khoan/ve-cua-toi', label: 'Vé của tôi', icon: Ticket },
    { to: '/tai-khoan', label: 'Tài khoản', icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden no-print" aria-label="Điều hướng nhanh">
      <div className="grid grid-cols-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition', isActive ? 'text-brand' : 'text-muted')}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function PublicLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnline();
  const location = useLocation();
  const { user } = useAuthStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { setDrawerOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Bỏ qua tới nội dung
      </a>
      {!online && (
        <div className="bg-warning px-4 py-1.5 text-center text-[11px] font-semibold text-slate-950" role="status">
          Bạn đang ngoại tuyến. Một số chức năng có thể tạm thời không khả dụng.
        </div>
      )}
      <header className="sticky top-0 z-50 border-b border-line/50 glass no-print">
        <div className="container-page flex h-16 items-center gap-4">
          <button type="button" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Mở menu">
            <IconButton label="Mở menu"><Menu className="h-5 w-5" /></IconButton>
          </button>
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => cn(
                  'rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
                  isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-elevated/70 hover:text-ink',
                )}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border border-line/70 bg-surface/60 px-3 text-xs text-muted transition hover:border-brand/40 hover:text-ink md:flex"
            >
              <Search className="h-3.5 w-3.5" /> Tìm phim…
              <kbd className="rounded border border-line bg-base px-1.5 py-0.5 text-[9px]">⌘K</kbd>
            </button>
            <IconButton label="Tìm kiếm" className="md:hidden" onClick={() => setSearchOpen(true)}><Search className="h-4 w-4" /></IconButton>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1 pb-16 sm:pb-0">
        <Outlet />
      </main>

      <Footer />
      <MobileTabBar />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      {drawerOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs animate-fade-in border-r border-line bg-surface p-5" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng menu"><X className="h-5 w-5 text-muted" /></button>
            </div>
            <nav className="mt-6 space-y-1">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={({ isActive }) => cn('block rounded-lg px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-brand/10 text-brand' : 'text-ink2 hover:bg-elevated')}>
                  {link.label}
                </NavLink>
              ))}
              <div className="my-2 border-t border-line/60" />
              <NavLink to="/tai-khoan/ve-cua-toi" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-ink2 hover:bg-elevated">Vé của tôi</NavLink>
              <NavLink to="/tai-khoan" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-ink2 hover:bg-elevated">Tài khoản</NavLink>
              {user && (
                <>
                  <div className="my-2 border-t border-line/60" />
                  <Link to={homeRouteFor(user)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand hover:bg-elevated">
                    <Clapperboard className="h-4 w-4" /> {user.role === 'customer' ? 'Trang chủ' : 'Khu vực làm việc'}
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-6 rounded-lg border border-line/70 bg-base/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink"><Phone className="h-3.5 w-3.5 text-brand" /> Hotline 1900 6363</p>
              <p className="mt-1 text-[10px] text-muted">Hỗ trợ 8:00 – 23:00 mỗi ngày</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
