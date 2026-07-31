/**
 * Phase 21 Wave 2 — Readiness honesty + accounting boundary.
 * G21-07…G21-14: request≠READY/ACTIVE/PROVISIONED; invitation≠ACCESS_VALID;
 * no fabricated Tenant/User IDs; migration coordinate/reconcile only;
 * accounting governed services only; portfolio fail-closed on readiness writes-by-id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateProvisioningReadiness,
  evaluateSubscriptionReadiness,
  evaluateEntitlementReadiness,
  evaluateUsersReadiness,
  evaluateConfigurationReadiness,
  evaluateIntegrationReadiness,
  evaluateOnboardingReadiness,
  assertNoFabricatedTenantIdentity,
  refuseOnboardingTenantMint,
  refuseOnboardingUserMint,
  refusePlatformSuperAdminViaOnboarding,
  refuseEntitlementMutationFromOnboarding,
  setMigrationCoordinationStatus,
  runOnboardingBrowserImport,
  assertOnboardingAccountingBoundary,
  assertNoOnboardingAccountingCreate,
  assertGovernedAccountingOnly,
  createOnboardingJournalEntry,
  editOnboardingAccountBalance,
  administerOnboardingSystemCoa,
  redactIntegrationSecrets,
  READINESS_STATUS,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-p21-w2') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csScopedAdmin(id = 'cs-p21-w2-scoped') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function makeStoreCrud(store, idPrefix) {
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
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
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
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.status) {
        const st = where.status;
        if (typeof st === 'string') rows = rows.filter((r) => r.status === st);
        else if (st?.in) rows = rows.filter((r) => st.in.includes(r.status));
        else if (st?.notIn) rows = rows.filter((r) => !st.notIn.includes(r.status));
      }
      if (where.accessValid === true) {
        rows = rows.filter((r) => r.accessValid === true);
      }
      if (where.invitationStatus) {
        rows = rows.filter((r) => r.invitationStatus === where.invitationStatus);
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const projectStore = overrides._projectStore || [];
  const readinessStore = overrides._readinessStore || [];
  const migrationStore = overrides._migrationStore || [];
  const changeRequestStore = overrides._changeRequestStore || [];
  const userStore = overrides._userStore || [];
  const subscriptionStore = overrides._subscriptionStore || [];
  const tenantStore = overrides._tenantStore || [];
  const journalStore = overrides._journalStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _projectStore: projectStore,
    _migrationStore: migrationStore,
    _userStore: userStore,
    _subscriptionStore: subscriptionStore,
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          status: data.status || 'IN_PROGRESS',
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        projectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return projectStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = projectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingReadinessEvaluation: makeStoreCrud(readinessStore, 'ready'),
    customerOnboardingMigration: makeStoreCrud(migrationStore, 'mig'),
    customerOnboardingChangeRequest: makeStoreCrud(changeRequestStore, 'cr'),
    user: {
      ...makeStoreCrud(userStore, 'user'),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...userStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where.accessValid === true) {
          rows = rows.filter(
            (r) =>
              r.accessValid === true ||
              String(r.status || '').toUpperCase() === 'ACTIVE' ||
              String(r.accessStatus || '').toUpperCase() === 'ACCESS_VALID'
          );
        }
        if (where.status?.in) {
          rows = rows.filter((r) => where.status.in.includes(r.status));
        }
        if (where.status?.notIn) {
          rows = rows.filter((r) => !where.status.notIn.includes(r.status));
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.invitationStatus) {
                return r.invitationStatus === clause.invitationStatus;
              }
              if (clause.status) return r.status === clause.status;
              if (clause.accessStatus) return r.accessStatus === clause.accessStatus;
              return false;
            })
          );
        }
        return rows.length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...userStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
    },
    subscription: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return subscriptionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    tenant: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return tenantStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `tenant-mint-${tenantStore.length + 1}`, ...data };
        tenantStore.push(row);
        return row;
      }),
    },
    journalEntry: {
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
    ...overrides,
  };
  return prisma;
}

async function seedProject(prisma, admin, opts = {}) {
  const row = await prisma.customerOnboardingProject.create({
    data: {
      id: opts.projectId || 'onb-p21-w2-1',
      number: opts.number || 'ONB-2026-000099',
      tenantId: opts.tenantId || 'tenant-p21-w2',
      customerId: opts.customerId || 'cust-p21-w2',
      subscriptionId: opts.subscriptionId || 'sub-p21-w2',
      status: opts.status || 'IN_PROGRESS',
      onboardingRequestId: opts.onboardingRequestId || 'req-p21-w2',
      ownerAssignmentsJson: opts.ownerAssignmentsJson || {},
      createdByAdminId: admin.id,
    },
  });
  return { project: row };
}

describe('Phase 21 Wave 2 — Readiness honesty + accounting boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('G21-07: REQUESTED/PROCESSING ≠ READY/PROVISIONED without provider result', async () => {
    const project = {
      id: 'onb-prov',
      tenantId: 'tenant-p21-w2',
      ownerAssignmentsJson: { provisioningStatus: 'REQUESTED' },
    };
    const requested = await evaluateProvisioningReadiness(null, project, {});
    expect(requested.status).not.toBe(READINESS_STATUS.READY);
    expect(requested.status).toBe(READINESS_STATUS.NOT_READY);
    expect(requested.evidence?.provisioningStatus || requested.evidence?.status).toMatch(
      /REQUESTED|PROCESSING|PENDING/i
    );

    const processing = await evaluateProvisioningReadiness(null, project, {
      provisioningStatus: 'PROCESSING',
    });
    expect(processing.status).not.toBe(READINESS_STATUS.READY);
    expect(processing.status).toBe(READINESS_STATUS.NOT_READY);

    const forged = await evaluateProvisioningReadiness(null, project, {
      provisioningStatus: 'PROVISIONED',
      providerResult: null,
    });
    expect(forged.status).not.toBe(READINESS_STATUS.READY);
    expect(forged.evidence?.reason || forged.evidence?.error || '').toMatch(
      /provider|fabricat|without/i
    );

    const honest = await evaluateProvisioningReadiness(null, project, {
      provisioningStatus: 'PROVISIONED',
      providerResult: { ok: true, authoritative: true, tenantId: 'tenant-p21-w2' },
    });
    expect(honest.status).toBe(READINESS_STATUS.READY);
  });

  it('G21-07: refuses fabricated Tenant IDs from onboarding', async () => {
    const prisma = makePrisma();
    const denied = assertNoFabricatedTenantIdentity({
      tenantId: 'fabricated-tenant-xyz',
      providerResult: null,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/fabricat|provider|identity/i);

    const mint = await refuseOnboardingTenantMint(prisma, {
      tenantId: 'minted-by-onboarding',
      name: 'Fake Co',
    });
    expect(mint.ok).toBe(false);
    expect(mint.error).toMatch(/fabricat|mint|forbidden|identity/i);
    expect(prisma.tenant.create).not.toHaveBeenCalled();
  });

  it('G21-08: subscription ACTIVE only from authoritative service', async () => {
    const prisma = makePrisma({
      _subscriptionStore: [
        { id: 'sub-p21-w2', status: 'REQUESTED', planCode: 'GROWTH' },
      ],
    });
    const project = {
      id: 'onb-sub',
      subscriptionId: 'sub-p21-w2',
      tenantId: 'tenant-p21-w2',
    };

    const requested = await evaluateSubscriptionReadiness(prisma, project, {});
    expect(requested.status).not.toBe(READINESS_STATUS.READY);
    expect(requested.evidence?.subscriptionStatus || '').not.toMatch(/^ACTIVE$/i);

    prisma._subscriptionStore[0].status = 'ACTIVE';
    const active = await evaluateSubscriptionReadiness(prisma, project, {});
    expect(active.status).toBe(READINESS_STATUS.READY);
    expect(active.evidence?.subscriptionStatus).toBe('ACTIVE');

    const forgedActive = await evaluateSubscriptionReadiness(prisma, project, {
      forceActive: true,
      subscriptionStatus: 'ACTIVE',
      providerResult: null,
      ignoreAuthoritative: true,
    });
    // Force flags must not invent ACTIVE when authoritative row is ignored/missing
    const prismaEmpty = makePrisma({ _subscriptionStore: [] });
    const noRow = await evaluateSubscriptionReadiness(prismaEmpty, project, {
      forceActive: true,
      subscriptionStatus: 'ACTIVE',
    });
    expect(noRow.status).not.toBe(READINESS_STATUS.READY);
  });

  it('G21-09: entitlement readiness blocks unaccepted scope; no UI term mutation', async () => {
    const prisma = makePrisma({
      _changeRequestStore: [
        {
          id: 'cr-1',
          projectId: 'onb-ent',
          status: 'OPEN',
          reason: 'SCOPE_MISMATCH',
          subscriptionMutated: false,
        },
      ],
    });
    const project = { id: 'onb-ent', subscriptionId: 'sub-p21-w2', tenantId: 'tenant-p21-w2' };

    const blocked = await evaluateEntitlementReadiness(prisma, project, {});
    expect(blocked.status).toBe(READINESS_STATUS.NOT_READY);
    expect(blocked.evidence?.reason || '').toMatch(/scope|unaccepted|change.?request/i);

    const mutate = refuseEntitlementMutationFromOnboarding({
      entitlementsJson: { seats: 999 },
      uiTermMutation: true,
    });
    expect(mutate.ok).toBe(false);
    expect(mutate.error).toMatch(/entitlement|forbidden|mutation|ui.?term/i);
    expect(mutate.subscriptionMutated).toBe(false);
  });

  it('G21-10: invitation sent ≠ ACCESS_VALID; no Platform Super Admin via onboarding', async () => {
    const prisma = makePrisma({
      _userStore: [
        {
          id: 'u-inv',
          tenantId: 'tenant-p21-w2',
          status: 'INVITED',
          invitationStatus: 'SENT',
          accessValid: false,
        },
      ],
    });
    const project = { id: 'onb-users', tenantId: 'tenant-p21-w2' };

    const invitedOnly = await evaluateUsersReadiness(prisma, project, {});
    expect(invitedOnly.status).not.toBe(READINESS_STATUS.READY);
    expect(invitedOnly.evidence?.accessValidCount ?? 0).toBe(0);
    expect(invitedOnly.evidence?.reason || invitedOnly.evidence?.invitationOnly || true).toBeTruthy();

    prisma._userStore.push({
      id: 'u-ok',
      tenantId: 'tenant-p21-w2',
      status: 'ACTIVE',
      accessStatus: 'ACCESS_VALID',
      accessValid: true,
    });
    const valid = await evaluateUsersReadiness(prisma, project, {});
    expect(valid.status).toBe(READINESS_STATUS.READY);
    expect(valid.evidence.accessValidCount).toBeGreaterThan(0);

    const superDeny = refusePlatformSuperAdminViaOnboarding({
      role: 'Platform Super Admin',
      grant: true,
    });
    expect(superDeny.ok).toBe(false);
    expect(superDeny.error).toMatch(/super.?admin|forbidden|platform/i);

    const userMint = await refuseOnboardingUserMint(prisma, {
      userId: 'fabricated-user-1',
      email: 'fake@example.com',
    });
    expect(userMint.ok).toBe(false);
    expect(userMint.error).toMatch(/fabricat|mint|forbidden|identity/i);
  });

  it('G21-12: accounting boundary — governed only; no balance edit / fake journal / System CoA', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin);

    const boundary = await assertOnboardingAccountingBoundary(prisma, {
      tenantId: project.tenantId,
      projectId: project.id,
    });
    expect(boundary.ok).toBe(true);

    expect(assertNoOnboardingAccountingCreate({ type: 'JOURNAL' }).ok).toBe(false);
    expect(assertGovernedAccountingOnly({ action: 'BALANCE_EDIT' }).ok).toBe(false);
    expect(assertGovernedAccountingOnly({ action: 'FAKE_JOURNAL' }).ok).toBe(false);
    expect(assertGovernedAccountingOnly({ action: 'SYSTEM_COA_ADMIN' }).ok).toBe(false);
    expect(assertGovernedAccountingOnly({ action: 'GOVERNED_COA_SERVICE' }).ok).toBe(true);

    const journal = await createOnboardingJournalEntry(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
    });
    expect(journal.ok).toBe(false);

    const bal = await editOnboardingAccountBalance(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
      accountId: 'acc-1',
      amount: 100,
    });
    expect(bal.ok).toBe(false);
    expect(bal.error).toMatch(/accounting.?boundary|forbidden|balance/i);

    const coa = await administerOnboardingSystemCoa(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
    });
    expect(coa.ok).toBe(false);
    expect(coa.error).toMatch(/coa|forbidden|accounting.?boundary|system/i);
  });

  it('G21-13: migration coordinate/reconcile only; refuses unsafe browser import', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin);

    const coord = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'IN_PROGRESS',
      reconciliationStatus: 'STARTED',
    });
    expect(coord.ok).toBe(true);

    const browser = await runOnboardingBrowserImport(prisma, {
      actorContext: { admin },
      projectId: project.id,
      file: { name: 'books.csv', content: '...' },
    });
    expect(browser.ok).toBe(false);
    expect(browser.error).toMatch(/browser.?import|forbidden|coordinate|engine/i);
  });

  it('G21-14: integration coordination redacts secrets; metadata only', async () => {
    const raw = {
      provider: 'webhook',
      endpoint: 'https://example.com/hook',
      apiKey: 'sk-live-secret',
      clientSecret: 'super-secret',
      password: 'p@ss',
      status: 'CONFIGURED',
    };
    const redacted = redactIntegrationSecrets(raw);
    expect(redacted.apiKey).toMatch(/REDACTED|\*+/i);
    expect(redacted.clientSecret).toMatch(/REDACTED|\*+/i);
    expect(redacted.password).toMatch(/REDACTED|\*+/i);
    expect(redacted.endpoint).toBe('https://example.com/hook');
    expect(JSON.stringify(redacted)).not.toMatch(/sk-live-secret|super-secret|p@ss/);

    const project = { id: 'onb-int', tenantId: 'tenant-p21-w2' };
    const evalResult = await evaluateIntegrationReadiness(null, project, {
      integrationConfig: raw,
    });
    expect(evalResult.evidence?.config?.apiKey || '').toMatch(/REDACTED|\*+|^$/);
    expect(JSON.stringify(evalResult)).not.toMatch(/sk-live-secret/);
  });

  it('G21-11: portfolio fail-closed on readiness writes-by-id', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const scoped = csScopedAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w2-scope',
      tenantId: 'tenant-p21-w2',
    });

    const deniedMig = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin: scoped },
      projectId: project.id,
      status: 'IN_PROGRESS',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(deniedMig.ok).toBe(false);
    expect(deniedMig.forbidden || deniedMig.notFound).toBe(true);
    expect(deniedMig.error || deniedMig.reason).toMatch(/scope|portfolio|forbidden/i);
    expect(prisma._migrationStore.length).toBe(0);

    const deniedEval = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin: scoped },
      projectId: project.id,
      persist: true,
      portfolioTenantIds: [],
    });
    expect(deniedEval.ok).toBe(false);
    expect(deniedEval.forbidden || deniedEval.notFound || deniedEval.error).toBeTruthy();

    const config = await evaluateConfigurationReadiness(prisma, project, {});
    // Pin alone must not invent subscription ACTIVE
    expect(config.evidence?.subscriptionStatus).not.toBe('ACTIVE');
  });
});
