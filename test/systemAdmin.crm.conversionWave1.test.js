/**
 * Phase 16 Wave 1 — Conversion request / plan / dry-run / orchestrator spine + Closed Won early.
 * No Customer/Tenant/Subscription/Invoice create. Dry-run = zero operational side effects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as closeModule from '@/lib/admin/crm/opportunities/close.js';
import * as statusModule from '@/lib/admin/crm/conversions/status.js';
import {
  CRM_CONVERSION_REQUEST_NUMBER_RE,
  CRM_CONVERSION_NUMBER_RE,
  allocateConversionRequestNumber,
  allocateConversionNumber,
  createConversionRequest,
  createConversionRequestFromClosedWonHandoff,
  evaluateConversionReadiness,
  createConversionPlan,
  dryRunConversion,
  executeClosedWonConversion,
  resumeConversion,
  getConversionDomainContract,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-cvn-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.pipeline.transitionStages': true,
    },
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const planStore = overrides._planStore || [];
  const planVersionStore = overrides._planVersionStore || [];
  const dryRunStore = overrides._dryRunStore || [];
  const conversionStore = overrides._conversionStore || [];
  const conversionHistoryStore = overrides._conversionHistoryStore || [];
  const stepStore = overrides._stepStore || [];
  const attemptStore = overrides._attemptStore || [];
  const failureStore = overrides._failureStore || [];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-1',
      acceptanceId: 'accp-1',
      documentVersionId: 'ver-1',
      opportunityId: 'opp-1',
      payloadJson: {
        type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF',
        acceptanceId: 'accp-1',
        opportunityId: 'opp-1',
        accountId: 'acct-1',
        contactId: 'con-1',
        checksumSha256: 'abc123',
        documentVersionId: 'ver-1',
        currency: 'MWK',
      },
      idempotencyKey: 'closed-won-handoff:accp-1',
      createdByAdminId: 'super-cvn-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const opportunityStore = overrides._opportunityStore || [
    {
      id: 'opp-1',
      opportunityNumber: 'OPP-2026-000001',
      stageCode: 'NEGOTIATION',
      status: 'OPEN',
      accountId: 'acct-1',
      contactId: 'con-1',
      currency: 'MWK',
      amount: 5000,
      version: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];
  const customerStore = overrides._customerStore || [];
  const tenantStore = overrides._tenantStore || [];
  const subscriptionStore = overrides._subscriptionStore || [];
  const acceptanceStore = overrides._acceptanceStore || [
    {
      id: 'accp-1',
      documentVersionId: 'ver-1',
      artifactId: 'art-1',
      checksumSha256: 'abc123',
      recipientId: 'rcp-1',
      authorityRole: 'SIGNATORY',
      authorityStatus: 'VERIFIED',
      acceptedAt: new Date('2026-07-30T10:00:00Z'),
      createdAt: new Date('2026-07-30T10:00:00Z'),
      updatedAt: new Date('2026-07-30T10:00:00Z'),
    },
  ];
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'ver-1',
      documentId: 'doc-1',
      versionNumber: 1,
      status: 'ACCEPTED',
      immutable: true,
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _planVersionStore: planVersionStore,
    _conversionStore: conversionStore,
    _stepStore: stepStore,
    _opportunityStore: opportunityStore,
    _customerStore: customerStore,
    _tenantStore: tenantStore,
    _subscriptionStore: subscriptionStore,
    crmCommercialAcceptance: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `accp-${acceptanceStore.length + 1}`, ...data };
        acceptanceStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return acceptanceStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return acceptanceStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...acceptanceStore];
        if (where.documentVersionId) {
          rows = rows.filter((r) => r.documentVersionId === where.documentVersionId);
        }
        return rows[0] || null;
      }),
    },
    crmCommercialDocumentVersion: {
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        documentVersionStore.find((r) => r.id === where.id) || null
      ),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = documentVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
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
    crmClosedWonConversionHandoff: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return handoffStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return handoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.acceptanceId) {
          rows = rows.filter((r) => r.acceptanceId === where.acceptanceId);
        }
        return rows[0] || null;
      }),
    },
    crmConversionRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cvr-${requestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        requestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.requestNumber) {
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.acceptanceId) {
          rows = rows.filter((r) => r.acceptanceId === where.acceptanceId);
        }
        if (where.handoffId) rows = rows.filter((r) => r.handoffId === where.handoffId);
        if (where.source) rows = rows.filter((r) => r.source === where.source);
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...requestStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cvrh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    crmConversionPlan: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `plan-${planStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        planStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return planStore.find((r) => r.id === where.id) || null;
        if (where.conversionRequestId) {
          return planStore.find((r) => r.conversionRequestId === where.conversionRequestId) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = planStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionPlanVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pv-${planVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        planVersionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return planVersionStore.find((r) => r.id === where.id) || null;
        if (where.planId_versionNumber) {
          const k = where.planId_versionNumber;
          return (
            planVersionStore.find(
              (r) => r.planId === k.planId && r.versionNumber === k.versionNumber
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...planVersionStore];
        if (where.planId) rows = rows.filter((r) => r.planId === where.planId);
        if (orderBy?.versionNumber === 'desc') {
          rows.sort((a, b) => b.versionNumber - a.versionNumber);
        }
        return rows[0] || null;
      }),
    },
    crmConversionDryRun: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `dry-${dryRunStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        dryRunStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...dryRunStore]),
    },
    crmConversion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cvn-${conversionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        conversionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return conversionStore.find((r) => r.id === where.id) || null;
        if (where.conversionNumber) {
          return conversionStore.find((r) => r.conversionNumber === where.conversionNumber) || null;
        }
        if (where.idempotencyKey) {
          return conversionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...conversionStore];
        if (where.conversionRequestId) {
          rows = rows.filter((r) => r.conversionRequestId === where.conversionRequestId);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = conversionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cvnh-${conversionHistoryStore.length + 1}`, ...data };
        conversionHistoryStore.push(row);
        return row;
      }),
    },
    crmConversionStep: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `step-${stepStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        stepStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...stepStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (orderBy?.stepOrder === 'asc') {
          rows.sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...stepStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.stepCode) rows = rows.filter((r) => r.stepCode === where.stepCode);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = stepStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      createMany: vi.fn(async ({ data }) => {
        for (const d of data) {
          stepStore.push({
            id: d.id || `step-${stepStore.length + 1}`,
            createdAt: d.createdAt || new Date(),
            updatedAt: d.updatedAt || new Date(),
            ...d,
          });
        }
        return { count: data.length };
      }),
    },
    crmConversionAttempt: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `att-${attemptStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        attemptStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...attemptStore]),
    },
    crmConversionFailure: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `fail-${failureStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        failureStore.push(row);
        return row;
      }),
    },
    crmOpportunity: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return (
            opportunityStore.find((r) => r.opportunityNumber === where.opportunityNumber) || null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    // Operational domains — Wave 1 must NOT create via dry-run / execute spine
    customer: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `cust-${customerStore.length + 1}`, ...data };
        customerStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...customerStore]),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ten-${tenantStore.length + 1}`, ...data };
        tenantStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...tenantStore]),
    },
    subscription: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sub-${subscriptionStore.length + 1}`, ...data };
        subscriptionStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...subscriptionStore]),
    },
  };

  return prisma;
}

describe('Phase 16 Wave 1 — Conversion spine', () => {
  let closeSpy;

  beforeEach(() => {
    closeSpy = vi.spyOn(closeModule, 'closeOpportunityWon').mockImplementation(async (prisma, args) => {
      const opp = await prisma.crmOpportunity.findUnique({
        where: { id: args.opportunityId },
      });
      if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };
      const updated = await prisma.crmOpportunity.update({
        where: { id: opp.id },
        data: {
          stageCode: 'CLOSED_WON',
          status: 'WON',
          winReason: args.winReason || 'BEST_FIT',
          decisionDate: args.decisionDate || new Date(),
          closedAt: args.now || new Date(),
        },
      });
      return {
        ok: true,
        opportunity: updated,
        toStageCode: 'CLOSED_WON',
        tenantCreated: false,
        subscriptionCreated: false,
        invoiceCreated: false,
        paymentCreated: false,
        provisionExecuted: false,
      };
    });
    closeSpy.mockClear();
  });

  it('allocates unique CVR-YYYY-###### request numbers', async () => {
    const prisma = makePrisma();
    const a = await allocateConversionRequestNumber(prisma, {
      now: new Date('2026-07-31T12:00:00Z'),
    });
    const b = await allocateConversionRequestNumber(prisma, {
      now: new Date('2026-07-31T12:00:00Z'),
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.number).toMatch(CRM_CONVERSION_REQUEST_NUMBER_RE);
    expect(b.number).toMatch(CRM_CONVERSION_REQUEST_NUMBER_RE);
    expect(a.number).not.toBe(b.number);
    expect(getConversionDomainContract().surface).toContain('conversions');
  });

  it('Phase 15 handoff → CVR is idempotent', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const first = await createConversionRequestFromClosedWonHandoff(prisma, {
      actorContext: { admin },
      acceptanceId: 'accp-1',
      idempotencyKey: 'cvr-from-handoff:accp-1',
    });
    expect(first.ok).toBe(true);
    expect(first.request.requestNumber).toMatch(CRM_CONVERSION_REQUEST_NUMBER_RE);
    expect(first.request.acceptanceId).toBe('accp-1');

    const second = await createConversionRequestFromClosedWonHandoff(prisma, {
      actorContext: { admin },
      acceptanceId: 'accp-1',
      idempotencyKey: 'cvr-from-handoff:accp-1',
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
  });

  it('dry-run does not create Customer/Tenant/Subscription or change Opp stage', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-dry:1',
    });
    expect(req.ok).toBe(true);

    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    expect(plan.ok).toBe(true);

    const stageBefore = prisma._opportunityStore[0].stageCode;
    const dry = await dryRunConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
    });
    expect(dry.ok).toBe(true);
    expect(dry.customerCreated).toBe(false);
    expect(dry.tenantCreated).toBe(false);
    expect(dry.subscriptionCreated).toBe(false);
    expect(dry.invoiceCreated).toBe(false);
    expect(dry.opportunityStageMutated).toBe(false);
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma._opportunityStore[0].stageCode).toBe(stageBefore);
    expect(prisma._conversionStore.length).toBe(0);
  });

  it('execute Closed Won once via Phase 12 closeOpportunityWon (no direct status invent)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-exec:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const readiness = await evaluateConversionReadiness(prisma, {
      conversionRequestId: req.request.id,
      actorContext: { admin },
      admin,
    });
    expect(readiness.ok).toBe(true);

    const exec = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-exec:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    });
    expect(exec.ok).toBe(true);
    expect(exec.conversion.conversionNumber).toMatch(CRM_CONVERSION_NUMBER_RE);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy.mock.calls[0][1].opportunityId).toBe('opp-1');
    expect(prisma._opportunityStore[0].stageCode).toBe('CLOSED_WON');

    const closedWonStep = prisma._stepStore.find(
      (s) => s.stepCode === 'TRANSITION_OPPORTUNITY_CLOSED_WON'
    );
    expect(closedWonStep).toBeTruthy();
    expect(closedWonStep.status).toBe('COMPLETED');

    const validateStep = prisma._stepStore.find((s) => s.stepCode === 'VALIDATE_EVIDENCE');
    expect(validateStep?.status).toBe('COMPLETED');

    // Wave 1 must not provision operational resources
    expect(exec.customerCreated).toBe(false);
    expect(exec.tenantCreated).toBe(false);
    expect(exec.subscriptionCreated).toBe(false);
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('exact retry returns existing conversion (no duplicate CVN)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-retry:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const args = {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-exact:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    };
    const first = await executeClosedWonConversion(prisma, args);
    expect(first.ok).toBe(true);
    const second = await executeClosedWonConversion(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.conversion.id).toBe(first.conversion.id);
    expect(prisma._conversionStore.length).toBe(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('conflicting retry (same key, different input hash) fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-conflict:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const plan2 = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      forceNewVersion: true,
      notes: 'material change for conflict',
    });
    expect(plan2.planVersion.id).not.toBe(plan.planVersion.id);

    const first = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-conflict:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    });
    expect(first.ok).toBe(true);

    const conflict = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan2.planVersion.id,
      idempotencyKey: 'cvn-conflict:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/conflict|idempotency/i);
    expect(prisma._conversionStore.length).toBe(1);
  });

  it('resume skips completed validate and closed-won steps', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-resume:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const exec = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-resume:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
      // Wave 1: simulate a later step failure without reopen
      simulateLaterStepFailure: true,
    });
    expect(exec.ok).toBe(true);
    expect(prisma._opportunityStore[0].stageCode).toBe('CLOSED_WON');

    closeSpy.mockClear();
    const resumed = await resumeConversion(prisma, {
      actorContext: { admin },
      conversionId: exec.conversion.id,
      idempotencyKey: 'cvn-resume:1',
    });
    expect(resumed.ok).toBe(true);
    expect(resumed.skippedStepCodes).toEqual(
      expect.arrayContaining(['VALIDATE_EVIDENCE', 'TRANSITION_OPPORTUNITY_CLOSED_WON'])
    );
    expect(closeSpy).not.toHaveBeenCalled();
    expect(prisma._opportunityStore[0].stageCode).toBe('CLOSED_WON');
  });

  it('allocates unique CVN numbers', async () => {
    const prisma = makePrisma();
    const a = await allocateConversionNumber(prisma, {
      now: new Date('2026-07-31T12:00:00Z'),
    });
    const b = await allocateConversionNumber(prisma, {
      now: new Date('2026-07-31T12:00:00Z'),
    });
    expect(a.number).toMatch(CRM_CONVERSION_NUMBER_RE);
    expect(b.number).toMatch(CRM_CONVERSION_NUMBER_RE);
    expect(a.number).not.toBe(b.number);
  });

  it('exact retry completes incomplete Closed Won before reporting success', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-retry-incomplete:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const args = {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-retry-incomplete:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    };
    const first = await executeClosedWonConversion(prisma, args);
    expect(first.ok).toBe(true);

    // Simulate crash after durable CVN insert, before Closed Won completed
    const closedWonStep = prisma._stepStore.find(
      (s) => s.stepCode === 'TRANSITION_OPPORTUNITY_CLOSED_WON'
    );
    expect(closedWonStep).toBeTruthy();
    closedWonStep.status = 'NOT_STARTED';
    closedWonStep.outputJson = null;
    closedWonStep.errorCode = null;
    prisma._conversionStore[0].closedWonAt = null;
    prisma._opportunityStore[0].stageCode = 'NEGOTIATION';
    prisma._opportunityStore[0].status = 'OPEN';

    closeSpy.mockClear();
    const second = await executeClosedWonConversion(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(prisma._opportunityStore[0].stageCode).toBe('CLOSED_WON');
    expect(closedWonStep.status).toBe('COMPLETED');
    expect(prisma._conversionStore[0].closedWonAt).toBeTruthy();
    expect(prisma._conversionStore.length).toBe(1);
  });

  it('resume executes incomplete Closed Won via Phase 12 (skips when completed)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-resume-incomplete:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    const exec = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-resume-incomplete:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
      simulateLaterStepFailure: true,
    });
    expect(exec.ok).toBe(true);

    const closedWonStep = prisma._stepStore.find(
      (s) => s.stepCode === 'TRANSITION_OPPORTUNITY_CLOSED_WON'
    );
    closedWonStep.status = 'FAILED_RETRYABLE';
    closedWonStep.errorCode = 'SIMULATED_CRASH_BEFORE_CLOSED_WON';
    prisma._conversionStore[0].closedWonAt = null;
    prisma._opportunityStore[0].stageCode = 'NEGOTIATION';
    prisma._opportunityStore[0].status = 'OPEN';

    closeSpy.mockClear();
    const resumed = await resumeConversion(prisma, {
      actorContext: { admin },
      conversionId: exec.conversion.id,
      idempotencyKey: 'cvn-resume-incomplete:1',
    });
    expect(resumed.ok).toBe(true);
    expect(resumed.skippedStepCodes).toEqual(
      expect.arrayContaining(['VALIDATE_EVIDENCE'])
    );
    expect(resumed.skippedStepCodes).not.toEqual(
      expect.arrayContaining(['TRANSITION_OPPORTUNITY_CLOSED_WON'])
    );
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(prisma._opportunityStore[0].stageCode).toBe('CLOSED_WON');
    expect(closedWonStep.status).toBe('COMPLETED');
    expect(prisma._conversionStore[0].closedWonAt).toBeTruthy();
  });

  it('CVR status update fails closed without force-bypass on illegal transition', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const req = await createConversionRequest(prisma, {
      actorContext: { admin },
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      acceptanceId: 'accp-1',
      opportunityId: 'opp-1',
      handoffId: 'handoff-1',
      idempotencyKey: 'cvr-status-noforce:1',
    });
    const plan = await createConversionPlan(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
    });
    expect(prisma._requestStore[0].status).toBe('READY');

    const transitionSpy = vi
      .spyOn(statusModule, 'transitionConversionRequestStatus')
      .mockResolvedValue({
        ok: false,
        error: 'invalid_status_transition: READY → IN_PROGRESS',
      });

    const exec = await executeClosedWonConversion(prisma, {
      actorContext: { admin },
      conversionRequestId: req.request.id,
      conversionPlanVersionId: plan.planVersion.id,
      idempotencyKey: 'cvn-status-noforce:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    });

    expect(exec.ok).toBe(false);
    expect(exec.error).toMatch(
      /invalid_status_transition|transition|conversion_not_ready|not_ready/i
    );
    expect(prisma._requestStore[0].status).toBe('READY');
    expect(closeSpy).not.toHaveBeenCalled();
    transitionSpy.mockRestore();
  });
});
