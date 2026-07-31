/**
 * Phase 16 Wave 2 — Customer match/create-link, Tenant/Business/Branch, invitations.
 * POSSIBLE_MATCH blocks create; no auto-merge; invite hash-only; no Tenant GL; no Subscription.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import * as closeModule from '@/lib/admin/crm/opportunities/close.js';
import * as readinessModule from '@/lib/admin/crm/conversions/readiness.js';
import * as customerMatchModule from '@/lib/admin/crm/conversions/customerMatch.js';
import * as accountingBoundaryModule from '@/lib/admin/crm/conversions/accountingBoundary.js';
import { runWave2ProvisionSpine } from '@/lib/admin/crm/conversions/wave2Runner.js';
import {
  matchPlatformCustomer,
  decideCustomerCreateOrLink,
  decideTenantCreateOrLink,
  createOrLinkPlatformCustomer,
  createOrLinkTenant,
  createPrimaryBusinessBranch,
  createInitialUserInvitation,
  assertNoTenantAccountingSideEffects,
  assertTenantIsolation,
  executeClosedWonConversion,
  ensureWave2Steps,
  CRM_CUSTOMER_MATCH_STATE,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_TENANT_PROVISION_STATUS,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-cvn-w2') {
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
  const conversionStore = overrides._conversionStore || [];
  const conversionHistoryStore = overrides._conversionHistoryStore || [];
  const stepStore = overrides._stepStore || [];
  const attemptStore = overrides._attemptStore || [];
  const failureStore = overrides._failureStore || [];
  const matchDecisionStore = overrides._matchDecisionStore || [];
  const resourceStore = overrides._resourceStore || [];
  const inviteStore = overrides._inviteStore || [];
  const journalStore = overrides._journalStore || [];
  const balanceStore = overrides._balanceStore || [];
  const branchStore = overrides._branchStore || [];
  const businessStore = overrides._businessStore || [];
  const tenantStore = overrides._tenantStore || [];
  const customerStore = overrides._customerStore || [];
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
  const contactStore = overrides._contactStore || [
    {
      id: 'con-1',
      contactNumber: 'CON-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.example',
      phone: '+265999000111',
      accountId: 'acct-1',
    },
  ];
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
      createdByAdminId: 'super-cvn-w2',
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

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _tenantStore: tenantStore,
    _customerStore: customerStore,
    _inviteStore: inviteStore,
    _journalStore: journalStore,
    _balanceStore: balanceStore,
    _branchStore: branchStore,
    _businessStore: businessStore,
    _matchDecisionStore: matchDecisionStore,
    _resourceStore: resourceStore,
    _stepStore: stepStore,
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
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...planVersionStore];
        if (where.planId) rows = rows.filter((r) => r.planId === where.planId);
        return rows[0] || null;
      }),
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
        if (where.id) rows = rows.filter((r) => r.id === where.id);
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.stepCode) rows = rows.filter((r) => r.stepCode === where.stepCode);
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
    crmConversionMatchDecision: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `match-${matchDecisionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        matchDecisionStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...matchDecisionStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...matchDecisionStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.decisionType) {
          rows = rows.filter((r) => r.decisionType === where.decisionType);
        }
        return rows[0] || null;
      }),
    },
    crmConversionResource: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `res-${resourceStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        resourceStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...resourceStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.resourceType) {
          rows = rows.filter((r) => r.resourceType === where.resourceType);
        }
        return rows;
      }),
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
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = resourceStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionInvitation: {
      create: vi.fn(async ({ data }) => {
        if (data.rawToken || data.token || data.password || data.temporaryPassword) {
          throw new Error('raw_token_or_password_forbidden');
        }
        const row = {
          id: data.id || `inv-${inviteStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        inviteStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...inviteStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (where.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where.email) rows = rows.filter((r) => r.email === where.email);
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...inviteStore]),
    },
    crmAccount: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return accountStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...accountStore];
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.registrationNumber) {
                return r.registrationNumber === clause.registrationNumber.equals ||
                  r.registrationNumber === clause.registrationNumber;
              }
              if (clause.taxId) {
                return r.taxId === clause.taxId.equals || r.taxId === clause.taxId;
              }
              if (clause.domain) {
                return r.domain === clause.domain.equals || r.domain === clause.domain;
              }
              if (clause.customerId) return r.customerId === clause.customerId;
              if (clause.tenantId) return r.tenantId === clause.tenantId;
              if (clause.displayName) {
                const q = clause.displayName.equals || clause.displayName.contains || clause.displayName;
                return String(r.displayName || '')
                  .toLowerCase()
                  .includes(String(q).toLowerCase());
              }
              return false;
            })
          );
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = accountStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmContact: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...contactStore];
        if (where.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
        return rows;
      }),
    },
    crmOpportunity: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return opportunityStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    platformCustomer: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pcust-${customerStore.length + 1}`,
          status: data.status || 'PROVISIONING',
          ...data,
        };
        customerStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return customerStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...customerStore];
        if (where.externalKey) {
          rows = rows.filter((r) => r.externalKey === where.externalKey);
        }
        if (where.registrationNumber) {
          rows = rows.filter((r) => r.registrationNumber === where.registrationNumber);
        }
        if (where.taxId) rows = rows.filter((r) => r.taxId === where.taxId);
        if (where.domain) rows = rows.filter((r) => r.domain === where.domain);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...customerStore];
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              const key = Object.keys(clause)[0];
              const val = clause[key]?.equals ?? clause[key];
              return r[key] === val;
            })
          );
        }
        return rows;
      }),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
        if (tenantStore.some((t) => t.subdomain === data.subdomain)) {
          const err = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `ten-${tenantStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        tenantStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return tenantStore.find((r) => r.id === where.id) || null;
        if (where.subdomain) {
          return tenantStore.find((r) => r.subdomain === where.subdomain) || null;
        }
        return null;
      }),
      findMany: vi.fn(async () => [...tenantStore]),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = tenantStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    branch: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `br-${branchStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        branchStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...branchStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where.name) rows = rows.filter((r) => r.name === where.name);
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...branchStore]),
    },
    // Conversion "Business" proxy store (no first-class Business model)
    conversionBusiness: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `biz-${businessStore.length + 1}`,
          ...data,
        };
        businessStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...businessStore]),
    },
    journalEntry: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `je-${journalStore.length + 1}`, ...data };
        journalStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...journalStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...journalStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
    },
    accountBalance: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `bal-${balanceStore.length + 1}`, ...data };
        balanceStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...balanceStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...balanceStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
    },
    ...overrides,
  };

  return prisma;
}

describe('Phase 16 Wave 2 — Customer / Tenant / invitations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSSIBLE_MATCH blocks Customer create (no auto-merge)', async () => {
    const prisma = makePrisma({
      _customerStore: [
        {
          id: 'pcust-similar',
          displayName: 'Acme Tradng',
          registrationNumber: null,
          taxId: null,
          domain: null,
        },
      ],
    });

    const match = await matchPlatformCustomer(prisma, {
      accountId: 'acct-1',
      evidence: {
        displayName: 'Acme Trading',
        registrationNumber: null,
        taxId: null,
        domain: null,
      },
    });

    expect(match.ok).toBe(true);
    expect(match.matchState).toBe(CRM_CUSTOMER_MATCH_STATE.POSSIBLE_MATCH);

    const decision = await decideCustomerCreateOrLink(prisma, {
      conversionId: 'cvn-test',
      match,
      admin: superAdmin(),
      action: 'CREATE',
    });

    expect(decision.ok).toBe(false);
    expect(decision.error).toBe('possible_match_blocks_create');
    expect(decision.requiresReview).toBe(true);

    const provision = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-test',
      accountId: 'acct-1',
      match,
      decision,
      admin: superAdmin(),
    });
    expect(provision.ok).toBe(false);
    expect(provision.error).toBe('possible_match_blocks_create');
    expect(prisma._customerStore.filter((c) => c.id !== 'pcust-similar')).toHaveLength(0);
  });

  it('exact link does not create duplicate Customer', async () => {
    const prisma = makePrisma({
      _customerStore: [
        {
          id: 'pcust-exact',
          displayName: 'Acme Trading',
          registrationNumber: 'REG-100',
          taxId: 'TAX-100',
          domain: 'acme.example',
          status: 'ACTIVE',
        },
      ],
      _accountStore: [
        {
          id: 'acct-1',
          accountNumber: 'ACC-001',
          displayName: 'Acme Trading',
          customerId: 'pcust-exact',
          tenantId: null,
          status: 'ACTIVE',
          registrationNumber: 'REG-100',
          taxId: 'TAX-100',
          domain: 'acme.example',
        },
      ],
    });

    const match = await matchPlatformCustomer(prisma, {
      accountId: 'acct-1',
      evidence: {
        existingCustomerId: 'pcust-exact',
        registrationNumber: 'REG-100',
        taxId: 'TAX-100',
        domain: 'acme.example',
        displayName: 'Acme Trading',
      },
    });

    expect(
      [
        CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH,
        CRM_CUSTOMER_MATCH_STATE.EXACT_EXISTING_CUSTOMER,
      ]
    ).toContain(match.matchState);

    const decision = await decideCustomerCreateOrLink(prisma, {
      conversionId: 'cvn-link',
      match,
      admin: superAdmin(),
      action: 'LINK',
    });
    expect(decision.ok).toBe(true);
    expect(
      [CRM_CUSTOMER_MATCH_STATE.LINK_EXISTING, 'LINK']
    ).toContain(decision.decision);
    expect(decision.audited).toBe(true);

    const before = prisma._customerStore.length;
    const provision = await createOrLinkPlatformCustomer(prisma, {
      conversionId: 'cvn-link',
      accountId: 'acct-1',
      match,
      decision,
      admin: superAdmin(),
      idempotencyKey: 'cust:cvn-link',
    });

    expect(provision.ok).toBe(true);
    expect(provision.action).toBe('LINK');
    expect(provision.customerId).toBe('pcust-exact');
    expect(prisma._customerStore).toHaveLength(before);
  });

  it('Tenant slug unique / reserved blocked; status not ACTIVE', async () => {
    const prisma = makePrisma({
      _tenantStore: [{ id: 'ten-existing', name: 'Taken', subdomain: 'taken', status: 'active' }],
    });

    const reserved = await createOrLinkTenant(prisma, {
      conversionId: 'cvn-t1',
      customerId: 'pcust-1',
      slug: 'admin',
      name: 'Admin Corp',
      admin: superAdmin(),
      decision: { ok: true, decision: 'CREATE' },
      idempotencyKey: 'tenant:cvn-t1:admin',
    });
    expect(reserved.ok).toBe(false);
    expect(reserved.error).toBe('tenant_slug_reserved');

    const collision = await createOrLinkTenant(prisma, {
      conversionId: 'cvn-t2',
      customerId: 'pcust-1',
      slug: 'taken',
      name: 'Taken Again',
      admin: superAdmin(),
      decision: { ok: true, decision: 'CREATE' },
      idempotencyKey: 'tenant:cvn-t2:taken',
    });
    expect(collision.ok).toBe(false);
    expect(collision.error).toBe('tenant_slug_collision');

    const tenantDecision = await decideTenantCreateOrLink(prisma, {
      conversionId: 'cvn-t3',
      slug: 'acme-trading',
      existingTenantId: null,
      admin: superAdmin(),
      action: 'CREATE',
    });
    expect(tenantDecision.ok).toBe(true);
    expect(tenantDecision.audited).toBe(true);

    const created = await createOrLinkTenant(prisma, {
      conversionId: 'cvn-t3',
      customerId: 'pcust-1',
      slug: 'acme-trading',
      name: 'Acme Trading',
      admin: superAdmin(),
      decision: tenantDecision,
      idempotencyKey: 'tenant:cvn-t3:acme',
      initFinancialDefaults: false,
      seedRoles: false,
    });
    expect(created.ok).toBe(true);
    expect(created.tenantId).toBeTruthy();
    expect(created.status).not.toBe('active');
    expect(created.status).not.toBe('ACTIVE');
    expect(['PROVISIONING', 'pending', 'PENDING']).toContain(created.status);
  });

  it('invitation exact retry returns same invite; hash only; no default password', async () => {
    const prisma = makePrisma();
    const args = {
      conversionId: 'cvn-inv',
      tenantId: 'ten-1',
      contactId: 'con-1',
      email: 'ada@acme.example',
      admin: superAdmin(),
      idempotencyKey: 'invite:cvn-inv:con-1',
    };

    const first = await createInitialUserInvitation(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.invitationId).toBeTruthy();
    expect(first.tokenHash).toBeTruthy();
    expect(first.rawToken).toBeUndefined();
    expect(first.token).toBeUndefined();
    expect(first.temporaryPassword).toBeUndefined();
    expect(first.password).toBeUndefined();

    const stored = prisma._inviteStore[0];
    expect(stored.tokenHash).toBe(first.tokenHash);
    expect(stored.rawToken).toBeUndefined();
    expect(stored.token).toBeUndefined();
    expect(stored.temporaryPassword).toBeUndefined();

    const second = await createInitialUserInvitation(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.invitationId).toBe(first.invitationId);
    expect(second.idempotentReplay).toBe(true);
    expect(prisma._inviteStore).toHaveLength(1);
  });

  it('accounting boundary: no journal/balance posts from conversion init', async () => {
    const prisma = makePrisma();
    const tenantId = 'ten-acct-1';
    prisma._tenantStore.push({
      id: tenantId,
      name: 'Acme',
      subdomain: 'acme-acct',
      status: 'PROVISIONING',
    });

    const ok = await assertNoTenantAccountingSideEffects(prisma, {
      tenantId,
      conversionId: 'cvn-acct',
    });
    expect(ok.ok).toBe(true);
    expect(ok.journalCount).toBe(0);
    expect(ok.balanceCount).toBe(0);

    await prisma.journalEntry.create({
      data: { tenantId, description: 'forbidden from conversion', amount: 100 },
    });
    const violated = await assertNoTenantAccountingSideEffects(prisma, {
      tenantId,
      conversionId: 'cvn-acct',
    });
    expect(violated.ok).toBe(false);
    expect(violated.error).toBe('tenant_accounting_side_effect_detected');
  });

  it('cross-Tenant Business create denied', async () => {
    const prisma = makePrisma({
      _tenantStore: [
        { id: 'ten-a', subdomain: 'a', name: 'A', status: 'PROVISIONING' },
        { id: 'ten-b', subdomain: 'b', name: 'B', status: 'PROVISIONING' },
      ],
    });

    const isolation = await assertTenantIsolation({
      lockedTenantId: 'ten-a',
      requestedTenantId: 'ten-b',
      resource: 'BUSINESS',
    });
    expect(isolation.ok).toBe(false);
    expect(isolation.error).toBe('cross_tenant_denied');

    const denied = await createPrimaryBusinessBranch(prisma, {
      conversionId: 'cvn-biz',
      lockedTenantId: 'ten-a',
      tenantId: 'ten-b',
      businessName: 'Wrong Tenant Biz',
      branchName: 'HQ',
      admin: superAdmin(),
      requireBusiness: true,
      idempotencyKey: 'biz:cvn-biz',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('cross_tenant_denied');
    expect(prisma._businessStore).toHaveLength(0);
    expect(prisma._branchStore).toHaveLength(0);
  });

  it('Customer step exception fails closed (no Tenant without Customer)', async () => {
    const prisma = makePrisma();
    const conversion = {
      id: 'cvn-exc-1',
      inputHash: 'hash-exc-1',
    };
    await ensureWave2Steps(prisma, conversion.id, conversion.inputHash, new Date());

    vi.spyOn(customerMatchModule, 'matchPlatformCustomer').mockRejectedValueOnce(
      new Error('customer_match_boom')
    );

    const result = await runWave2ProvisionSpine(prisma, {
      conversion,
      request: { accountId: 'acct-1', contactId: 'con-1' },
      admin: superAdmin(),
      planVersion: {
        contentJson: {
          tenantSlug: 'should-not-create',
          tenantName: 'Should Not Create',
          requireBusiness: false,
          requireBranch: false,
          inviteContacts: false,
        },
      },
      inputHash: conversion.inputHash,
      now: new Date(),
      args: { initFinancialDefaults: false, seedRoles: false },
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.error).toBe('customer_step_exception');
    expect(result.customerId).toBeFalsy();
    expect(prisma._tenantStore.find((t) => t.subdomain === 'should-not-create')).toBeFalsy();

    const customerStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER
    );
    expect(customerStep?.status).toBe(CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE);
    expect(customerStep?.status).not.toBe(
      CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING
    );
  });

  it('missing Business model returns typed NOT_AVAILABLE (no biz-proxy success)', async () => {
    const prisma = makePrisma({
      conversionBusiness: undefined,
    });
    // Ensure override removed the model (spread may leave undefined)
    delete prisma.conversionBusiness;

    const result = await createPrimaryBusinessBranch(prisma, {
      conversionId: 'cvn-biz-na',
      lockedTenantId: 'ten-a',
      tenantId: 'ten-a',
      businessName: 'Proxy Trap',
      branchName: 'HQ',
      admin: superAdmin(),
      requireBusiness: true,
      requireBranch: false,
      idempotencyKey: 'biz:cvn-biz-na',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('NOT_AVAILABLE');
    expect(result.error).toBe('business_model_unavailable');
    expect(result.businessId).toBeFalsy();
    expect(result.businessCreated).not.toBe(true);
    expect(String(result.businessId || '')).not.toMatch(/^biz-proxy:/);
    expect(prisma._businessStore).toHaveLength(0);
    expect(
      prisma._resourceStore.filter((r) => String(r.resourceId || '').startsWith('biz-proxy:'))
    ).toHaveLength(0);
  });

  it('accounting-boundary fail after Tenant create is compensatable and retry-idempotent', async () => {
    const prisma = makePrisma();
    const boundarySpy = vi
      .spyOn(accountingBoundaryModule, 'assertNoTenantAccountingSideEffects')
      .mockResolvedValueOnce({
        ok: false,
        error: 'tenant_accounting_side_effect_detected',
        journalCount: 1,
        balanceCount: 0,
      })
      .mockResolvedValue({
        ok: true,
        journalCount: 0,
        balanceCount: 0,
      });

    const args = {
      conversionId: 'cvn-bound-1',
      customerId: 'pcust-1',
      slug: 'acme-bound',
      name: 'Acme Bound',
      admin: superAdmin(),
      decision: { ok: true, decision: 'CREATE' },
      idempotencyKey: 'tenant:cvn-bound-1:acme-bound',
      initFinancialDefaults: false,
      seedRoles: false,
    };

    const first = await createOrLinkTenant(prisma, args);
    expect(first.ok).toBe(false);
    expect(first.error).toBe('tenant_accounting_side_effect_detected');
    expect(first.retryable).toBe(true);
    expect(first.tenantId).toBeTruthy();
    expect(prisma._tenantStore).toHaveLength(1);
    expect(prisma._tenantStore[0].status).toBe(
      CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING
    );

    const failedRes = prisma._resourceStore.find(
      (r) =>
        r.conversionId === 'cvn-bound-1' &&
        r.resourceType === 'TENANT' &&
        r.idempotencyKey === args.idempotencyKey
    );
    expect(failedRes).toBeTruthy();
    expect(failedRes.resourceId).toBe(first.tenantId);
    expect([
      'FAILED',
      CRM_TENANT_PROVISION_STATUS.FAILED_PROVISIONING,
      'FAILED_PROVISIONING',
    ]).toContain(failedRes.status);

    const retry = await createOrLinkTenant(prisma, args);
    expect(retry.ok).toBe(true);
    expect(retry.tenantId).toBe(first.tenantId);
    expect(retry.idempotentReplay || retry.recoveredFromFailedProvisioning).toBe(true);
    expect(prisma._tenantStore).toHaveLength(1);
    expect(prisma._tenantStore[0].subdomain).toBe('acme-bound');
    expect(prisma._tenantStore[0].status).not.toBe('active');
    expect(prisma._tenantStore[0].status).not.toBe('ACTIVE');
    expect(boundarySpy).toHaveBeenCalled();
  });

  it('orchestrator runs Wave 2 steps after Closed Won (not SKIPPED)', async () => {
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
    // READY conversion request + plan version
    const request = await prisma.crmConversionRequest.create({
      data: {
        id: 'cvr-w2',
        requestNumber: 'CVR-2026-000001',
        status: 'READY',
        source: 'PHASE_15_ACCEPTANCE_HANDOFF',
        conversionType: 'NEW_CUSTOMER_NEW_TENANT',
        acceptanceId: 'accp-1',
        handoffId: 'handoff-1',
        opportunityId: 'opp-1',
        accountId: 'acct-1',
        contactId: 'con-1',
        documentVersionId: 'ver-1',
        checksumSha256: 'abc123',
        currency: 'MWK',
        idempotencyKey: 'cvr:accp-1',
        createdByAdminId: 'super-cvn-w2',
      },
    });
    const plan = await prisma.crmConversionPlan.create({
      data: {
        id: 'plan-w2',
        conversionRequestId: request.id,
        latestVersionNumber: 1,
        createdByAdminId: 'super-cvn-w2',
      },
    });
    const planVersion = await prisma.crmConversionPlanVersion.create({
      data: {
        id: 'pv-w2',
        planId: plan.id,
        versionNumber: 1,
        planChecksum: 'chk-w2',
        contentJson: {
          conversionType: 'NEW_CUSTOMER_NEW_TENANT',
          tenantSlug: 'acme-wave2',
          tenantName: 'Acme Wave2',
          requireBusiness: true,
          requireBranch: true,
          inviteContacts: true,
        },
        immutable: true,
        createdByAdminId: 'super-cvn-w2',
      },
    });
    await prisma.crmConversionPlan.update({
      where: { id: plan.id },
      data: { currentVersionId: planVersion.id },
    });

    const result = await executeClosedWonConversion(prisma, {
      admin: superAdmin(),
      conversionRequestId: request.id,
      conversionPlanVersionId: planVersion.id,
      idempotencyKey: 'exec-w2-1',
      winReason: 'BEST_FIT',
    });

    expect(result.ok).toBe(true);
    expect(result.customerCreated || result.customerLinked).toBe(true);
    expect(result.tenantCreated || result.tenantLinked).toBe(true);
    expect(result.subscriptionCreated).toBe(false);
    expect(result.invoiceCreated).toBe(false);

    const customerStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_PLATFORM_CUSTOMER
    );
    const tenantStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_TENANT
    );
    expect(customerStep?.status).not.toBe(CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE);
    expect(tenantStep?.status).not.toBe(CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE);
    expect([
      CRM_CONVERSION_STEP_STATUS.COMPLETED,
      CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING,
      CRM_CONVERSION_STEP_STATUS.BLOCKED,
      CRM_CONVERSION_STEP_STATUS.MANUAL_INTERVENTION_REQUIRED,
    ]).toContain(customerStep?.status);

    const tenant = prisma._tenantStore.find((t) => t.subdomain === 'acme-wave2');
    if (tenant) {
      expect(tenant.status).not.toBe('active');
      const boundary = await assertNoTenantAccountingSideEffects(prisma, {
        tenantId: tenant.id,
        conversionId: result.conversion.id,
      });
      expect(boundary.ok).toBe(true);
    }
  });
});
