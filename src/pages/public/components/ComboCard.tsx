import type { ReactNode } from 'react';
import { ShoppingBag } from 'lucide-react';
import { cn, money } from '@/lib/format';
import type { Combo } from '@/types/domain';
import { Badge } from '@/components/ui';

export function comboStockMeta(combo: Combo): { tone: 'success' | 'warning' | 'danger'; label: string } {
  if (combo.stock <= 0) return { tone: 'danger', label: 'Hết hàng' };
  if (combo.stock <= 10) return { tone: 'warning', label: `Sắp hết · còn ${combo.stock}` };
  return { tone: 'success', label: `Còn ${combo.stock} phần` };
}

export function ComboCard({ combo, action, compact = false, className }: {
  combo: Combo;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const stock = comboStockMeta(combo);
  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-card border border-line/70 bg-surface/80 shadow-card transition duration-300 ease-cinema hover:border-brand/40 hover:shadow-lift',
        className,
      )}
    >
      <div
        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(140deg, ${combo.art.from} 0%, ${combo.art.to} 100%)` }}
      >
        {combo.art.imageUrl && (
          <img
            src={combo.art.imageUrl}
            alt={combo.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 ease-cinema group-hover:scale-105"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )}
        <div className="poster-grain absolute inset-0" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" aria-hidden />
        {!combo.art.imageUrl && (
          <span className={cn('relative drop-shadow-[0_8px_18px_rgba(0,0,0,.4)]', compact ? 'text-4xl' : 'text-5xl')} role="img" aria-label={combo.name}>
            {combo.art.emoji}
          </span>
        )}
        <div className="absolute right-3 top-3"><Badge tone={stock.tone}>{stock.label}</Badge></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold uppercase leading-tight tracking-wide text-ink transition group-hover:text-brand">
          {combo.name}
        </h3>
        <p className={cn('mt-1 text-xs leading-relaxed text-muted', compact ? 'line-clamp-2' : 'line-clamp-3')}>{combo.description}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <p className="text-money font-display text-xl font-bold text-brand">{money(combo.price)}</p>
          <span className="text-[10px] text-muted">Tối đa {combo.maxPerOrder} phần/đơn</span>
        </div>
        {action && (
          <div className="mt-4 flex items-center gap-2">
            {action}
            <span className="inline-flex items-center gap-1 text-[10px] text-muted"><ShoppingBag className="h-3 w-3" /> Nhận tại quầy</span>
          </div>
        )}
      </div>
    </article>
  );
}
