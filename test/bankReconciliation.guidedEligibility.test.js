import { describe, it, expect } from 'vitest';
import { RECONCILABLE_PAYMENT_TYPES } from '../lib/bankReconciliation/domain/enums.js';
import {
  isGuidedReconcilableAccountType,
  guidedStatementStatusLabel,
} from '../lib/bankReconciliation/domain/guidedLabels.js';
import { assertReconcilablePaymentAccount } from '../lib/bankReconciliation/application/configService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';

describe('guided recon eligibility', () => {
  it('allows only Bank and Mobile Money', () => {
    expect([...RECONCILABLE_PAYMENT_TYPES]).toEqual(['Bank', 'Mobile Money']);
    expect(isGuidedReconcilableAccountType('Bank')).toBe(true);
    expect(isGuidedReconcilableAccountType('Mobile Money')).toBe(true);
    expect(isGuidedReconcilableAccountType('Cash')).toBe(false);
  });

  it('rejects Cash on assert', () => {
    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Cash',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', postingAllowed: true, acceptsNewTransactions: true },
      })
    ).toThrow(AccountingValidationError);
  });

  it('maps statement statuses to guide labels', () => {
    expect(guidedStatementStatusLabel('MATCHED')).toBe('Matched');
    expect(guidedStatementStatusLabel('UNMATCHED')).toBe('Unmatched bank');
    expect(guidedStatementStatusLabel('PARTIAL')).toBe('Unmatched bank');
  });
});
