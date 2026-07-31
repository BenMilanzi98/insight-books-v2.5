'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { SUPPORTED_LOCALES } from '@/lib/i18n/locales';
import { cn } from '@/lib/utils';

export default function AdminLanguageSwitcher({ className }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-[var(--admin-radius)] px-2 text-sm text-[var(--admin-text-muted)]',
        className
      )}
    >
      <span className="sr-only">{t('admin-shell.language.label')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="h-9 max-w-[7.5rem] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        aria-label={t('admin-shell.language.label')}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(`admin-shell.language.${code}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
