import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--status-danger)]/30 bg-red-50 px-4 py-8 text-center',
        className
      )}
    >
      <AlertTriangle className="mb-2 h-6 w-6 text-[var(--status-danger)]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">{message}</p> : null}
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
