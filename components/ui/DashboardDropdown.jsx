'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/runtime';

/** Trigger button matching Dashboard date-range / business-scope dropdowns. */
export const DashboardDropdownTrigger = forwardRef(function DashboardDropdownTrigger(
  { icon: Icon, label, description, open, compact = false, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'flex items-center justify-between rounded-lg border border-gray-200 bg-white text-sm shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        compact ? 'px-2.5 py-1.5 min-w-[9rem] max-w-[200px]' : 'px-3 py-2 min-w-[11rem] max-w-[240px]',
        className
      )}
      aria-haspopup="listbox"
      aria-expanded={open}
      {...props}
    >
      <div className="mr-2 flex min-w-0 items-center">
        {Icon ? <Icon size={compact ? 14 : 16} className="mr-1.5 shrink-0 text-gray-500" /> : null}
        <div className="min-w-0 truncate text-left font-medium text-gray-900">{tx(label)}</div>
      </div>
      <ChevronDown
        size={14}
        className={cn('shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
      />
    </button>
  );
});

/** Gray pill wrapper used on the Dashboard toolbar around date / scope pickers. */
export function DashboardDropdownShell({ children, className }) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-gray-200/50 bg-gray-50/80 p-1 backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
