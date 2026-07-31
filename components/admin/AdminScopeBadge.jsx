'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export default function AdminScopeBadge({ scope, className }) {
  const { t } = useI18n();
  if (!scope) return null;
  return (
    <span
      className={cn(
        'inline-flex rounded-md bg-[var(--admin-surface-muted)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--admin-text-muted)] ring-1 ring-inset ring-[var(--admin-border)]',
        className
      )}
    >
      {t('admin-foundation.scope.label', { scope })}
    </span>
  );
}
