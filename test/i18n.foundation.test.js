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
  setI18nRuntime,
  tt,
  translateNavLabel,
} from '../lib/i18n/index.js';
import { titleForPath } from '../components/i18n/RouteDocumentTitle.js';
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

describe('critical keys are translated in Chichewa', () => {
  it('does not force English for accounting keys in ny', () => {
    expect(shouldUseEnglishForKey('accounting.debit', 'ny')).toBe(false);
    const messages = loadAllLocaleMessages();
    const s = translate({
      key: 'accounting.debit',
      locale: 'ny',
      messages,
      englishMessages: messages.en,
    });
    expect(s).toBe('Debiti');
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

  it('translates Paid in Chichewa', () => {
    const messages = loadAllLocaleMessages();
    expect(
      translateStatus('Paid', {
        locale: 'ny',
        messages,
        englishMessages: messages.en,
      })
    ).toBe('Zalipidwa');
  });
});

describe('English UI literals', () => {
  it('translates common button labels in Chichewa', () => {
    const nyPhrases = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/phrases/ny.json'), 'utf8')
    );
    setI18nRuntime({ locale: 'ny', phrasesNy: nyPhrases });
    expect(tt('Cancel')).toBe('Letsani');
    expect(tt('Save')).toBe('Sungani');
    expect(tt('Apply')).toBe('Gwiritsani');
    expect(tt('Filters')).toBe('Zosefera');
    expect(tt('Reset all')).toBe('Bwezerani zonse');
    expect(tt('This Month')).toBe('Mwezi uno');
    expect(tt('Date range')).toBe('Masiku');
    expect(tt('Send Invoice to Client')).toBe('Tumizani inivoisi kwa kasitomala');
    expect(tt('Client Management')).toBe('Kuwongolera makasitomala');
    expect(tt('Active Clients')).toBe('Makasitomala ogwira');
    expect(tt('Profit Analysis')).toBe('Kuwunika phindu');
    expect(tt('Clients')).toBe('Makasitomala');
  });

  it('leaves English unchanged when locale is en', () => {
    setI18nRuntime({ locale: 'en' });
    expect(tt('Cancel')).toBe('Cancel');
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

describe('page titles and nav labels', () => {
  it('maps report query types to English titles for tt()', () => {
    const params = new URLSearchParams('type=PROFIT_ANALYSIS');
    expect(titleForPath('/reports-v2', params)).toBe('Profit Analysis');
    expect(titleForPath('/clients', params)).toBe('Client Management');
  });

  it('translates unmapped nav labels via phrases', () => {
    const nyPhrases = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/phrases/ny.json'), 'utf8')
    );
    setI18nRuntime({ locale: 'ny', phrasesNy: nyPhrases });
    expect(translateNavLabel('Dashboard', () => 'Tsamba loyamba')).toBe('Tsamba loyamba');
    expect(translateNavLabel('Business Management')).toBe('Kuwongolera bizinesi');
  });
});
