import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyBusinessActivity,
  assertSetupStartAllowed,
} from '../../lib/setupWizard/activityClassifier.js';
import {
  BUSINESS_ACTIVITY_CLASS,
  SETUP_TYPE,
} from '../../lib/setupWizard/constants.js';
import { ExistingBusinessActivityConflictError } from '../../lib/setupWizard/errors.js';

function mockDb(overrides = {}) {
  const zero = async () => 0;
  const counts = {
    account: overrides.account ?? 0,
    paymentAccount: overrides.paymentAccount ?? 0,
    client: overrides.client ?? 0,
    product: overrides.product ?? 0,
    invoice: overrides.invoice ?? 0,
    supplierBill: overrides.supplierBill ?? 0,
    inventoryTransaction: overrides.inventoryTransaction ?? 0,
    journalEntry: overrides.journalEntry ?? 0,
    acctV2OpeningBalanceBatch: overrides.acctV2OpeningBalanceBatch ?? 0,
    businessSetupRun: overrides.businessSetupRun ?? 0,
    businessSetupRunPosting: overrides.businessSetupRunPosting ?? 0,
  };

  return {
    account: { count: vi.fn(async () => counts.account) },
    paymentAccount: { count: vi.fn(async () => counts.paymentAccount) },
    client: { count: vi.fn(async () => counts.client) },
    product: { count: vi.fn(async () => counts.product) },
    invoice: { count: vi.fn(async () => counts.invoice) },
    supplierBill: { count: vi.fn(async () => counts.supplierBill) },
    inventoryTransaction: { count: vi.fn(async () => counts.inventoryTransaction) },
    journalEntry: { count: vi.fn(async () => counts.journalEntry) },
    acctV2OpeningBalanceBatch: {
      count: vi.fn(async () => counts.acctV2OpeningBalanceBatch),
    },
    businessSetupRun: {
      count: vi.fn(async ({ where }) => {
        if (where?.status === 'POSTING') return counts.businessSetupRunPosting;
        return counts.businessSetupRun;
      }),
    },
  };
}

describe('classifyBusinessActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies empty business', async () => {
    const result = await classifyBusinessActivity('t1', mockDb());
    expect(result.classification).toBe(BUSINESS_ACTIVITY_CLASS.NEW_EMPTY_BUSINESS);
  });

  it('classifies partially configured with accounts only', async () => {
    const result = await classifyBusinessActivity('t1', mockDb({ account: 12 }));
    expect(result.classification).toBe(
      BUSINESS_ACTIVITY_CLASS.NEW_PARTIALLY_CONFIGURED_BUSINESS
    );
  });

  it('classifies existing with posted V2 journals', async () => {
    const result = await classifyBusinessActivity('t1', mockDb({ journalEntry: 3 }));
    expect(result.classification).toBe(
      BUSINESS_ACTIVITY_CLASS.EXISTING_WITH_FINANCIAL_ACTIVITY
    );
  });

  it('classifies completed setup when OB batch posted', async () => {
    const result = await classifyBusinessActivity(
      't1',
      mockDb({ acctV2OpeningBalanceBatch: 1 })
    );
    expect(result.classification).toBe(BUSINESS_ACTIVITY_CLASS.EXISTING_SETUP_COMPLETED);
  });
});

describe('assertSetupStartAllowed', () => {
  it('allows new empty business', () => {
    expect(() =>
      assertSetupStartAllowed({
        classification: BUSINESS_ACTIVITY_CLASS.NEW_EMPTY_BUSINESS,
      })
    ).not.toThrow();
  });

  it('blocks financial activity without conversion approval', () => {
    expect(() =>
      assertSetupStartAllowed(
        { classification: BUSINESS_ACTIVITY_CLASS.EXISTING_WITH_FINANCIAL_ACTIVITY },
        { setupType: SETUP_TYPE.NEW_BUSINESS }
      )
    ).toThrow(ExistingBusinessActivityConflictError);
  });

  it('allows conversion when approved', () => {
    const result = assertSetupStartAllowed(
      { classification: BUSINESS_ACTIVITY_CLASS.EXISTING_WITH_FINANCIAL_ACTIVITY },
      {
        setupType: SETUP_TYPE.EXISTING_BUSINESS_CONVERSION,
        conversionApproved: true,
      }
    );
    expect(result.classification).toBe(
      BUSINESS_ACTIVITY_CLASS.REQUIRES_CONTROLLED_CONVERSION
    );
  });
});
