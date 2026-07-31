import { cn } from '@/lib/utils';

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[var(--surface-muted)]', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 w-full', i === lines - 1 && 'w-2/3')} />
      ))}
    </div>
  );
}
