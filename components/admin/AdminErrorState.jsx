'use client';
import { tt } from '@/lib/i18n/runtime';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminErrorState({
  title = tt('Something went wrong'),
  message,
  onRetry,
  className,
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-red-200 bg-red-50 px-4 py-6 text-[var(--status-danger)]',
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-red-800">{title}</h3>
          {message ? (
            <p className="mt-1 break-words text-sm text-red-700">{message}</p>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-[var(--radius-md)] bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              {tt('Retry')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
