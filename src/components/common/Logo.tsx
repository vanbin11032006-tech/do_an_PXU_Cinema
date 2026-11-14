import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';
import { LogoMark } from '@/components/ui';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('inline-flex items-center gap-2.5', className)} aria-label="PXU Cinema – về trang chủ">
      <LogoMark className={compact ? 'h-8 w-8' : 'h-9 w-9'} />
      <span className="leading-none">
        <span className="block font-display text-xl font-extrabold uppercase tracking-[0.14em] text-ink">PXU</span>
        <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.34em] text-brand">Cinema</span>
      </span>
    </Link>
  );
}
