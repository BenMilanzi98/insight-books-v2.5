/**
 * Phase 15 Wave 4 — Hubs, reports, DQ/recon, Closed-Won readiness, Phase 16 handoff.
 * Acceptance ≠ Closed Won. Handoff creates nothing. Gate fail ≠ fabricated 0.
 * Currency-separated overview. Opp stage never auto-mutated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateClosedWonReadiness,
  createClosedWonConversionHandoff,
  getCommercialMetric,
  getCommercialReport,
  getCommercialOverview,
  applyCommercialReportHonesty,
  runCommercialDataQuality,
  runCommercialReconciliation,
  getESignatureProviderStatus,
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  CRM_READINESS_STATUS,
  CRM_COMMERCIAL_REPORT_STATUS,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

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
      return null;
    }),
    findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
      let rows = [...store];
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.acceptanceId) {
        rows = rows.filter((r) => r.acceptanceId === where.acceptanceId);
      }
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (orderBy?.createdAt === 'desc') {
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.documentVersionId) {
        rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
      }
      if (where.status) {
        if (typeof where.status === 'object' && where.status.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else {
          rows = rows.filter((r) => r.status === where.status);
        }
      }
      if (where.currency) rows = rows.filter((r) => r.currency === where.currency);
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.status) {
        if (typeof where.status === 'object' && where.status.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else {
          rows = rows.filter((r) => r.status === where.status);
        }
      }
      if (where.OR) {
        // leave filtering to callers that pass specific OR — treat as all for mock simplicity
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const documentStore = overrides._documentStore || [
    {
      id: 'doc-1',
      documentNumber: 'QUO-2026-000001',
      documentFamily: 'QUOTATION',
      opportunityId: 'opp-1',
      accountId: 'acc-1',
      contactId: 'con-1',
      title: 'Acme Quote',
      currency: 'ZAR',
      currentVersionId: 'cdv-1',
      latestVersionNumber: 1,
    },
    {
      id: 'doc-2',
      documentNumber: 'QUO-2026-000002',
      documentFamily: 'QUOTATION',
      opportunityId: 'opp-2',
      accountId: 'acc-2',
      contactId: 'con-2',
      title: 'Usd Quote',
      currency: 'USD',
      currentVersionId: 'cdv-2',
      latestVersionNumber: 1,
    },
  ];
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'cdv-1',
      documentId: 'doc-1',
      versionNumber: 1,
      versionLabel: 'QUO-2026-000001-V1',
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED,
      contentJson: {
        title: 'Acme Quote',
        totals: { currency: 'ZAR', grandTotal: 1000 },
        lineItems: [{ productRef: 'PLAN-CORE', quantity: 1, unitPrice: 1000, currency: 'ZAR' }],
      },
      immutable: true,
    },
    {
      id: 'cdv-2',
      documentId: 'doc-2',
      versionNumber: 1,
      versionLabel: 'QUO-2026-000002-V1',
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
      contentJson: {
        title: 'Usd Quote',
        totals: { currency: 'USD', grandTotal: 500 },
      },
      immutable: true,
    },
  ];
  const acceptanceStore = overrides._acceptanceStore || [
    {
      id: 'accp-1',
      documentVersionId: 'cdv-1',
      artifactId: 'art-1',
      checksumSha256: 'abc123def456',
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      authorityStatus: 'VERIFIED',
      acceptedAt: new Date('2026-07-30T10:00:00.000Z'),
      idempotencyKey: 'accept-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const opportunityStore = overrides._opportunityStore || [
    {
      id: 'opp-1',
      opportunityNumber: 'OPP-2026-000001',
      stageCode: 'NEGOTIATION',
      status: 'OPEN',
      probability: 40,
      closeDate: null,
      accountId: 'acc-1',
      contactId: 'con-1',
      amount: 1000,
      currency: 'ZAR',
      version: 1,
    },
  ];
  const handoffStore = overrides._handoffStore || [];
  const customerStore = overrides._customerStore || [];
  const tenantStore = overrides._tenantStore || [];
  const subscriptionStore = overrides._subscriptionStore || [];
  const invoiceStore = overrides._invoiceStore || [];
  const dqIncidentStore = overrides._dqIncidentStore || [];
  const reconRunStore = overrides._reconRunStore || [];
  const scheduleStore = overrides._scheduleStore || [];
  const runStore = overrides._runStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    crmCommercialDocument: {
      ...simpleCrud(documentStore, 'doc'),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...documentStore];
        if (where.currency) rows = rows.filter((r) => r.currency === where.currency);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows.length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...documentStore];
        if (where.currency) rows = rows.filter((r) => r.currency === where.currency);
        return rows;
      }),
      groupBy: vi.fn(async ({ by } = {}) => {
        if (by?.includes('currency')) {
          const map = new Map();
          for (const d of documentStore) {
            const c = d.currency || 'UNKNOWN';
            map.set(c, (map.get(c) || 0) + 1);
          }
          return [...map.entries()].map(([currency, _count]) => ({
            currency,
            _count: { _all: _count },
          }));
        }
        return [];
      }),
    },
    crmCommercialDocumentVersion: simpleCrud(documentVersionStore, 'cdv'),
    crmCommercialAcceptance: simpleCrud(acceptanceStore, 'accp'),
    crmClosedWonConversionHandoff: simpleCrud(handoffStore, 'cwh'),
    crmCommercialDqIncident: simpleCrud(dqIncidentStore, 'dq'),
    crmCommercialReconRun: simpleCrud(reconRunStore, 'recon'),
    crmCommercialReportSchedule: simpleCrud(scheduleStore, 'crs'),
    crmCommercialReportRun: simpleCrud(runStore, 'crr'),
    crmOpportunity: {
      ...simpleCrud(opportunityStore, 'opp'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return (
            opportunityStore.find((r) => r.opportunityNumber === where.opportunityNumber) ||
            null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('opp not found');
        Object.assign(row, data);
        return row;
      }),
    },
    customer: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cust-${customerStore.length + 1}`, ...data };
        customerStore.push(row);
        return row;
      }),
      count: vi.fn(async () => customerStore.length),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ten-${tenantStore.length + 1}`, ...data };
        tenantStore.push(row);
        return row;
      }),
      count: vi.fn(async () => tenantStore.length),
    },
    subscription: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sub-${subscriptionStore.length + 1}`, ...data };
        subscriptionStore.push(row);
        return row;
      }),
      count: vi.fn(async () => subscriptionStore.length),
    },
    invoice: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `inv-${invoiceStore.length + 1}`, ...data };
        invoiceStore.push(row);
        return row;
      }),
      count: vi.fn(async () => invoiceStore.length),
    },
    _stores: {
      documentStore,
      documentVersionStore,
      acceptanceStore,
      opportunityStore,
      handoffStore,
      customerStore,
      tenantStore,
      subscriptionStore,
      invoiceStore,
      dqIncidentStore,
      reconRunStore,
    },
    ...overrides,
  };
  return prisma;
}

describe('Phase 15 Wave 4 — Closed-Won readiness + Phase 16 handoff + reports', () => {
  let prisma;
  let actorContext;

  beforeEach(() => {
    prisma = makePrisma();
    actorContext = { admin: superAdmin() };
  });

  it('Acceptance → readiness READY when evidence complete (version+checksum+authority)', async () => {
    const result = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-1',
      admin: actorContext.admin,
    });
    expect(result.ok).toBe(true);
    expect(result.readinessStatus).toBe(CRM_READINESS_STATUS.READY);
    expect(result.checklist.some((i) => i.key === 'acceptance_version' && i.ok)).toBe(true);
    expect(result.checklist.some((i) => i.key === 'acceptance_checksum' && i.ok)).toBe(true);
    expect(result.checklist.some((i) => i.key === 'acceptance_authority' && i.ok)).toBe(true);
    expect(result.closedWon).toBe(false);
    expect(result.conversionExecuted).toBe(false);
  });

  it('Handoff idempotent and creates zero provisioning side effects', async () => {
    const first = await createClosedWonConversionHandoff(prisma, {
      actorContext,
      acceptanceId: 'accp-1',
      idempotencyKey: 'handoff-1',
    });
    expect(first.ok).toBe(true);
    expect(first.handoff).toBeTruthy();
    expect(first.customerCreated).toBe(false);
    expect(first.tenantCreated).toBe(false);
    expect(first.subscriptionCreated).toBe(false);
    expect(first.invoiceCreated).toBe(false);
    expect(first.payload?.customerCreated).toBe(false);
    expect(first.payload?.tenantCreated).toBe(false);

    const customersBefore = prisma._stores.customerStore.length;
    const tenantsBefore = prisma._stores.tenantStore.length;
    const subsBefore = prisma._stores.subscriptionStore.length;
    const invoicesBefore = prisma._stores.invoiceStore.length;

    const second = await createClosedWonConversionHandoff(prisma, {
      actorContext,
      acceptanceId: 'accp-1',
      idempotencyKey: 'handoff-1',
    });
    expect(second.ok).toBe(true);
    expect(second.idempotentReplay || second.alreadyExists).toBeTruthy();
    expect(prisma._stores.handoffStore.length).toBe(1);
    expect(prisma._stores.customerStore.length).toBe(customersBefore);
    expect(prisma._stores.tenantStore.length).toBe(tenantsBefore);
    expect(prisma._stores.subscriptionStore.length).toBe(subsBefore);
    expect(prisma._stores.invoiceStore.length).toBe(invoicesBefore);
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();

    const after = await evaluateClosedWonReadiness(prisma, {
      acceptanceId: 'accp-1',
      admin: actorContext.admin,
    });
    expect(after.readinessStatus).toBe('HANDED_OFF');
  });

  it('Opp stage unchanged after acceptance/handoff', async () => {
    const oppBefore = { ...prisma._stores.opportunityStore[0] };
    await createClosedWonConversionHandoff(prisma, {
      actorContext,
      acceptanceId: 'accp-1',
      idempotencyKey: 'handoff-stage',
    });
    const oppAfter = prisma._stores.opportunityStore[0];
    expect(oppAfter.stageCode).toBe(oppBefore.stageCode);
    expect(oppAfter.probability).toBe(oppBefore.probability);
    expect(oppAfter.closeDate).toBe(oppBefore.closeDate);
    expect(oppAfter.status).toBe(oppBefore.status);
    expect(prisma.crmOpportunity.update).not.toHaveBeenCalled();
  });

  it('Report/metric gate fail ≠ fabricated 0', async () => {
    const honesty = applyCommercialReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.crmCommercialDocument.count = vi.fn(async () => {
      throw new Error('db down');
    });
    const metric = await getCommercialMetric(broken, {
      admin: actorContext.admin,
      metric: 'document_count',
    });
    expect(metric.ok).toBe(true);
    expect(metric.status).toBe(CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);
    expect(metric.honesty?.falseZeroes).toBe(false);

    const report = await getCommercialReport(broken, { admin: actorContext.admin });
    expect(report.status).toBe(CRM_COMMERCIAL_REPORT_STATUS.UNAVAILABLE);
    expect(report.report).toBeNull();
  });

  it('Currency-separated overview (no silent ZAR+USD sum)', async () => {
    const overview = await getCommercialOverview(prisma, {
      admin: actorContext.admin,
    });
    expect(overview.ok).toBe(true);
    expect(overview.byCurrency).toBeTruthy();
    expect(overview.byCurrency.ZAR).toBeTruthy();
    expect(overview.byCurrency.USD).toBeTruthy();
    expect(overview.combinedGrandTotal).toBeUndefined();
    expect(overview.silentMultiCurrencySum).toBe(false);
    expect(overview.honesty?.currencySeparated).toBe(true);
  });

  it('DQ + recon runners never invent zeroes on gate fail', async () => {
    const broken = makePrisma();
    broken.crmCommercialDocument.count = vi.fn(async () => {
      throw new Error('fail');
    });
    broken.crmCommercialAcceptance.count = vi.fn(async () => {
      throw new Error('fail');
    });

    const dq = await runCommercialDataQuality(broken, { admin: actorContext.admin });
    expect(dq.checks).toBeNull();
    expect(dq.honesty?.inventZeroesForbidden).toBe(true);
    expect(dq.honesty?.falseZeroes).toBe(false);

    const recon = await runCommercialReconciliation(broken, { admin: actorContext.admin });
    expect(recon.cards).toBeNull();
    expect(recon.honesty?.inventZeroesForbidden).toBe(true);
  });

  it('E-sign remains NOT_CONFIGURED (exit blocker honesty)', () => {
    const status = getESignatureProviderStatus();
    expect(status.status).toBe('NOT_CONFIGURED');
  });
});
