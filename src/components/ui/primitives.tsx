import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Loader2, Star, ChevronDown } from 'lucide-react';
import { cn, initials, money } from '@/lib/format';
import type { AgeRating, PaymentStatus, Tier } from '@/types/domain';

/* ------------------------------- Button ------------------------------- */

const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition duration-200 ease-cinema disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white shadow-glow hover:bg-brand-600 active:bg-brand-700',
        secondary: 'border border-line bg-elevated/80 text-ink hover:border-brand/50 hover:bg-elevated',
        outline: 'border border-brand/60 bg-brand/5 text-brand hover:bg-brand/15',
        ghost: 'text-ink2 hover:bg-elevated/80 hover:text-ink',
        danger: 'bg-danger text-white hover:bg-red-600',
        gold: 'bg-gold text-slate-950 hover:bg-amber-300',
        success: 'bg-success text-white hover:bg-green-600',
        subtle: 'bg-white/5 text-ink2 hover:bg-white/10 hover:text-ink',
        dark: 'bg-slate-950/80 text-white border border-white/10 hover:border-white/25',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
      full: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, full, loading, icon, children, disabled, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, full }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md' }>(
  function IconButton({ className, label, size = 'md', children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex items-center justify-center rounded-lg border border-line/70 bg-surface/70 text-ink2 transition hover:border-brand/50 hover:text-ink',
          size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

/* ------------------------------- Fields ------------------------------- */

export function Field({ label, htmlFor, error, hint, required, children, className }: {
  label?: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}{required && <span className="ml-1 text-brand">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: boolean }>(
  function Input({ className, error, ...props }, ref) {
    return <input ref={ref} className={cn('field', error && 'field-error', className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }>(
  function Textarea({ className, error, ...props }, ref) {
    return <textarea ref={ref} className={cn('field min-h-[96px] resize-y', error && 'field-error', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }>(
  function Select({ className, error, children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn('field appearance-none pr-9', error && 'field-error', className)} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </div>
    );
  },
);

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-ink2', className)}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line bg-base text-brand focus:ring-brand/40 focus:ring-offset-0"
        {...props}
      />
      {label && <span className="leading-snug">{label}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string; disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-center gap-3', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ?? 'Bật/tắt'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition',
          checked ? 'border-brand bg-brand' : 'border-line bg-elevated',
        )}
      >
        <span className={cn(
          'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-ink">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

/* ------------------------------- Badges ------------------------------- */

const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5', {
  variants: {
    tone: {
      neutral: 'border-line bg-elevated text-ink2',
      brand: 'border-brand/30 bg-brand/10 text-brand',
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/10 text-warning',
      danger: 'border-danger/30 bg-danger/10 text-danger',
      info: 'border-info/30 bg-info/10 text-sky-300',
      purple: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
      gold: 'border-gold/30 bg-gold/10 text-gold',
      outline: 'border-line text-ink2',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_META: Record<string, { label: string; tone: NonNullable<BadgeProps['tone']> }> = {
  holding: { label: 'Đang giữ ghế', tone: 'warning' },
  pending: { label: 'Chờ thanh toán', tone: 'warning' },
  proof_submitted: { label: 'Chờ duyệt', tone: 'info' },
  confirmed: { label: 'Đã thanh toán', tone: 'success' },
  paid: { label: 'Đã thanh toán', tone: 'success' },
  rejected: { label: 'Biên lai bị từ chối', tone: 'danger' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  completed: { label: 'Đã hoàn thành', tone: 'neutral' },
  refunded: { label: 'Đã hoàn tiền', tone: 'purple' },
  partially_refunded: { label: 'Hoàn một phần', tone: 'purple' },
  valid: { label: 'Chưa sử dụng', tone: 'success' },
  used: { label: 'Đã sử dụng', tone: 'neutral' },
  selling: { label: 'Đang mở bán', tone: 'success' },
  scheduled: { label: 'Đã lên lịch', tone: 'info' },
  closed: { label: 'Đóng bán', tone: 'neutral' },
  finished: { label: 'Đã chiếu', tone: 'neutral' },
  active: { label: 'Hoạt động', tone: 'success' },
  paused: { label: 'Tạm dừng', tone: 'warning' },
  locked: { label: 'Đã khóa', tone: 'danger' },
  invited: { label: 'Đã mời', tone: 'info' },
  maintenance: { label: 'Bảo trì', tone: 'warning' },
  requested: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'info' },
  processing: { label: 'Đang xử lý', tone: 'info' },
  failed: { label: 'Thất bại', tone: 'danger' },
  now_showing: { label: 'Đang chiếu', tone: 'success' },
  coming_soon: { label: 'Sắp chiếu', tone: 'info' },
  ended: { label: 'Đã kết thúc', tone: 'neutral' },
  open: { label: 'Đang mở', tone: 'success' },
  resolved: { label: 'Đã xử lý', tone: 'neutral' },
  published: { label: 'Đã đăng', tone: 'success' },
  draft: { label: 'Nháp', tone: 'neutral' },
  below: { label: 'Dưới ngưỡng', tone: 'neutral' },
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' as const };
  return <Badge tone={meta.tone} className={className}>{label ?? meta.label}</Badge>;
}

const AGE_STYLE: Record<AgeRating, string> = {
  P: 'bg-emerald-500 text-white',
  K: 'bg-sky-500 text-white',
  T13: 'bg-yellow-400 text-slate-950',
  T16: 'bg-orange-500 text-white',
  T18: 'bg-red-600 text-white',
};

export function AgeBadge({ age, className }: { age: AgeRating; className?: string }) {
  return (
    <span
      title={`Nhãn độ tuổi ${age}`}
      className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[11px] font-extrabold tracking-wide', AGE_STYLE[age], className)}
    >
      {age}
    </span>
  );
}

export function TierBadge({ tier, label }: { tier: Tier; label?: string }) {
  const tone: Record<Tier, string> = {
    member: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
    silver: 'border-slate-300/40 bg-slate-300/10 text-slate-200',
    gold: 'border-gold/40 bg-gold/10 text-gold',
    diamond: 'border-info/40 bg-info/10 text-sky-300',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tone[tier])}>{label ?? tier}</span>;
}

/* ------------------------------- Surfaces ------------------------------- */

export function Card({ className, hover, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line/80 bg-surface/85 shadow-card backdrop-blur-sm',
        hover && 'transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Chip({ active, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition',
        active
          ? 'border-brand bg-brand/15 text-brand'
          : 'border-line bg-surface/60 text-ink2 hover:border-brand/40 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Avatar({ name, seed = 0, size = 'md', className }: {
  name: string; seed?: number; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string;
}) {
  const gradients = [
    'from-orange-500 to-rose-600', 'from-sky-500 to-indigo-600', 'from-emerald-500 to-teal-700',
    'from-fuchsia-500 to-purple-700', 'from-amber-400 to-orange-600', 'from-cyan-400 to-blue-700',
  ];
  const sizes = { xs: 'h-7 w-7 text-[10px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg' };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/10', gradients[seed % gradients.length], sizes[size], className)}>
      {initials(name)}
    </span>
  );
}

/* ------------------------------- Data display ------------------------------- */

export function PriceText({ value, className, suffix }: { value: number; className?: string; suffix?: ReactNode }) {
  return <span className={cn('text-money font-semibold', className)}>{money(value)}{suffix}</span>;
}

export function Rating({ value, outOf = 10, showValue = true, size = 'sm' }: {
  value: number; outOf?: number; showValue?: boolean; size?: 'xs' | 'sm' | 'md';
}) {
  const stars = Math.round((value / outOf) * 5);
  const px = size === 'xs' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Điểm ${value}/${outOf}`}>
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(px, i < stars ? 'fill-gold text-gold' : 'text-line')} strokeWidth={1.5} />
        ))}
      </span>
      {showValue && <span className={cn('text-money font-semibold text-gold', size === 'md' ? 'text-sm' : 'text-xs')}>{value.toFixed(1)}</span>}
    </span>
  );
}

export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'success' | 'gold' }) {
  const toneClass = { brand: 'bg-brand', success: 'bg-success', gold: 'bg-gold' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', toneClass)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* ------------------------------- Feedback ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand', className)} aria-label="Đang tải" />;
}

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-card border border-dashed border-line/80 bg-surface/40 px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-muted">{icon}</div>
      <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Không tải được dữ liệu', message, onRetry, className }: {
  title?: string; message?: string; onRetry?: () => void; className?: string;
}) {
  return (
    <div className={cn('rounded-card border border-danger/30 bg-danger/5 px-6 py-10 text-center', className)} role="alert">
      <h3 className="font-display text-xl font-semibold uppercase text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink2">{message ?? 'Đã xảy ra lỗi kết nối. Vui lòng thử lại.'}</p>
      {onRetry && <Button className="mt-5" variant="secondary" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function CheckMark({ className }: { className?: string }) {
  return <Check className={cn('h-4 w-4', className)} strokeWidth={3} />;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge status={status} />;
}
