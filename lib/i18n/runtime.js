import nyPhrases from '../../locales/phrases/ny.json';
import { translatePhrase } from './translatePhrase.js';

let currentLocale = 'en';
let phraseMap = nyPhrases;
let translateFn = (key) => key;

export function setI18nRuntime({ locale, phrasesNy, t } = {}) {
  if (locale) currentLocale = locale;
  if (phrasesNy) phraseMap = phrasesNy;
  if (typeof t === 'function') translateFn = t;
}

export function getRuntimeLocale() {
  return currentLocale;
}

/** Translate an English UI literal (buttons, headings, placeholders). */
export function tt(text, params) {
  return translatePhrase(text, currentLocale, phraseMap, params);
}

/** Translate strings; pass through numbers, elements, and other values. */
export function tx(value, params) {
  if (typeof value === 'string') return tt(value, params);
  if (Array.isArray(value)) return value.map((item) => tx(item, params));
  return value;
}

/** Key-based translate using the last provider catalogue. */
export function tRuntime(key, params) {
  return translateFn(key, params);
}
