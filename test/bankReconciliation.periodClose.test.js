import { describe, it, expect } from 'vitest';
import { getChecklistTemplate, listChecklistTemplates } from '../lib/accountingV2/periods/periodCloseChecklist.js';
import { evaluateBankReconciliationClose } from '../lib/bankReconciliation/application/periodCloseFeed.js';

describe('checklist v1.1.0 bank recon live feed', () => {
  it('publishes AUTOMATIC BANK_RECONCILIATION_REVIEWED on 1.1.0', () => {
    const v11 = getChecklistTemplate('STANDARD_MONTHLY_CLOSE', '1.1.0');
    const bank = v11.tasks.find((t) => t.taskKey === 'BANK_RECONCILIATION_REVIEWED');
    expect(bank.kind).toBe('AUTOMATIC');
    expect(bank.blocking).toBe(true);

    const v10 = getChecklistTemplate('STANDARD_MONTHLY_CLOSE', '1.0.0');
    expect(v10.tasks.find((t) => t.taskKey === 'BANK_RECONCILIATION_REVIEWED').kind).toBe('MANUAL');
    expect(listChecklistTemplates().some((t) => t.version === '1.1.0')).toBe(true);
  });
});

describe('period close feed evaluation', () => {
  it('falls back to manual when flags are off', async () => {
    const db = {
      acctV2FeatureFlag: {
        findMany: async () => [],
      },
    };
    const result = await evaluateBankReconciliationClose(
      db,
      { businessId: 'biz-1' },
      { endDate: new Date('2026-07-31') }
    );
    expect(result.automatic).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.result.mode).toBe('MANUAL_FALLBACK');
  });

  it('passes live feed when no reconcilable accounts are in scope', async () => {
    const db = {
      acctV2FeatureFlag: {
        findMany: async () => [
          {
            tenantId: 'biz-1',
            flagKey: 'bankReconciliationV2Enabled',
            moduleKey: '*',
            eventType: '*',
            enabled: true,
          },
          {
            tenantId: 'biz-1',
            flagKey: 'bankReconciliationPeriodCloseFeedEnabled',
            moduleKey: '*',
            eventType: '*',
            enabled: true,
          },
        ],
      },
      paymentAccount: {
        findMany: async () => [],
      },
      bankRecConfiguration: {
        findMany: async () => [],
      },
    };
    const result = await evaluateBankReconciliationClose(
      db,
      { businessId: 'biz-1' },
      { endDate: new Date('2026-07-31') }
    );
    expect(result.automatic).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.result.expected).toBe(0);
  });
});
