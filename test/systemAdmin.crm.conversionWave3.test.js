/**
 * Phase 16 Wave 3 — Subscription, entitlements, billing, payment boundary, activation.
 * Invoice from accepted snapshot only; payment initiation ≠ PAID; Closed Won ≠ ACTIVE.
 * Entitlement qty ≤ accepted; no Tenant GL; no fabricate PAID/ACTIVE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as closeModule from '@/lib/admin/crm/opportunities/close.js';
import * as readinessModule from '@/lib/admin/crm/conversions/readiness.js';
import {
  createOrAmendSubscriptionFromAccepted,
  provisionEntitlementsFromAccepted,
  createOrLinkBillingAccount,
  createBillingSchedule,
  createPlatformInvoiceIfRequired,
  initiatePaymentIfRequired,
  activateProvisionedSubscription,
  assertNoTenantAccountingSideEffects,
  executeClosedWonConversion,
  runWave3ProvisionSpine,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_ACTIVATION_POLICY,
  CRM_SUBSCRIPTION_PROVISION_STATUS,
} from '@/lib/admin/crm';
import { ENTITLEMENT_STATUSES } from '@/lib/admin/featureEntitlements';

function superAdmin(id = 'super-cvn-w3') {
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

function acceptedSnapshot(overrides = {}) {
  return {
    acceptanceId: 'accp-w3',
    documentVersionId: 'ver-w3',
    checksumSha256: 'chk-accepted-w3',
    currency: 'MWK',
    planCode: 'CORE_GROWTH',
    planVersion: 2,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    lineItems: [
      {
        productRef: 'CORE_GROWTH',
        featureCode: 'POS',
        quantity: 2,
        unitPrice: 50000,
        lineTotal: 100000,
      },
      {
        productRef: 'ADDON_USERS',
        featureCode: 'EXTRA_USERS',
        quantity: 5,
        unitPrice: 10000,
        lineTotal: 50000,
      },
    ],
    totals: {
      subtotal: 150000,
      discount: 0,
      tax: 0,
      total: 150000,
    },
    ...overrides,
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
  const tenantStore = overrides._tenantStore || [
    {
      id: 'ten-w3',
      subdomain: 'acme-w3',
      name: 'Acme W3',
      status: 'PROVISIONING',
    },
  ];
  const customerStore = overrides._customerStore || [
    { id: 'pcust-w3', displayName: 'Acme W3', status: 'PROVISIONING' },
  ];
  const subscriptionStore = overrides._subscriptionStore || [];
  const entitlementStore = overrides._entitlementStore || [];
  const billingAccountStore = overrides._billingAccountStore || [];
  const billingScheduleStore = overrides._billingScheduleStore || [];
  const invoiceStore = overrides._invoiceStore || [];
  const paymentStore = overrides._paymentStore || [];
  const activationStore = overrides._activationStore || [];
  const accountStore = overrides._accountStore || [
    {
      id: 'acct-1',
      accountNumber: 'ACC-001',
      displayName: 'Acme Trading',
      customerId: null,
      tenantId: null,
      status: 'ACTIVE',
    },
  ];
  const contactStore = overrides._contactStore || [
    {
      id: 'con-1',
      contactNumber: 'CON-001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@acme.example',
      accountId: 'acct-1',
    },
  ];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-1',
      acceptanceId: 'accp-w3',
      documentVersionId: 'ver-w3',
      opportunityId: 'opp-1',
      payloadJson: {
        type: 'CRM_CLOSED_WON_CONVERSION_HANDOFF',
        acceptanceId: 'accp-w3',
        opportunityId: 'opp-1',
        accountId: 'acct-1',
        contactId: 'con-1',
        checksumSha256: 'chk-accepted-w3',
        documentVersionId: 'ver-w3',
        currency: 'MWK',
      },
      idempotencyKey: 'closed-won-handoff:accp-w3',
      createdByAdminId: 'super-cvn-w3',
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
      amount: 150000,
      version: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _tenantStore: tenantStore,
    _customerStore: customerStore,
    _subscriptionStore: subscriptionStore,
    _entitlementStore: entitlementStore,
    _billingAccountStore: billingAccountStore,
    _billingScheduleStore: billingScheduleStore,
    _invoiceStore: invoiceStore,
    _paymentStore: paymentStore,
    _activationStore: activationStore,
    _journalStore: journalStore,
    _balanceStore: balanceStore,
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
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('request not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async () => [...requestStore]),
    },
    crmConversionRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `crh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    crmConversionPlan: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `plan-${planStore.length + 1}`, ...data };
        planStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return planStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = planStore.find((r) => r.id === where.id);
        if (!row) throw new Error('plan not found');
        Object.assign(row, data);
        return row;
      }),
    },
    crmConversionPlanVersion: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `pv-${planVersionStore.length + 1}`, ...data };
        planVersionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return planVersionStore.find((r) => r.id === where.id) || null;
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
        if (where.conversionNumber) {
          return (
            conversionStore.find((r) => r.conversionNumber === where.conversionNumber) || null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = conversionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('conversion not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `csh-${conversionHistoryStore.length + 1}`, ...data };
        conversionHistoryStore.push(row);
        return row;
      }),
    },
    crmConversionStep: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `step-${stepStore.length + 1}`,
          attemptCount: data.attemptCount ?? 0,
          version: data.version ?? 0,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        stepStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return stepStore.find((r) => r.id === where.id) || null;
      }),
      findMany: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...stepStore];
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        if (orderBy?.stepOrder === 'asc') {
          rows = [...rows].sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          stepStore.find(
            (r) =>
              (!where.conversionId || r.conversionId === where.conversionId) &&
              (!where.stepCode || r.stepCode === where.stepCode) &&
              (!where.id || r.id === where.id)
          ) || null
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = stepStore.find((r) => r.id === where.id);
        if (!row) throw new Error('step not found');
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
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        for (const row of rows) {
          Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        }
        return { count: rows.length };
      }),
    },
    crmConversionAttempt: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `att-${attemptStore.length + 1}`, ...data };
        attemptStore.push(row);
        return row;
      }),
    },
    crmConversionFailure: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `fail-${failureStore.length + 1}`, ...data };
        failureStore.push(row);
        return row;
      }),
    },
    crmConversionMatchDecision: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `md-${matchDecisionStore.length + 1}`, ...data };
        matchDecisionStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...matchDecisionStore]),
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
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          resourceStore.find(
            (r) =>
              (!where.conversionId || r.conversionId === where.conversionId) &&
              (!where.resourceType || r.resourceType === where.resourceType) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey) &&
              (!where.resourceId || r.resourceId === where.resourceId)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return resourceStore.filter(
          (r) =>
            (!where.conversionId || r.conversionId === where.conversionId) &&
            (!where.resourceType || r.resourceType === where.resourceType)
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = resourceStore.find((r) => r.id === where.id);
        if (!row) throw new Error('resource not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionInvitation: {
      create: vi.fn(async ({ data }) => {
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
        return (
          inviteStore.find(
            (r) =>
              (!where.conversionId || r.conversionId === where.conversionId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      findMany: vi.fn(async () => [...inviteStore]),
      update: vi.fn(async ({ where, data }) => {
        const row = inviteStore.find((r) => r.id === where.id);
        if (!row) throw new Error('invite not found');
        Object.assign(row, data);
        return row;
      }),
    },
    platformCustomer: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pcust-${customerStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        customerStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return customerStore.find((r) => r.id === where.id) || null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...customerStore];
        if (where.accountId) rows = rows.filter((r) => r.accountId === where.accountId);
        if (where.registrationNumber) {
          rows = rows.filter((r) => r.registrationNumber === where.registrationNumber);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async () => [...customerStore]),
      update: vi.fn(async ({ where, data }) => {
        const row = customerStore.find((r) => r.id === where.id);
        if (!row) throw new Error('customer not found');
        Object.assign(row, data);
        return row;
      }),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
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
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where.subdomain) {
          return tenantStore.find((r) => r.subdomain === where.subdomain) || null;
        }
        return tenantStore[0] || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = tenantStore.find((r) => r.id === where.id);
        if (!row) throw new Error('tenant not found');
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...tenantStore]),
    },
    accountSubscription: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sub-${subscriptionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          isActive: data.isActive ?? false,
          status: data.status || 'Pending',
          ...data,
        };
        subscriptionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return subscriptionStore.find((r) => r.id === where.id) || null;
        if (where.txRef) return subscriptionStore.find((r) => r.txRef === where.txRef) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...subscriptionStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where.txRef) rows = rows.filter((r) => r.txRef === where.txRef);
        if (where.isActive != null) rows = rows.filter((r) => r.isActive === where.isActive);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...subscriptionStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = subscriptionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('subscription not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...subscriptionStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where.isActive != null) rows = rows.filter((r) => r.isActive === where.isActive);
        return rows.length;
      }),
    },
    platformFeatureEntitlement: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ent-${entitlementStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        entitlementStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return entitlementStore.find((r) => r.id === where.id) || null;
        if (where.tenantId_featureCode) {
          return (
            entitlementStore.find(
              (r) =>
                r.tenantId === where.tenantId_featureCode.tenantId &&
                r.featureCode === where.tenantId_featureCode.featureCode
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          entitlementStore.find(
            (r) =>
              (!where.tenantId || r.tenantId === where.tenantId) &&
              (!where.featureCode || r.featureCode === where.featureCode)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return entitlementStore.filter((r) => {
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.id?.in && !where.id.in.includes(r.id)) return false;
          else if (where.id && !where.id.in && r.id !== where.id) return false;
          return true;
        });
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = entitlementStore.find(
          (r) =>
            r.tenantId === where.tenantId_featureCode.tenantId &&
            r.featureCode === where.tenantId_featureCode.featureCode
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const row = {
          id: `ent-${entitlementStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        entitlementStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = entitlementStore.find((r) => r.id === where.id);
        if (!row) throw new Error('entitlement not found');
        Object.assign(row, data);
        return row;
      }),
    },
    platformBillingAccount: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pba-${billingAccountStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        billingAccountStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          billingAccountStore.find(
            (r) =>
              (!where.tenantId || r.tenantId === where.tenantId) &&
              (!where.customerId || r.customerId === where.customerId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return billingAccountStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return billingAccountStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
    },
    platformBillingSchedule: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pbs-${billingScheduleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        billingScheduleStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          billingScheduleStore.find(
            (r) =>
              (!where.billingAccountId || r.billingAccountId === where.billingAccountId) &&
              (!where.subscriptionId || r.subscriptionId === where.subscriptionId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return billingScheduleStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return (
            billingScheduleStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null
          );
        }
        return null;
      }),
    },
    platformInvoice: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `pinv-${invoiceStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          amountPaid: data.amountPaid ?? 0,
          outstanding: data.outstanding ?? data.total,
          status: data.status || 'ISSUED',
          ...data,
        };
        invoiceStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return invoiceStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return invoiceStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.invoiceNumber) {
          return invoiceStore.find((r) => r.invoiceNumber === where.invoiceNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          invoiceStore.find(
            (r) =>
              (!where.tenantId || r.tenantId === where.tenantId) &&
              (!where.subscriptionId || r.subscriptionId === where.subscriptionId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return invoiceStore.filter((r) => !where.tenantId || r.tenantId === where.tenantId);
      }),
    },
    platformPayment: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ppay-${paymentStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          status: data.status || 'PENDING',
          ...data,
        };
        paymentStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return paymentStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return paymentStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          paymentStore.find(
            (r) =>
              (!where.tenantId || r.tenantId === where.tenantId) &&
              (!where.invoiceId || r.invoiceId === where.invoiceId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return paymentStore.filter(
          (r) => !where.invoiceId || r.invoiceId === where.invoiceId
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = paymentStore.find((r) => r.id === where.id);
        if (!row) throw new Error('payment not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    crmConversionActivationAttempt: {
      create: vi.fn(async ({ data }) => {
        const dup = activationStore.find(
          (r) =>
            r.subscriptionId === data.subscriptionId &&
            r.idempotencyKey === data.idempotencyKey
        );
        if (dup) {
          const err = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `act-${activationStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        activationStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          activationStore.find(
            (r) =>
              (!where.subscriptionId || r.subscriptionId === where.subscriptionId) &&
              (!where.idempotencyKey || r.idempotencyKey === where.idempotencyKey)
          ) || null
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = activationStore.find((r) => r.id === where.id);
        if (!row) throw new Error('activation attempt not found');
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...activationStore]),
    },
    journalEntry: {
      count: vi.fn(async ({ where = {} } = {}) => {
        return journalStore.filter((r) => !where.tenantId || r.tenantId === where.tenantId)
          .length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return journalStore.filter((r) => !where.tenantId || r.tenantId === where.tenantId);
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: `je-${journalStore.length + 1}`, ...data };
        journalStore.push(row);
        return row;
      }),
    },
    accountBalance: {
      count: vi.fn(async ({ where = {} } = {}) => {
        return balanceStore.filter((r) => !where.tenantId || r.tenantId === where.tenantId)
          .length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return balanceStore.filter((r) => !where.tenantId || r.tenantId === where.tenantId);
      }),
    },
    conversionBusiness: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `biz-${businessStore.length + 1}`, ...data };
        businessStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async () => businessStore[0] || null),
    },
    branch: {
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `br-${branchStore.length + 1}`, ...data };
        branchStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async () => branchStore[0] || null),
      findMany: vi.fn(async () => [...branchStore]),
    },
    account: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return accountStore.find((r) => r.id === where.id) || null;
      }),
      findFirst: vi.fn(async () => accountStore[0] || null),
    },
    contact: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return contactStore.find((r) => r.id === where.id) || null;
      }),
      findMany: vi.fn(async () => [...contactStore]),
    },
    opportunity: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return opportunityStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = opportunityStore.find((r) => r.id === where.id);
        if (!row) throw new Error('opp not found');
        Object.assign(row, data);
        return row;
      }),
    },
    ...overrides,
  };

  return prisma;
}

describe('Phase 16 Wave 3 — subscription / entitlements / billing / payment / activation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects entitlement quantity greater than accepted snapshot', async () => {
    const prisma = makePrisma();
    const snapshot = acceptedSnapshot();

    const result = await provisionEntitlementsFromAccepted(prisma, {
      conversionId: 'cvn-ent-1',
      tenantId: 'ten-w3',
      subscriptionId: 'sub-1',
      acceptedSnapshot: snapshot,
      requestedEntitlements: [
        { featureCode: 'POS', quantity: 3 }, // accepted qty=2
      ],
      admin: superAdmin(),
      idempotencyKey: 'ent:cvn-ent-1',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('entitlement_qty_exceeds_accepted');
    expect(prisma._entitlementStore).toHaveLength(0);
  });

  it('exact invoice retry returns same Platform Invoice (from accepted snapshot)', async () => {
    const prisma = makePrisma();
    const snapshot = acceptedSnapshot();
    const args = {
      conversionId: 'cvn-inv-1',
      tenantId: 'ten-w3',
      subscriptionId: 'sub-1',
      acceptedSnapshot: snapshot,
      admin: superAdmin(),
      idempotencyKey: 'pinv:cvn-inv-1:sub-1',
    };

    const first = await createPlatformInvoiceIfRequired(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.invoiceId).toBeTruthy();
    expect(first.invoiceCreated).toBe(true);
    expect(first.status).not.toBe('PAID');
    expect(Number(first.amountPaid || 0)).toBe(0);
    expect(Number(first.total)).toBe(150000);
    expect(first.source).toBe('ACCEPTED_SNAPSHOT');

    const retry = await createPlatformInvoiceIfRequired(prisma, args);
    expect(retry.ok).toBe(true);
    expect(retry.invoiceId).toBe(first.invoiceId);
    expect(retry.idempotentReplay).toBe(true);
    expect(prisma._invoiceStore).toHaveLength(1);
  });

  it('payment initiation is not PAID (provider or NOT_CONFIGURED)', async () => {
    const prisma = makePrisma();
    const invoice = await createPlatformInvoiceIfRequired(prisma, {
      conversionId: 'cvn-pay-1',
      tenantId: 'ten-w3',
      subscriptionId: 'sub-1',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'pinv:cvn-pay-1',
    });

    const result = await initiatePaymentIfRequired(prisma, {
      conversionId: 'cvn-pay-1',
      tenantId: 'ten-w3',
      invoiceId: invoice.invoiceId,
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'ppay:cvn-pay-1',
      // no paymentProvider configured → NOT_CONFIGURED
    });

    expect(result.ok).toBe(true);
    expect(['NOT_CONFIGURED', 'INITIATED', 'PENDING']).toContain(
      result.status || result.paymentStatus
    );
    expect(result.paymentStatus).not.toBe('PAID');
    expect(result.fabricatedPaid).not.toBe(true);
    if (result.paymentId) {
      const pay = prisma._paymentStore.find((p) => p.id === result.paymentId);
      expect(pay?.status).not.toBe('PAID');
      expect(pay?.status).not.toBe('COMPLETED');
    }
  });

  it('activation blocked without payment when AFTER_PAYMENT policy requires it', async () => {
    const prisma = makePrisma();
    const sub = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-act-1',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-act-1',
    });
    expect(sub.ok).toBe(true);
    expect(sub.isActive).toBe(false);
    expect(sub.status).not.toBe('ACTIVE');

    const blocked = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: { closedWon: true, invoiceIssued: true, paymentSuccessful: false },
      idempotencyKey: 'act:cvn-act-1',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('activation_blocked_payment_required');
    expect(blocked.activated).not.toBe(true);

    const still = await prisma.accountSubscription.findUnique({
      where: { id: sub.subscriptionId },
    });
    expect(still.isActive).toBe(false);
    expect(String(still.status).toUpperCase()).not.toBe('ACTIVE');
  });

  it('expansion path amends subscription without duplicate Tenant', async () => {
    const prisma = makePrisma();
    const tenantCountBefore = prisma._tenantStore.length;

    const first = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-exp-1',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      conversionType: 'EXISTING_CUSTOMER_NEW_SUBSCRIPTION',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-exp-1:v1',
    });
    expect(first.ok).toBe(true);
    expect(first.action).toMatch(/CREATE|AMEND/);

    const amend = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-exp-1',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      conversionType: 'EXISTING_CUSTOMER_NEW_SUBSCRIPTION',
      existingSubscriptionId: first.subscriptionId,
      acceptedSnapshot: acceptedSnapshot({
        planVersion: 3,
        totals: { subtotal: 200000, discount: 0, tax: 0, total: 200000 },
        lineItems: [
          {
            productRef: 'CORE_GROWTH',
            featureCode: 'POS',
            quantity: 4,
            unitPrice: 50000,
            lineTotal: 200000,
          },
        ],
      }),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-exp-1:v2',
    });

    expect(amend.ok).toBe(true);
    expect(amend.action).toBe('AMEND');
    expect(amend.tenantId).toBe('ten-w3');
    expect(prisma._tenantStore).toHaveLength(tenantCountBefore);
    expect(amend.isActive).toBe(false);
  });

  it('Platform Invoice create produces no Tenant GL journals/balances', async () => {
    const prisma = makePrisma();
    const result = await createPlatformInvoiceIfRequired(prisma, {
      conversionId: 'cvn-gl-1',
      tenantId: 'ten-w3',
      subscriptionId: 'sub-1',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'pinv:cvn-gl-1',
    });
    expect(result.ok).toBe(true);

    const boundary = await assertNoTenantAccountingSideEffects(prisma, {
      tenantId: 'ten-w3',
      conversionId: 'cvn-gl-1',
    });
    expect(boundary.ok).toBe(true);
    expect(prisma._journalStore).toHaveLength(0);
    expect(prisma._balanceStore).toHaveLength(0);
  });

  it('orchestrator Wave 3: subscription pending until activation; Closed Won ≠ ACTIVE', async () => {
    vi.spyOn(closeModule, 'closeOpportunityWon').mockResolvedValue({
      ok: true,
      toStageCode: 'CLOSED_WON',
    });
    vi.spyOn(readinessModule, 'evaluateConversionRequestReadiness').mockResolvedValue({
      ok: true,
      readinessStatus: 'READY',
      checklist: [],
    });

    const prisma = makePrisma({
      _tenantStore: [],
      _customerStore: [],
    });

    const request = await prisma.crmConversionRequest.create({
      data: {
        id: 'cvr-w3',
        requestNumber: 'CVR-2026-000010',
        status: 'READY',
        source: 'PHASE_15_ACCEPTANCE_HANDOFF',
        conversionType: 'NEW_CUSTOMER_NEW_TENANT',
        acceptanceId: 'accp-w3',
        handoffId: 'handoff-1',
        opportunityId: 'opp-1',
        accountId: 'acct-1',
        contactId: 'con-1',
        documentVersionId: 'ver-w3',
        checksumSha256: 'chk-accepted-w3',
        currency: 'MWK',
        idempotencyKey: 'cvr:accp-w3',
        createdByAdminId: 'super-cvn-w3',
      },
    });
    const plan = await prisma.crmConversionPlan.create({
      data: {
        id: 'plan-w3',
        conversionRequestId: request.id,
        latestVersionNumber: 1,
        createdByAdminId: 'super-cvn-w3',
      },
    });
    const snapshot = acceptedSnapshot();
    const planVersion = await prisma.crmConversionPlanVersion.create({
      data: {
        id: 'pv-w3',
        planId: plan.id,
        versionNumber: 1,
        planChecksum: 'chk-pv-w3',
        contentJson: {
          conversionType: 'NEW_CUSTOMER_NEW_TENANT',
          tenantSlug: 'acme-wave3',
          tenantName: 'Acme Wave3',
          requireBusiness: false,
          requireBranch: false,
          inviteContacts: false,
          activationPolicy: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
          acceptedSnapshot: snapshot,
        },
        immutable: true,
        createdByAdminId: 'super-cvn-w3',
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
      idempotencyKey: 'exec-w3-1',
      winReason: 'BEST_FIT',
    });

    expect(result.ok).toBe(true);
    expect(result.customerCreated || result.customerLinked).toBe(true);
    expect(result.tenantCreated || result.tenantLinked).toBe(true);
    expect(result.subscriptionCreated || result.subscriptionAmended).toBe(true);
    expect(result.subscriptionActive).not.toBe(true);
    expect(result.invoicePaid).not.toBe(true);

    const subStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.CREATE_OR_AMEND_SUBSCRIPTION
    );
    expect(subStep?.status).not.toBe(CRM_CONVERSION_STEP_STATUS.SKIPPED_NOT_APPLICABLE);
    expect([
      CRM_CONVERSION_STEP_STATUS.COMPLETED,
      CRM_CONVERSION_STEP_STATUS.COMPLETED_WITH_WARNING,
      CRM_CONVERSION_STEP_STATUS.BLOCKED,
    ]).toContain(subStep?.status);

    const sub = prisma._subscriptionStore[0];
    expect(sub).toBeTruthy();
    expect(sub.isActive).toBe(false);
    expect(String(sub.status).toUpperCase()).not.toBe('ACTIVE');
    expect([
      CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING,
      CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION,
      'Pending',
      'PENDING',
    ]).toContain(sub.status);

    const boundary = await assertNoTenantAccountingSideEffects(prisma, {
      tenantId: result.tenantId || sub.tenantId,
      conversionId: result.conversion.id,
    });
    expect(boundary.ok).toBe(true);
  });

  it('createOrLinkBillingAccount + schedule are idempotent', async () => {
    const prisma = makePrisma();
    const acctArgs = {
      conversionId: 'cvn-bill-1',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      admin: superAdmin(),
      idempotencyKey: 'pba:cvn-bill-1',
    };
    const a1 = await createOrLinkBillingAccount(prisma, acctArgs);
    const a2 = await createOrLinkBillingAccount(prisma, acctArgs);
    expect(a1.ok).toBe(true);
    expect(a2.billingAccountId).toBe(a1.billingAccountId);
    expect(a2.idempotentReplay).toBe(true);

    const schedArgs = {
      conversionId: 'cvn-bill-1',
      billingAccountId: a1.billingAccountId,
      subscriptionId: 'sub-1',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'pbs:cvn-bill-1',
    };
    const s1 = await createBillingSchedule(prisma, schedArgs);
    const s2 = await createBillingSchedule(prisma, schedArgs);
    expect(s1.ok).toBe(true);
    expect(s2.scheduleId).toBe(s1.scheduleId);
    expect(s2.idempotentReplay).toBe(true);
  });

  it('blocked AFTER_PAYMENT attempt does not poison idempotencyKey; succeeds after payment truth', async () => {
    const prisma = makePrisma();
    const sub = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-act-reval',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-act-reval',
    });
    expect(sub.ok).toBe(true);

    const invoice = await createPlatformInvoiceIfRequired(prisma, {
      conversionId: 'cvn-act-reval',
      tenantId: 'ten-w3',
      subscriptionId: sub.subscriptionId,
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'pinv:cvn-act-reval',
    });
    expect(invoice.ok).toBe(true);

    const key = 'act:cvn-act-reval';
    const blocked = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      conversionId: 'cvn-act-reval',
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: {
        closedWon: true,
        invoiceIssued: true,
        invoiceId: invoice.invoiceId,
      },
      idempotencyKey: key,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('activation_blocked_payment_required');
    expect(blocked.reevaluable).toBe(true);

    await prisma.platformPayment.create({
      data: {
        id: 'ppay-paid-reval',
        paymentNumber: 'PPAY-REVAL-1',
        tenantId: 'ten-w3',
        invoiceId: invoice.invoiceId,
        amount: 150000,
        currency: 'MWK',
        status: 'COMPLETED',
        idempotencyKey: 'ppay-row:cvn-act-reval',
      },
    });

    const activated = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      conversionId: 'cvn-act-reval',
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: {
        closedWon: true,
        invoiceIssued: true,
        invoiceId: invoice.invoiceId,
      },
      idempotencyKey: key,
    });
    expect(activated.ok).toBe(true);
    expect(activated.activated).toBe(true);
    expect(activated.idempotentReplay).not.toBe(true);

    const still = await prisma.accountSubscription.findUnique({
      where: { id: sub.subscriptionId },
    });
    expect(still.isActive).toBe(true);
    expect(String(still.status).toUpperCase()).toBe('ACTIVE');

    const replay = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: { invoiceId: invoice.invoiceId },
      idempotencyKey: key,
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotentReplay).toBe(true);
  });

  it('AFTER_PAYMENT ignores caller paymentSuccessful boolean without Payment record', async () => {
    const prisma = makePrisma();
    const sub = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-act-bool',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-act-bool',
    });

    const forged = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: {
        closedWon: true,
        invoiceIssued: true,
        paymentSuccessful: true,
        paymentCompleted: true,
      },
      idempotencyKey: 'act:cvn-act-bool',
    });

    expect(forged.ok).toBe(false);
    expect(forged.error).toBe('activation_blocked_payment_required');
    expect(forged.activated).not.toBe(true);
    const still = await prisma.accountSubscription.findUnique({
      where: { id: sub.subscriptionId },
    });
    expect(still.isActive).toBe(false);
  });

  it('activation promotes only conversion-scoped entitlements, not all tenant PENDING', async () => {
    const prisma = makePrisma();
    const sub = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-act-scope',
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'sub:cvn-act-scope',
    });

    const ents = await provisionEntitlementsFromAccepted(prisma, {
      conversionId: 'cvn-act-scope',
      tenantId: 'ten-w3',
      subscriptionId: sub.subscriptionId,
      acceptedSnapshot: acceptedSnapshot(),
      admin: superAdmin(),
      idempotencyKey: 'ent:cvn-act-scope',
    });
    expect(ents.ok).toBe(true);
    expect(ents.entitlementIds.length).toBeGreaterThan(0);

    const foreign = await prisma.platformFeatureEntitlement.create({
      data: {
        id: 'ent-foreign-other-cvn',
        tenantId: 'ten-w3',
        featureCode: 'FOREIGN_FEATURE',
        featureName: 'FOREIGN_FEATURE',
        status: ENTITLEMENT_STATUSES.PENDING,
        source: 'PLAN',
        reason: 'Other conversion pending',
      },
    });

    await prisma.platformPayment.create({
      data: {
        id: 'ppay-scope',
        paymentNumber: 'PPAY-SCOPE-1',
        tenantId: 'ten-w3',
        invoiceId: 'inv-scope',
        amount: 1,
        currency: 'MWK',
        status: 'PAID',
        idempotencyKey: 'ppay-row:cvn-act-scope',
      },
    });

    const activated = await activateProvisionedSubscription(prisma, {
      actorContext: { admin: superAdmin() },
      subscriptionId: sub.subscriptionId,
      conversionId: 'cvn-act-scope',
      entitlementIds: ents.entitlementIds,
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: { paymentId: 'ppay-scope' },
      idempotencyKey: 'act:cvn-act-scope',
    });
    expect(activated.ok).toBe(true);

    for (const id of ents.entitlementIds) {
      const row = prisma._entitlementStore.find((e) => e.id === id);
      expect(row.status).toBe(ENTITLEMENT_STATUSES.ACTIVE);
    }
    const foreignRow = prisma._entitlementStore.find((e) => e.id === foreign.id);
    expect(foreignRow.status).toBe(ENTITLEMENT_STATUSES.PENDING);
  });

  it('Wave 3 entitlement/activate steps fail visibly when subscriptionId missing (no sticky IN_PROGRESS)', async () => {
    const prisma = makePrisma();
    // Soft NOT_AVAILABLE subscription path leaves subscriptionId null
    prisma.accountSubscription = {
      create: undefined,
      update: undefined,
      findUnique: vi.fn(async () => null),
    };

    const conversion = await prisma.crmConversion.create({
      data: {
        id: 'cvn-no-sub',
        conversionRequestId: 'cvr-w3',
        conversionPlanVersionId: 'pv-w3',
        status: 'IN_PROGRESS',
        inputHash: 'hash-no-sub',
        createdByAdminId: 'super-cvn-w3',
      },
    });

    const result = await runWave3ProvisionSpine(prisma, {
      conversion,
      request: { id: 'cvr-w3', conversionType: 'NEW_CUSTOMER_NEW_TENANT' },
      admin: superAdmin(),
      planVersion: {
        contentJson: {
          activationPolicy: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
          acceptedSnapshot: acceptedSnapshot(),
        },
      },
      inputHash: 'hash-no-sub',
      now: new Date('2026-07-31T00:00:00.000Z'),
      tenantId: 'ten-w3',
      customerId: 'pcust-w3',
    });

    expect(result.subscriptionId).toBeFalsy();
    const entStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.PROVISION_ENTITLEMENTS
    );
    const actStep = result.steps.find(
      (s) => s.stepCode === CRM_CONVERSION_STEP_CODE.ACTIVATE_SUBSCRIPTION
    );
    expect(entStep?.status).not.toBe(CRM_CONVERSION_STEP_STATUS.IN_PROGRESS);
    expect(actStep?.status).not.toBe(CRM_CONVERSION_STEP_STATUS.IN_PROGRESS);
    expect(entStep?.status).toBe(CRM_CONVERSION_STEP_STATUS.FAILED_RETRYABLE);
    expect(entStep?.errorCode).toBe('subscriptionId_required');
  });
});
