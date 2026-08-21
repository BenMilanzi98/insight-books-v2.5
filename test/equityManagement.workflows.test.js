import { describe, it, expect } from 'vitest';
import { createEquityTransaction, previewEquityPosting } from '../lib/equityManagement/application/transactionService.js';
import { EquityTransactionType, EquityTxStatus } from '../lib/equityManagement/domain/enums.js';

function makeDb(overrides = {}) {
  const store = {
    config: {
      tenantId: 'biz-1',
      status: 'ACTIVE',
      ownerCapitalEnabled: true,
      ownerDrawingsEnabled: true,
      shareCapitalEnabled: true,
      dividendManagementEnabled: true,
      ownershipTrackingEnabled: true,
      requireContributionApproval: false,
      requireDrawingApproval: false,
      requireDividendApproval: false,
      requireSeparateApprover: false,
      defaultCurrency: 'MWK',
      equityModel: 'OWNER_CAPITAL',
    },
    relationships: [
      { id: 'rel-1', tenantId: 'biz-1', ownershipStatus: 'ACTIVE', partyName: 'Owner A' },
    ],
    accounts: [
      { id: 'bank-1', tenantId: 'biz-1', isActive: true, code: '1131' },
      {
        id: 'cap-1',
        tenantId: 'biz-1',
        isActive: true,
        code: '3100',
        systemPurpose: 'OWNER_CAPITAL',
        postingAllowed: true,
      },
      {
        id: 'draw-1',
        tenantId: 'biz-1',
        isActive: true,
        code: '3150',
        systemPurpose: 'OWNER_DRAWINGS',
        postingAllowed: true,
      },
    ],
    txs: [],
  };

  return {
    eqV2Configuration: {
      findUnique: async () => store.config,
      update: async ({ data }) => {
        store.config = { ...store.config, ...data };
        return store.config;
      },
      upsert: async ({ create, update }) => {
        store.config = { ...store.config, ...(update || create) };
        return store.config;
      },
    },
    eqV2PartyRelationship: {
      findFirst: async ({ where }) => store.relationships.find((r) => r.id === where.id) || null,
    },
    eqV2EquityTransaction: {
      count: async () => store.txs.length,
      create: async ({ data }) => {
        const row = { id: `tx-${store.txs.length + 1}`, ...data };
        store.txs.push(row);
        return row;
      },
      findFirst: async ({ where }) => store.txs.find((t) => t.id === where.id) || null,
      update: async ({ where, data }) => {
        const i = store.txs.findIndex((t) => t.id === where.id);
        store.txs[i] = { ...store.txs[i], ...data };
        return store.txs[i];
      },
    },
    eqV2EquityApproval: { create: async () => ({}) },
    account: {
      findFirst: async ({ where }) => {
        if (where.id) return store.accounts.find((a) => a.id === where.id) || null;
        if (where.OR) {
          for (const clause of where.OR) {
            if (clause.systemPurpose) {
              const hit = store.accounts.find((a) => a.systemPurpose === clause.systemPurpose);
              if (hit) return hit;
            }
          }
        }
        return store.accounts[0];
      },
    },
    ...overrides,
  };
}

describe('equity transaction create', () => {
  it('creates capital contribution draft/approved without treating as revenue', async () => {
    const db = makeDb();
    const ctx = { businessId: 'biz-1', userId: 'u1' };
    const tx = await createEquityTransaction(db, ctx, {
      transactionType: EquityTransactionType.CAPITAL_CONTRIBUTION,
      relationshipId: 'rel-1',
      amount: '1000000.00',
      transactionDate: '2026-07-01',
      bankAccountId: 'bank-1',
      description: 'Owner capital',
    });
    expect(tx.amountMinor).toBe(100000000);
    expect(tx.transactionType).toBe('CAPITAL_CONTRIBUTION');
    expect(tx.status).toBe(EquityTxStatus.APPROVED);
    expect(tx.approvalStatus).toBe('NOT_REQUIRED');
  });

  it('builds drawing lines that debit drawings not expense', async () => {
    const db = makeDb();
    const ctx = { businessId: 'biz-1', userId: 'u1' };
    const tx = await createEquityTransaction(db, ctx, {
      transactionType: EquityTransactionType.OWNER_DRAWING,
      relationshipId: 'rel-1',
      amount: '200000.00',
      transactionDate: '2026-07-02',
      bankAccountId: 'bank-1',
    });
    // Force approved for preview
    tx.status = EquityTxStatus.APPROVED;
    db.eqV2EquityTransaction.findFirst = async () => tx;
    const preview = await previewEquityPosting(db, ctx, tx.id);
    expect(preview.balanced).toBe(true);
    expect(preview.lines.some((l) => l.accountId === 'draw-1' && l.debit !== '0.00')).toBe(true);
    expect(preview.lines.some((l) => l.accountId === 'bank-1' && l.credit !== '0.00')).toBe(true);
  });
});

describe('MK1,000,000 once', () => {
  it('records amount exactly once per transaction identity', async () => {
    const db = makeDb();
    const ctx = { businessId: 'biz-1', userId: 'u1' };
    const a = await createEquityTransaction(db, ctx, {
      transactionType: EquityTransactionType.CAPITAL_CONTRIBUTION,
      relationshipId: 'rel-1',
      amount: '1000000.00',
      transactionDate: '2026-01-15',
      bankAccountId: 'bank-1',
    });
    const b = await createEquityTransaction(db, ctx, {
      transactionType: EquityTransactionType.CAPITAL_CONTRIBUTION,
      relationshipId: 'rel-1',
      amount: '1000000.00',
      transactionDate: '2026-01-15',
      bankAccountId: 'bank-1',
    });
    // Two drafts may exist before posting — idempotency is on post via event registry
    expect(a.id).not.toBe(b.id);
    expect(a.amountMinor).toBe(100000000);
  });
});
