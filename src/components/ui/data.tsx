import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox, ArrowUpDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button, EmptyState, ErrorState, Skeleton } from './primitives';

/* ------------------------------- Tabs ------------------------------- */

export function Tabs<T extends string>({ items, value, onChange, variant = 'underline', className, size = 'md' }: {
  items: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[];
  value: T; onChange: (v: T) => void; variant?: 'underline' | 'pill' | 'segment'; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div className={cn(
      'flex shrink-0 gap-1 overflow-x-auto no-scrollbar',
      variant === 'underline' && 'border-b border-line',
      variant === 'pill' && 'rounded-full border border-line bg-surface/60 p-1',
      variant === 'segment' && 'rounded-lg border border-line bg-base/60 p-1',
      className,
    )} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'relative inline-flex shrink-0 items-center gap-2 font-semibold transition',
            size === 'sm' ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
            variant === 'underline'
              ? value === item.value
                ? 'text-brand after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand'
                : 'text-ink2 hover:text-ink'
              : value === item.value
                ? 'rounded-md bg-elevated text-ink shadow-sm'
                : 'text-ink2 hover:text-ink',
          )}
        >
          {item.icon}
          {item.label}
          {item.count !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              value === item.value ? 'bg-brand/20 text-brand' : 'bg-elevated text-muted',
            )}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Accordion({ items, className }: { items: { id: string; title: ReactNode; content: ReactNode }[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  return (
    <div className={cn('divide-y divide-line/70 rounded-card border border-line bg-surface/60', className)}>
      {items.map((item) => (
        <div key={item.id}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-semibold text-ink hover:bg-elevated/40"
            aria-expanded={open === item.id}
            onClick={() => setOpen(open === item.id ? null : item.id)}
          >
            {item.title}
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition', open === item.id && 'rotate-180')} />
          </button>
          {open === item.id && <div className="px-4 pb-4 text-sm leading-relaxed text-ink2">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Breadcrumb ------------------------------- */

export function Breadcrumb({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted', className)}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-line" />}
          {item.href ? <a href={item.href} className="transition hover:text-ink">{item.label}</a> : <span className="text-ink2">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------- Table ------------------------------- */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  sortValue?: (row: T) => string | number;
  hideOnMobile?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, loading, empty, emptyAction, onRowClick, mobileCard, className, pageSize }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number; loading?: boolean;
  empty?: ReactNode; emptyAction?: ReactNode; onRowClick?: (row: T) => void; mobileCard?: (row: T) => ReactNode;
  className?: string; pageSize?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const sorted = sort
    ? [...rows].sort((a, b) => {
      const col = columns.find((c) => c.key === sort.key);
      if (!col?.sortValue) return 0;
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv), 'vi') * sort.dir;
    })
    : rows;
  const paged = pageSize ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;
  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }
  if (!rows.length) {
    return <EmptyState icon={<Inbox className="h-6 w-6" />} title={typeof empty === 'string' ? empty : 'Chưa có dữ liệu'} description={typeof empty === 'string' ? undefined : undefined} action={emptyAction} />;
  }

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-card border border-line md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-base/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted',
                    col.align === 'right' && 'text-right', col.align === 'center' && 'text-center',
                    col.sortValue && 'cursor-pointer select-none hover:text-ink',
                  )}
                  onClick={() => {
                    if (!col.sortValue) return;
                    setSort((prev) => prev?.key === col.key ? { key: col.key, dir: prev.dir === 1 ? -1 : 1 } : { key: col.key, dir: 1 });
                  }}
                >
                  <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'justify-end', col.align === 'center' && 'justify-center')}>
                    {col.header}
                    {col.sortValue && <ArrowUpDown className={cn('h-3 w-3', sort?.key === col.key ? 'text-brand' : 'text-line')} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-b border-line/50 last:border-0 hover:bg-elevated/40', onRowClick && 'cursor-pointer')}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3.5 align-middle', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2.5 md:hidden">
        {paged.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('rounded-card border border-line bg-surface p-4', onRowClick && 'cursor-pointer active:bg-elevated')}
          >
            {mobileCard ? mobileCard(row) : (
              <div className="space-y-2">
                {columns.filter((c) => !c.hideOnMobile).map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs text-muted">{col.header}</span>
                    <span className="text-right">{col.render(row)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {pageSize && totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{sorted.length} bản ghi</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2">Trang {page}/{totalPages}</span>
            <Button variant="ghost" size="icon-sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Pagination({ page, perPage, total, onChange, className }: {
  page: number; perPage: number; total: number; onChange: (page: number) => void; className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className={cn('flex items-center justify-between gap-3 pt-4 text-xs text-muted', className)}>
      <span>{total} kết quả · trang {page}/{pages}</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</Button>
      </div>
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : undefined;
  return <ErrorState message={message} onRetry={onRetry} />;
}
