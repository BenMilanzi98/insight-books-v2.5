'use client';

import { cn } from '@/lib/utils';

const TONES = {
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-600/25',
  warning: 'bg-amber-100 text-amber-900 ring-amber-600/25',
  danger: 'bg-rose-100 text-rose-800 ring-rose-600/25',
  info: 'bg-sky-100 text-sky-900 ring-sky-600/25',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};

export default function AdminStatusBadge({ children, tone = 'neutral', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
