'use client';

import { useI18n } from './I18nProvider';

/** Shared translated H1 for module entry pages. */
export default function ModulePageHeading({ titleKey, descriptionKey = null, className = '' }) {
  const { t } = useI18n();
  return (
    <div className={className || 'mb-4'}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {t(titleKey)}
      </h1>
      {descriptionKey ? (
        <p className="mt-1 text-sm text-slate-500">{t(descriptionKey)}</p>
      ) : null}
    </div>
  );
}
