/**
 * Phase 23 Wave 1 — Marketing UTM + URL safety.
 */
import { describe, it, expect } from 'vitest';
import {
  UTM_KEYS,
  parseUtmFromUrl,
  parseUtmFromSearchParams,
  buildUtmQuery,
  validateUtmParams,
  isSafeMarketingUrl,
  normalizeMarketingUrl,
} from '@/lib/admin/marketing';

describe('Marketing Wave 1 — URL safety', () => {
  it('allows http/https URLs without credentials', () => {
    expect(isSafeMarketingUrl('https://example.com/landing')).toBe(true);
    expect(isSafeMarketingUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects javascript, data, file, relative, and credential URLs', () => {
    expect(isSafeMarketingUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMarketingUrl('data:text/html,hello')).toBe(false);
    expect(isSafeMarketingUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeMarketingUrl('//evil.example/phish')).toBe(false);
    expect(isSafeMarketingUrl('/relative/path')).toBe(false);
    expect(isSafeMarketingUrl('https://user:pass@example.com')).toBe(false);
  });

  it('normalizeMarketingUrl returns canonical https URL or error', () => {
    expect(normalizeMarketingUrl('https://example.com/campaign')).toEqual({
      ok: true,
      url: 'https://example.com/campaign',
    });
    expect(normalizeMarketingUrl('javascript:void(0)').ok).toBe(false);
    expect(normalizeMarketingUrl('').ok).toBe(false);
  });
});

describe('Marketing Wave 1 — UTM parsing and validation', () => {
  it('parses UTM keys from URL and search params', () => {
    const url =
      'https://example.com/?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&foo=bar';
    expect(parseUtmFromUrl(url)).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring_sale',
    });

    const params = new URLSearchParams('utm_term=widget&utm_content=hero');
    expect(parseUtmFromSearchParams(params)).toEqual({
      utm_term: 'widget',
      utm_content: 'hero',
    });
  });

  it('validates lowercase charset and max lengths', () => {
    const valid = validateUtmParams({
      utm_source: 'Google_Ads',
      utm_medium: 'CPC',
      utm_campaign: 'q1-2026_launch',
    });
    expect(valid.ok).toBe(true);
    expect(valid.params.utm_source).toBe('google_ads');
    expect(valid.params.utm_medium).toBe('cpc');

    const invalid = validateUtmParams({ utm_source: 'bad value!' });
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toBe('utm_invalid_charset');
  });

  it('buildUtmQuery encodes validated params safely', () => {
    const query = buildUtmQuery({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'wave1',
      ignored: 'nope',
    });
    expect(query).toContain('utm_source=newsletter');
    expect(query).toContain('utm_medium=email');
    expect(query).not.toContain('ignored');
    expect(UTM_KEYS).toContain('utm_campaign');
  });
});
