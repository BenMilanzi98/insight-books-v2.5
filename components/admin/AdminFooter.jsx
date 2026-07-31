'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

function envLabel() {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.NODE_ENV ||
    'development'
  );
}

export default function AdminFooter({ className }) {
  const { t } = useI18n();
  const env = envLabel();

  return (
    <footer
      className={cn(
        'shrink-0 border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-text-muted)] sm:px-6',
        className
      )}
    >
      <div className="mx-auto flex max-w-[var(--admin-content-max)] flex-wrap items-center justify-between gap-2">
        <span>{t('admin-shell.footer.version')}</span>
        <span>{t('admin-shell.footer.environment', { env })}</span>
      </div>
    </footer>
  );
}
