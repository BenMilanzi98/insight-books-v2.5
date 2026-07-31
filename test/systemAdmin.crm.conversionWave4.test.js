/**
 * Phase 16 Wave 4 — CS assignment, handoffs, completion, reports/DQ/recon,
 * weighted UI honesty gate, Phase 17 pack readiness.
 * Handoff ≠ execute. Gate fail ≠ fabricated 0. Indicative ≠ Revenue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import {
  assignCustomerSuccessOwner,
  createOnboardingHandoff,
  createTrainingHandoff,
  createDataMigrationHandoff,
  createMraEisHandoff,
  finalizeConversion,
  getConversionMetric,
  getConversionReport,
  applyConversionReportHonesty,
  runConversionDataQuality,
  runConversionReconciliation,
  resolveWeightedPipelineUiAccess,
  getOpportunityCommercial,
  WEIGHTED_PIPELINE_UI_ENABLED,
  compensateConversionArtifacts,
  CRM_CONVERSION_REPORT_STATUS,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-cvn-w4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.customers.managePortfolios': true,
      'systemAdmin.customers.read': true,
    },
  };
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
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.handoffType) {
        rows = rows.filter((r) => r.handoffType === where.handoffType);
      }
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.handoffType) {
        rows = rows.filter((r) => r.handoffType === where.handoffType);
      }
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
        if (where.tenantId && row.tenantId !== where.tenantId) match = false;
        if (where.isPrimary != null && row.isPrimary !== where.isPrimary) match = false;
        if (where.status && row.status !== where.status) match = false;
        if (match) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      return rows.length;
    }),
    delete: vi.fn(async ({ where = {} } = {}) => {
      const idx = store.findIndex((r) => r.id === where.id);
      if (idx < 0) throw new Error('not found');
      const [row] = store.splice(idx, 1);
      return row;
    }),
    deleteMany: vi.fn(async ({ where = {} } = {}) => {
      const before = store.length;
      for (let i = store.length - 1; i >= 0; i -= 1) {
        const row = store[i];
        if (where.id && row.id !== where.id) continue;
        if (where.conversionId && row.conversionId !== where.conversionId) continue;
        store.splice(i, 1);
      }
      return { count: before - store.length };
    }),
  };
}

function makePrisma(overrides = {}) {
  const conversionStore = overrides._conversionStore || [
    {
      id: 'cvn-w4',
      conversionNumber: 'CVN-2026-000004',
      conversionRequestId: 'cvr-w4',
      status: 'PARTIALLY_COMPLETED',
      opportunityId: 'opp-1',
      acceptanceId: 'accp-w4',
      documentVersionId: 'ver-w4',
      checksumSha256: 'chk-accepted-w4',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const tenantStore = overrides._tenantStore || [
    { id: 'ten-w4', subdomain: 'acme-w4', name: 'Acme W4', status: 'PROVISIONING' },
  ];
  const ownershipStore = overrides._ownershipStore || [];
  const csAssignStore = overrides._csAssignStore || [];
  const handoffStore = overrides._handoffStore || [];
  const certificateStore = overrides._certificateStore || [];
  const dqStore = overrides._dqStore || [];
  const reconStore = overrides._reconStore || [];
  const acceptanceStore = overrides._acceptanceStore || [
    {
      id: 'accp-w4',
      documentVersionId: 'ver-w4',
      checksumSha256: 'chk-accepted-w4',
      authorityRole: 'SIGNATORY',
      acceptedAt: new Date('2026-07-30T10:00:00Z'),
    },
  ];
  const resourceStore = overrides._resourceStore || [
    {
      id: 'res-ten',
      conversionId: 'cvn-w4',
      resourceType: 'TENANT',
      resourceId: 'ten-w4',
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _conversionStore: conversionStore,
    _tenantStore: tenantStore,
    _ownershipStore: ownershipStore,
    _csAssignStore: csAssignStore,
    _handoffStore: handoffStore,
    _certificateStore: certificateStore,
    _dqStore: dqStore,
    _reconStore: reconStore,
    _acceptanceStore: acceptanceStore,
    _resourceStore: resourceStore,
    tenant: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return tenantStore.find((t) => t.id === where.id) || null;
      }),
      count: vi.fn(async () => tenantStore.length),
    },
    customerPortfolio: {
      findUnique: vi.fn(async () => ({ id: 'port-1', status: 'ACTIVE', code: 'CS-DEFAULT' })),
    },
    customerOwnership: {
      ...simpleCrud(ownershipStore, 'own'),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `own-${ownershipStore.length + 1}`,
          status: data.status || 'ACTIVE',
          isPrimary: data.isPrimary !== false,
          assignmentType: data.assignmentType || 'CUSTOMER_SUCCESS_OWNER',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        ownershipStore.push(row);
        return row;
      }),
    },
    crmConversion: {
      ...simpleCrud(conversionStore, 'cvn'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return conversionStore.find((r) => r.id === where.id) || null;
        if (where.conversionNumber) {
          return (
            conversionStore.find((r) => r.conversionNumber === where.conversionNumber) ||
            null
          );
        }
        return null;
      }),
      count: vi.fn(async () => conversionStore.length),
    },
    crmConversionResource: simpleCrud(resourceStore, 'res'),
    crmConversionCsAssignment: simpleCrud(csAssignStore, 'csa'),
    crmConversionDomainHandoff: simpleCrud(handoffStore, 'hd'),
    crmConversionCompletionCertificate: simpleCrud(certificateStore, 'cert'),
    crmConversionDqIncident: simpleCrud(dqStore, 'dq'),
    crmConversionReconRun: simpleCrud(reconStore, 'recon'),
    crmCommercialAcceptance: {
      ...simpleCrud(acceptanceStore, 'accp'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return acceptanceStore.find((r) => r.id === where.id) || null;
      }),
      delete: vi.fn(async ({ where = {} } = {}) => {
        const idx = acceptanceStore.findIndex((r) => r.id === where.id);
        if (idx < 0) throw new Error('not found');
        const [row] = acceptanceStore.splice(idx, 1);
        return row;
      }),
      deleteMany: vi.fn(async () => {
        const count = acceptanceStore.length;
        acceptanceStore.length = 0;
        return { count };
      }),
      count: vi.fn(async () => acceptanceStore.length),
    },
    ...overrides,
  };
  return prisma;
}

describe('Phase 16 Wave 4 — handoffs, reports, weighted UI, completion', () => {
  let prisma;
  let admin;

  beforeEach(() => {
    prisma = makePrisma();
    admin = superAdmin();
  });

  it('handoff retry returns same id; onboarding not fabricated complete', async () => {
    const args = {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'onb-w4-1',
    };
    const first = await createOnboardingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.handoff?.id).toBeTruthy();
    expect(first.handoff?.executionStatus).toBe('NOT_STARTED');
    expect(first.onboardingCompleted).toBe(false);
    expect(first.fabricatedComplete).toBe(false);

    const second = await createOnboardingHandoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.handoff?.id).toBe(first.handoff.id);
    expect(second.idempotentReplay || second.alreadyExists).toBeTruthy();
    expect(prisma._handoffStore.length).toBe(1);
    expect(second.onboardingCompleted).toBe(false);

    const training = await createTrainingHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'trn-w4-1',
    });
    expect(training.ok).toBe(true);
    expect(training.trainingCompleted).toBe(false);

    const migration = await createDataMigrationHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'mig-w4-1',
    });
    expect(migration.ok).toBe(true);
    expect(migration.productionImportExecuted).toBe(false);

    const mra = await createMraEisHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'mra-w4-1',
    });
    expect(mra.ok).toBe(true);
    expect(mra.fiscalSubmitted).toBe(false);
    expect(mra.credentialsStored).toBe(false);
  });

  it('CS assignment is idempotent and does not fabricate health', async () => {
    const first = await assignCustomerSuccessOwner(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      ownerAdminId: 'cs-owner-1',
      portfolioId: 'port-1',
      idempotencyKey: 'cs-assign-w4',
    });
    expect(first.ok).toBe(true);
    expect(first.assignment?.id).toBeTruthy();
    expect(first.healthScore).toBeNull();
    expect(first.fabricatedHealth).toBe(false);

    const second = await assignCustomerSuccessOwner(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      ownerAdminId: 'cs-owner-1',
      portfolioId: 'port-1',
      idempotencyKey: 'cs-assign-w4',
    });
    expect(second.ok).toBe(true);
    expect(second.assignment?.id).toBe(first.assignment.id);
    expect(prisma._csAssignStore.length).toBe(1);
  });

  it('recon/metric gate fail ≠ fabricated 0', async () => {
    const honesty = applyConversionReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.crmConversion.count = vi.fn(async () => {
      throw new Error('db down');
    });

    const metric = await getConversionMetric(broken, {
      admin,
      metric: 'conversion_count',
    });
    expect(metric.ok).toBe(true);
    expect(metric.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);

    const report = await getConversionReport(broken, { admin });
    expect(report.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(report.report).toBeNull();

    const dq = await runConversionDataQuality(broken, { admin });
    expect(dq.checks).toBeNull();
    expect(dq.honesty?.falseZeroes).toBe(false);

    const recon = await runConversionReconciliation(broken, { admin });
    expect(recon.cards).toBeNull();
    expect(recon.honesty?.falseZeroes).toBe(false);
  });

  it('weighted UI unlock is honesty/currency gated; never Revenue', () => {
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);

    const lockedHonesty = resolveWeightedPipelineUiAccess({
      honestyOk: false,
      currencyOk: true,
    });
    expect(lockedHonesty.unlocked).toBe(false);
    expect(lockedHonesty.weightedUiEnabled).toBe(false);
    expect(lockedHonesty.isRevenue).toBe(false);
    expect(lockedHonesty.reason).toBe('honesty_gate_failed');

    const lockedCurrency = resolveWeightedPipelineUiAccess({
      honestyOk: true,
      currencyOk: false,
    });
    expect(lockedCurrency.unlocked).toBe(false);
    expect(lockedCurrency.weightedUiEnabled).toBe(false);
    expect(lockedCurrency.reason).toBe('currency_gate_failed');

    const unlocked = resolveWeightedPipelineUiAccess({
      honestyOk: true,
      currencyOk: true,
    });
    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.weightedUiEnabled).toBe(true);
    expect(unlocked.isRevenue).toBe(false);
    expect(unlocked.isIndicativeOnly).toBe(true);
    expect(unlocked.label).toBe('indicative_weighted_amount_not_revenue');
  });

  it('commercial surface never exposes ungated weightedUiEnabled as true', async () => {
    prisma.crmOpportunity = {
      findUnique: vi.fn(async () => ({
        id: 'opp-1',
        amount: 1000,
        currency: 'MUR',
        amountBasis: 'FIRST_YEAR_TOTAL',
        probability: 50,
        recurringAnnualAmount: null,
        oneTimeAmount: null,
      })),
    };
    prisma.crmOpportunityAmountHistory = {
      findMany: vi.fn(async () => []),
      create: vi.fn(),
    };

    const ungated = await getOpportunityCommercial(prisma, {
      admin,
      opportunityId: 'opp-1',
    });
    expect(ungated.ok).toBe(true);
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
    expect(ungated.weightedUiCapability).toBe(true);
    expect(ungated.weightedUiEnabled).toBe(false);
    expect(ungated.isRevenue).toBe(false);
    expect(ungated.indicativeWeighted?.isRevenue).toBe(false);

    const gated = await getOpportunityCommercial(prisma, {
      admin,
      opportunityId: 'opp-1',
      uiGate: { honestyOk: true, currencyOk: true },
    });
    expect(gated.weightedUiEnabled).toBe(true);
    expect(gated.isRevenue).toBe(false);
    expect(gated.isIndicativeOnly).toBe(true);
  });

  it('handoff stored payload cannot forge fiscal/execution completion flags', async () => {
    const onboarding = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'onb-forge-1',
      payload: {
        onboardingCompleted: true,
        fabricatedComplete: true,
        executionComplete: true,
        executionStatus: 'COMPLETED',
      },
    });
    expect(onboarding.ok).toBe(true);
    const onbPayload = prisma._handoffStore.find((h) => h.idempotencyKey === 'onb-forge-1')
      ?.payloadJson;
    expect(onbPayload.onboardingCompleted).toBe(false);
    expect(onbPayload.fabricatedComplete).toBe(false);
    expect(onbPayload.executionComplete).toBe(false);
    expect(onbPayload.executionStatus).toBe('NOT_STARTED');

    const training = await createTrainingHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'trn-forge-1',
      payload: {
        trainingCompleted: true,
        fabricatedComplete: true,
        executionComplete: true,
      },
    });
    expect(training.ok).toBe(true);
    const trnPayload = prisma._handoffStore.find((h) => h.idempotencyKey === 'trn-forge-1')
      ?.payloadJson;
    expect(trnPayload.trainingCompleted).toBe(false);
    expect(trnPayload.fabricatedComplete).toBe(false);
    expect(trnPayload.executionComplete).toBe(false);

    const migration = await createDataMigrationHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'mig-forge-1',
      payload: { productionImportExecuted: true },
    });
    expect(migration.ok).toBe(true);
    const migPayload = prisma._handoffStore.find((h) => h.idempotencyKey === 'mig-forge-1')
      ?.payloadJson;
    expect(migPayload.productionImportExecuted).toBe(false);

    const mra = await createMraEisHandoff(prisma, {
      admin,
      conversionId: 'cvn-w4',
      tenantId: 'ten-w4',
      idempotencyKey: 'mra-forge-1',
      payload: {
        fiscalSubmitted: true,
        credentialsStored: true,
        mraEisFiscalSubmitted: true,
      },
    });
    expect(mra.ok).toBe(true);
    expect(mra.mraEisFiscalSubmitted).toBe(false);
    const mraPayload = prisma._handoffStore.find((h) => h.idempotencyKey === 'mra-forge-1')
      ?.payloadJson;
    expect(mraPayload.fiscalSubmitted).toBe(false);
    expect(mraPayload.credentialsStored).toBe(false);
    expect(mraPayload.mraEisFiscalSubmitted).toBe(false);
  });

  it('completion certificate checksum is stable across finalize retries', async () => {
    const first = await finalizeConversion(prisma, {
      admin,
      conversionId: 'cvn-w4',
      idempotencyKey: 'finalize-w4',
    });
    expect(first.ok).toBe(true);
    expect(first.certificate?.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.certificate?.acceptanceId).toBe('accp-w4');

    const second = await finalizeConversion(prisma, {
      admin,
      conversionId: 'cvn-w4',
      idempotencyKey: 'finalize-w4',
    });
    expect(second.ok).toBe(true);
    expect(second.certificate?.id).toBe(first.certificate.id);
    expect(second.certificate?.checksumSha256).toBe(first.certificate.checksumSha256);

    const expected = createHash('sha256')
      .update(
        JSON.stringify({
          conversionId: 'cvn-w4',
          acceptanceId: 'accp-w4',
          documentVersionId: 'ver-w4',
          acceptanceChecksumSha256: 'chk-accepted-w4',
          tenantId: 'ten-w4',
        })
      )
      .digest('hex');
    expect(first.certificate.checksumSha256).toBe(expected);
  });

  it('compensation does not delete acceptance evidence', async () => {
    const before = prisma._acceptanceStore.length;
    expect(before).toBeGreaterThan(0);

    const result = await compensateConversionArtifacts(prisma, {
      admin,
      conversionId: 'cvn-w4',
      acceptanceId: 'accp-w4',
      reason: 'wave4_test_compensate',
    });
    expect(result.ok).toBe(true);
    expect(result.acceptancePreserved).toBe(true);
    expect(result.deletedAcceptance).toBe(false);
    expect(prisma._acceptanceStore.length).toBe(before);
    expect(prisma.crmCommercialAcceptance.delete).not.toHaveBeenCalled();
    expect(prisma.crmCommercialAcceptance.deleteMany).not.toHaveBeenCalled();
  });
});
