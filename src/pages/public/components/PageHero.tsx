import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export function PageHero({ eyebrow, title, description, breadcrumb, actions, children, className }: {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative overflow-hidden border-b border-line/60', className)}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(120% 160% at 100% 0%, rgba(255,102,0,.18), transparent 52%), radial-gradient(80% 120% at 0% 100%, rgba(56,189,248,.08), transparent 55%)',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden />
      <div className="container-page relative py-9 sm:py-14">
        {breadcrumb}
        <div className={cn('flex flex-wrap items-end justify-between gap-5', breadcrumb && 'mt-4')}>
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h1 className="font-display text-3xl font-bold uppercase leading-[0.98] tracking-wide text-ink sm:text-5xl">
              {title}
            </h1>
            {description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
