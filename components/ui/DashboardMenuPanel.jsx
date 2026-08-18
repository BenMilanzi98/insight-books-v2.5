'use client';

import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/runtime';

/**
 * Visual shell matching the Dashboard date-range menu:
 * POS blue/sky accent bar, soft gradient panel, rounded-xl + shadow-2xl.
 */
export default function DashboardMenuPanel({ children, className, bodyClassName }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden',
        className
      )}
    >
      <div className="h-1 bg-gradient-to-r from-blue-500 via-sky-500 to-indigo-500" />
      <div className={cn('p-4 bg-gradient-to-br from-gray-50/50 to-white', bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

/** Chip / option button used inside dashboard-style menus */
export function DashboardMenuChip({ active, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'flex-shrink-0 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium',
        active
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
          : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {tx(children)}
    </button>
  );
}

/** List-row option used for sort / filter lists */
export function DashboardMenuItem({ active, className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between',
        active
          ? 'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 font-medium border border-blue-100'
          : 'text-gray-700 hover:bg-gray-50',
        className
      )}
      {...props}
    >
      {tx(children)}
    </button>
  );
}
