'use client';

import { useI18n } from './I18nProvider';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

/**
 * Accessible language switcher — text labels only (not flags).
 * Preserves current route/query (no navigation).
 */
export default function LanguageSwitcher({
  className = '',
  compact = false,
  showLabel = true,
}) {
  const { locale, setLocale, t, languageLabel } = useI18n();

  return (
    <div
      className={className}
      role="group"
      aria-label={t('accessibility.languageSwitcher')}
    >
      {showLabel && !compact ? (
        <span className="sr-only">{t('common.language.label')}</span>
      ) : null}
      <select
        value={locale}
        onChange={(e) => {
          void setLocale(e.target.value);
        }}
        className={
          compact
            ? 'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700'
            : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm'
        }
        aria-label={t('common.language.switchTo')}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {languageLabel(code)}
          </option>
        ))}
      </select>
    </div>
  );
}
