import { describe, it, expect } from 'vitest';
import {
  money,
  addMoneyValues,
  subtractMoneyValues,
  convertToBase,
  parseDecimalToMinor,
  minorToDecimalString,
} from '../lib/accountingV2/domain/money.js';
import {
  createAccountingContext,
  contextFromSessionUser,
  assertSameBusiness,
} from '../lib/accountingV2/domain/accountingContext.js';
import {
  createSourceReference,
  deriveIdempotencyKey,
  hashCommandContent,
} from '../lib/accountingV2/domain/sourceReference.js';
import { createJournalDraft, createJournalLineDraft } from '../lib/accountingV2/domain/journalDraft.js';
import { validateDimensions, Dimension } from '../lib/accountingV2/domain/dimensionPolicy.js';
import {
  AccountingValidationError,
  UnbalancedJournalError,
  CrossTenantAccountingError,
  InvalidExchangeRateError,
} from '../lib/accountingV2/domain/errors.js';
import {
  AccountingSourceModule,
  AccountingEventType,
  PostingMode,
  isEnumValue,
  assertEnumValue,
} from '../lib/accountingV2/domain/enums.js';

describe('money value object', () => {
  it('parses decimal strings exactly', () => {
    expect(money('1500.00').minor).toBe(150000);
    expect(money('0.01').minor).toBe(1);
    expect(money('-25.50').minor).toBe(-2550);
    expect(money('1,000,000.00').minor).toBe(100000000);
  });

  it('avoids float drift for classic IEEE cases', () => {
    const a = money('0.10');
    const b = money('0.20');
    expect(addMoneyValues(a, b).decimal).toBe('0.30');
  });

  it('rounds half-up beyond scale', () => {
    expect(money('1.005').minor).toBe(101);
    expect(money('1.004').minor).toBe(100);
  });

  it('rejects malformed input', () => {
    expect(() => money('abc')).toThrow(AccountingValidationError);
    expect(() => money('')).toThrow(AccountingValidationError);
    expect(() => money(NaN)).toThrow(AccountingValidationError);
    expect(() => money('10.00', 'mwk')).toThrow(AccountingValidationError);
  });

  it('refuses cross-currency arithmetic', () => {
    expect(() => addMoneyValues(money('1.00', 'MWK'), money('1.00', 'USD'))).toThrow(
      AccountingValidationError
    );
  });

  it('subtracts and renders decimal strings', () => {
    expect(subtractMoneyValues(money('100.00'), money('40.25')).decimal).toBe('59.75');
    expect(minorToDecimalString(-5)).toBe('-0.05');
  });

  it('converts to base currency with a positive rate only', () => {
    const usd = money('10.00', 'USD');
    expect(convertToBase(usd, '1750.5', 'MWK').decimal).toBe('17505.00');
    expect(() => convertToBase(usd, 0, 'MWK')).toThrow(InvalidExchangeRateError);
    expect(() => convertToBase(usd, -1, 'MWK')).toThrow(InvalidExchangeRateError);
  });

  it('parses Prisma-Decimal-like objects', () => {
    const fakeDecimal = { d: [1], toString: () => '123.45' };
    expect(parseDecimalToMinor(fakeDecimal)).toBe(12345);
  });
});

