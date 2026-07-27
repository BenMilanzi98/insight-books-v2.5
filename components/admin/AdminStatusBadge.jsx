'use client';

import { cn } from '@/lib/utils';

const TONES = {
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-red-50 text-red-800 ring-red-600/20',
  info: 'bg-sky-50 text-sky-800 ring-sky-600/20',
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
