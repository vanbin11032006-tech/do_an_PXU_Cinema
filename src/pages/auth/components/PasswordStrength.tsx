import { Check, X } from 'lucide-react';
import { cn } from '@/lib/format';
import { PASSWORD_STRENGTH_LABELS, passwordChecks } from './authUtils';

const BAR_TONES = ['bg-elevated', 'bg-danger', 'bg-warning', 'bg-gold', 'bg-success'] as const;
const TEXT_TONES = ['text-muted', 'text-danger', 'text-warning', 'text-gold', 'text-success'] as const;

export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const checks = passwordChecks(password);
  const score = password ? checks.filter((check) => check.ok).length : 0;

  return (
    <div id={id} className="mt-2.5 rounded-lg border border-line/60 bg-base/40 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className="flex flex-1 gap-1"
          role="progressbar"
          aria-label="Độ mạnh mật khẩu"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={score}
        >
          {checks.map((check, index) => (
            <span
              key={check.label}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                index < score ? BAR_TONES[score] : 'bg-elevated',
              )}
            />
          ))}
        </div>
        <span className={cn('shrink-0 text-[11px] font-semibold', TEXT_TONES[score])}>
          {PASSWORD_STRENGTH_LABELS[score]}
        </span>
      </div>
      <ul className="mt-2.5 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn('flex items-center gap-1.5 text-[11px]', check.ok ? 'text-success' : 'text-muted')}
          >
            {check.ok ? (
              <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
            ) : (
              <X className="h-3 w-3 shrink-0" aria-hidden />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
