'use client';

import { cn } from '@/lib/utils';

export default function AdminPageContainer({ children, className, maxWidth = 'default' }) {
  const max =
    maxWidth === 'full'
      ? 'max-w-none'
      : maxWidth === 'narrow'
        ? 'max-w-3xl'
        : 'max-w-[1600px]';

  return (
    <div className={cn('mx-auto w-full min-w-0', max, className)}>{children}</div>
  );
}
