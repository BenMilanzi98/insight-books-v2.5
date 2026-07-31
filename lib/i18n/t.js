import { coerceLocale, DEFAULT_LOCALE } from './locales.js';
import { shouldUseEnglishForKey } from './criticalKeys.js';

function getByPath(obj, key) {
  if (!obj || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  const parts = String(key).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
    if (params[name] == null) return '';
    return String(params[name]);
  });
}

/**
 * Translate a key using flat or nested message dictionaries.
 * @param {object} options
 * @param {string} options.key
 * @param {string} [options.locale]
 * @param {Record<string, any>} options.messages - locale → dict (or already selected dict if messagesForLocale provided)
 * @param {Record<string, any>} [options.messagesForLocale]
 * @param {Record<string, any>} [options.englishMessages]
 * @param {Record<string, any>} [params]
 * @param {boolean} [options.devWarn]
 */
export function translate({
  key,
  locale = DEFAULT_LOCALE,
  messages,
  messagesForLocale,
  englishMessages,
  params = {},
  devWarn = process.env.NODE_ENV === 'development',
}) {
  const loc = coerceLocale(locale);
  const forceEn = shouldUseEnglishForKey(key, loc);
  const effectiveLocale = forceEn ? DEFAULT_LOCALE : loc;

  const dict =
    messagesForLocale ||
    (messages && (messages[effectiveLocale] || messages[DEFAULT_LOCALE])) ||
    {};
  const enDict = englishMessages || (messages && messages[DEFAULT_LOCALE]) || dict;

  let value = getByPath(dict, key);
  if (value == null && effectiveLocale !== DEFAULT_LOCALE) {
    value = getByPath(enDict, key);
  }
  if (value == null) {
    if (devWarn) {
      console.warn(`[i18n] missing key: ${key} (locale=${loc})`);
    }
    return interpolate(String(key).split('.').pop() || key, params);
  }
  if (typeof value === 'object' && value !== null) {
    // Plural lite: { one, other }
    const count = Number(params.count);
    if (!Number.isNaN(count) && (value.one != null || value.other != null)) {
      const pick = count === 1 ? value.one ?? value.other : value.other ?? value.one;
      return interpolate(String(pick), params);
    }
    return String(key);
  }
  return interpolate(String(value), params);
}

export function createTranslator({ locale, messages, englishMessages }) {
  return (key, params) =>
    translate({
      key,
      locale,
      messages,
      englishMessages,
      params,
    });
}
