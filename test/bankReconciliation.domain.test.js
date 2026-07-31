import { describe, it, expect } from 'vitest';
import {
  signedFromDebitCredit,
  signedFromJournalLine,
  normalizeReference,
  toSignedMinor,
  fromSignedMinor,
  daysBetween,
} from '../lib/bankReconciliation/domain/signedAmount.js';
import { calculateReconciliation, progressPercent } from '../lib/bankReconciliation/domain/calculation.js';
import { CONFIDENCE_RANK, MatchConfidence } from '../lib/bankReconciliation/domain/enums.js';
import { scorePair, findSubsetSum, DEFAULT_RULES } from '../lib/bankReconciliation/application/matchingService.js';
import { assertSafeStatementFile, sanitizeCell } from '../lib/bankReconciliation/infrastructure/fileSecurity.js';
import { parseCsvStatement } from '../lib/bankReconciliation/infrastructure/parsers/csvParser.js';
import { parseOfxStatement } from '../lib/bankReconciliation/infrastructure/parsers/ofxParser.js';

describe('signed amounts', () => {
  it('normalizes debit/credit to bank perspective', () => {
    expect(signedFromDebitCredit({ debit: '100.00', credit: '0' })).toBe(-10000);
    expect(signedFromDebitCredit({ debit: '0', credit: '50.00' })).toBe(5000);
    expect(signedFromDebitCredit({ amount: '-25.50' })).toBe(-2550);
  });

  it('normalizes journal asset lines (debit increases bank)', () => {
    expect(signedFromJournalLine({ debit: '200.00', credit: '0' })).toBe(20000);
    expect(signedFromJournalLine({ debit: '0', credit: '75.00' })).toBe(-7500);
  });

  it('normalizes references', () => {
    expect(normalizeReference(' chq-001 ')).toBe('CHQ001');
  });

  it('round-trips minor units', () => {
    expect(fromSignedMinor(toSignedMinor('1,234.56'))).toBe('1234.56');
  });
});

describe('calculation engine', () => {
  it('reconciles when statement equals adjusted book', () => {
    const calc = calculateReconciliation({
      statementClosingMinor: 100000,
      bookBalanceMinor: 90000,
      depositsInTransitMinor: 15000,
      outstandingPaymentsMinor: 5000,
      adjustmentsMinor: 0,
    });
    expect(calc.adjustedBookMinor).toBe(100000);
    expect(calc.differenceMinor).toBe(0);
    expect(calc.canComplete).toBe(true);
  });

  it('blocks complete when difference remains', () => {
    const calc = calculateReconciliation({
      statementClosingMinor: 100000,
      bookBalanceMinor: 90000,
      depositsInTransitMinor: 0,
      outstandingPaymentsMinor: 0,
      adjustmentsMinor: 0,
      toleranceMinor: 0,
    });
    expect(calc.canComplete).toBe(false);
    expect(calc.differenceMinor).toBe(10000);
  });

  it('respects tolerance', () => {
    const calc = calculateReconciliation({
      statementClosingMinor: 10001,
      bookBalanceMinor: 10000,
      depositsInTransitMinor: 0,
      outstandingPaymentsMinor: 0,
      adjustmentsMinor: 0,
      toleranceMinor: 1,
    });
    expect(calc.canComplete).toBe(true);
  });

  it('computes progress', () => {
    expect(progressPercent({ matchedCount: 3, totalCount: 4 })).toBe(75);
    expect(progressPercent({ matchedCount: 0, totalCount: 0 })).toBe(100);
  });
});

describe('matching rules', () => {
  const stmt = {
    id: 's1',
    transactionDate: new Date('2026-07-01'),
    remainingAmountMinor: -5000,
    reference: 'ABC123',
    referenceNormalized: 'ABC123',
  };
  const book = {
    journalEntryLineId: 'l1',
    journalEntryId: 'j1',
    transactionDate: new Date('2026-07-01'),
    remainingAmountMinor: -5000,
    reference: 'ABC-123',
  };

  it('scores exact ref+amount+date', () => {
    const rule = DEFAULT_RULES[0];
    const hit = scorePair(stmt, book, rule, 3);
    expect(hit).toBeTruthy();
    expect(hit.confidence).toBe(MatchConfidence.EXACT);
  });

  it('rejects amount mismatch', () => {
    const rule = DEFAULT_RULES[1];
    const hit = scorePair(stmt, { ...book, remainingAmountMinor: -4000 }, rule, 3);
    expect(hit).toBeNull();
  });

  it('finds 1:N subset sum', () => {
    const combo = findSubsetSum(
      [
        { journalEntryLineId: 'a', remainingAmountMinor: -2000 },
        { journalEntryLineId: 'b', remainingAmountMinor: -3000 },
        { journalEntryLineId: 'c', remainingAmountMinor: -9000 },
      ],
      -5000,
      5
    );
    expect(combo).toBeTruthy();
    expect(combo).toHaveLength(2);
  });

  it('ranks confidence for auto-accept gating', () => {
    expect(CONFIDENCE_RANK.EXACT).toBeGreaterThan(CONFIDENCE_RANK.HIGH);
    expect(CONFIDENCE_RANK.HIGH).toBeGreaterThan(CONFIDENCE_RANK.MEDIUM);
  });
});

describe('file security', () => {
  it('accepts csv and hashes', () => {
    const buf = Buffer.from('Date,Description,Amount\n2026-07-01,Test,10.00\n');
    const meta = assertSafeStatementFile({ buffer: buf, fileName: 'stmt.csv' });
    expect(meta.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(meta.ext).toBe('.csv');
  });

  it('rejects oversized extension', () => {
    expect(() =>
      assertSafeStatementFile({ buffer: Buffer.from('x'), fileName: 'evil.exe' })
    ).toThrow(/FILE_TYPE_NOT_ALLOWED/);
  });

  it('sanitizes formula cells', () => {
    expect(sanitizeCell('=cmd|"/c calc"!A1')).toMatch(/^'/);
  });
});

describe('parsers', () => {
  it('parses CSV with debit/credit columns', () => {
    const csv = [
      'Date,Description,Reference,Debit,Credit',
      '2026-07-01,Salary,,0,1000.00',
      '2026-07-02,Fee,FEE1,25.00,0',
    ].join('\n');
    const { rows } = parseCsvStatement(Buffer.from(csv));
    expect(rows).toHaveLength(2);
    expect(rows[0].signedAmountMinor).toBe(100000);
    expect(rows[1].signedAmountMinor).toBe(-2500);
    expect(rows[1].referenceNormalized).toBe('FEE1');
  });

  it('parses OFX STMTTRN blocks', () => {
    const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260715
<TRNAMT>-12.50
<FITID>X1
<NAME>BANK FEE
<MEMO>Monthly fee
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260716
<TRNAMT>200.00
<FITID>X2
<NAME>DEPOSIT
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>187.50
<DTASOF>20260716
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const { rows, statementClosing } = parseOfxStatement(Buffer.from(ofx));
    expect(rows).toHaveLength(2);
    expect(rows[0].signedAmountMinor).toBe(-1250);
    expect(rows[1].signedAmountMinor).toBe(20000);
    expect(statementClosing).toBe('187.50');
  });
});

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween(new Date('2026-07-01'), new Date('2026-07-04'))).toBe(3);
  });
});
