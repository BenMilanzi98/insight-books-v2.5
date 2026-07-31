'use client';

import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

export default function LanguageSettingsCard() {
  const { t, locale } = useI18n();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{t('settings.language')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('settings.languageHelp')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LanguageSwitcher />
        <span className="text-xs text-slate-400">
          {t('common.language.label')}: {locale}
        </span>
      </div>
    </div>
  );
}
