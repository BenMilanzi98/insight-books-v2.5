import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
  primary: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

/**
 * Status chip — always include readable text; colour is secondary.
 */
export default function Badge({ children, tone = 'neutral', className, icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone] || tones.neutral,
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatusBadge({ status, map = {}, className }) {
  const key = String(status || '').toLowerCase();
  const tone =
    map[key] ||
    ({
      active: 'success',
      approved: 'success',
      paid: 'success',
      completed: 'success',
      posted: 'success',
      pending: 'warning',
      draft: 'neutral',
      unpaid: 'warning',
      overdue: 'danger',
      rejected: 'danger',
      failed: 'danger',
      cancelled: 'neutral',
      inactive: 'neutral',
    }[key] || 'neutral');
  return (
    <Badge tone={tone} className={className}>
      {status}
    </Badge>
  );
}
