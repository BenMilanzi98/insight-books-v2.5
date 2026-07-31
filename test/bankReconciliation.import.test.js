import { describe, it, expect } from 'vitest';
import { validateStatementBalances } from '../lib/bankReconciliation/application/importService.js';
import { parseXlsxStatement } from '../lib/bankReconciliation/infrastructure/parsers/xlsxParser.js';
import * as XLSX from 'xlsx';

describe('statement balance validation', () => {
  it('validates opening + movements = closing', () => {
    const rows = [
      { signedAmountMinor: 10000 },
      { signedAmountMinor: -2500 },
    ];
    const result = validateStatementBalances({
      rows,
      statementOpening: '100.00',
      statementClosing: '175.00',
    });
    expect(result.valid).toBe(true);
  });

  it('flags mismatch', () => {
    const rows = [{ signedAmountMinor: 10000 }];
    const result = validateStatementBalances({
      rows,
      statementOpening: '0',
      statementClosing: '50.00',
    });
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toMatch(/Balance validation failed/);
  });
});

describe('xlsx parser', () => {
  it('reads a simple workbook', () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Amount'],
      ['2026-07-10', 'Transfer in', '500.00'],
      ['2026-07-11', 'POS settlement', '-120.00'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const { rows, format } = parseXlsxStatement(buffer);
    expect(format).toBe('XLSX');
    expect(rows).toHaveLength(2);
    expect(rows[0].signedAmountMinor).toBe(50000);
    expect(rows[1].signedAmountMinor).toBe(-12000);
  });
});
