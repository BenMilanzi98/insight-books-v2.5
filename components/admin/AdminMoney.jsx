'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

/**
 * Amount display that never implies a revenue domain without sourceContext.
 * @param {{ amount: number|string, currency: string, sourceContext: string, precision?: number, className?: string, signPolicy?: 'auto'|'accounting' }} props
 */
export default function AdminMoney({
  amount,
  currency,
  sourceContext,
  precision = 2,
  className,
  signPolicy = 'auto',
}) {
  const { t, formatCurrency } = useI18n();

  if (!sourceContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(t('admin-foundation.money.missingContext'));
    }
    return (
      <span className={cn('text-[var(--admin-danger,#b91c1c)]', className)} title="missing sourceContext">
        —
      </span>
    );
  }

  if (!currency) {
    return <span className={className}>—</span>;
  }

  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const formatted =
    typeof formatCurrency === 'function'
      ? formatCurrency(value, { currency, maximumFractionDigits: precision, minimumFractionDigits: precision })
      : `${currency} ${value.toFixed(precision)}`;

  return (
    <span
      className={cn('tabular-nums', className)}
      data-source-context={sourceContext}
      data-sign-policy={signPolicy}
    >
      {formatted}
    </span>
  );
}
