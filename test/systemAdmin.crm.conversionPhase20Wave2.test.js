/**
 * Phase 20 Wave 2 — Conversion saga idempotency / snapshot immutability /
 * customer-contact duplicates harden.
 *
 * Exact retry → same CVN; conflicting idempotency → fail;
 * snapshot immutable after lock; Proposal draft edit ≠ mutate locked snapshot;
 * EXACT_MATCH blocks auto-create; LINK_EXISTING; no auto-merge;
 * Contact duplicate link vs create; consent preserved; cross-Customer denied;
 * Optimistic concurrency / step resume without duplicate downstream creates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as closeModule from '@/lib/admin/crm/opportunities/close.js';
import * as readinessModule from '@/lib/admin/crm/conversions/readiness.js';
import {
  executeClosedWonConversion,
  matchPlatformCustomer,
  decideCustomerCreateOrLink,
  createOrLinkPlatformCustomer,
  linkContactsForConversion,
  CRM_CUSTOMER_MATCH_STATE,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_CONVERSION_RESOURCE_TYPE,
} from '@/lib/admin/crm';
import {
  lockConversionCommercialSnapshot,
  getLockedConversionCommercialSnapshot,
  resolveConversionAcceptedSnapshot,
} from '@/lib/admin/crm/conversions/commercialSnapshot.js';
import {
  claimConversionStep,
  beginStepOptimistic,
} from '@/lib/admin/crm/conversions/steps.js';
import { runWave2ProvisionSpine } from '@/lib/admin/crm/conversions/wave2Runner.js';
import {
  decideContactCreateOrLink,
} from '@/lib/admin/crm/conversions/businessBranch.js';
import { updateDocumentVersionContent } from '@/lib/admin/crm/commercial/versions.js';
import { CRM_CONSENT_STATUS } from '@/lib/admin/crm/catalogue.js';

function superAdmin(id = 'super-p20-w2') {
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
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.resourceType) {
        rows = rows.filter((r) => r.resourceType === where.resourceType);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.email) {
        rows = rows.filter(
          (r) => String(r.email || '').toLowerCase() === String(where.email).toLowerCase()
        );
      }
      if (where.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
      if (orderBy?.createdAt === 'desc') {
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.resourceType) {
        rows = rows.filter((r) => r.resourceType === where.resourceType);
      }
      if (where.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
      if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
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
      let rows = [...store];
      if (where.id) rows = rows.filter((r) => r.id === where.id);
      if (where.status != null) rows = rows.filter((r) => r.status === where.status);
      if (where.attemptCount != null) {
        rows = rows.filter((r) => r.attemptCount === where.attemptCount);
      }
      if (where.version != null) rows = rows.filter((r) => r.version === where.version);
      for (const row of rows) {
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      }
      return { count: rows.length };
    }),
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const planStore = overrides._planStore || [];
  const planVersionStore = overrides._planVersionStore || [];
  const conversionStore = overrides._conversionStore || [];
  const conversionHistoryStore = overrides._conversionHistoryStore || [];
  const stepStore = overrides._stepStore || [];
  const attemptStore = overrides._attemptStore || [];
  const failureStore = overrides._failureStore || [];
  const matchDecisionStore = overrides._matchDecisionStore || [];
  const resourceStore = overrides._resourceStore || [];
  const customerStore = overrides._customerStore || [];
  const contactStore = overrides._contactStore || [
    {
      id: 'con-1',
      contactNumber: 'CON-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.example',
      phone: '+265999000111',
      accountId: 'acct-1',
      role: 'PRIMARY',
    },
  ];
  const accountStore = overrides._accountStore || [
    {
      id: 'acct-1',
      accountNumber: 'ACC-001',
      displayName: 'Acme Trading',
      customerId: null,
      tenantId: null,
      status: 'ACTIVE',
      registrationNumber: 'REG-100',
      taxId: 'TAX-100',
      domain: 'acme.example',
    },
  ];
  const consentStore = overrides._consentStore || [];
  const dncStore = overrides._dncStore || [];
  const documentVersionStore = overrides._documentVersionStore || [
    {
      id: 'cdv-1',
      documentId: 'doc-1',
      versionNumber: 1,
      status: 'ACCEPTED',
      immutable: true,
      contentJson: {
        lineItems: [{ sku: 'PLAN-A', qty: 1, unitPrice: 1000 }],
        totals: { currency: 'MWK', grandTotal: 1000 },
      },
    },
    {
      id: 'cdv-draft',
      documentId: 'doc-1',
      versionNumber: 2,
      status: 'DRAFT',
      immutable: false,
      contentJson: {
        lineItems: [{ sku: 'PLAN-A', qty: 1, unitPrice: 1000 }],
        totals: { currency: 'MWK', grandTotal: 1000 },
      },
    },
  ];
  const acceptanceStore = overrides._acceptanceStore || [
    {
      id: 'accp-1',
      documentVersionId: 'cdv-1',
      checksumSha256: 'snap-checksum-abc',
      authorityStatus: 'VERIFIED',
    },
  ];
  const opportunityStore = overrides._opportunityStore || [
    {
      id: 'opp-1',
      opportunityNumber: 'OPP-2026-000001',
      stageCode: 'CLOSED_WON',
      status: 'WON',
      accountId: 'acct-1',
      contactId: 'con-1',
      currency: 'MWK',
      amount: 1000,
      version: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-1',
      acceptanceId: 'accp-1',
      documentVersionId: 'cdv-1',
      opportunityId: 'opp-1',
      payloadJson: {
        type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF',
        acceptanceId: 'accp-1',
        opportunityId: 'opp-1',
        accountId: 'acct-1',
        contactId: 'con-1',
        checksumSha256: 'snap-checksum-abc',
        documentVersionId: 'cdv-1',
        currency: 'MWK',
      },
      idempotencyKey: 'closed-won-handoff:accp-1',
      createdByAdminId: 'super-p20-w2',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];
  const stageHistoryStore = overrides._stageHistoryStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _conversionStore: conversionStore,
    _requestStore: requestStore,
    _resourceStore: resourceStore,
    _stepStore: stepStore,
    _customerStore: customerStore,
    _contactStore: contactStore,
    _documentVersionStore: documentVersionStore,
    _consentStore: consentStore,
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === (where.prefix_year?.prefix || where.prefix) &&
            r.year === (where.prefix_year?.year || where.year) &&
            (where.lastValue == null || r.lastValue === where.lastValue)
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      }),
    },
    crmClosedWonConversionHandoff: simpleCrud(handoffStore, 'handoff'),
    crmCommercialAcceptance: simpleCrud(acceptanceStore, 'accp'),
    crmCommercialDocumentVersion: {
      ...simpleCrud(documentVersionStore, 'cdv'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return documentVersionStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = documentVersionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmAccount: {
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        accountStore.find((r) => r.id === where.id) || null
      ),
      findMany: vi.fn(async () => [...accountStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = accountStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmContact: {
      ...simpleCrud(contactStore, 'con'),
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        contactStore.find((r) => r.id === where.id) || null
      ),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...contactStore];
        if (where.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
        if (where.email) {
          rows = rows.filter(
            (r) => String(r.email || '').toLowerCase() === String(where.email).toLowerCase()
          );
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `con-${contactStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        contactStore.push(row);
        return row;
      }),
    },
    crmConsentRecord: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...consentStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...consentStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        return rows;
      }),
    },
    crmDoNotContact: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...dncStore];
        if (where.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        return rows;
      }),
    },
    platformCustomer: {
      findMany: vi.fn(async () => [...customerStore]),
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        customerStore.find((r) => r.id === where.id) || null
      ),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...customerStore];
        if (where.email) {
          rows = rows.filter(
            (r) => String(r.email || '').toLowerCase() === String(where.email).toLowerCase()
          );
        }
        if (where.registrationNumber) {
          rows = rows.filter(
            (r) =>
              String(r.registrationNumber || '').toLowerCase() ===
              String(where.registrationNumber).toLowerCase()
          );
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pcust-${customerStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        customerStore.push(row);
        return row;
      }),
    },
    crmOpportunity: {
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        opportunityStore.find((r) => r.id === where.id) || null
      ),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let rows = [...opportunityStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
    },
    crmOpportunityStageHistory: simpleCrud(stageHistoryStore, 'osh'),
    crmConversionRequest: {
      ...simpleCrud(requestStore, 'cvr'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionRequestStatusHistory: simpleCrud(requestHistoryStore, 'cvrh'),
    crmConversionPlan: {
      ...simpleCrud(planStore, 'plan'),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where.conversionRequestId) {
          return planStore.find((r) => r.conversionRequestId === where.conversionRequestId) || null;
        }
        return planStore[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = planStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmConversionPlanVersion: {
      ...simpleCrud(planVersionStore, 'pv'),
      findUnique: vi.fn(async ({ where = {} } = {}) =>
        planVersionStore.find((r) => r.id === where.id) || null
      ),
      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...planVersionStore];
        if (where.planId) rows = rows.filter((r) => r.planId === where.planId);
        if (orderBy?.versionNumber === 'desc') {
          rows.sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
        }
        return rows[0] || null;
      }),
    },
    crmConversion: {
      create: vi.fn(async ({ data }) => {
        if (
          data.idempotencyKey &&
          conversionStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `cvn-${conversionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          version: data.version ?? 1,
          ...data,
        };
        conversionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return conversionStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return conversionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = conversionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let rows = [...conversionStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        for (const row of rows) {
          Object.assign(row, data, {
            updatedAt: data.updatedAt || new Date(),
            version: data.version != null ? data.version : (row.version || 1) + 1,
          });
        }
        return { count: rows.length };
      }),
    },
    crmConversionStatusHistory: simpleCrud(conversionHistoryStore, 'cvnh'),
    crmConversionStep: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `step-${stepStore.length + 1}`,
          attemptCount: data.attemptCount ?? 0,
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
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return stepStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = stepStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where = {}, data = {} } = {}) => {
        let rows = [...stepStore];
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.status != null) rows = rows.filter((r) => r.status === where.status);
        if (where.attemptCount != null) {
          rows = rows.filter((r) => r.attemptCount === where.attemptCount);
        }
        for (const row of rows) {
          Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        }
        return { count: rows.length };
      }),
    },
    crmConversionAttempt: simpleCrud(attemptStore, 'att'),
    crmConversionFailure: simpleCrud(failureStore, 'fail'),
    crmConversionMatchDecision: simpleCrud(matchDecisionStore, 'md'),
    crmConversionResource: {
      ...simpleCrud(resourceStore, 'res'),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...resourceStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.resourceType) {
          rows = rows.filter((r) => r.resourceType === where.resourceType);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where.resourceId) {
          rows = rows.filter((r) => r.resourceId === where.resourceId);
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        if (
          data.idempotencyKey &&
          resourceStore.some(
            (r) =>
              r.conversionId === data.conversionId &&
              r.resourceType === data.resourceType &&
              r.idempotencyKey === data.idempotencyKey
          )
        ) {
          const err = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `res-${resourceStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        resourceStore.push(row);
        return row;
      }),
    },
    crmTimelineEvent: { create: vi.fn(async ({ data }) => data) },
  };

  return prisma;
}

async function seedReadyConversion(prisma, {
  idempotencyKey = 'cvn-p20-w2:1',
  planNotes = null,
} = {}) {
  const request = await prisma.crmConversionRequest.create({
    data: {
      id: `cvr-${idempotencyKey}`,
      requestNumber: `CVR-2026-${String(prisma._requestStore.length + 1).padStart(6, '0')}`,
      status: 'READY',
      source: 'PHASE_15_ACCEPTANCE_HANDOFF',
      conversionType: 'NEW_CUSTOMER_NEW_TENANT',
      acceptanceId: 'accp-1',
      handoffId: 'handoff-1',
      opportunityId: 'opp-1',
      accountId: 'acct-1',
      contactId: 'con-1',
      documentVersionId: 'cdv-1',
      checksumSha256: 'snap-checksum-abc',
      currency: 'MWK',
      idempotencyKey: `cvr-key:${idempotencyKey}`,
      createdByAdminId: 'super-p20-w2',
    },
  });
  const plan = await prisma.crmConversionPlan.create({
    data: {
      id: `plan-${idempotencyKey}`,
      conversionRequestId: request.id,
      latestVersionNumber: 1,
      createdByAdminId: 'super-p20-w2',
    },
  });
  const planVersion = await prisma.crmConversionPlanVersion.create({
    data: {
      id: `pv-${idempotencyKey}`,
      planId: plan.id,
      versionNumber: 1,
      planChecksum: `chk-${idempotencyKey}`,
      notes: planNotes,
      contentJson: {
        conversionType: 'NEW_CUSTOMER_NEW_TENANT',
        acceptedSnapshot: {
          acceptanceId: 'accp-1',
          documentVersionId: 'cdv-1',
          checksumSha256: 'snap-checksum-abc',
          currency: 'MWK',
          planCode: 'PLAN-A',
          totals: { currency: 'MWK', total: 1000, grandTotal: 1000 },
          lineItems: [{ sku: 'PLAN-A', qty: 1, unitPrice: 1000 }],
        },
        customerDisplayName: 'Acme Trading',
        registrationNumber: 'REG-100',
        taxId: 'TAX-100',
        domain: 'acme.example',
        tenantSlug: `acme-${idempotencyKey}`.slice(0, 40),
        tenantName: 'Acme Trading',
      },
      immutable: true,
      createdByAdminId: 'super-p20-w2',
    },
  });
  await prisma.crmConversionPlan.update({
    where: { id: plan.id },
    data: { currentVersionId: planVersion.id },
  });
  return { request, planVersion };
}

describe('Phase 20 Wave 2 — saga idempotency / snapshot / duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('catalogue exposes EXACT_MATCH and LINK_EXISTING / CREATE_NEW policy states', () => {
    expect(CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH).toBe('EXACT_MATCH');
    expect(CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING).toBe('LINK_EXISTING');
    expect(CRM_CUSTOMER_MATCH_STATE.CREATE_NEW).toBe('CREATE_NEW');
    expect(CRM_CONVERSION_RESOURCE_TYPE.COMMERCIAL_SNAPSHOT).toBe('COMMERCIAL_SNAPSHOT');
  });

  it('exact conversion retry returns same Conversion; conflicting idempotency fails', async () => {
    vi.spyOn(closeModule, 'closeOpportunityWon').mockResolvedValue({
      ok: true,
      toStageCode: 'CLOSED_WON',
    });
    vi.spyOn(readinessModule, 'evaluateConversionRequestReadiness').mockResolvedValue({
      ok: true,
      readinessStatus: 'READY',
      checklist: [],
    });

    const prisma = makePrisma();
    const admin = superAdmin();
    const seeded = await seedReadyConversion(prisma, {
      idempotencyKey: 'exact-1',
    });

    const args = {
      actorContext: { admin },
      conversionRequestId: seeded.request.id,
      conversionPlanVersionId: seeded.planVersion.id,
      idempotencyKey: 'cvn-exact-p20:1',
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-31',
      evidence: [{ type: 'ACCEPTANCE', value: 'accp-1' }],
    };

    const first = await executeClosedWonConversion(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.conversion.id).toBeTruthy();

    const second = await executeClosedWonConversion(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.conversion.id).toBe(first.conversion.id);
    expect(prisma._conversionStore.length).toBe(1);

    // Same key, different plan version → input hash conflict
    const otherPlan = await prisma.crmConversionPlanVersion.create({
      data: {
        id: 'pv-conflict',
        planId: seeded.planVersion.planId,
        versionNumber: 2,
        planChecksum: 'chk-conflict',
        contentJson: { materialChange: true },
        immutable: true,
        createdByAdminId: admin.id,
      },
    });
    const conflict = await executeClosedWonConversion(prisma, {
      ...args,
      conversionPlanVersionId: otherPlan.id,
      idempotencyKey: 'cvn-exact-p20:1',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/idempotency_input_conflict/i);
    expect(prisma._conversionStore.length).toBe(1);
  });

  it('locks commercial snapshot with checksum; Proposal draft edit does not mutate locked snapshot', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const snapshot = {
      acceptanceId: 'accp-1',
      documentVersionId: 'cdv-1',
      checksumSha256: 'snap-checksum-abc',
      currency: 'MWK',
      planCode: 'PLAN-A',
      totals: { currency: 'MWK', total: 1000, grandTotal: 1000 },
      lineItems: [{ sku: 'PLAN-A', qty: 1, unitPrice: 1000 }],
    };

    const locked = await lockConversionCommercialSnapshot(prisma, {
      actorContext: { admin },
      conversionId: 'cvn-snap-1',
      acceptanceId: 'accp-1',
      documentVersionId: 'cdv-1',
      snapshot,
      now: new Date('2026-07-31T12:00:00Z'),
    });
    expect(locked.ok).toBe(true);
    expect(locked.locked).toBe(true);
    expect(locked.checksumSha256).toBeTruthy();
    expect(locked.immutable).toBe(true);

    const replay = await lockConversionCommercialSnapshot(prisma, {
      actorContext: { admin },
      conversionId: 'cvn-snap-1',
      acceptanceId: 'accp-1',
      documentVersionId: 'cdv-1',
      snapshot: { ...snapshot, totals: { currency: 'MWK', total: 9999 } },
      now: new Date('2026-07-31T12:05:00Z'),
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotentReplay).toBe(true);

    const got = await getLockedConversionCommercialSnapshot(prisma, {
      conversionId: 'cvn-snap-1',
    });
    expect(got.ok).toBe(true);
    expect(got.snapshot.totals.grandTotal).toBe(1000);
    expect(got.immutable).toBe(true);

    // Silent draft Proposal edit must not mutate locked conversion snapshot
    await updateDocumentVersionContent(prisma, {
      actorContext: { admin },
      documentVersionId: 'cdv-draft',
      contentJson: {
        lineItems: [{ sku: 'PLAN-A', qty: 99, unitPrice: 9999 }],
        totals: { currency: 'MWK', grandTotal: 999999 },
      },
    });

    const afterEdit = await getLockedConversionCommercialSnapshot(prisma, {
      conversionId: 'cvn-snap-1',
    });
    expect(afterEdit.snapshot.totals.grandTotal).toBe(1000);
    expect(afterEdit.snapshot.lineItems[0].qty).toBe(1);

    const resolved = resolveConversionAcceptedSnapshot({
      lockedSnapshot: afterEdit.snapshot,
      planSnapshot: { totals: { grandTotal: 50 } },
      argsSnapshot: { totals: { grandTotal: 1 } },
    });
    expect(resolved.totals.grandTotal).toBe(1000);
  });

  it('EXACT_MATCH blocks auto-create; LINK_EXISTING path; no auto-merge', async () => {
    const prisma = makePrisma({
      _customerStore: [
        {
          id: 'pcust-exact',
          displayName: 'Acme Trading Ltd',
          registrationNumber: 'REG-100',
          taxId: 'TAX-100',
          domain: 'acme.example',
          email: 'billing@acme.example',
        },
      ],
    });
    const admin = superAdmin();

    const match = await matchPlatformCustomer(prisma, {
      accountId: 'acct-1',
      evidence: {
        registrationNumber: 'REG-100',
        taxId: 'TAX-100',
        existingCustomerId: 'pcust-exact',
      },
    });
    // Exact identity → EXACT_MATCH (or legacy EXACT_EXISTING_CUSTOMER)
    expect(
      [CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH, CRM_CUSTOMER_MATCH_STATE.EXACT_EXISTING_CUSTOMER]
    ).toContain(match.matchState);
    expect(match.primaryCandidateId).toBe('pcust-exact');

    const blockedCreate = await decideCustomerCreateOrLink(prisma, {
      conversionId: 'cvn-exact-block',
      match: {
        ...match,
        matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
        primaryCandidateId: 'pcust-exact',
      },
      action: 'CREATE',
      admin,
    });
    expect(blockedCreate.ok).toBe(false);
    expect(blockedCreate.error).toMatch(/exact|link_required|auto_create/i);
    expect(blockedCreate.requiresReview || blockedCreate.decision).toBeTruthy();

    const link = await decideCustomerCreateOrLink(prisma, {
      conversionId: 'cvn-exact-link',
      match: {
        ...match,
        matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
        primaryCandidateId: 'pcust-exact',
      },
      action: 'LINK',
      admin,
    });
    expect(link.ok).toBe(true);
    expect(link.decision).toBe(CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING);
    expect(link.customerId).toBe('pcust-exact');

    // Soft-name possible match still blocks create (no auto-merge)
    const soft = await decideCustomerCreateOrLink(prisma, {
      conversionId: 'cvn-soft',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.POSSIBLE_MATCH,
        primaryCandidateId: 'pcust-exact',
        candidates: [{ customerId: 'pcust-exact' }],
      },
      action: 'CREATE',
      admin,
    });
    expect(soft.ok).toBe(false);
    expect(soft.requiresReview).toBe(true);

    // Server gate: provision refuses CREATE on EXACT_MATCH even if decision forged
    const forged = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-forge',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
        primaryCandidateId: 'pcust-exact',
        evidence: {},
      },
      decision: { ok: true, decision: 'CREATE_NEW', customerId: null },
      action: 'CREATE',
      admin,
      idempotencyKey: 'customer:cvn-forge',
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/exact_match|auto_create|link_required/i);

    // Non-LINK forge (e.g. LINK_REQUIRED) must NOT fall through to platformCustomer.create
    const customersBefore = prisma._customerStore.length;
    const forgedFallthrough = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-forge-fallthrough',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
        primaryCandidateId: 'pcust-exact',
        evidence: {},
      },
      decision: { ok: true, decision: 'LINK_REQUIRED', customerId: null },
      admin,
      idempotencyKey: 'customer:cvn-forge-fallthrough',
    });
    expect(forgedFallthrough.ok).toBe(false);
    expect(forgedFallthrough.error).toMatch(
      /exact_match|auto_create|link_required|invalid_customer_decision/i
    );
    expect(prisma._customerStore.length).toBe(customersBefore);
    expect(prisma.platformCustomer.create).not.toHaveBeenCalled();
  });

  it('contact duplicate: link vs create; consent preserved; cross-Customer denied', async () => {
    const prisma = makePrisma({
      _contactStore: [
        {
          id: 'con-1',
          contactNumber: 'CON-001',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@acme.example',
          accountId: 'acct-1',
          role: 'PRIMARY',
        },
        {
          id: 'con-other',
          contactNumber: 'CON-002',
          firstName: 'Other',
          lastName: 'Cust',
          email: 'other@rival.example',
          accountId: 'acct-rival',
          role: 'PRIMARY',
          customerId: 'pcust-rival',
        },
      ],
      _consentStore: [
        {
          id: 'consent-1',
          contactId: 'con-1',
          status: CRM_CONSENT_STATUS.GRANTED,
          purposes: ['MARKETING', 'ONBOARDING'],
        },
      ],
      _accountStore: [
        {
          id: 'acct-1',
          displayName: 'Acme',
          customerId: 'pcust-acme',
        },
        {
          id: 'acct-rival',
          displayName: 'Rival',
          customerId: 'pcust-rival',
        },
      ],
      _customerStore: [
        { id: 'pcust-acme', displayName: 'Acme' },
        { id: 'pcust-rival', displayName: 'Rival' },
      ],
    });
    const admin = superAdmin();

    const linkDecision = await decideContactCreateOrLink(prisma, {
      conversionId: 'cvn-con-1',
      customerId: 'pcust-acme',
      contactId: 'con-1',
      accountId: 'acct-1',
      admin,
    });
    expect(linkDecision.ok).toBe(true);
    expect(linkDecision.decision).toMatch(/LINK/i);
    expect(linkDecision.consentStatus).toBe(CRM_CONSENT_STATUS.GRANTED);
    expect(linkDecision.consentPreserved).toBe(true);

    const cross = await decideContactCreateOrLink(prisma, {
      conversionId: 'cvn-con-x',
      customerId: 'pcust-acme',
      contactId: 'con-other',
      accountId: 'acct-1',
      admin,
    });
    expect(cross.ok).toBe(false);
    expect(cross.error).toMatch(/cross_customer|denied/i);

    const linked = await linkContactsForConversion(prisma, {
      conversionId: 'cvn-con-1',
      tenantId: 'ten-1',
      customerId: 'pcust-acme',
      accountId: 'acct-1',
      contactId: 'con-1',
      admin,
      now: new Date(),
    });
    expect(linked.ok).toBe(true);
    expect(linked.linkedContacts[0].consentStatus).toBe(CRM_CONSENT_STATUS.GRANTED);
    expect(linked.linkedContacts[0].consentPreserved).toBe(true);

    const denied = await linkContactsForConversion(prisma, {
      conversionId: 'cvn-con-x',
      tenantId: 'ten-1',
      customerId: 'pcust-acme',
      accountId: 'acct-1',
      contactId: 'con-other',
      admin,
      now: new Date(),
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/cross_customer|denied/i);

    // Create path when no existing contact identity under customer
    const createDecision = await decideContactCreateOrLink(prisma, {
      conversionId: 'cvn-con-new',
      customerId: 'pcust-acme',
      email: 'new.person@acme.example',
      firstName: 'New',
      lastName: 'Person',
      accountId: 'acct-1',
      role: 'BILLING',
      admin,
    });
    expect(createDecision.ok).toBe(true);
    expect(createDecision.decision).toMatch(/CREATE/i);
  });

  it('optimistic concurrency claim + resume does not duplicate downstream creates', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const now = new Date('2026-07-31T13:00:00Z');

    const step = await prisma.crmConversionStep.create({
      data: {
        conversionId: 'cvn-occ-1',
        stepCode: CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER,
        stepOrder: 30,
        status: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
        attemptCount: 0,
        inputHash: 'h1',
      },
    });

    const claim1 = await claimConversionStep(prisma, {
      stepId: step.id,
      expectedStatus: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
      expectedAttemptCount: 0,
      now,
    });
    expect(claim1.ok).toBe(true);
    expect(claim1.step.status).toBe(CRM_CONVERSION_STEP_STATUS.IN_PROGRESS);
    expect(claim1.step.attemptCount).toBe(1);

    const claim2 = await claimConversionStep(prisma, {
      stepId: step.id,
      expectedStatus: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
      expectedAttemptCount: 0,
      now,
    });
    expect(claim2.ok).toBe(false);
    expect(claim2.error).toMatch(/concurrency|conflict|stale/i);

    // Resource create once; resume replays
    const customer = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-occ-1',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.NO_MATCH,
        primaryCandidateId: null,
        evidence: { displayName: 'New Co', registrationNumber: 'REG-NEW' },
      },
      decision: {
        ok: true,
        decision: CRM_CUSTOMER_MATCH_STATE.CREATE_NEW,
        customerId: null,
      },
      action: 'CREATE',
      admin,
      idempotencyKey: 'customer:cvn-occ-1',
      now,
    });
    expect(customer.ok).toBe(true);
    expect(customer.customerCreated).toBe(true);

    const resume = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-occ-1',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.NO_MATCH,
        evidence: { displayName: 'New Co', registrationNumber: 'REG-NEW' },
      },
      decision: {
        ok: true,
        decision: CRM_CUSTOMER_MATCH_STATE.CREATE_NEW,
      },
      action: 'CREATE',
      admin,
      idempotencyKey: 'customer:cvn-occ-1',
      now,
    });
    expect(resume.ok).toBe(true);
    expect(resume.idempotentReplay).toBe(true);
    expect(resume.customerId).toBe(customer.customerId);
    expect(prisma._customerStore.length).toBe(1);

    const begun = await beginStepOptimistic(prisma, {
      step: {
        ...step,
        status: CRM_CONVERSION_STEP_STATUS.COMPLETED,
        attemptCount: 1,
      },
      now,
    });
    expect(begun.skip).toBe(true);
  });

  it('EXACT_MATCH forged non-LINK decision never creates Platform Customer', async () => {
    const prisma = makePrisma({
      _customerStore: [
        {
          id: 'pcust-exact-2',
          displayName: 'Exact Co',
          registrationNumber: 'REG-200',
        },
      ],
    });
    const admin = superAdmin();
    const before = prisma._customerStore.length;

    for (const forgedDecision of ['LINK_REQUIRED', 'REVIEW', 'MERGE', '', null]) {
      prisma.platformCustomer.create.mockClear();
      const result = await createOrLinkPlatformCustomer(prisma, {
        conversionId: `cvn-forge-${String(forgedDecision || 'null')}`,
        accountId: 'acct-1',
        match: {
          matchState: CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
          primaryCandidateId: 'pcust-exact-2',
          evidence: {},
        },
        decision: { ok: true, decision: forgedDecision, customerId: null },
        admin,
        idempotencyKey: `customer:cvn-forge-${String(forgedDecision || 'null')}`,
      });
      expect(result.ok).toBe(false);
      expect(prisma.platformCustomer.create).not.toHaveBeenCalled();
    }
    expect(prisma._customerStore.length).toBe(before);
  });

  it('concurrent alreadyInProgress resume does not double-create Customers', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const now = new Date('2026-07-31T14:00:00Z');

    const step = await prisma.crmConversionStep.create({
      data: {
        conversionId: 'cvn-toctou-1',
        stepCode: CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER,
        stepOrder: 30,
        status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
        attemptCount: 1,
        inputHash: 'h-toctou',
      },
    });

    const begunA = await beginStepOptimistic(prisma, { step, now });
    const begunB = await beginStepOptimistic(prisma, { step, now });
    expect(begunA.skip).toBe(true);
    expect(begunA.alreadyInProgress || begunA.concurrencyConflict).toBe(true);
    expect(begunB.skip).toBe(true);
    expect(begunB.concurrencyConflict).toBe(true);

    // Winner completes CREATE once; concurrent resume must replay, not create again.
    const first = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-toctou-1',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.NO_MATCH,
        primaryCandidateId: null,
        evidence: { displayName: 'Toctou Co', registrationNumber: 'REG-TOCTOU' },
      },
      decision: {
        ok: true,
        decision: CRM_CUSTOMER_MATCH_STATE.CREATE_NEW,
        customerId: null,
      },
      action: 'CREATE',
      admin,
      idempotencyKey: 'customer:cvn-toctou-1',
      now,
    });
    expect(first.ok).toBe(true);
    expect(first.customerCreated).toBe(true);

    const concurrent = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-toctou-1',
      accountId: 'acct-1',
      match: {
        matchState: CRM_CUSTOMER_MATCH_STATE.NO_MATCH,
        evidence: { displayName: 'Toctou Co', registrationNumber: 'REG-TOCTOU' },
      },
      decision: {
        ok: true,
        decision: CRM_CUSTOMER_MATCH_STATE.CREATE_NEW,
      },
      action: 'CREATE',
      admin,
      idempotencyKey: 'customer:cvn-toctou-1',
      now,
    });
    expect(concurrent.ok).toBe(true);
    expect(concurrent.idempotentReplay).toBe(true);
    expect(concurrent.customerId).toBe(first.customerId);
    expect(prisma._customerStore.length).toBe(1);
  });

  it('concurrencyConflict blocks Wave 2 when customerId missing (no null continue)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const now = new Date('2026-07-31T15:00:00Z');
    const conversionId = 'cvn-cas-block-1';

    // Pre-seed Wave 2 customer step as IN_PROGRESS with no output / no resource.
    await prisma.crmConversionStep.create({
      data: {
        conversionId,
        stepCode: CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER,
        stepOrder: 30,
        status: CRM_CONVERSION_STEP_STATUS.IN_PROGRESS,
        attemptCount: 1,
        inputHash: 'h-cas',
        outputJson: null,
      },
    });
    for (const [code, order] of [
      [CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_TENANT, 40],
      [CRM_CONVERSION_STEP_CODE.CREATE_BUSINESS, 50],
      [CRM_CONVERSION_STEP_CODE.CREATE_BRANCH, 60],
      [CRM_CONVERSION_STEP_CODE.LINK_CONTACTS, 70],
      [CRM_CONVERSION_STEP_CODE.CREATE_INITIAL_USER_INVITATIONS, 80],
    ]) {
      await prisma.crmConversionStep.create({
        data: {
          conversionId,
          stepCode: code,
          stepOrder: order,
          status: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
          attemptCount: 0,
          inputHash: 'h-cas',
        },
      });
    }

    const result = await runWave2ProvisionSpine(prisma, {
      conversion: { id: conversionId, inputHash: 'h-cas' },
      request: {
        accountId: 'acct-1',
        contactId: 'con-1',
        acceptanceId: 'accp-1',
      },
      admin,
      planVersion: {
        contentJson: {
          customerDisplayName: 'Cas Block Co',
          registrationNumber: 'REG-CAS',
          tenantSlug: 'cas-block',
          tenantName: 'Cas Block Co',
          acceptedSnapshot: {
            acceptanceId: 'accp-1',
            checksumSha256: 'snap-checksum-abc',
            totals: { grandTotal: 1000 },
          },
        },
      },
      inputHash: 'h-cas',
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.error).toMatch(/concurrency|in_progress|conflict/i);
    expect(result.customerId == null).toBe(true);
    expect(prisma._customerStore.length).toBe(0);
  });
});
