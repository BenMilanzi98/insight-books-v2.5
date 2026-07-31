'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export default function AdminDateRangePicker({
  from = '',
  to = '',
  onChange,
  onApply,
  onClear,
  className,
}) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-end gap-2',
        className
      )}
    >
      <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--admin-text-muted)]">
        {t('admin-foundation.dateRange.from')}
        <input
          type="date"
          value={from}
          onChange={(e) => onChange?.({ from: e.target.value, to })}
          className="h-11 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
        />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--admin-text-muted)]">
        {t('admin-foundation.dateRange.to')}
        <input
          type="date"
          value={to}
          onChange={(e) => onChange?.({ from, to: e.target.value })}
          className="h-11 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
        />
      </label>
      {onApply ? (
        <button
          type="button"
          onClick={() => onApply({ from, to })}
          className="h-11 rounded-[var(--admin-radius)] bg-[var(--admin-accent,#0ea5e9)] px-3 text-sm font-medium text-white"
        >
          {t('admin-foundation.dateRange.apply')}
        </button>
      ) : null}
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="h-11 rounded-[var(--admin-radius)] px-3 text-sm text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)]"
        >
          {t('admin-foundation.dateRange.clear')}
        </button>
      ) : null}
    </div>
  );
}
