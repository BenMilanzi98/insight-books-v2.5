import { afterEach, describe, it, expect, vi } from 'vitest';
import { RECONCILABLE_PAYMENT_TYPES } from '../lib/bankReconciliation/domain/enums.js';
import {
  isGuidedReconcilableAccountType,
  guidedStatementStatusLabel,
} from '../lib/bankReconciliation/domain/guidedLabels.js';
import { assertReconcilablePaymentAccount } from '../lib/bankReconciliation/application/configService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';
import {
  canCompleteFromWorkspace,
  completeReconciliation,
  summaryFromWorkspace,
} from '../components/payments/reconcile/reconApi.js';

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

describe('canCompleteFromWorkspace', () => {
  it('uses server canComplete when present, including nested GET workspace shape', () => {
    expect(
      canCompleteFromWorkspace({ calculation: { canComplete: true, differenceMinor: 50 } })
    ).toBe(true);
    expect(
      canCompleteFromWorkspace({ calculation: { canComplete: false, differenceMinor: 0 } })
    ).toBe(false);
    expect(
      canCompleteFromWorkspace({
        calculation: { calculation: { canComplete: true, differenceMinor: 0 } },
      })
    ).toBe(true);
  });

  it('falls back to differenceMinor === 0 when canComplete is absent', () => {
    expect(canCompleteFromWorkspace({ calculation: { differenceMinor: 0 } })).toBe(true);
    expect(canCompleteFromWorkspace({ calculation: { differenceMinor: '0' } })).toBe(true);
    expect(canCompleteFromWorkspace({ calculation: { differenceMinor: 1 } })).toBe(false);
    expect(canCompleteFromWorkspace({})).toBe(false);
  });
});

describe('guided reconcile complete helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('POSTs calculate then complete with the guided comment', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.includes('/complete')
          ? { reconciliation: { id: 'rec-1', status: 'COMPLETED' } }
          : { calculation: { canComplete: true, differenceMinor: 0 } },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await completeReconciliation('rec 1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/bank-reconciliation/reconciliations/rec%201/calculate'
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBe('{}');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/bank-reconciliation/reconciliations/rec%201/complete'
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      comment: 'Guided reconcile complete',
    });
    expect(result.reconciliation.status).toBe('COMPLETED');
  });

  it('does not POST complete when calculate fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Cannot complete: difference 5.00 is outside tolerance.' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(completeReconciliation('rec-1')).rejects.toThrow(
      'Cannot complete: difference 5.00 is outside tolerance.'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/calculate');
  });

  it('reads sticky summary fields from workspace counts and calculation', () => {
    const summary = summaryFromWorkspace({
      reconciliation: {
        statementOpeningBalance: '100.00',
        statementClosingBalance: '250.00',
        bookBalance: '200.00',
        status: 'IN_PROGRESS',
      },
      outstanding: [{ id: 'o1' }, { id: 'o2' }],
      calculation: {
        matchedCount: 3,
        totalCount: 5,
        calculation: {
          canComplete: false,
          differenceMinor: 500,
          decimals: { bookBalance: '200.00', difference: '5.00', statementClosing: '250.00' },
        },
      },
    });

    expect(summary.opening).toBe('100.00');
    expect(summary.closing).toBe('250.00');
    expect(summary.bookBalance).toBe('200.00');
    expect(summary.matchedCount).toBe(3);
    expect(summary.unmatchedCount).toBe(2);
    expect(summary.outstandingCount).toBe(2);
    expect(summary.difference).toBe('5.00');
    expect(summary.canComplete).toBe(false);
    expect(summary.isComplete).toBe(false);
    expect(summary.statusText).toBe('');
  });

  it('shows Reconciled status text only when the server status is COMPLETED', () => {
    const summary = summaryFromWorkspace({
      reconciliation: { status: 'COMPLETED', statementOpeningBalance: '0', statementClosingBalance: '0' },
      outstanding: [],
      calculation: {
        matchedCount: 1,
        totalCount: 1,
        calculation: { canComplete: true, differenceMinor: 0, decimals: { difference: '0.00' } },
      },
    });
    expect(summary.isComplete).toBe(true);
    expect(summary.statusText).toBe('Reconciled');
    expect(summary.canComplete).toBe(true);
  });
});
