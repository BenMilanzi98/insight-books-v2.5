'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  coerceLocale,
  loadAllLocaleMessages,
  translate,
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  translateStatus,
  languageLabel,
  LOCALE_COOKIE,
} from '@/lib/i18n';

const I18nContext = createContext(null);

function readCookieLocale() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ib_locale=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function I18nProvider({
  children,
  initialLocale = 'en',
  currencyCode = 'MWK',
}) {
  const catalogues = useMemo(() => loadAllLocaleMessages(), []);
  const [locale, setLocaleState] = useState(() => coerceLocale(initialLocale));

  useEffect(() => {
    const fromCookie = readCookieLocale();
    if (fromCookie) setLocaleState(coerceLocale(fromCookie));
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key, params) =>
      translate({
        key,
        locale,
        messages: catalogues,
        englishMessages: catalogues.en,
        params,
      }),
    [locale, catalogues]
  );

  const setLocale = useCallback(async (next, { persist = true } = {}) => {
    const loc = coerceLocale(next);
    setLocaleState(loc);
    if (typeof document !== 'undefined') {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(loc)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    if (persist) {
      try {
        await fetch('/api/preferences/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: loc }),
        });
      } catch {
        // Guest / offline — cookie still set
      }
    }
    return loc;
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      languageLabel: (code) => languageLabel(code, locale),
      formatCurrency: (v, opts) =>
        formatCurrency(v, { locale, currencyCode, ...opts }),
      formatNumber: (v, opts) => formatNumber(v, { locale, ...opts }),
      formatDate: (v, opts) => formatDate(v, { locale, ...opts }),
      formatDateTime: (v, opts) => formatDateTime(v, { locale, ...opts }),
      translateStatus: (status) =>
        translateStatus(status, {
          locale,
          messages: catalogues,
          englishMessages: catalogues.en,
        }),
      catalogues,
    }),
    [locale, setLocale, t, currencyCode, catalogues]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback when provider missing (tests / isolated renders)
    const catalogues = loadAllLocaleMessages();
    return {
      locale: 'en',
      setLocale: async () => 'en',
      t: (key, params) =>
        translate({
          key,
          locale: 'en',
          messages: catalogues,
          englishMessages: catalogues.en,
          params,
        }),
      languageLabel: (code) => languageLabel(code, 'en'),
      formatCurrency: (v, opts) => formatCurrency(v, { locale: 'en', ...opts }),
      formatNumber: (v, opts) => formatNumber(v, { locale: 'en', ...opts }),
      formatDate: (v, opts) => formatDate(v, { locale: 'en', ...opts }),
      formatDateTime: (v, opts) => formatDateTime(v, { locale: 'en', ...opts }),
      translateStatus: (status) =>
        translateStatus(status, {
          locale: 'en',
          messages: catalogues,
          englishMessages: catalogues.en,
        }),
      catalogues,
    };
  }
  return ctx;
}
