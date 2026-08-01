'use client';

import { cn } from '@/lib/utils';
import AdminPageEnter from './AdminPageEnter';

export default function AdminPageContainer({ children, className, maxWidth = 'full' }) {
  const max =
    maxWidth === 'narrow'
      ? 'max-w-3xl'
      : 'max-w-none';

  return (
    <AdminPageEnter className={cn('mx-auto w-full min-w-0', max, className)}>
      {children}
    </AdminPageEnter>
  );
}
