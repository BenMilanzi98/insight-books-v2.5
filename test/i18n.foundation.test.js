import { describe, expect, it } from 'vitest';
import {
  resolveRequestLocale,
  coerceLocale,
  normalizeLocale,
  translate,
  shouldUseEnglishForKey,
  loadMessages,
  loadAllLocaleMessages,
  ALL_NAMESPACES,
  formatCurrency,
  translateStatus,
} from '../lib/i18n/index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('i18n locale resolution', () => {
  it('uses cookie over user preference', () => {
    const r = resolveRequestLocale({
      cookieHeader: 'ib_locale=ny; session=abc',
      userPreferredLanguage: 'en',
      tenantDefaultLanguage: 'en',
    });
    expect(r.locale).toBe('ny');
    expect(r.source).toBe('cookie');
  });

  it('falls back to English for unsupported values', () => {
    expect(coerceLocale('fr')).toBe('en');
    expect(normalizeLocale('de-DE')).toBeNull();
  });

  it('accepts Accept-Language ny', () => {
    const r = resolveRequestLocale({ acceptLanguage: 'ny-MW,en;q=0.8' });
    expect(r.locale).toBe('ny');
  });
});

describe('i18n catalogues', () => {
  it('has matching en/ny keys for all namespaces', () => {
    const all = loadAllLocaleMessages();
    const enKeys = Object.keys(all.en).sort();
    const nyKeys = Object.keys(all.ny).sort();
    expect(nyKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(50);
  });

  it('ALL_NAMESPACES is non-empty', () => {
    expect(ALL_NAMESPACES.length).toBeGreaterThan(10);
  });

  it('translates common.save in Chichewa', () => {
    const messages = loadAllLocaleMessages();
    const s = translate({
      key: 'common.actions.save',
      locale: 'ny',
      messages,
      englishMessages: messages.en,
    });
    expect(s).toBe('Sungani');
  });
});

describe('critical key English fallback', () => {
  it('forces English for unreviewed accounting keys in ny', () => {
    expect(shouldUseEnglishForKey('accounting.debit', 'ny')).toBe(true);
    const messages = loadAllLocaleMessages();
    const s = translate({
      key: 'accounting.debit',
      locale: 'ny',
      messages,
      englishMessages: messages.en,
    });
    // English source text while FINANCIAL_REVIEW_REQUIRED
    expect(s).toBe('Debit');
  });

  it('allows approved navigation keys in ny', () => {
    expect(shouldUseEnglishForKey('navigation.dashboard', 'ny')).toBe(false);
  });
});

describe('formatters do not change currency code', () => {
  it('formats MWK in both locales without converting', () => {
    const en = formatCurrency(1000, { locale: 'en', currencyCode: 'MWK' });
    const ny = formatCurrency(1000, { locale: 'ny', currencyCode: 'MWK' });
    expect(en).toMatch(/1[,.]?000|MWK/);
    expect(ny).toMatch(/1[,.]?000|MWK/);
  });
});

describe('status labels', () => {
  it('translates POSTED', () => {
    const messages = loadAllLocaleMessages();
    expect(
      translateStatus('POSTED', {
        locale: 'en',
        messages,
        englishMessages: messages.en,
      })
    ).toBe('Posted');
  });
});

describe('language switcher safety (static)', () => {
  it('LanguageSwitcher does not import posting engine', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/i18n/LanguageSwitcher.js'),
      'utf8'
    );
    expect(src).not.toMatch(/postingEngine|reverseJournal|createStock/);
  });
});
