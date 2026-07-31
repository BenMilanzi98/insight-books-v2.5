import { describe, it, expect } from 'vitest';
import { calculateReconciliation } from '../lib/bankReconciliation/domain/calculation.js';
import { assertReconcilablePaymentAccount } from '../lib/bankReconciliation/application/configService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';
import { BANK_RECON_PERMISSIONS } from '../lib/bankReconciliation/permissions.js';
import { statementToCsv } from '../lib/bankReconciliation/application/reportService.js';

describe('config validation', () => {
  it('requires Bank/Mobile Money + CoA posting account', () => {
    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Cash',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', postingAllowed: true },
      })
    ).toThrow(AccountingValidationError);

    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Bank',
        tenantId: 't1',
        coaAccountId: null,
        coaAccount: null,
      })
    ).toThrow(/linked/i);

    expect(
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Mobile Money',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', postingAllowed: true, acceptsNewTransactions: true },
      })
    ).toBe(true);
  });

  it('blocks header CoA accounts', () => {
    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Bank',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', coaV2Behaviour: 'HEADER' },
      })
    ).toThrow(/header/i);
  });
});

describe('completion gate (no plug)', () => {
  it('never allows complete when difference outside tolerance', () => {
    const calc = calculateReconciliation({
      statementClosingMinor: 50000,
      bookBalanceMinor: 40000,
      depositsInTransitMinor: 0,
      outstandingPaymentsMinor: 0,
      adjustmentsMinor: 0,
      toleranceMinor: 0,
    });
    expect(calc.canComplete).toBe(false);
    // There is no API to force difference to zero without matching/outstanding
    expect(calc.differenceMinor).not.toBe(0);
  });
});

describe('permissions catalogue', () => {
  it('exposes SoD-relevant keys', () => {
    expect(BANK_RECON_PERMISSIONS.COMPLETE).toBe('bankReconciliation.complete');
    expect(BANK_RECON_PERMISSIONS.APPROVE).toBe('bankReconciliation.approve');
    expect(BANK_RECON_PERMISSIONS.REOPEN).toBe('bankReconciliation.reopen');
  });
});

describe('export csv', () => {
  it('serializes statement sections', () => {
    const csv = statementToCsv({
      summary: {
        statementClosing: '100.00',
        bookBalance: '90.00',
        depositsInTransit: '15.00',
        outstandingPayments: '5.00',
        difference: '0.00',
      },
      sections: {
        statementLines: [
          {
            id: '1',
            date: '2026-07-01',
            description: 'Fee',
            reference: 'R1',
            amount: '-10.00',
            status: 'MATCHED',
          },
        ],
        outstanding: [],
        adjustments: [],
      },
    });
    expect(csv).toContain('STATEMENT');
    expect(csv).toContain('Difference');
    expect(csv).toContain('0.00');
  });
});
