import { describe, it, expect, vi } from 'vitest';
import {
  emitProductMeaningfulAction,
  emitSalesInvoicePosted,
  emitPosTransactionCompleted,
  emitMraEisTransactionAccepted,
} from '@/lib/admin/productAnalytics';
import {
  ANALYTICS_EVENT_TYPES,
  appendAnalyticsOutbox,
  SCAFFOLD_ONLY,
} from '@/lib/admin/analytics';
import { resolveFeatureEntitlement } from '@/lib/admin/productCatalogue';
import { transitionTransmissionStatus } from '@/lib/mraEis/application/services/transmissionService.js';
import { TRANSMISSION_STATUS } from '@/lib/mraEis/domain/operationalEnums.js';

function makeOutboxDb() {
  const store = [];
  return {
    store,
    analyticsOutbox: {
      create: vi.fn(async ({ data }) => {
        if (store.some((r) => r.idempotencyKey === data.idempotencyKey)) {
          const err = new Error('unique');
          err.code = 'P2002';
          throw err;
        }
        const row = { id: `ob-${store.length + 1}`, ...data };
        store.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) =>
        store.find((r) => r.idempotencyKey === where.idempotencyKey) || null
      ),
    },
  };
}

describe('emitProductMeaningfulAction', () => {
  it('rejects FEATURE_USED as free-for-all scaffold emit', async () => {
    const db = makeOutboxDb();
    const r = await emitProductMeaningfulAction(db, {
      eventCode: ANALYTICS_EVENT_TYPES.FEATURE_USED,
      tenantId: 't1',
      featureCode: 'invoices.post',
      sourceType: 'Invoice',
      sourceId: 'inv1',
      idempotencyKey: 'evt:FEATURE_USED:inv1',
    });
    expect(r.ok).toBe(false);
    expect(SCAFFOLD_ONLY.has(ANALYTICS_EVENT_TYPES.FEATURE_USED)).toBe(true);
    expect(db.analyticsOutbox.create).not.toHaveBeenCalled();
  });

  it('rejects unknown / uninstrumented feature codes', async () => {
    const db = makeOutboxDb();
    const r = await emitProductMeaningfulAction(db, {
      eventCode: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,
      tenantId: 't1',
      featureCode: 'payroll.run',
      sourceType: 'Invoice',
      sourceId: 'inv1',
      idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv1',
    });
    expect(r.ok).toBe(false);
    expect(r.reason || r.error).toMatch(/instrument|feature/i);
  });
});

