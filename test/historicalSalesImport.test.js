import { describe, it, expect } from 'vitest';
import {
  parseImportDate,
  toDateOnlyString,
  isFutureDate,
  parseCsv,
  buildImportPreview,
  buildTemplateCsv,
  TEMPLATE_HEADERS,
} from '../lib/historicalSalesImport/index.js';

describe('historical sales import dates', () => {
  it('parses YYYY-MM-DD and DD/MM/YYYY', () => {
    expect(toDateOnlyString(parseImportDate('2024-01-15'))).toBe('2024-01-15');
    expect(toDateOnlyString(parseImportDate('15/01/2024'))).toBe('2024-01-15');
    expect(toDateOnlyString(parseImportDate('15-01-2024'))).toBe('2024-01-15');
  });

  it('rejects invalid and future dates', () => {
    expect(parseImportDate('not-a-date')).toBeNull();
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureStr = toDateOnlyString(future);
    expect(isFutureDate(parseImportDate(futureStr))).toBe(true);
  });
});

describe('historical sales import CSV preview', () => {
  it('builds a simple template', () => {
    const csv = buildTemplateCsv();
    expect(csv.startsWith(TEMPLATE_HEADERS.join(','))).toBe(true);
  });

  it('previews valid rows and reports date range without stock impact', () => {
    const csv = [
      TEMPLATE_HEADERS.join(','),
      '2024-01-10,R1,Alice,Item A,1,1000,0,cash,',
      '15/01/2024,,Bob,Item B,2,500,17.5,mpamba,note',
      '2099-01-01,R3,,Future,1,1,0,cash,',
    ].join('\n');
    const rows = parseCsv(csv);
    const preview = buildImportPreview(rows);
    expect(preview.validCount).toBe(2);
    expect(preview.invalidCount).toBe(1);
    expect(preview.dateFrom).toBe('2024-01-10');
    expect(preview.dateTo).toBe('2024-01-15');
    expect(preview.stockImpact).toBe('NONE');
  });
});
