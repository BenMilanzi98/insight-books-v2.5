'use client';

import { cn } from '@/lib/utils';

/** Soft page enter for admin routes. Disabled visually when reduced-motion is on. */
export default function AdminPageEnter({ children, className }) {
  return <div className={cn('admin-page-enter', className)}>{children}</div>;
}
