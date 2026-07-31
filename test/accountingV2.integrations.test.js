/**
 * Phase 9 — Stage 1–3A cutover / adapter / legacy-guard integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAcctV2PrismaStub } from './helpers/acctV2PrismaStub.js';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { runCutoverPosting } from '../lib/accountingV2/adapters/cutoverBridge.js';
import { assertLegacyPostingAllowed } from '../lib/accountingV2/engine/legacyGuard.js';
import { getActiveTemplate, TemplateStatus } from '../lib/accountingV2/templates/index.js';
import { SCAFFOLDED_ADAPTERS } from '../lib/accountingV2/adapters/scaffolds.js';
import { AccountingEventType, AccountingSourceModule, PostingMode } from '../lib/accountingV2/domain/enums.js';
import { LegacyAndNewPostingConflictError, PostingDisabledError } from '../lib/accountingV2/domain/errors.js';
import { FLAG } from '../lib/accountingV2/infrastructure/featureFlags.js';

const T1 = 'tenant-1';
const USER = 'user-1';

vi.mock('../lib/accountingV2/engine/postingEngine.js', () => ({
  executePosting: vi.fn(async () => ({
    journalEntryId: 'je_v2_1',
    eventRegistryId: 'evt_1',
    status: 'POSTED',
  })),
}));

import { executePosting } from '../lib/accountingV2/engine/postingEngine.js';

const ctx = () =>
  createAccountingContext({ businessId: T1, userId: USER, sourceChannel: 'test' });

const newEngineSeed = () => ({
  configurations: [
    {
      id: 'cfg1',
      tenantId: T1,
      baseCurrency: 'MWK',
      defaultPostingMode: 'NEW_ENGINE',
      enableShadowAccounting: true,
    },
  ],
  featureFlags: [
    { id: 'f1', tenantId: T1, flagKey: FLAG.V2_ENABLED, moduleKey: '*', eventType: '*', enabled: true },
  ],
});

const shadowSeed = () => ({
  configurations: [
    {
      id: 'cfg1',
      tenantId: T1,
      baseCurrency: 'MWK',
      defaultPostingMode: 'SHADOW',
      enableShadowAccounting: true,
    },
  ],
});

const legacySeed = () => ({
  configurations: [
    {
      id: 'cfg1',
      tenantId: T1,
      baseCurrency: 'MWK',
      defaultPostingMode: 'LEGACY',
      enableShadowAccounting: false,
    },
  ],
});

describe('Phase 9 cutover bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('NEW_ENGINE calls executePosting only', async () => {
    const { client } = makeAcctV2PrismaStub(newEngineSeed());
    const outcome = await runCutoverPosting({
      db: client,
      context: ctx(),
      moduleKey: AccountingSourceModule.EXPENSES,
      eventType: AccountingEventType.EXPENSE_POSTED,
      buildEngineInput: async () => ({
        sourceReference: {
          sourceModule: AccountingSourceModule.EXPENSES,
          sourceType: 'Expense',
          sourceId: 'exp-1',
          eventType: AccountingEventType.EXPENSE_POSTED,
        },
        transactionDate: '2026-07-15',
        totalAmount: '100.00',
      }),
    });

    expect(outcome.mode).toBe(PostingMode.NEW_ENGINE);
    expect(outcome.authority).toBe('V2');
    expect(outcome.result.journalEntryId).toBe('je_v2_1');
    expect(executePosting).toHaveBeenCalledTimes(1);
    expect(executePosting).toHaveBeenCalledWith(expect.any(Object), client);
  });

  it('LEGACY/SHADOW configs still resolve to NEW_ENGINE cutover', async () => {
    const { client } = makeAcctV2PrismaStub(legacySeed());
    const outcome = await runCutoverPosting({
      db: client,
      context: ctx(),
      moduleKey: AccountingSourceModule.SALES,
      eventType: AccountingEventType.INVOICE_POSTED,
      buildEngineInput: async () => ({ totalAmount: '50.00' }),
    });

    expect(outcome.mode).toBe(PostingMode.NEW_ENGINE);
    expect(outcome.authority).toBe('V2');
    expect(executePosting).toHaveBeenCalledTimes(1);
  });

  it('SHADOW config also posts via NEW_ENGINE only', async () => {
    const { client } = makeAcctV2PrismaStub(shadowSeed());
    const outcome = await runCutoverPosting({
      db: client,
      context: ctx(),
      moduleKey: AccountingSourceModule.RECEIVABLES,
      eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED,
      buildEngineInput: async () => ({ totalAmount: '25.00' }),
    });

    expect(outcome.mode).toBe(PostingMode.NEW_ENGINE);
    expect(outcome.authority).toBe('V2');
    expect(executePosting).toHaveBeenCalledTimes(1);
  });

  it('DISABLED refuses posting', async () => {
    const { client } = makeAcctV2PrismaStub({
      configurations: [
        {
          id: 'cfg1',
          tenantId: T1,
          baseCurrency: 'MWK',
          defaultPostingMode: 'DISABLED',
          enableShadowAccounting: false,
        },
      ],
    });
    await expect(
      runCutoverPosting({
        db: client,
        context: ctx(),
        moduleKey: AccountingSourceModule.BANKING,
        eventType: AccountingEventType.BANK_CHARGE_POSTED,
        buildEngineInput: async () => ({}),
      })
    ).rejects.toBeInstanceOf(PostingDisabledError);
  });
});

describe('Phase 9 legacy guard expansion', () => {
  it.each([
    ['Expense', AccountingSourceModule.EXPENSES, AccountingEventType.EXPENSE_POSTED],
    ['BankCharge', AccountingSourceModule.BANKING, AccountingEventType.BANK_CHARGE_POSTED],
    ['InterestIncome', AccountingSourceModule.BANKING, AccountingEventType.INTEREST_INCOME_POSTED],
    ['SupplierBill', AccountingSourceModule.PAYABLES, AccountingEventType.SUPPLIER_BILL_POSTED],
    ['SupplierPayment', AccountingSourceModule.PAYABLES, AccountingEventType.SUPPLIER_PAYMENT_POSTED],
    ['Payment', AccountingSourceModule.RECEIVABLES, AccountingEventType.CUSTOMER_PAYMENT_POSTED],
    ['Invoice', AccountingSourceModule.SALES, AccountingEventType.INVOICE_POSTED],
    ['Sale', AccountingSourceModule.POINT_OF_SALE, AccountingEventType.INVENTORY_SOLD],
    ['Sale-COGS', AccountingSourceModule.INVENTORY, AccountingEventType.COST_OF_SALES_RECOGNIZED],
    ['Invoice-COGS', AccountingSourceModule.INVENTORY, AccountingEventType.COST_OF_SALES_RECOGNIZED],
    ['GoodsReceipt', AccountingSourceModule.PURCHASES, AccountingEventType.INVENTORY_RECEIVED],
    ['InventoryExpiryWriteOff', AccountingSourceModule.INVENTORY, AccountingEventType.STOCK_ADJUSTMENT_POSTED],
    ['InventoryManualStockOut', AccountingSourceModule.INVENTORY, AccountingEventType.STOCK_ADJUSTMENT_POSTED],
    ['CreditNote', AccountingSourceModule.SALES, AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED],
    ['InvoiceRefund', AccountingSourceModule.RECEIVABLES, AccountingEventType.CUSTOMER_REFUND_POSTED],
    ['Payroll', AccountingSourceModule.PAYROLL, AccountingEventType.PAYROLL_POSTED],
    ['SalaryAdvance', AccountingSourceModule.PAYROLL, AccountingEventType.PAYROLL_POSTED],
    ['Asset', AccountingSourceModule.FIXED_ASSETS, AccountingEventType.ASSET_ACQUIRED],
    ['DepreciationSchedule', AccountingSourceModule.FIXED_ASSETS, AccountingEventType.DEPRECIATION_POSTED],
    ['Liability', AccountingSourceModule.LOANS, AccountingEventType.LOAN_RECEIVED],
    ['LiabilityPayment', AccountingSourceModule.LOANS, AccountingEventType.LOAN_REPAYMENT_POSTED],
    ['capital_contribution', AccountingSourceModule.EQUITY, AccountingEventType.CAPITAL_CONTRIBUTION_POSTED],
    ['Transfer', AccountingSourceModule.BANKING, AccountingEventType.BANK_TRANSFER_POSTED],
    ['PosCashDeposit', AccountingSourceModule.BANKING, AccountingEventType.BANK_TRANSFER_POSTED],
    ['TaxPayment', AccountingSourceModule.TAX, AccountingEventType.TAX_SETTLEMENT_POSTED],
  ])('blocks %s when NEW_ENGINE is authoritative', async (sourceType) => {
    const { client } = makeAcctV2PrismaStub(newEngineSeed());
    await expect(
      assertLegacyPostingAllowed({ tenantId: T1, sourceType, sourceId: 'src-1' }, client)
    ).rejects.toBeInstanceOf(LegacyAndNewPostingConflictError);
  });

  it('refuses Expense even under legacy config (V2-only)', async () => {
    const { client } = makeAcctV2PrismaStub(legacySeed());
    await expect(
      assertLegacyPostingAllowed({ tenantId: T1, sourceType: 'Expense', sourceId: 'src-1' }, client)
    ).rejects.toBeInstanceOf(LegacyAndNewPostingConflictError);
  });

  it('blocks duplicate when V2 registry already POSTED', async () => {
    const { client } = makeAcctV2PrismaStub({
      ...legacySeed(),
      eventRegistry: [
        {
          id: 'er1',
          tenantId: T1,
          sourceType: 'Expense',
          sourceId: 'exp-dup',
          status: 'POSTED',
          journalEntryId: 'je1',
        },
      ],
    });
    await expect(
      assertLegacyPostingAllowed(
        { tenantId: T1, sourceType: 'Expense', sourceId: 'exp-dup' },
        client
      )
    ).rejects.toBeInstanceOf(LegacyAndNewPostingConflictError);
  });
});

describe('Phase 9 Stage 1–3A ACTIVE templates', () => {
  it.each([
    [AccountingEventType.EXPENSE_POSTED, 'CASH_EXPENSE'],
    [AccountingEventType.CUSTOMER_PAYMENT_POSTED, 'CUSTOMER_PAYMENT'],
    [AccountingEventType.SUPPLIER_BILL_POSTED, 'SUPPLIER_BILL'],
    [AccountingEventType.SUPPLIER_PAYMENT_POSTED, 'SUPPLIER_PAYMENT'],
    [AccountingEventType.BANK_CHARGE_POSTED, 'BANK_CHARGE'],
    [AccountingEventType.INTEREST_INCOME_POSTED, 'INTEREST_INCOME'],
    [AccountingEventType.INVENTORY_SOLD, 'CASH_SALE'],
    [AccountingEventType.COST_OF_SALES_RECOGNIZED, 'COST_OF_SALES'],
    [AccountingEventType.INVENTORY_RECEIVED, 'INVENTORY_PURCHASE'],
    [AccountingEventType.STOCK_ADJUSTMENT_POSTED, 'STOCK_ADJUSTMENT'],
    [AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED, 'CUSTOMER_CREDIT_NOTE'],
    [AccountingEventType.CUSTOMER_REFUND_POSTED, 'CUSTOMER_REFUND'],
    [AccountingEventType.BANK_TRANSFER_POSTED, 'BANK_TRANSFER'],
    [AccountingEventType.TAX_SETTLEMENT_POSTED, 'TAX_SETTLEMENT'],
    [AccountingEventType.PAYROLL_POSTED, 'PAYROLL'],
    [AccountingEventType.ASSET_ACQUIRED, 'ASSET_ACQUISITION'],
    [AccountingEventType.DEPRECIATION_POSTED, 'DEPRECIATION'],
    [AccountingEventType.LOAN_RECEIVED, 'LOAN_RECEIPT'],
    [AccountingEventType.LOAN_REPAYMENT_POSTED, 'LOAN_REPAYMENT'],
    [AccountingEventType.CAPITAL_CONTRIBUTION_POSTED, 'CAPITAL_CONTRIBUTION'],
    [AccountingEventType.SUPPLIER_CREDIT_POSTED, 'SUPPLIER_CREDIT'],
  ])('%s has ACTIVE v2 template %s', (eventType, templateId) => {
    const tpl = getActiveTemplate(eventType);
    expect(tpl).toBeTruthy();
    expect(tpl.templateId).toBe(templateId);
    expect(tpl.templateVersion).toBe(2);
    expect(tpl.status).toBe(TemplateStatus.ACTIVE);
    expect(typeof tpl.buildDraft).toBe('function');
  });
});

describe('Phase 9 scaffolded adapters (UI-pending only)', () => {
  it('exposes dividend/disposal hooks and refuses premature submit', async () => {
    expect(SCAFFOLDED_ADAPTERS.DIVIDEND_DECLARED).toBeTruthy();
    expect(SCAFFOLDED_ADAPTERS.ASSET_DISPOSED).toBeTruthy();
    await expect(SCAFFOLDED_ADAPTERS.DIVIDEND_PAID.submit()).rejects.toThrow(/scaffolded but not yet ACTIVE/);
  });
});

describe('Phase 9 Stage 3A cutover modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POS sale NEW_ENGINE uses POINT_OF_SALE / INVENTORY_SOLD', async () => {
    const { client } = makeAcctV2PrismaStub(newEngineSeed());
    const legacyPost = vi.fn(async () => ({ id: 'legacy' }));
    const outcome = await runCutoverPosting({
      db: client,
      context: ctx(),
      moduleKey: AccountingSourceModule.POINT_OF_SALE,
      eventType: AccountingEventType.INVENTORY_SOLD,
      buildEngineInput: async () => ({ totalAmount: '100.00' }),
      legacyPost,
    });
    expect(outcome.authority).toBe('V2');
    expect(legacyPost).not.toHaveBeenCalled();
    expect(executePosting).toHaveBeenCalledTimes(1);
  });

  it('COGS NEW_ENGINE skips legacy (dual-caller safe)', async () => {
    const { client } = makeAcctV2PrismaStub(newEngineSeed());
    const legacyPost = vi.fn(async () => ({ id: 'cogs_legacy' }));
    const outcome = await runCutoverPosting({
      db: client,
      context: ctx(),
      moduleKey: AccountingSourceModule.INVENTORY,
      eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED,
      buildEngineInput: async () => ({ totalAmount: '40.00' }),
      legacyPost,
    });
    expect(outcome.authority).toBe('V2');
    expect(legacyPost).not.toHaveBeenCalled();
  });
});
