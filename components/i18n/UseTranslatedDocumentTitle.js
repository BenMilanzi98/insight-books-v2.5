'use client';

import { useEffect } from 'react';
import { useI18n } from './I18nProvider';

/** Sets document.title from a translation key (module entry pages). */
export default function UseTranslatedDocumentTitle({ titleKey }) {
  const { t, locale } = useI18n();
  useEffect(() => {
    if (!titleKey) return;
    const prev = document.title;
    document.title = `${t(titleKey)} | InsightBooks`;
    return () => {
      document.title = prev;
    };
  }, [titleKey, t, locale]);
  return null;
}
