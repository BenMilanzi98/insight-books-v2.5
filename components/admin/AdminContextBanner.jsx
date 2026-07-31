'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

/** Real-actor identity strip (support-access banner remains separate). */
export default function AdminContextBanner({ admin, className }) {
  const { t } = useI18n();
  if (!admin) return null;

  return (
    <div
      className={cn(
        'mb-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] px-3 py-2 text-xs text-[var(--admin-text-muted)] sm:hidden',
        className
      )}
    >
      <div>{t('admin-shell.actor.signedInAs', { name: admin.name || admin.email || '—' })}</div>
      <div>{t('admin-shell.actor.role', { role: admin.role || '—' })}</div>
    </div>
  );
}
