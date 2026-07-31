/**
 * Locale-aware translate for emails, PDFs, exports (server-side).
 * Does not alter amounts — labels only.
 */
import { loadMessages } from './loadMessages.js';
import { translate } from './t.js';
import { coerceLocale, DEFAULT_LOCALE } from './locales.js';

const cache = new Map();

function messagesFor(locale) {
  const loc = coerceLocale(locale);
  if (!cache.has(loc)) cache.set(loc, loadMessages(loc));
  if (!cache.has(DEFAULT_LOCALE)) cache.set(DEFAULT_LOCALE, loadMessages(DEFAULT_LOCALE));
  return {
    locale: loc,
    messages: { [loc]: cache.get(loc), en: cache.get(DEFAULT_LOCALE) },
    englishMessages: cache.get(DEFAULT_LOCALE),
  };
}

export function tDocument(key, { locale = 'en', params = {} } = {}) {
  const ctx = messagesFor(locale);
  return translate({
    key,
    locale: ctx.locale,
    messages: ctx.messages,
    englishMessages: ctx.englishMessages,
    params,
    devWarn: false,
  });
}

export function emailSubject(templateKey, { locale, params } = {}) {
  return tDocument(`emails.${templateKey}`, { locale, params });
}