describe('accounting context', () => {
  it('requires businessId and userId', () => {
    expect(() => createAccountingContext({})).toThrow(AccountingValidationError);
    expect(() => createAccountingContext({ businessId: 't1' })).toThrow(AccountingValidationError);
    const ctx = createAccountingContext({ businessId: 't1', userId: 'u1' });
    expect(ctx.requestId).toBeTruthy();
    expect(ctx.correlationId).toBeTruthy();
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('derives tenant from session and rejects client-supplied mismatch', () => {
    const ctx = contextFromSessionUser({ id: 'u1', tenantId: 't1' });
    expect(ctx.businessId).toBe('t1');
    expect(() =>
      contextFromSessionUser({ id: 'u1', tenantId: 't1' }, { businessId: 't2' })
    ).toThrow(CrossTenantAccountingError);
  });

  it('blocks cross-business entities', () => {
    const ctx = createAccountingContext({ businessId: 't1', userId: 'u1' });
    expect(() => assertSameBusiness(ctx, { tenantId: 't2' }, 'account')).toThrow(
      CrossTenantAccountingError
    );
    expect(() => assertSameBusiness(ctx, { tenantId: 't1' })).not.toThrow();
  });
});

describe('source reference and idempotency key', () => {
  const ref = createSourceReference({
    sourceModule: AccountingSourceModule.SALES,
    sourceType: 'Invoice',
    sourceId: 'INV-456',
    eventType: AccountingEventType.INVOICE_POSTED,
  });

  it('derives the canonical key from stable identity only', () => {
    expect(deriveIdempotencyKey('BUSINESS-123', ref)).toBe(
      'ACCOUNTING:BUSINESS-123:SALES:Invoice:INV-456:INVOICE_POSTED:1'
    );
  });

  it('same source with a different event type yields a different key', () => {
    const paymentRef = createSourceReference({ ...ref, eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED });
    expect(deriveIdempotencyKey('B1', paymentRef)).not.toBe(deriveIdempotencyKey('B1', ref));
  });

  it('rejects invalid enums and colon-bearing identity parts', () => {
    expect(() => createSourceReference({ ...ref, sourceModule: 'HACK' })).toThrow();
    const evil = createSourceReference({ ...ref, sourceId: 'a:b' });
    expect(() => deriveIdempotencyKey('B1', evil)).toThrow(AccountingValidationError);
  });

  it('content hash is stable across key order and detects material change', async () => {
    const h1 = await hashCommandContent({ sourceReference: ref, transactionDate: '2026-07-20', currency: 'MWK', amount: '100.00' });
    const h2 = await hashCommandContent({ currency: 'MWK', amount: '100.00', transactionDate: '2026-07-20', sourceReference: ref });
    const h3 = await hashCommandContent({ sourceReference: ref, transactionDate: '2026-07-20', currency: 'MWK', amount: '200.00' });
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe('journal draft validation', () => {
  const ref = createSourceReference({
    sourceModule: AccountingSourceModule.MANUAL_JOURNAL,
    sourceType: 'ManualJournal',
    sourceId: 'MJ-1',
    eventType: AccountingEventType.MANUAL_JOURNAL_POSTED,
  });

  it('accepts a balanced two-line draft and freezes it', () => {
    const draft = createJournalDraft({
      description: 'Test journal',
      transactionDate: '2026-07-20',
      sourceReference: ref,
      lines: [
        { accountId: 'a1', debit: '100.00' },
        { accountId: 'a2', credit: '100.00' },
      ],
    });
    expect(draft.totals.debitMinor).toBe(10000);
    expect(draft.totals.creditMinor).toBe(10000);
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.lines)).toBe(true);
  });

  it('rejects unbalanced drafts', () => {
    expect(() =>
      createJournalDraft({
        description: 'Bad',
        transactionDate: '2026-07-20',
        sourceReference: ref,
        lines: [
          { accountId: 'a1', debit: '100.00' },
          { accountId: 'a2', credit: '99.99' },
        ],
      })
    ).toThrow(UnbalancedJournalError);
  });

  it('rejects single-line drafts', () => {
    expect(() =>
      createJournalDraft({
        description: 'Bad',
        transactionDate: '2026-07-20',
        sourceReference: ref,
        lines: [{ accountId: 'a1', debit: '100.00' }],
      })
    ).toThrow(AccountingValidationError);
  });

  it('rejects a line with both debit and credit', () => {
    expect(() => createJournalLineDraft({ accountId: 'a1', debit: '10.00', credit: '10.00' })).toThrow(
      AccountingValidationError
    );
  });

  it('rejects negative amounts', () => {
    expect(() => createJournalLineDraft({ accountId: 'a1', debit: '-10.00' })).toThrow(
      AccountingValidationError
    );
  });

  it('rejects zero-value lines without an approved reason, accepts with one', () => {
    expect(() => createJournalLineDraft({ accountId: 'a1' })).toThrow(AccountingValidationError);
    expect(() =>
      createJournalLineDraft({ accountId: 'a1', zeroValueReason: 'memo line approved' })
    ).not.toThrow();
  });
});

describe('dimension policies', () => {
  it('requires customer on invoices and prohibits supplier', () => {
    expect(() => validateDimensions('INVOICE_POSTED', {})).toThrow(AccountingValidationError);
    expect(() =>
      validateDimensions('INVOICE_POSTED', { [Dimension.CUSTOMER]: 'c1', [Dimension.SUPPLIER]: 's1' })
    ).toThrow(AccountingValidationError);
    expect(() => validateDimensions('INVOICE_POSTED', { [Dimension.CUSTOMER]: 'c1' })).not.toThrow();
  });

  it('capital contribution allows empty dimensions (owner optional until equity UI)', () => {
    expect(() => validateDimensions('CAPITAL_CONTRIBUTION_POSTED', {})).not.toThrow();
    expect(() =>
      validateDimensions('CAPITAL_CONTRIBUTION_POSTED', { [Dimension.OWNER]: 'o1' })
    ).not.toThrow();
    expect(() =>
      validateDimensions('CAPITAL_CONTRIBUTION_POSTED', {
        [Dimension.CUSTOMER]: 'c1',
      })
    ).toThrow(AccountingValidationError);
  });
});

describe('enums', () => {
  it('are frozen single definitions with helpers', () => {
    expect(Object.isFrozen(PostingMode)).toBe(true);
    expect(isEnumValue(PostingMode, 'LEGACY')).toBe(true);
    expect(isEnumValue(PostingMode, 'legacy')).toBe(false);
    expect(() => assertEnumValue(PostingMode, 'NOPE', 'postingMode')).toThrow(RangeError);
  });
});
