'use client';

import { cn } from '@/lib/utils';

export default function AdminLoadingState({ label = 'Loading', className, rows = 3 }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-muted)]"
        />
      ))}
    </div>
  );
}
