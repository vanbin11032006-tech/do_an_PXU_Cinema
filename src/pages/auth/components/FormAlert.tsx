import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

export function FormAlert({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{message}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" className="mt-2.5" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}
