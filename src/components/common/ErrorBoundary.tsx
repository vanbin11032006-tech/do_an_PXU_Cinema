import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

interface State { hasError: boolean; message?: string; requestId?: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Lỗi không xác định' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('[PXU]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger"><TriangleAlert className="h-7 w-7" /></div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">Có lỗi xảy ra</h1>
        <p className="mt-2 max-w-md text-sm text-muted">Màn hình này gặp sự cố không mong muốn. Bạn có thể tải lại trang để tiếp tục.</p>
        {this.state.message && <code className="mt-3 max-w-lg overflow-auto rounded-md bg-base px-3 py-2 text-[11px] text-danger/80">{this.state.message}</code>}
        <button
          type="button"
          onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <RefreshCw className="h-4 w-4" /> Tải lại trang
        </button>
      </div>
    );
  }
}
