'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ClickableStatCard from '@/components/ui/ClickableStatCard';
import StatCard from '@/components/ui/StatCard';
import PosStylePageHeader, { PosStyleHeaderButton } from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';
import { cn } from '@/lib/utils';
import {
  BF_PRIMARY_BTN_CLASS,
  BF_PRIMARY_SUCCESS_BTN_CLASS,
  BF_TAB_ACTIVE_CLASS,
  BF_TAB_IDLE_CLASS,
  BF_THEAD_CLASS,
} from '@/components/budget-forecast/bfVisualClasses.js';

export {
  BF_PRIMARY_BTN_CLASS,
  BF_PRIMARY_SUCCESS_BTN_CLASS,
  BF_TAB_ACTIVE_CLASS,
  BF_TAB_IDLE_CLASS,
  BF_THEAD_CLASS,
} from '@/components/budget-forecast/bfVisualClasses.js';

const TABS = [
  { href: '/budget-forecast/budgets', label: 'Budgets' },
  { href: '/budget-forecast/forecasts', label: 'Forecasts' },
  { href: '/budget-forecast/reports', label: 'Reports' },
];

export function BfPrimaryButton({ success = false, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(success ? BF_PRIMARY_SUCCESS_BTN_CLASS : BF_PRIMARY_BTN_CLASS, className)}
      {...props}
    />
  );
}

export function BfSecondaryButton(props) {
  return <PosStyleHeaderButton {...props} />;
}

export function BfTableShell({ children, accent = 'default', className = '' }) {
  return (
    <PosStylePanel accent={accent} className={cn('overflow-x-auto', className)}>
      {children}
    </PosStylePanel>
  );
}

export default function BfShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();

  return (
    <div className="w-full">
      <PosStylePageHeader title={title} description={subtitle} actions={actions} />
      <PosStylePanel className="mb-6 p-2" accent={false}>
        <nav className="flex gap-1 overflow-x-auto" aria-label="Budget and Forecast sections">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? BF_TAB_ACTIVE_CLASS : BF_TAB_IDLE_CLASS}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </PosStylePanel>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  const tone =
    s.includes('ACTIVE') || s.includes('APPROVED')
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : s.includes('LOCK')
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : s.includes('REVIEW')
          ? 'bg-sky-50 text-sky-900 ring-sky-200'
          : 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {s || 'UNKNOWN'}
    </span>
  );
}

export function SummaryCard({
  label,
  value,
  hint,
  onClick,
  active = false,
  title,
  barClassName,
}) {
  if (onClick) {
    return (
      <ClickableStatCard
        label={label}
        value={value}
        countLabel={hint || undefined}
        active={active}
        onClick={onClick}
        title={title}
        barClassName={barClassName}
      />
    );
  }

  return (
    <StatCard label={label} value={value} title={title} barClassName={barClassName}>
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </StatCard>
  );
}