describe('commerce producers — idempotency', () => {
  it('invoice posted producer fails closed when status omitted or unknown', async () => {
    const db = makeOutboxDb();
    const omitted = await emitSalesInvoicePosted(db, {
      tenantId: 't1',
      invoiceId: 'inv-omit',
    });
    expect(omitted.ok).toBe(false);
    expect(omitted.skipped).toBe(true);
    expect(omitted.reason).toBe('status_required');

    const unknown = await emitSalesInvoicePosted(db, {
      tenantId: 't1',
      invoiceId: 'inv-unknown',
      status: 'UNKNOWN',
    });
    expect(unknown.ok).toBe(false);
    expect(unknown.skipped).toBe(true);
    expect(unknown.reason).toBe('not_posted');

    const draft = await emitSalesInvoicePosted(db, {
      tenantId: 't1',
      invoiceId: 'inv-draft',
      status: 'Draft',
    });
    expect(draft.ok).toBe(false);
    expect(draft.reason).toBe('not_posted');
    expect(db.analyticsOutbox.create).not.toHaveBeenCalled();
  });

  it('invoice posted producer is idempotent on source id', async () => {
    const db = makeOutboxDb();
    const input = {
      tenantId: 't1',
      invoiceId: 'inv-100',
      actorId: 'u1',
      status: 'Sent',
      occurredAt: new Date('2026-07-29T10:00:00Z'),
    };
    const first = await emitSalesInvoicePosted(db, input);
    const second = await emitSalesInvoicePosted(db, input);
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(db.store).toHaveLength(1);
    expect(db.store[0].eventType).toBe(ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED);
    expect(db.store[0].idempotencyKey).toBe('evt:SALES_INVOICE_POSTED:inv-100');
    expect(db.store[0].payload).toMatchObject({
      featureCode: 'invoices.post',
      sourceType: 'Invoice',
      sourceId: 'inv-100',
      status: 'Sent',
    });
    // No Tenant GL line text / amounts as primary payload
    expect(db.store[0].payload.lineItems).toBeUndefined();
    expect(db.store[0].payload.glLines).toBeUndefined();
  });

  it('POS completed producer is idempotent and skips non-completed', async () => {
    const db = makeOutboxDb();
    const skip = await emitPosTransactionCompleted(db, {
      tenantId: 't1',
      saleId: 'sale-1',
      status: 'draft',
    });
    expect(skip.ok).toBe(false);
    expect(skip.skipped).toBe(true);

    const first = await emitPosTransactionCompleted(db, {
      tenantId: 't1',
      saleId: 'sale-1',
      status: 'completed',
    });
    const second = await emitPosTransactionCompleted(db, {
      tenantId: 't1',
      saleId: 'sale-1',
      status: 'completed',
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(db.store[0].eventType).toBe(ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED);
    expect(db.store[0].idempotencyKey).toBe('evt:POS_TRANSACTION_COMPLETED:sale-1');
  });

  it('MRA accepted producer emits only on accepted and is idempotent', async () => {
    const db = makeOutboxDb();
    const rejected = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-9',
      accepted: false,
      outcome: 'REJECTED',
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.skipped).toBe(true);

    const retry = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-9',
      accepted: true,
      isRetry: true,
    });
    expect(retry.ok).toBe(false);
    expect(retry.skipped).toBe(true);

    const first = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-9',
      accepted: true,
      snapshotId: 'snap-1',
    });
    const second = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-9',
      accepted: true,
      snapshotId: 'snap-1',
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(db.store[0].eventType).toBe(ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED);
    expect(db.store[0].idempotencyKey).toBe('evt:MRA_EIS_TRANSACTION_ACCEPTED:tx-9');
    expect(db.store[0].payload.mraCredentials).toBeUndefined();
    expect(db.store[0].payload.rawResponse).toBeUndefined();
  });

  it('MRA accepted producer emits once for offline and reconcile-accepted outcomes', async () => {
    const db = makeOutboxDb();
    const offline = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-offline-1',
      accepted: true,
      outcome: 'ACCEPTED_OFFLINE',
      snapshotId: 'snap-off',
    });
    expect(offline.ok).toBe(true);
    expect(offline.created).toBe(true);

    const reconcile = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-reconcile-1',
      accepted: true,
      outcome: 'RECONCILED_ACCEPTED',
      snapshotId: 'snap-rec',
    });
    expect(reconcile.ok).toBe(true);
    expect(reconcile.created).toBe(true);

    // Same transmissionId stays idempotent if online already emitted then reconcile retries
    const firstAccept = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-shared',
      accepted: true,
      outcome: 'ACCEPTED_ONLINE',
    });
    const reconcileAgain = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-shared',
      accepted: true,
      outcome: 'RECONCILED_ACCEPTED',
    });
    expect(firstAccept.created).toBe(true);
    expect(reconcileAgain.ok).toBe(true);
    expect(reconcileAgain.created).toBe(false);
    expect(db.store.filter((r) => r.aggregateId === 'tx-shared')).toHaveLength(1);
  });
});

