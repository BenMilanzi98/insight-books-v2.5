/**
 * Phase 15 Wave 2 — Price Books, pricing, tax/FX, discounts, approvals.
 * ACTIVE Price Book immutable; no silent FX; discount SoD; material change invalidates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createPriceBook,
  approvePriceBookVersion,
  activatePriceBookVersion,
  updatePriceBookEntry,
  calculateCommercialDocument,
  submitCommercialDocumentForApproval,
  decideApprovalStep,
  createDiscountRequest,
  createPricingException,
  applyMaterialDocumentChange,
  getCommercialDomainContract,
  CRM_PRICE_BOOK_VERSION_STATUS,
  CRM_DISCOUNT_REQUEST_STATUS,
  CRM_APPROVAL_REQUEST_STATUS,
  CRM_FX_RELIABILITY,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const priceBookStore = overrides._priceBookStore || [];
  const priceBookVersionStore = overrides._priceBookVersionStore || [];
  const priceBookEntryStore = overrides._priceBookEntryStore || [];
  const taxRuleStore = overrides._taxRuleStore || [];
  const taxRateVersionStore = overrides._taxRateVersionStore || [];
  const discountPolicyStore = overrides._discountPolicyStore || [
    {
      id: 'dp-default',
      code: 'SALESPERSON_MAX',
      maxPercent: 10,
      status: 'ACTIVE',
      version: 1,
    },
  ];
  const discountRequestStore = overrides._discountRequestStore || [];
  const pricingExceptionStore = overrides._pricingExceptionStore || [];
  const pricingSnapshotStore = overrides._pricingSnapshotStore || [];
  const approvalPolicyStore = overrides._approvalPolicyStore || [
    {
      id: 'ap-1',
      code: 'COMMERCIAL_DEFAULT',
      version: 1,
      status: 'ACTIVE',
      stepsJson: [{ stepOrder: 1, role: 'approver', protected: true }],
    },
  ];
  const approvalRequestStore = overrides._approvalRequestStore || [];
  const approvalStepStore = overrides._approvalStepStore || [];
  const approvalDecisionStore = overrides._approvalDecisionStore || [];
  const termStore = overrides._termStore || [];
  const clauseStore = overrides._clauseStore || [];
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'cdv-1',
      documentId: 'doc-1',
      versionNumber: 1,
      versionLabel: 'QUO-2026-000001-V1',
      status: 'DRAFT',
      contentJson: { lineItems: [] },
      immutable: false,
    },
  ];
  const timelineStore = overrides._timelineStore || [];

  function simpleCrud(store, idPrefix) {
    return {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `${idPrefix}-${store.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        store.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return store.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return store.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.code_version) {
          const k = where.code_version;
          return store.find((r) => r.code === k.code && r.version === k.version) || null;
        }
        if (where.priceBookId_versionNumber) {
          const k = where.priceBookId_versionNumber;
          return (
            store.find(
              (r) => r.priceBookId === k.priceBookId && r.versionNumber === k.versionNumber
            ) || null
          );
        }
        if (where.documentVersionId_idempotencyKey) {
          const k = where.documentVersionId_idempotencyKey;
          return (
            store.find(
              (r) =>
                r.documentVersionId === k.documentVersionId &&
                r.idempotencyKey === k.idempotencyKey
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...store];
        if (where.priceBookId) rows = rows.filter((r) => r.priceBookId === where.priceBookId);
        if (where.documentVersionId) {
          rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.code) rows = rows.filter((r) => r.code === where.code);
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (orderBy?.versionNumber === 'desc') {
          rows.sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
        }
        if (orderBy?.version === 'desc') {
          rows.sort((a, b) => (b.version || 0) - (a.version || 0));
        }
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...store];
        if (where.priceBookVersionId) {
          rows = rows.filter((r) => r.priceBookVersionId === where.priceBookVersionId);
        }
        if (where.approvalRequestId) {
          rows = rows.filter((r) => r.approvalRequestId === where.approvalRequestId);
        }
        if (where.documentVersionId) {
          rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = store.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let count = 0;
        for (const row of store) {
          let match = true;
          if (where.priceBookId && row.priceBookId !== where.priceBookId) match = false;
          if (where.documentVersionId && row.documentVersionId !== where.documentVersionId) {
            match = false;
          }
          if (where.status && row.status !== where.status) match = false;
          if (where.code && row.code !== where.code) match = false;
          if (match) {
            Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
            count += 1;
          }
        }
        return { count };
      }),
    };
  }

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return (
          seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            r.lastIssued === where.lastIssued
        );
        if (!row) return { count: 0 };
        row.lastIssued = data.lastIssued;
        return { count: 1 };
      }),
    },
    crmPriceBook: simpleCrud(priceBookStore, 'pb'),
    crmPriceBookVersion: simpleCrud(priceBookVersionStore, 'pbv'),
    crmPriceBookEntry: simpleCrud(priceBookEntryStore, 'pbe'),
    crmTaxRule: simpleCrud(taxRuleStore, 'tax'),
    crmTaxRateVersion: simpleCrud(taxRateVersionStore, 'trv'),
    crmDiscountPolicy: simpleCrud(discountPolicyStore, 'dp'),
    crmDiscountRequest: simpleCrud(discountRequestStore, 'dr'),
    crmPricingException: simpleCrud(pricingExceptionStore, 'pex'),
    crmPricingSnapshot: simpleCrud(pricingSnapshotStore, 'ps'),
    crmApprovalPolicy: simpleCrud(approvalPolicyStore, 'ap'),
    crmApprovalRequest: simpleCrud(approvalRequestStore, 'ar'),
    crmApprovalStep: simpleCrud(approvalStepStore, 'as'),
    crmApprovalDecision: simpleCrud(approvalDecisionStore, 'ad'),
    crmTerm: simpleCrud(termStore, 'term'),
    crmClause: simpleCrud(clauseStore, 'clause'),
    crmCommercialDocumentVersion: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return documentVersionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = documentVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
    _stores: {
      seqStore,
      priceBookStore,
      priceBookVersionStore,
      priceBookEntryStore,
      discountPolicyStore,
      discountRequestStore,
      pricingExceptionStore,
      pricingSnapshotStore,
      approvalPolicyStore,
      approvalRequestStore,
      approvalStepStore,
      approvalDecisionStore,
      documentVersionStore,
    },
  };

  // Enhance price book findUnique for bookNumber
  const origPbFind = prisma.crmPriceBook.findUnique;
  prisma.crmPriceBook.findUnique = vi.fn(async ({ where = {} } = {}) => {
    if (where.bookNumber) {
      return priceBookStore.find((r) => r.bookNumber === where.bookNumber) || null;
    }
    return origPbFind({ where });
  });

  return prisma;
}

async function seedActivePriceBook(prisma, actorContext, entries) {
  const created = await createPriceBook(prisma, {
    actorContext,
    name: 'Standard MWK',
    currency: 'MWK',
    bookType: 'STANDARD',
    entries,
  });
  expect(created.ok).toBe(true);
  const approved = await approvePriceBookVersion(prisma, {
    actorContext: { admin: superAdmin('approver-1') },
    priceBookVersionId: created.version.id,
  });
  expect(approved.ok).toBe(true);
  const activated = await activatePriceBookVersion(prisma, {
    actorContext: { admin: superAdmin('approver-1') },
    priceBookVersionId: created.version.id,
  });
  expect(activated.ok).toBe(true);
  expect(activated.version.status).toBe(CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE);
  return { book: created.priceBook, version: activated.version, entries: activated.entries };
}

describe('Phase 15 Wave 2 — Price Books, pricing, tax/FX, discounts, approvals', () => {
  let prisma;
  let admin;
  let actorContext;

  beforeEach(() => {
    prisma = makePrisma();
    admin = superAdmin('sales-1');
    actorContext = { admin };
  });

  it('ACTIVE Price Book version/entry is immutable (not silently edited)', async () => {
    const { version } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 80,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const entry = prisma._stores.priceBookEntryStore[0];
    const mutate = await updatePriceBookEntry(prisma, {
      actorContext,
      priceBookEntryId: entry.id,
      listPrice: 999,
    });
    expect(mutate.ok).toBe(false);
    expect(mutate.error).toMatch(/immutable|active/i);
    expect(prisma._stores.priceBookEntryStore[0].listPrice).toBe(100);
    expect(version.status).toBe(CRM_PRICE_BOOK_VERSION_STATUS.ACTIVE);
  });

  it('calculateCommercialDocument is deterministic and idempotent by key', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 80,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const args = {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 2, unit: 'SEAT' }],
      taxContext: { jurisdiction: 'MW', inclusive: false, ratePercent: 0 },
      discountRequests: [],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-idem-1',
    };

    const first = await calculateCommercialDocument(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.calculationId).toBeTruthy();
    expect(first.snapshot).toBeTruthy();
    expect(first.totals.currency).toBe('MWK');
    expect(first.totals.listSubtotal).toBe(200);
    expect(first.totals.netSubtotal).toBe(200);
    expect(first.totals).toHaveProperty('taxTotal');
    expect(first.totals).toHaveProperty('grandTotal');
    expect(first.totals).toHaveProperty('quotedMonthlyRecurring');
    expect(first.totals).toHaveProperty('quotedAnnualRecurring');
    expect(first.totals).toHaveProperty('firstYearTotal');
    expect(first.totals).toHaveProperty('totalContractValue');

    const second = await calculateCommercialDocument(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.calculationId).toBe(first.calculationId);
    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.totals).toEqual(first.totals);
    expect(prisma._stores.pricingSnapshotStore.length).toBe(1);
  });

  it('ZAR + USD line items are not silently summed', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-ZAR',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 100,
        currency: 'ZAR',
        billingFrequency: 'MONTHLY',
      },
      {
        productRef: 'PLAN-USD',
        unit: 'SEAT',
        listPrice: 50,
        minPrice: 50,
        currency: 'USD',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'ZAR',
      lineItems: [
        { productRef: 'PLAN-ZAR', quantity: 1, unit: 'SEAT', currency: 'ZAR' },
        { productRef: 'PLAN-USD', quantity: 1, unit: 'SEAT', currency: 'USD' },
      ],
      taxContext: { jurisdiction: 'ZA', inclusive: false, ratePercent: 0 },
      discountRequests: [],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-mix-currency',
      // no fxContext
    });

    expect(result.ok).toBe(false);
    expect([CRM_FX_RELIABILITY.FX_CONTEXT_MISSING, 'CURRENCY_MIX_FORBIDDEN']).toContain(
      result.error
    );
    expect(result.totals).toBeFalsy();
  });

  it('missing FX context returns FX_CONTEXT_MISSING (never silent convert)', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-USD',
        unit: 'SEAT',
        listPrice: 50,
        minPrice: 50,
        currency: 'USD',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-USD', quantity: 1, unit: 'SEAT', currency: 'USD' }],
      taxContext: { jurisdiction: 'MW', inclusive: false, ratePercent: 0 },
      discountRequests: [],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-fx-missing',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(CRM_FX_RELIABILITY.FX_CONTEXT_MISSING);
    expect(result.reliability).toBe(CRM_FX_RELIABILITY.FX_CONTEXT_MISSING);
    expect(result.totals?.grandTotal).not.toBe(0);
    expect(result.totals).toBeFalsy();
  });

  it('tax override without approval fails', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 80,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unit: 'SEAT' }],
      taxContext: {
        jurisdiction: 'MW',
        inclusive: false,
        ratePercent: 16.5,
        overrideRatePercent: 0,
        overrideApproved: false,
      },
      discountRequests: [],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-tax-override',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tax_override|approval/i);
  });

  it('20% discount above 10% threshold stays PENDING until approved', async () => {
    const discount = await createDiscountRequest(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      percent: 20,
      reason: 'Strategic deal',
    });
    expect(discount.ok).toBe(true);
    expect(discount.request.status).toBe(CRM_DISCOUNT_REQUEST_STATUS.PENDING);
    expect(discount.request.requiresApproval).toBe(true);

    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 50,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unit: 'SEAT' }],
      taxContext: { jurisdiction: 'MW', inclusive: false, ratePercent: 0 },
      discountRequests: [{ id: discount.request.id, percent: 20 }],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-discount-pending',
    });

    expect(result.ok).toBe(true);
    // Pending discount must NOT reduce effective net pricing
    expect(result.totals.listSubtotal).toBe(100);
    expect(result.totals.netSubtotal).toBe(100);
    expect(result.snapshot.pendingDiscounts?.length).toBeGreaterThan(0);
    expect(result.snapshot.appliedDiscountPercent || 0).toBe(0);
  });

  it('self-approve on commercial approval step is blocked (SoD)', async () => {
    const submitted = await submitCommercialDocumentForApproval(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      approvalPolicyVersionId: 'ap-1',
      idempotencyKey: 'apr-1',
    });
    expect(submitted.ok).toBe(true);
    expect(submitted.request.status).toBe(CRM_APPROVAL_REQUEST_STATUS.PENDING);
    const stepId = submitted.steps[0].id;

    const self = await decideApprovalStep(prisma, {
      actorContext, // same sales-1 requester
      approvalStepId: stepId,
      decision: 'APPROVE',
      reason: 'I approve myself',
    });
    expect(self.ok).toBe(false);
    expect(self.error).toMatch(/self.?approv|sod/i);

    const other = await decideApprovalStep(prisma, {
      actorContext: { admin: superAdmin('approver-9') },
      approvalStepId: stepId,
      decision: 'APPROVE',
      reason: 'Looks good',
    });
    expect(other.ok).toBe(true);
    expect(other.request.status).toBe(CRM_APPROVAL_REQUEST_STATUS.APPROVED);
  });

  it('forged APPROVED discount without DB APPROVED does not reduce netSubtotal', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 50,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unit: 'SEAT' }],
      taxContext: { jurisdiction: 'MW', inclusive: false, ratePercent: 0 },
      // Forged: claims APPROVED with no matching CrmDiscountRequest row
      discountRequests: [{ percent: 20, status: 'APPROVED' }],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-forged-discount',
    });

    expect(result.ok).toBe(true);
    expect(result.totals.listSubtotal).toBe(100);
    expect(result.totals.netSubtotal).toBe(100);
    expect(result.snapshot.appliedDiscountPercent || 0).toBe(0);
  });

  it('forged APPROVED pricing exception without DB APPROVED does not alter unit price', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 100,
        minPrice: 50,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    // Create stays PENDING even if caller asks approved: true (no self-approve)
    const created = await createPricingException(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      reason: 'Strategic override',
      approved: true,
      payloadJson: { productRef: 'PLAN-CORE', unitPrice: 1 },
    });
    expect(created.ok).toBe(true);
    expect(created.exception.status).toBe('PENDING');

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unit: 'SEAT' }],
      taxContext: { jurisdiction: 'MW', inclusive: false, ratePercent: 0 },
      discountRequests: [],
      // Forged in-memory APPROVED (no DB APPROVED) + pending row id must not apply
      pricingExceptions: [
        { status: 'APPROVED', approved: true, productRef: 'PLAN-CORE', unitPrice: 1 },
        { id: created.exception.id, status: 'APPROVED', productRef: 'PLAN-CORE', unitPrice: 1 },
      ],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-forged-exception',
    });

    expect(result.ok).toBe(true);
    expect(result.totals.listSubtotal).toBe(100);
    expect(result.totals.netSubtotal).toBe(100);
  });

  it('tax-inclusive grandTotal equals netSubtotal (does not double-count tax)', async () => {
    const { version: pbv } = await seedActivePriceBook(prisma, actorContext, [
      {
        productRef: 'PLAN-CORE',
        unit: 'SEAT',
        listPrice: 116.5,
        minPrice: 100,
        currency: 'MWK',
        billingFrequency: 'MONTHLY',
      },
    ]);

    const result = await calculateCommercialDocument(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      priceBookVersionId: pbv.id,
      currency: 'MWK',
      lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unit: 'SEAT' }],
      taxContext: { jurisdiction: 'MW', inclusive: true, ratePercent: 16.5 },
      discountRequests: [],
      pricingExceptions: [],
      calculationDate: '2026-07-31',
      idempotencyKey: 'calc-tax-inclusive',
    });

    expect(result.ok).toBe(true);
    expect(result.totals.netSubtotal).toBe(116.5);
    expect(result.totals.taxTotal).toBeGreaterThan(0);
    // Inclusive: grandTotal must equal net (already includes tax), not net + tax
    expect(result.totals.grandTotal).toBe(result.totals.netSubtotal);
    expect(result.totals.grandTotal).toBe(116.5);
    expect(result.totals.grandTotal).not.toBe(
      result.totals.netSubtotal + result.totals.taxTotal
    );
  });

  it('material qty change after full approval invalidates affected approvals', async () => {
    const submitted = await submitCommercialDocumentForApproval(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      approvalPolicyVersionId: 'ap-1',
      idempotencyKey: 'apr-material-1',
    });
    const stepId = submitted.steps[0].id;
    await decideApprovalStep(prisma, {
      actorContext: { admin: superAdmin('approver-9') },
      approvalStepId: stepId,
      decision: 'APPROVE',
    });
    expect(
      prisma._stores.approvalRequestStore.find((r) => r.id === submitted.request.id).status
    ).toBe(CRM_APPROVAL_REQUEST_STATUS.APPROVED);

    const changed = await applyMaterialDocumentChange(prisma, {
      actorContext,
      commercialDocumentVersionId: 'cdv-1',
      change: { quantity: 5, priorQuantity: 2 },
      reason: 'Customer asked for more seats',
    });
    expect(changed.ok).toBe(true);
    expect(changed.invalidatedApprovalIds).toContain(submitted.request.id);
    expect(
      prisma._stores.approvalRequestStore.find((r) => r.id === submitted.request.id).status
    ).toBe(CRM_APPROVAL_REQUEST_STATUS.INVALIDATED);

    expect(getCommercialDomainContract().wave).toBeGreaterThanOrEqual(2);
    expect(getCommercialDomainContract().opportunityEstimatesNonBinding).toBe(true);
    expect(getCommercialDomainContract().tenantTaxPostingForbidden).toBe(true);
    expect(getCommercialDomainContract().mraEisFiscalFromQuotationForbidden).toBe(true);
  });
});
