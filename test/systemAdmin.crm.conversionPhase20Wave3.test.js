/**
 * Phase 20 Wave 3 — Request honesty + onboarding handoff harden.
 *
 * Never ACTIVATED/PROVISIONED/PAID without provider result;
 * one active onboarding handoff; exact retry same; correction supersedes with history;
 * pending provisioning labelled; no CS Onboarding Project; no secrets; no GL/fiscal;
 * partial provider failure → PARTIALLY_COMPLETED/BLOCKED; resume idempotent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrAmendSubscriptionFromAccepted,
  provisionEntitlementsFromAccepted,
  activateProvisionedSubscription,
  createOrLinkTenant,
  createOnboardingHandoff,
  sendOnboardingHandoff,
  supersedeOnboardingHandoff,
  sanitizeConversionHandoffPayload,
  computeOnboardingHandoffChecksum,
  assertProvisionResultHonesty,
  clampProvisionRequestStatus,
  createTrainingHandoff,
  createDataMigrationHandoff,
  createMraEisHandoff,
  runWave3ProvisionSpine,
  assertNoTenantAccountingSideEffects,
  CRM_ACTIVATION_POLICY,
  CRM_SUBSCRIPTION_PROVISION_STATUS,
  CRM_CONVERSION_STATUS,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_CONVERSION_HANDOFF_STATUS,
  CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS,
} from '@/lib/admin/crm';
import { ENTITLEMENT_STATUSES as FE_ENTITLEMENT_STATUSES } from '@/lib/admin/featureEntitlements';

function superAdmin(id = 'super-p20-w3') {
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
    acceptanceId: 'accp-p20-w3',
    documentVersionId: 'ver-p20-w3',
    checksumSha256: 'chk-accepted-p20-w3',
    currency: 'MWK',
    planCode: 'CORE_GROWTH',
    planVersion: 2,
    lineItems: [
      {
        productRef: 'CORE_GROWTH',
        featureCode: 'POS',
        quantity: 2,
        unitPrice: 50000,
        lineTotal: 100000,
      },
    ],
    totals: { subtotal: 100000, discount: 0, tax: 0, total: 100000 },
    ...overrides,
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
      if (where.txRef) return store.find((r) => r.txRef === where.txRef) || null;
      if (where.subdomain) {
        return store.find((r) => r.subdomain === where.subdomain) || null;
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
      if (where.resourceType) {
        rows = rows.filter((r) => r.resourceType === where.resourceType);
      }
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.txRef) rows = rows.filter((r) => r.txRef === where.txRef);
      if (where.status) {
        if (typeof where.status === 'object' && where.status.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else if (typeof where.status === 'object' && where.status.notIn) {
          rows = rows.filter((r) => !where.status.notIn.includes(r.status));
        } else {
          rows = rows.filter((r) => r.status === where.status);
        }
      }
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
      if (where.resourceType) {
        rows = rows.filter((r) => r.resourceType === where.resourceType);
      }
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.id?.in) {
        rows = rows.filter((r) => where.id.in.includes(r.id));
      }
      if (where.status) {
        if (typeof where.status === 'object' && where.status.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        } else if (typeof where.status === 'object' && where.status.notIn) {
          rows = rows.filter((r) => !where.status.notIn.includes(r.status));
        } else {
          rows = rows.filter((r) => r.status === where.status);
        }
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
      let rows = [...store];
      if (where.id) rows = rows.filter((r) => r.id === where.id);
      if (where.conversionId) {
        rows = rows.filter((r) => r.conversionId === where.conversionId);
      }
      if (where.handoffType) {
        rows = rows.filter((r) => r.handoffType === where.handoffType);
      }
      if (where.attemptCount != null) {
        rows = rows.filter((r) => r.attemptCount === where.attemptCount);
      }
      if (where.version != null) {
        rows = rows.filter((r) => r.version === where.version);
      }
      if (where.status?.in) {
        rows = rows.filter((r) => where.status.in.includes(r.status));
      } else if (where.status) {
        rows = rows.filter((r) => r.status === where.status);
      }
      if (where.id?.not) {
        rows = rows.filter((r) => r.id !== where.id.not);
      }
      for (const row of rows) {
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      }
      return { count: rows.length };
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.isActive != null) {
        rows = rows.filter((r) => r.isActive === where.isActive);
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const tenantStore = overrides._tenantStore || [
    {
      id: 'ten-p20-w3',
      subdomain: 'acme-p20-w3',
      name: 'Acme P20 W3',
      status: 'PROVISIONING',
    },
  ];
  const subscriptionStore = overrides._subscriptionStore || [];
  const entitlementStore = overrides._entitlementStore || [];
  const resourceStore = overrides._resourceStore || [];
  const handoffStore = overrides._handoffStore || [];
  const paymentStore = overrides._paymentStore || [];
  const journalStore = overrides._journalStore || [];
  const balanceStore = overrides._balanceStore || [];
  const projectStore = overrides._projectStore || [];
  const stepStore = overrides._stepStore || [];
  const attemptStore = overrides._attemptStore || [];
  const activationStore = overrides._activationStore || [];
  const conversionStore = overrides._conversionStore || [
    {
      id: 'cvn-p20-w3',
      conversionNumber: 'CVN-2026-000020',
      status: 'IN_PROGRESS',
      inputHash: 'hash-p20-w3',
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _tenantStore: tenantStore,
    _subscriptionStore: subscriptionStore,
    _entitlementStore: entitlementStore,
    _resourceStore: resourceStore,
    _handoffStore: handoffStore,
    _paymentStore: paymentStore,
    _journalStore: journalStore,
    _balanceStore: balanceStore,
    _projectStore: projectStore,
    _stepStore: stepStore,
    _attemptStore: attemptStore,
    _activationStore: activationStore,
    _conversionStore: conversionStore,
    tenant: {
      ...simpleCrud(tenantStore, 'ten'),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return tenantStore.find((t) => t.id === where.id) || null;
        if (where.subdomain) {
          return tenantStore.find((t) => t.subdomain === where.subdomain) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ten-${tenantStore.length + 1}`,
          status: data.status || 'PROVISIONING',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        tenantStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = tenantStore.find((t) => t.id === where.id);
        if (!row) throw new Error('tenant not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    accountSubscription: {
      ...simpleCrud(subscriptionStore, 'sub'),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sub-${subscriptionStore.length + 1}`,
          isActive: data.isActive === true,
          status: data.status || 'PENDING_ACTIVATION',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        subscriptionStore.push(row);
        return row;
      }),
    },
    platformFeatureEntitlement: {
      ...simpleCrud(entitlementStore, 'ent'),
      upsert: vi.fn(async ({ where = {}, create, update } = {}) => {
        const existing = entitlementStore.find(
          (e) =>
            e.tenantId === where.tenantId_featureCode?.tenantId &&
            e.featureCode === where.tenantId_featureCode?.featureCode
        );
        if (existing) {
          Object.assign(existing, update || {}, { updatedAt: new Date() });
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
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...entitlementStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where.id?.in) rows = rows.filter((r) => where.id.in.includes(r.id));
        return rows;
      }),
    },
    platformPayment: {
      ...simpleCrud(paymentStore, 'pay'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...paymentStore];
        if (where.invoiceId) {
          rows = rows.filter((r) => r.invoiceId === where.invoiceId);
        }
        return rows;
      }),
    },
    crmConversion: simpleCrud(conversionStore, 'cvn'),
    crmConversionResource: simpleCrud(resourceStore, 'res'),
    crmConversionDomainHandoff: simpleCrud(handoffStore, 'hd'),
    crmConversionStep: simpleCrud(stepStore, 'step'),
    crmConversionStepAttempt: simpleCrud(attemptStore, 'att'),
    crmConversionActivationAttempt: simpleCrud(activationStore, 'act'),
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `proj-${projectStore.length + 1}`, ...data };
        projectStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => projectStore),
      count: vi.fn(async () => projectStore.length),
    },
    journalEntry: simpleCrud(journalStore, 'je'),
    accountBalance: simpleCrud(balanceStore, 'bal'),
    ...overrides,
  };
  return prisma;
}

describe('Phase 20 Wave 3 — request honesty + onboarding handoff', () => {
  let admin;

  beforeEach(() => {
    admin = superAdmin();
    vi.restoreAllMocks();
  });

  it('catalogue exposes onboarding package statuses and honesty helpers', () => {
    expect(CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.READY).toBe('READY');
    expect(CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.SENT).toBe('SENT');
    expect(CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.ACCEPTED_BY_ONBOARDING).toBe(
      'ACCEPTED_BY_ONBOARDING'
    );
    expect(typeof sanitizeConversionHandoffPayload).toBe('function');
    expect(typeof computeOnboardingHandoffChecksum).toBe('function');
    expect(typeof assertProvisionResultHonesty).toBe('function');
    expect(typeof clampProvisionRequestStatus).toBe('function');
    expect(typeof sendOnboardingHandoff).toBe('function');
    expect(typeof supersedeOnboardingHandoff).toBe('function');
  });

  it('never marks Subscription/Entitlement ACTIVATED/PROVISIONED/PAID without provider result', async () => {
    const prisma = makePrisma();
    const snapshot = acceptedSnapshot();

    const forged = assertProvisionResultHonesty(
      { ok: true, status: 'ACTIVATED', isActive: true },
      { providerResult: null }
    );
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/fabricated|provider/i);

    expect(clampProvisionRequestStatus('PROVISIONED', { providerConfirmed: false })).not.toBe(
      'PROVISIONED'
    );
    expect(clampProvisionRequestStatus('PAID', { providerConfirmed: false })).not.toBe('PAID');
    expect(
      clampProvisionRequestStatus('ACTIVE', { providerConfirmed: true })
    ).toBe('ACTIVE');

    const sub = await createOrAmendSubscriptionFromAccepted(prisma, {
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      customerId: 'cust-1',
      acceptedSnapshot: snapshot,
      admin,
      idempotencyKey: 'sub:p20-w3-honesty',
      // Caller forgeries must be ignored
      forceActive: true,
      isActive: true,
      status: 'ACTIVATED',
      provisioned: true,
      paid: true,
    });
    expect(sub.ok).toBe(true);
    expect(sub.isActive).toBe(false);
    expect(sub.status).toBe(CRM_SUBSCRIPTION_PROVISION_STATUS.PENDING_ACTIVATION);
    expect(sub.status).not.toBe('ACTIVATED');
    expect(sub.status).not.toBe('PROVISIONED');
    expect(sub.status).not.toBe('PAID');
    expect(sub.status).not.toBe('ACTIVE');

    const ents = await provisionEntitlementsFromAccepted(prisma, {
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      subscriptionId: sub.subscriptionId,
      acceptedSnapshot: snapshot,
      admin,
      idempotencyKey: 'ent:p20-w3-honesty',
      forceActive: true,
      status: 'ACTIVATED',
    });
    expect(ents.ok).toBe(true);
    const entStatus = ents.status || FE_ENTITLEMENT_STATUSES.PENDING;
    expect(entStatus).toBe(FE_ENTITLEMENT_STATUSES.PENDING);
    expect(entStatus).not.toBe('ACTIVE');
    expect(entStatus).not.toBe('ACTIVATED');
    expect(entStatus).not.toBe('PROVISIONED');

    const blocked = await activateProvisionedSubscription(prisma, {
      actorContext: { admin },
      subscriptionId: sub.subscriptionId,
      conversionId: 'cvn-p20-w3',
      activationPolicyVersionId: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
      evidence: {
        closedWon: true,
        invoiceIssued: true,
        paymentSuccessful: true,
        paymentCompleted: true,
      },
      idempotencyKey: 'act:p20-w3-honesty',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.activated).not.toBe(true);

    const tenant = await createOrLinkTenant(prisma, {
      conversionId: 'cvn-p20-w3-ten',
      customerId: 'cust-1',
      slug: 'acme-p20-w3-b',
      admin,
      idempotencyKey: 'ten:p20-w3-honesty',
      forceActive: true,
      status: 'PROVISIONED',
    });
    expect(tenant.ok).toBe(true);
    const tenantRow = prisma._tenantStore.find((t) => t.id === tenant.tenantId);
    expect(String(tenantRow?.status || '').toUpperCase()).not.toBe('ACTIVE');
    expect(String(tenantRow?.status || '').toUpperCase()).not.toBe('PROVISIONED');
    expect(String(tenantRow?.status || '').toUpperCase()).not.toBe('ACTIVATED');
  });

  it('onboarding handoff exact retry same; correction supersedes with history; one active', async () => {
    const prisma = makePrisma();
    const basePayload = {
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      contacts: [{ contactId: 'con-1', email: 'ada@example.com' }],
      commercialRefs: { acceptanceId: 'accp-p20-w3' },
      password: 'should-be-stripped',
      apiKey: 'sk-secret',
      mraCredentials: { user: 'x', password: 'y' },
      provisioningStatus: 'PENDING',
    };

    const first = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:v1',
      payload: basePayload,
    });
    expect(first.ok).toBe(true);
    expect(first.handoff?.id).toBeTruthy();
    expect(first.checksumSha256 || first.handoff?.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.onboardingCompleted).toBe(false);
    expect(first.createsOnboardingProject).not.toBe(true);
    expect(first.meta?.executesOnboarding).toBe(false);
    expect(prisma._projectStore).toHaveLength(0);

    const payload = prisma._handoffStore.find((h) => h.id === first.handoff.id)?.payloadJson;
    expect(payload.password).toBeUndefined();
    expect(payload.apiKey).toBeUndefined();
    expect(payload.mraCredentials).toBeUndefined();
    expect(payload.pendingProvisioning === true || payload.provisioningStatus === 'PENDING').toBe(
      true
    );
    expect(payload.onboardingProjectCreated).not.toBe(true);

    const retry = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:v1',
      payload: basePayload,
    });
    expect(retry.ok).toBe(true);
    expect(retry.handoff?.id).toBe(first.handoff.id);
    expect(retry.idempotentReplay || retry.alreadyExists).toBeTruthy();
    expect(prisma._handoffStore.filter((h) => h.handoffType === 'ONBOARDING').length).toBe(1);

    const sent = await sendOnboardingHandoff(prisma, {
      admin,
      handoffId: first.handoff.id,
    });
    expect(sent.ok).toBe(true);
    expect([
      CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.SENT,
      CRM_CONVERSION_HANDOFF_STATUS.EMITTED,
      'SENT',
    ]).toContain(sent.handoff?.status);
    expect(prisma._projectStore).toHaveLength(0);

    const correction = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:v2',
      correction: true,
      payload: {
        ...basePayload,
        contacts: [{ contactId: 'con-1', email: 'ada.corrected@example.com' }],
        correctionReason: 'email_typo',
      },
    });
    expect(correction.ok).toBe(true);
    expect(correction.handoff?.id).not.toBe(first.handoff.id);
    expect(correction.supersededHandoffId || correction.handoff?.payloadJson?.supersedesHandoffId).toBeTruthy();

    const prior = prisma._handoffStore.find((h) => h.id === first.handoff.id);
    expect(prior.status).toBe(CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED);
    const active = prisma._handoffStore.filter(
      (h) =>
        h.handoffType === 'ONBOARDING' &&
        h.conversionId === 'cvn-p20-w3' &&
        h.status !== CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED &&
        h.status !== CRM_CONVERSION_HANDOFF_STATUS.CANCELLED
    );
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(correction.handoff.id);

    const history =
      correction.handoff?.payloadJson?.supersessionHistory ||
      correction.supersessionHistory ||
      active[0].payloadJson?.supersessionHistory;
    expect(Array.isArray(history) ? history.length : 0).toBeGreaterThanOrEqual(1);

    const conflict = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:v3',
      correction: false,
      payload: { ...basePayload, notes: 'another without correction' },
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/active_handoff|correction/i);
  });

  it('requirement handoffs strip secrets; pending labelled; no Project / GL / fiscal', async () => {
    const prisma = makePrisma();
    const dirty = {
      password: 'x',
      apiKey: 'y',
      credentials: { a: 1 },
      paymentSecret: 'z',
      accessToken: 'at-secret',
      refreshToken: 'rt-secret',
      clientSecret: 'cs-secret',
      secretKey: 'sk-secret',
      authToken: 'auth-secret',
      bearerToken: 'bearer-secret',
      sessionToken: 'sess-secret',
      scope: 'TRAINING_CORE',
      contacts: [{ contactId: 'con-1' }],
      // Honesty flags must survive substring denylist
      credentialsStored: false,
      fiscalSubmitted: false,
    };

    const cleaned = sanitizeConversionHandoffPayload(dirty);
    expect(cleaned.password).toBeUndefined();
    expect(cleaned.apiKey).toBeUndefined();
    expect(cleaned.credentials).toBeUndefined();
    expect(cleaned.paymentSecret).toBeUndefined();
    expect(cleaned.accessToken).toBeUndefined();
    expect(cleaned.refreshToken).toBeUndefined();
    expect(cleaned.clientSecret).toBeUndefined();
    expect(cleaned.secretKey).toBeUndefined();
    expect(cleaned.authToken).toBeUndefined();
    expect(cleaned.bearerToken).toBeUndefined();
    expect(cleaned.sessionToken).toBeUndefined();
    expect(cleaned.scope).toBe('TRAINING_CORE');
    expect(cleaned.credentialsStored).toBe(false);
    expect(cleaned.fiscalSubmitted).toBe(false);

    const checksum = computeOnboardingHandoffChecksum({
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      contacts: dirty.contacts,
    });
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);

    const training = await createTrainingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'trn:p20-w3',
      payload: dirty,
    });
    expect(training.ok).toBe(true);
    expect(training.trainingCompleted).toBe(false);
    const trn = prisma._handoffStore.find((h) => h.idempotencyKey === 'trn:p20-w3');
    expect(trn.payloadJson.password).toBeUndefined();
    expect(trn.payloadJson.apiKey).toBeUndefined();
    expect(trn.payloadJson.accessToken).toBeUndefined();
    expect(trn.payloadJson.clientSecret).toBeUndefined();
    expect(trn.payloadJson.refreshToken).toBeUndefined();

    const migration = await createDataMigrationHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'mig:p20-w3',
      payload: dirty,
    });
    expect(migration.ok).toBe(true);
    expect(migration.productionImportExecuted).toBe(false);

    const mra = await createMraEisHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'mra:p20-w3',
      payload: { ...dirty, fiscalSubmitted: true },
    });
    expect(mra.ok).toBe(true);
    expect(mra.fiscalSubmitted).toBe(false);
    expect(mra.credentialsStored).toBe(false);

    expect(prisma._projectStore).toHaveLength(0);
    const gl = await assertNoTenantAccountingSideEffects(prisma, {
      tenantId: 'ten-p20-w3',
      conversionId: 'cvn-p20-w3',
    });
    expect(gl.ok).toBe(true);
    expect(prisma._journalStore).toHaveLength(0);
  });

  it('rejects caller-forged checksumSha256; persists server-computed checksum', async () => {
    const prisma = makePrisma();
    const payload = {
      conversionId: 'cvn-p20-w3-chk',
      tenantId: 'ten-p20-w3',
      contacts: [{ contactId: 'con-chk' }],
      commercialRefs: { acceptanceId: 'accp-chk' },
      provisioningStatus: 'PENDING',
    };

    const forged = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3-chk',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:forged-chk',
      payload,
      checksumSha256: 'a'.repeat(64),
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/checksum_mismatch/i);
    expect(forged.expectedChecksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(forged.expectedChecksumSha256).not.toBe('a'.repeat(64));
    expect(prisma._handoffStore.filter((h) => h.idempotencyKey === 'onb:p20-w3:forged-chk')).toHaveLength(
      0
    );

    const honest = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3-chk',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:server-chk',
      payload,
    });
    expect(honest.ok).toBe(true);
    const stored = prisma._handoffStore.find((h) => h.idempotencyKey === 'onb:p20-w3:server-chk');
    expect(stored.checksumSha256).toBe(honest.checksumSha256);
    expect(stored.checksumSha256).toMatch(/^[a-f0-9]{64}$/);

    // Matching supplied checksum accepted; persisted value is still server-computed
    const matchOk = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3-chk2',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:match-chk',
      payload: { ...payload, conversionId: 'cvn-p20-w3-chk2' },
      checksumSha256: forged.expectedChecksumSha256, // wrong body → must reject
    });
    expect(matchOk.ok).toBe(false);
    expect(matchOk.error).toMatch(/checksum_mismatch/i);

    const withServerChecksum = await createOnboardingHandoff(prisma, {
      admin,
      conversionId: 'cvn-p20-w3-chk',
      tenantId: 'ten-p20-w3',
      idempotencyKey: 'onb:p20-w3:match-ok',
      correction: true,
      payload,
      checksumSha256: honest.checksumSha256,
    });
    expect(withServerChecksum.ok).toBe(true);
    expect(withServerChecksum.checksumSha256).toBe(honest.checksumSha256);
  });

  it('partial provider failure → PARTIALLY_COMPLETED/BLOCKED; resume idempotent', async () => {
    const prisma = makePrisma();
    const now = new Date('2026-07-31T12:00:00.000Z');
    const snapshot = acceptedSnapshot();

    // Seed Wave 3 steps
    const stepCodes = [
      CRM_CONVERSION_STEP_CODE.CREATE_OR_AMEND_SUBSCRIPTION,
      CRM_CONVERSION_STEP_CODE.PROVISION_ENTITLEMENTS,
      CRM_CONVERSION_STEP_CODE.CREATE_OR_LINK_BILLING_ACCOUNT,
      CRM_CONVERSION_STEP_CODE.CREATE_PLATFORM_INVOICE_IF_REQUIRED,
      CRM_CONVERSION_STEP_CODE.INITIATE_PAYMENT_IF_REQUIRED,
      CRM_CONVERSION_STEP_CODE.ACTIVATE_SUBSCRIPTION,
    ];
    for (let i = 0; i < stepCodes.length; i += 1) {
      prisma._stepStore.push({
        id: `step-${i + 1}`,
        conversionId: 'cvn-p20-w3',
        stepCode: stepCodes[i],
        stepOrder: 50 + i,
        status: CRM_CONVERSION_STEP_STATUS.NOT_STARTED,
        attemptCount: 0,
        version: 0,
        inputHash: 'hash-p20-w3',
      });
    }

    // Fail entitlements model mid-spine after subscription succeeds
    const originalUpsert = prisma.platformFeatureEntitlement.upsert;
    let failOnce = true;
    prisma.platformFeatureEntitlement.upsert = vi.fn(async (...args) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('provider_entitlement_timeout');
      }
      return originalUpsert(...args);
    });
    prisma.platformFeatureEntitlement.create = vi.fn(async () => {
      throw new Error('provider_entitlement_timeout');
    });

    const conversion = prisma._conversionStore[0];
    const first = await runWave3ProvisionSpine(prisma, {
      conversion,
      request: { conversionType: 'NEW_CUSTOMER_NEW_TENANT', currency: 'MWK' },
      admin,
      planVersion: {
        contentJson: {
          conversionType: 'NEW_CUSTOMER_NEW_TENANT',
          acceptedSnapshot: snapshot,
          activationPolicy: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
        },
      },
      inputHash: 'hash-p20-w3',
      now,
      args: { acceptedSnapshot: snapshot },
      tenantId: 'ten-p20-w3',
      customerId: 'cust-1',
    });

    expect(first.ok).toBe(false);
    expect(first.blocked).toBe(true);
    // Early blocked returns must include conversionStatus (not invent from blocked).
    expect([
      CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED,
      CRM_CONVERSION_STATUS.BLOCKED,
    ]).toContain(first.conversionStatus);
    expect(first.subscriptionId).toBeTruthy();
    expect(first.subscriptionActive).not.toBe(true);

    const subCountAfterFail = prisma._subscriptionStore.length;

    // Resume — subscription must not duplicate
    const resume = await runWave3ProvisionSpine(prisma, {
      conversion: { ...conversion, status: first.conversionStatus },
      request: { conversionType: 'NEW_CUSTOMER_NEW_TENANT', currency: 'MWK' },
      admin,
      planVersion: {
        contentJson: {
          conversionType: 'NEW_CUSTOMER_NEW_TENANT',
          acceptedSnapshot: snapshot,
          activationPolicy: CRM_ACTIVATION_POLICY.AFTER_PAYMENT,
        },
      },
      inputHash: 'hash-p20-w3',
      now: new Date('2026-07-31T12:05:00.000Z'),
      args: { acceptedSnapshot: snapshot },
      tenantId: 'ten-p20-w3',
      customerId: 'cust-1',
    });

    expect(prisma._subscriptionStore.length).toBe(subCountAfterFail);
    expect(resume.subscriptionId).toBe(first.subscriptionId);
    // Still not ACTIVE without payment provider result
    expect(resume.subscriptionActive).not.toBe(true);
  });
});
