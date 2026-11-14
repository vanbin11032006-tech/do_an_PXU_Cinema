import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { Button, Input } from './primitives';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function useDialog(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const timer = window.setTimeout(() => {
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus();
    }, 30);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = original;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  return panelRef;
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }: {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode; children?: ReactNode;
  footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; className?: string;
}) {
  const panelRef = useDialog(open, onClose);
  if (!open) return null;
  const width = {
    sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-6xl',
  }[size];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/75 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Hộp thoại'}
        tabIndex={-1}
        className={cn(
          'relative z-10 max-h-[92dvh] w-full animate-scale-in overflow-hidden rounded-t-modal border border-line bg-surface shadow-lift sm:rounded-modal',
          'flex flex-col',
          width, className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {title && <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{title}</h2>}
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-muted transition hover:bg-elevated hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="border-t border-line/70 bg-base/40 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, width = 'md' }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: 'md' | 'lg';
}) {
  const panelRef = useDialog(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Bảng chi tiết'}
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-[100dvh] w-full animate-fade-in flex-col border-l border-line bg-surface shadow-lift',
          width === 'lg' ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line/70 px-5 py-4">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-line/70 bg-base/40 p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmText = 'Xác nhận', cancelText = 'Hủy',
  danger, requireReason, requireText, loading, extraField,
}: {
  open: boolean; onClose: () => void; onConfirm: (value: string) => void; title: string; description?: ReactNode;
  confirmText?: string; cancelText?: string; danger?: boolean; requireReason?: boolean; requireText?: string;
  loading?: boolean; extraField?: ReactNode;
}) {
  const [value, setValue] = useState('');
  useEffect(() => { if (open) setValue(''); }, [open]);
  const reasonValid = !requireReason || value.trim().length >= 10;
  const textValid = !requireText || value.trim() === requireText;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          {danger && <AlertTriangle className="h-5 w-5 text-danger" />}
          {title}
        </span>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!reasonValid || !textValid}
            loading={loading}
            onClick={() => onConfirm(value)}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {description && <div className="text-sm leading-relaxed text-ink2">{description}</div>}
        {extraField}
        {requireReason && (
          <div>
            <label className="label" htmlFor="confirm-reason">Lý do <span className="text-danger">*</span></label>
            <Input
              id="confirm-reason"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Nhập lý do tối thiểu 10 ký tự…"
              error={value.length > 0 && !reasonValid}
              autoFocus={!requireText}
            />
            <p className="mt-1 text-xs text-muted">Lý do được lưu vào nhật ký hệ thống.</p>
          </div>
        )}
        {requireText && (
          <div>
            <label className="label" htmlFor="confirm-text">Nhập <span className="font-mono text-danger">{requireText}</span> để xác nhận</label>
            <Input id="confirm-text" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
        )}
        {!requireReason && !requireText && (
          <p className="flex items-start gap-2 text-xs text-muted"><Info className="mt-0.5 h-3.5 w-3.5" />Thao tác này không thể hoàn tác tự động.</p>
        )}
      </div>
    </Modal>
  );
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[240px] -translate-x-1/2 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs text-ink shadow-lg group-hover/tt:block group-focus-within/tt:block',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  );
}
