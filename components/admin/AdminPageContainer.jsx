'use client';

import { cn } from '@/lib/utils';
import AdminPageEnter from './AdminPageEnter';

export default function AdminPageContainer({ children, className, maxWidth = 'default' }) {
  const max =
    maxWidth === 'full'
      ? 'max-w-none'
      : maxWidth === 'narrow'
        ? 'max-w-3xl'
        : 'max-w-[var(--admin-content-max)]';

  return (
    <AdminPageEnter className={cn('mx-auto w-full min-w-0', max, className)}>
      {children}
    </AdminPageEnter>
  );
}