describe('EIS accept call-site wiring — offline / reconcile transitions', () => {
  it('transitionTransmissionStatus emits on ACCEPTED_OFFLINE (idempotent)', async () => {
    const outbox = makeOutboxDb();
    const transmission = {
      id: 'tx-off-wire',
      tenantId: 't1',
      businessId: 't1',
      snapshotId: 'snap-off-wire',
      status: TRANSMISSION_STATUS.OFFLINE_UPLOADING,
      version: 1,
      validationUrl: null,
      acceptedAt: null,
      unknownOutcomeAt: null,
      rejectedAt: null,
    };
    const db = {
      ...outbox,
      mraEisTransmission: {
        findFirst: vi.fn(async () => ({ ...transmission })),
        update: vi.fn(async ({ data }) => {
          Object.assign(transmission, data, {
            version: (transmission.version || 1) + 1,
            acceptedAt: data.acceptedAt || transmission.acceptedAt,
          });
          return { ...transmission };
        }),
      },
      mraEisSnapshot: {
        findUnique: vi.fn(async () => null),
      },
      mraEisReceiptProjection: {
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    };

    const updated = await transitionTransmissionStatus({
      tenantId: 't1',
      transmissionId: 'tx-off-wire',
      nextStatus: TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
      db,
    });
    expect(updated.status).toBe(TRANSMISSION_STATUS.ACCEPTED_OFFLINE);
    expect(outbox.store).toHaveLength(1);
    expect(outbox.store[0].eventType).toBe(ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED);
    expect(outbox.store[0].idempotencyKey).toBe('evt:MRA_EIS_TRANSACTION_ACCEPTED:tx-off-wire');

    // Re-emit with same allowlisted payload stays idempotent (online→reconcile overlap)
    const again = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-off-wire',
      accepted: true,
      outcome: TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
      snapshotId: 'snap-off-wire',
    });
    expect(again.ok).toBe(true);
    expect(again.created).toBe(false);
    expect(outbox.store).toHaveLength(1);
  });

  it('reconcile-accepted producer path shares online idempotency key', async () => {
    const db = makeOutboxDb();
    const r = await emitMraEisTransactionAccepted(db, {
      tenantId: 't1',
      transmissionId: 'tx-rec-wire',
      accepted: true,
      isRetry: false,
      isReprint: false,
      outcome: TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
      snapshotId: 'snap-rec-wire',
    });
    expect(r.ok).toBe(true);
    expect(r.created).toBe(true);
    expect(db.store[0].idempotencyKey).toBe('evt:MRA_EIS_TRANSACTION_ACCEPTED:tx-rec-wire');
    expect(db.store[0].payload).toMatchObject({
      featureCode: 'eis.fiscal.accept',
      classification: 'ACCEPTED',
      snapshotId: 'snap-rec-wire',
    });
  });
});

describe('appendAnalyticsOutbox gates commerce events', () => {
  it('accepts SALES_INVOICE_POSTED via outbox', async () => {
    const db = makeOutboxDb();
    const r = await appendAnalyticsOutbox(db, {
      tenantId: 't1',
      aggregateType: 'Invoice',
      aggregateId: 'inv-2',
      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,
      idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv-2',
      payload: { featureCode: 'invoices.post', sourceType: 'Invoice', sourceId: 'inv-2' },
    });
    expect(r.ok).toBe(true);
    expect(r.created).toBe(true);
  });
});

describe('resolveFeatureEntitlement', () => {
  it('returns UNKNOWN when no plan/override evidence', async () => {
    const prisma = {
      platformFeatureEntitlement: {
        findUnique: vi.fn(async () => null),
      },
      accountSubscription: {
        findFirst: vi.fn(async () => null),
      },
      platformPlanVersion: {
        findFirst: vi.fn(async () => null),
      },
      mraEisTenantEntitlement: {
        findFirst: vi.fn(async () => null),
      },
    };
    const r = await resolveFeatureEntitlement(prisma, {
      tenantId: 't1',
      featureCode: 'invoices.post',
      asOf: new Date('2026-07-29'),
    });
    expect(r.status).toBe('UNKNOWN');
    expect(r.planVersion).toBeNull();
    expect(Array.isArray(r.limitations)).toBe(true);
  });

  it('resolves INCLUDED from plan featuresJson when present', async () => {
    const prisma = {
      platformFeatureEntitlement: {
        findUnique: vi.fn(async () => null),
      },
      accountSubscription: {
        findFirst: vi.fn(async () => ({
          id: 'sub1',
          plan: 'growth',
          planVersionId: 'pv1',
          status: 'ACTIVE',
        })),
      },
      platformPlanVersion: {
        findFirst: vi.fn(async () => ({
          id: 'pv1',
          version: 2,
          planCode: 'growth',
          featuresJson: ['invoices', 'invoices.post', 'sales'],
          limitsJson: { users: 10 },
        })),
        findUnique: vi.fn(async () => ({
          id: 'pv1',
          version: 2,
          planCode: 'growth',
          featuresJson: ['invoices', 'invoices.post', 'sales'],
          limitsJson: { users: 10 },
        })),
      },
      mraEisTenantEntitlement: {
        findFirst: vi.fn(async () => null),
      },
    };
    const r = await resolveFeatureEntitlement(prisma, {
      tenantId: 't1',
      featureCode: 'invoices.post',
    });
    expect(r.status).toBe('INCLUDED');
    expect(r.planVersion).toMatchObject({ id: 'pv1', version: 2 });
  });
});
