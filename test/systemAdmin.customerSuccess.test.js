import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  idempotencyKey,
  openCaseFromSignal,
  openCaseFromHealth,
  getCase,
  listCases,
  updateCase,
  setRenewalOutcome,
  openRenewalWorkspace,
  createPlaybook,
  executePlaybook,
  createExpansionHandoff,
  getFoundationStatus,
  CS_CASE_STATUS,
  CS_TRIGGER_TYPE,
  ALLOWED_SIGNAL_CASE_CODES,
  CS_RENEWAL_OUTCOME,
  CS_FOUNDATION_STATUS,
} from '@/lib/admin/customerSuccess';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';
import { CUSTOMER_SIGNAL_RULE_VERSION } from '@/lib/admin/customers/signalCatalogue.js';
import { HEALTH_DEFINITION_VERSION } from '@/lib/admin/health/catalogue.js';

const FUTURE = new Date(Date.now() + 45 * 864e5);
const PAST = new Date(Date.now() - 10 * 864e5);

function fixtureTenant(id = 'tenant-cs-1', overrides = {}) {
  return {
    id,
    name: `CS Tenant ${id}`,
    subdomain: id,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function fixtureSub(tenantId, overrides = {}) {
  return {
    id: `sub-${tenantId}`,
    tenantId,
    plan: '1month',
    amount: 12000,
    currency: 'MWK',
    status: 'Completed',
    isActive: true,
    isTrial: false,
    startedAt: new Date('2024-06-01T00:00:00.000Z'),
    expiresAt: FUTURE,
    createdAt: new Date('2024-06-01T00:00:00.000Z'),
    updatedAt: new Date('2024-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma(overrides = {}) {
  const tenants = overrides._tenants || [
    fixtureTenant('tenant-cs-1'),
    fixtureTenant('tenant-foreign', { name: 'Foreign Co', subdomain: 'foreign' }),
  ];
  const ownershipRows = overrides._ownershipRows || [
    {
      id: 'own-1',
      tenantId: 'tenant-cs-1',
      ownerAdminId: 'admin-agent-1',
      status: 'ACTIVE',
      isPrimary: true,
      endAt: null,
    },
  ];
  const caseStore = overrides._caseStore || [];
  const renewalStore = overrides._renewalStore || [];
  const playbookStore = overrides._playbookStore || [];
  const executionStore = overrides._executionStore || [];
  const taskStore = overrides._taskStore || [];
  const handoffStore = overrides._handoffStore || [];
  const onboardingStore = overrides._onboardingStore || [];
  const trainingStore = overrides._trainingStore || [];
  const surveyStore = overrides._surveyStore || [];
  const planStore = overrides._planStore || [];
  const goalStore = overrides._goalStore || [];
  const subsByTenant = overrides._subsByTenant || {
    'tenant-cs-1': [fixtureSub('tenant-cs-1')],
    'tenant-foreign': [fixtureSub('tenant-foreign')],
  };

  const prisma = {
    tenant: {
      findUnique: vi.fn(async ({ where }) => tenants.find((t) => t.id === where.id) || null),
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = tenants;
        if (where?.id?.in) {
          const set = new Set(where.id.in);
          rows = rows.filter((t) => set.has(t.id));
        }
        return rows;
      }),
    },
    customerOwnership: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = ownershipRows;
        if (where?.ownerAdminId) {
          rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        }
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        return rows;
      }),
    },
    accountSubscription: {
      findMany: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        if (!tid) return Object.values(subsByTenant).flat();
        return subsByTenant[tid] || [];
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        const tid = where?.tenantId;
        const rows = tid ? subsByTenant[tid] || [] : Object.values(subsByTenant).flat();
        if (where?.id) return rows.find((r) => r.id === where.id) || null;
        if (where?.isActive === true) return rows.find((r) => r.isActive) || null;
        return rows[0] || null;
      }),
      update: vi.fn(async () => {
        throw new Error('accountSubscription.update must not be called from CS Wave 4');
      }),
      create: vi.fn(async () => {
        throw new Error('accountSubscription.create must not be called from CS Wave 4');
      }),
    },
    customerSignal: {
      findFirst: vi.fn(async () => overrides._signal || null),
      findUnique: vi.fn(async () => overrides._signal || null),
    },
    customerHealthSnapshot: {
      findUnique: vi.fn(async ({ where } = {}) => {
        const snaps = overrides._snapshots || [];
        return snaps.find((s) => s.id === where?.id) || null;
      }),
      findFirst: vi.fn(async () => (overrides._snapshots || [])[0] || null),
    },
    csCase: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...caseStore];
        if (where?.tenantId?.in) {
          const set = new Set(where.tenantId.in);
          rows = rows.filter((r) => set.has(r.tenantId));
        } else if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        } else if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where?.id) {
          rows = rows.filter((r) => r.id === where.id);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = [...caseStore];
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where?.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        } else if (where?.status) {
          rows = rows.filter((r) => r.status === where.status);
        }
        if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where?.id) {
          rows = rows.filter((r) => r.id === where.id);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return caseStore.find((r) => r.id === where.id) || null;
        if (where?.idempotencyKey) {
          return caseStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const openStatuses = new Set([CS_CASE_STATUS.OPEN, CS_CASE_STATUS.IN_PROGRESS]);
        const key = data?.idempotencyKey;
        const status = data?.status || CS_CASE_STATUS.OPEN;
        if (
          key &&
          openStatuses.has(status) &&
          caseStore.some(
            (r) => r.idempotencyKey === key && openStatuses.has(r.status)
          )
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          err.meta = { target: ['idempotencyKey'] };
          throw err;
        }
        const row = {
          id: `case-${caseStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          openedAt: new Date(),
          status: CS_CASE_STATUS.OPEN,
          ...data,
        };
        caseStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = caseStore.find((r) => r.id === where.id);
        if (!row) throw new Error('case not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    csTask: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...taskStore];
        if (where?.executionId) rows = rows.filter((r) => r.executionId === where.executionId);
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = [...taskStore];
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where?.executionId && where?.stepId) {
          rows = rows.filter(
            (r) => r.executionId === where.executionId && r.stepId === where.stepId
          );
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return taskStore.find((r) => r.id === where.id) || null;
        if (where?.idempotencyKey) {
          return taskStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        if (
          data?.idempotencyKey &&
          taskStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          err.meta = { target: ['idempotencyKey'] };
          throw err;
        }
        const row = {
          id: `task-${taskStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'OPEN',
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = taskStore.find((r) => r.id === where.id);
        if (!row) throw new Error('task not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    csPlaybook: {
      findMany: vi.fn(async () => [...playbookStore]),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = [...playbookStore];
        if (where?.id) rows = rows.filter((r) => r.id === where.id);
        if (where?.key) rows = rows.filter((r) => r.key === where.key);
        if (where?.version) rows = rows.filter((r) => r.version === where.version);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return playbookStore.find((r) => r.id === where.id) || null;
        if (where?.key_version) {
          return (
            playbookStore.find(
              (r) =>
                r.key === where.key_version.key && r.version === where.key_version.version
            ) || null
          );
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `pb-${playbookStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'ACTIVE',
          ...data,
        };
        playbookStore.push(row);
        return row;
      }),
    },
    csPlaybookExecution: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...executionStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where?.playbookId) rows = rows.filter((r) => r.playbookId === where.playbookId);
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = [...executionStore];
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        if (where?.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return executionStore.find((r) => r.id === where.id) || null;
        if (where?.idempotencyKey) {
          return executionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        if (
          data?.idempotencyKey &&
          executionStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          err.meta = { target: ['idempotencyKey'] };
          throw err;
        }
        const row = {
          id: `exec-${executionStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          status: 'RUNNING',
          ...data,
        };
        executionStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = executionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('execution not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    csExpansionHandoff: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...handoffStore];
        if (where?.tenantId?.in) {
          const set = new Set(where.tenantId.in);
          rows = rows.filter((r) => set.has(r.tenantId));
        } else if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return handoffStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `hof-${handoffStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'OPEN',
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
    },
    csSuccessPlan: {
      findMany: vi.fn(async () => [...planStore]),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return planStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `plan-${planStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'ACTIVE',
          ...data,
        };
        planStore.push(row);
        return row;
      }),
    },
    csSuccessGoal: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...goalStore];
        if (where?.planId) rows = rows.filter((r) => r.planId === where.planId);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `goal-${goalStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'OPEN',
          ...data,
        };
        goalStore.push(row);
        return row;
      }),
    },
    csOnboardingRecord: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...onboardingStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      count: vi.fn(async ({ where } = {}) => {
        let rows = [...onboardingStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
    },
    csTrainingRecord: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...trainingStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      count: vi.fn(async ({ where } = {}) => {
        let rows = [...trainingStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
    },
    csSurveyResponse: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...surveyStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
      count: vi.fn(async ({ where } = {}) => {
        let rows = [...surveyStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
    },
    csIntervention: {
      findMany: vi.fn(async () => overrides._interventions || []),
      create: vi.fn(async ({ data }) => ({
        id: 'int-1',
        ...data,
        createdAt: new Date(),
        performedAt: data.performedAt || new Date(),
      })),
    },
    csRenewalWorkspace: {
      findMany: vi.fn(async ({ where } = {}) => {
        let rows = [...renewalStore];
        if (where?.tenantId?.in) {
          const set = new Set(where.tenantId.in);
          rows = rows.filter((r) => set.has(r.tenantId));
        } else if (where?.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where } = {}) => {
        let rows = [...renewalStore];
        if (where?.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        if (where?.periodKey) rows = rows.filter((r) => r.periodKey === where.periodKey);
        if (where?.id) rows = rows.filter((r) => r.id === where.id);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where } = {}) => {
        if (where?.id) return renewalStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `rw-${renewalStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          outcome: null,
          ...data,
        };
        renewalStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = renewalStore.find((r) => r.id === where.id);
        if (!row) throw new Error('renewal not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    ...overrides,
  };

  prisma._caseStore = caseStore;
  prisma._renewalStore = renewalStore;
  prisma._playbookStore = playbookStore;
  prisma._executionStore = executionStore;
  prisma._taskStore = taskStore;
  prisma._handoffStore = handoffStore;
  prisma._onboardingStore = onboardingStore;
  prisma._trainingStore = trainingStore;
  prisma._surveyStore = surveyStore;
  return prisma;
}

const superAdmin = { id: 'a-super', role: 'Super Admin', permissions: {} };

const csAgent = {
  id: 'admin-agent-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      intel: { 'customers.read': true },
      customerSuccess: { read: true, manageCases: true, manageRenewals: true },
    },
  },
};

const csReader = {
  id: 'admin-reader-1',
  role: 'Platform Support',
  permissions: {
    systemAdmin: {
      intel: { 'customers.read': true },
      customerSuccess: { read: true },
    },
  },
};

describe('systemAdmin.customerSuccess', () => {
  it('defines CS permissions including manageRenewals and nav map', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read).toBe(
      'systemAdmin.customerSuccess.read'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases).toBe(
      'systemAdmin.customerSuccess.manageCases'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageRenewals).toBe(
      'systemAdmin.customerSuccess.manageRenewals'
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/customer-success/cases']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/customer-success/renewals']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read
    );
  });

  it('builds deterministic idempotency keys', () => {
    const key = idempotencyKey({
      tenantId: 'tenant-cs-1',
      triggerType: CS_TRIGGER_TYPE.SIGNAL,
      triggerCode: 'RENEWAL_DUE_SOON',
      definitionVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    });
    expect(key).toBe(
      `tenant-cs-1+SIGNAL+RENEWAL_DUE_SOON+${CUSTOMER_SIGNAL_RULE_VERSION}`
    );
    expect(ALLOWED_SIGNAL_CASE_CODES).toContain('NO_MEANINGFUL_ACTIVITY');
    expect(ALLOWED_SIGNAL_CASE_CODES).not.toContain('FEATURE_USED');
  });

  it('forbids agent without portfolio from opening or reading a foreign case', async () => {
    const prisma = makePrisma();

    const openForeign = await openCaseFromSignal(prisma, {
      admin: csAgent,
      tenantId: 'tenant-foreign',
      signalCode: 'RENEWAL_DUE_SOON',
    });
    expect(openForeign.ok).toBe(false);
    expect(openForeign.forbidden).toBe(true);
    expect(prisma.csCase.create).not.toHaveBeenCalled();

    const foreignCase = {
      id: 'case-foreign',
      tenantId: 'tenant-foreign',
      status: CS_CASE_STATUS.OPEN,
      title: 'Foreign case',
      triggerType: CS_TRIGGER_TYPE.SIGNAL,
      triggerCode: 'RENEWAL_DUE_SOON',
      idempotencyKey: 'tenant-foreign+SIGNAL+RENEWAL_DUE_SOON+v1',
    };
    prisma._caseStore.push(foreignCase);

    const read = await getCase(prisma, { admin: csAgent, caseId: 'case-foreign' });
    expect(read.ok).toBe(false);
    expect(read.forbidden).toBe(true);

    const listed = await listCases(prisma, { admin: csAgent });
    expect(listed.ok).toBe(true);
    expect(listed.items.every((c) => c.tenantId === 'tenant-cs-1')).toBe(true);
    expect(listed.items.some((c) => c.tenantId === 'tenant-foreign')).toBe(false);
  });

  it('does not create a second open case for a duplicate trigger (idempotent)', async () => {
    const prisma = makePrisma();

    const first = await openCaseFromSignal(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      signalCode: 'HIGH_OUTSTANDING_BALANCE',
      signalId: 'sig-1',
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(first.case?.id).toBeTruthy();
    expect(prisma.csCase.create).toHaveBeenCalledTimes(1);

    const second = await openCaseFromSignal(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      signalCode: 'HIGH_OUTSTANDING_BALANCE',
      signalId: 'sig-1',
    });
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(second.noop || second.idempotent).toBeTruthy();
    expect(second.case?.id).toBe(first.case.id);
    expect(prisma.csCase.create).toHaveBeenCalledTimes(1);

    const healthKeyDay = new Date().toISOString().slice(0, 10);
    const snap = {
      id: 'snap-risk-1',
      tenantId: 'tenant-cs-1',
      band: 'AT_RISK',
      definitionVersion: HEALTH_DEFINITION_VERSION,
      score: 50,
      confidence: 'MEDIUM',
      asOf: new Date(),
    };
    const prismaHealth = makePrisma({ _snapshots: [snap] });
    const h1 = await openCaseFromHealth(prismaHealth, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      band: 'AT_RISK',
      snapshotId: 'snap-risk-1',
    });
    expect(h1.ok).toBe(true);
    expect(h1.created).toBe(true);
    expect(h1.case.idempotencyKey).toContain(healthKeyDay);

    const h2 = await openCaseFromHealth(prismaHealth, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      band: 'AT_RISK',
      snapshotId: 'snap-risk-1',
    });
    expect(h2.ok).toBe(true);
    expect(h2.created).toBe(false);
    expect(prismaHealth.csCase.create).toHaveBeenCalledTimes(1);

    const healthy = await openCaseFromHealth(prismaHealth, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      band: 'HEALTHY',
      snapshotId: 'snap-risk-1',
    });
    expect(healthy.ok).toBe(false);
    expect(healthy.reason || healthy.error).toMatch(/AT_RISK|CRITICAL|band/i);
  });

  it('allows re-open after close with the same trigger key', async () => {
    const prisma = makePrisma();

    const first = await openCaseFromSignal(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      signalCode: 'SUBSCRIPTION_SUSPENDED',
      signalId: 'sig-reopen-1',
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);

    const closed = await updateCase(prisma, {
      admin: superAdmin,
      caseId: first.case.id,
      status: CS_CASE_STATUS.CLOSED,
    });
    expect(closed.ok).toBe(true);
    expect(closed.case.status).toBe(CS_CASE_STATUS.CLOSED);

    const again = await openCaseFromSignal(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      signalCode: 'SUBSCRIPTION_SUSPENDED',
      signalId: 'sig-reopen-2',
    });
    expect(again.ok).toBe(true);
    expect(again.created).toBe(true);
    expect(again.case.id).not.toBe(first.case.id);
    expect(again.case.idempotencyKey).toBe(first.case.idempotencyKey);
    expect(prisma._caseStore.filter((c) => c.idempotencyKey === first.case.idempotencyKey)).toHaveLength(
      2
    );
  });

  it('treats concurrent P2002 on create as idempotent no-op', async () => {
    const prisma = makePrisma();
    const key = idempotencyKey({
      tenantId: 'tenant-cs-1',
      triggerType: CS_TRIGGER_TYPE.SIGNAL,
      triggerCode: 'CUSTOMER_OWNER_MISSING',
      definitionVersion: CUSTOMER_SIGNAL_RULE_VERSION,
    });
    const winner = {
      id: 'case-race-winner',
      tenantId: 'tenant-cs-1',
      status: CS_CASE_STATUS.OPEN,
      title: 'Race winner',
      triggerType: CS_TRIGGER_TYPE.SIGNAL,
      triggerCode: 'CUSTOMER_OWNER_MISSING',
      idempotencyKey: key,
      openedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Soft check misses (empty store); create hits unique race; re-fetch finds winner.
    prisma.csCase.findFirst
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => winner);
    prisma.csCase.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['idempotencyKey'] },
      })
    );

    const result = await openCaseFromSignal(prisma, {
      admin: superAdmin,
      tenantId: 'tenant-cs-1',
      signalCode: 'CUSTOMER_OWNER_MISSING',
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(result.noop || result.idempotent).toBeTruthy();
    expect(result.case?.id).toBe('case-race-winner');
  });

  it('rejects renewal outcome without matching AccountSubscription evidence', async () => {
    const prisma = makePrisma({
      _subsByTenant: {
        'tenant-cs-1': [
          fixtureSub('tenant-cs-1', {
            isActive: false,
            status: 'Expired',
            expiresAt: PAST,
          }),
        ],
      },
    });

    const workspace = await openRenewalWorkspace(prisma, {
      admin: csAgent,
      tenantId: 'tenant-cs-1',
      periodKey: '2026-07',
    });
    expect(workspace.ok).toBe(true);
    expect(workspace.workspace?.id).toBeTruthy();

    const rejected = await setRenewalOutcome(prisma, {
      admin: csAgent,
      workspaceId: workspace.workspace.id,
      outcome: CS_RENEWAL_OUTCOME.RENEWED,
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.evidenceMissing || rejected.reason).toBeTruthy();
    expect(prisma.csRenewalWorkspace.update).not.toHaveBeenCalled();

    // Evidence present: active sub with future expiresAt
    const prismaOk = makePrisma({
      _subsByTenant: {
        'tenant-cs-1': [fixtureSub('tenant-cs-1', { isActive: true, expiresAt: FUTURE })],
      },
      _renewalStore: [
        {
          id: 'rw-existing',
          tenantId: 'tenant-cs-1',
          periodKey: '2026-07',
          status: 'OPEN',
          outcome: null,
        },
      ],
    });
    const accepted = await setRenewalOutcome(prismaOk, {
      admin: csAgent,
      workspaceId: 'rw-existing',
      outcome: CS_RENEWAL_OUTCOME.RENEWED,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.workspace?.outcome).toBe(CS_RENEWAL_OUTCOME.RENEWED);
    expect(prismaOk.csRenewalWorkspace.update).toHaveBeenCalled();

    // Reader without manageRenewals cannot set outcome
    const denied = await setRenewalOutcome(prismaOk, {
      admin: csReader,
      workspaceId: 'rw-existing',
      outcome: CS_RENEWAL_OUTCOME.RENEWED,
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);
  });

  it('ships Wave 3 lib/API/SQL surface files', () => {
    const root = process.cwd();
    const required = [
      'lib/admin/customerSuccess/index.js',
      'lib/admin/customerSuccess/cases.js',
      'lib/admin/customerSuccess/tasks.js',
      'lib/admin/customerSuccess/interventions.js',
      'lib/admin/customerSuccess/automation.js',
      'lib/admin/customerSuccess/renewals.js',
      'lib/admin/customerSuccess/authz.js',
      'scripts/sql/customer-success-phase08.sql',
      'app/api/admin/customer-success/cases/route.js',
      'app/api/admin/customer-success/tasks/route.js',
      'app/api/admin/customer-success/interventions/route.js',
      'app/api/admin/customer-success/renewals/route.js',
      'app/api/admin/customer-success/automations/route.js',
    ];
    for (const rel of required) {
      expect(existsSync(join(root, rel)), `missing ${rel}`).toBe(true);
    }
  });

  it('playbook execution creates tasks deterministically from definition steps', async () => {
    const prisma = makePrisma();
    const pb = await createPlaybook(prisma, {
      admin: superAdmin,
      key: 'at-risk-outreach',
      name: 'At-risk outreach',
      version: '1',
      steps: [
        { stepId: 'kickoff', title: 'Kickoff call' },
        { stepId: 'checklist', title: 'Send recovery checklist' },
        { stepId: 'followup', title: '7-day follow-up' },
      ],
    });
    expect(pb.ok).toBe(true);
    expect(pb.playbook?.id).toBeTruthy();

    const run1 = await executePlaybook(prisma, {
      admin: csAgent,
      playbookId: pb.playbook.id,
      tenantId: 'tenant-cs-1',
      caseId: null,
    });
    expect(run1.ok).toBe(true);
    expect(run1.created).toBe(true);
    expect(run1.tasks).toHaveLength(3);
    expect(run1.tasks.map((t) => t.stepId)).toEqual(['kickoff', 'checklist', 'followup']);
    expect(run1.tasks.map((t) => t.title)).toEqual([
      'Kickoff call',
      'Send recovery checklist',
      '7-day follow-up',
    ]);
    expect(run1.tasks.every((t) => t.executionId === run1.execution.id)).toBe(true);
    expect(prisma.csTask.create).toHaveBeenCalledTimes(3);

    const run2 = await executePlaybook(prisma, {
      admin: csAgent,
      playbookId: pb.playbook.id,
      tenantId: 'tenant-cs-1',
      caseId: null,
    });
    expect(run2.ok).toBe(true);
    expect(run2.created).toBe(false);
    expect(run2.idempotent || run2.noop).toBeTruthy();
    expect(run2.execution.id).toBe(run1.execution.id);
    expect(run2.tasks).toHaveLength(3);
    expect(prisma.csTask.create).toHaveBeenCalledTimes(3);
  });

  it('executePlaybook fails closed on missing/invalid caseId (does not COMPLETE empty)', async () => {
    const prisma = makePrisma();
    const pb = await createPlaybook(prisma, {
      admin: superAdmin,
      key: 'case-guard-playbook',
      name: 'Case guard',
      version: '1',
      steps: [
        { stepId: 's1', title: 'Step one' },
        { stepId: 's2', title: 'Step two' },
      ],
    });
    expect(pb.ok).toBe(true);

    const missing = await executePlaybook(prisma, {
      admin: csAgent,
      playbookId: pb.playbook.id,
      tenantId: 'tenant-cs-1',
      caseId: 'case-does-not-exist',
    });
    expect(missing.ok).toBe(false);
    expect(missing.notFound).toBe(true);
    expect(missing.error).toBe('case_not_found');
    expect(prisma.csPlaybookExecution.create).not.toHaveBeenCalled();
    expect(prisma.csTask.create).not.toHaveBeenCalled();
    expect(
      prisma._executionStore.every((e) => e.status !== 'COMPLETED')
    ).toBe(true);
  });

  it('executePlaybook rejects cross-tenant caseId (no silent tenant overwrite)', async () => {
    const prisma = makePrisma();
    prisma._caseStore.push({
      id: 'case-foreign-pb',
      tenantId: 'tenant-foreign',
      status: CS_CASE_STATUS.OPEN,
      title: 'Foreign case for playbook',
      triggerType: CS_TRIGGER_TYPE.SIGNAL,
      triggerCode: 'RENEWAL_DUE_SOON',
      idempotencyKey: 'tenant-foreign+SIGNAL+RENEWAL_DUE_SOON+pb',
    });

    const pb = await createPlaybook(prisma, {
      admin: superAdmin,
      key: 'cross-tenant-playbook',
      name: 'Cross tenant guard',
      version: '1',
      steps: [{ stepId: 's1', title: 'Should not create' }],
    });
    expect(pb.ok).toBe(true);

    const agentDenied = await executePlaybook(prisma, {
      admin: csAgent,
      playbookId: pb.playbook.id,
      tenantId: 'tenant-cs-1',
      caseId: 'case-foreign-pb',
    });
    expect(agentDenied.ok).toBe(false);
    expect(agentDenied.forbidden).toBe(true);
    expect(prisma.csTask.create).not.toHaveBeenCalled();

    const mismatch = await executePlaybook(prisma, {
      admin: superAdmin,
      playbookId: pb.playbook.id,
      tenantId: 'tenant-cs-1',
      caseId: 'case-foreign-pb',
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.error).toBe('case_tenant_mismatch');
    expect(prisma.csPlaybookExecution.create).not.toHaveBeenCalled();
    expect(prisma.csTask.create).not.toHaveBeenCalled();
    expect(prisma._taskStore.some((t) => t.tenantId === 'tenant-foreign')).toBe(
      false
    );
  });

  it('expansion handoff is record-only (no subscription or CRM opportunity mutation)', async () => {
    const prisma = makePrisma();
    const result = await createExpansionHandoff(prisma, {
      admin: csAgent,
      tenantId: 'tenant-cs-1',
      reason: 'Ready for plan discussion',
      recommendedAction: 'UPGRADE_HANDOFF',
      notes: 'Customer asked about annual plan',
    });
    expect(result.ok).toBe(true);
    expect(result.handoff?.id).toBeTruthy();
    expect(result.handoff?.recordOnly).toBe(true);
    expect(result.handoff?.opportunityId).toBeUndefined();
    expect(prisma.csExpansionHandoff.create).toHaveBeenCalledTimes(1);
    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
    expect(prisma.accountSubscription.create).not.toHaveBeenCalled();
    expect(prisma.crmOpportunity).toBeUndefined();
  });

  it('onboarding/training/survey foundations return NOT_INSTRUMENTED when empty', async () => {
    const prisma = makePrisma();
    for (const kind of ['onboarding', 'training', 'survey']) {
      const status = await getFoundationStatus(prisma, {
        admin: csAgent,
        kind,
        tenantId: 'tenant-cs-1',
      });
      expect(status.ok).toBe(true);
      expect(status.status).toBe(CS_FOUNDATION_STATUS.NOT_INSTRUMENTED);
      expect(status.progressPercent).toBeNull();
      expect(status.items).toEqual([]);
    }

    const withRows = makePrisma({
      _onboardingStore: [
        {
          id: 'ob-1',
          tenantId: 'tenant-cs-1',
          checklistKey: 'welcome',
          status: 'DONE',
          completedAt: new Date(),
        },
      ],
    });
    const instrumented = await getFoundationStatus(withRows, {
      admin: csAgent,
      kind: 'onboarding',
      tenantId: 'tenant-cs-1',
    });
    expect(instrumented.ok).toBe(true);
    expect(instrumented.status).toBe(CS_FOUNDATION_STATUS.INSTRUMENTED);
    expect(instrumented.items).toHaveLength(1);
    expect(instrumented.progressPercent).toBeNull();
  });

  it('ships Wave 4 lib/API/docs surface and READY_FOR_PHASE_9_WITH_BLOCKERS', () => {
    const root = process.cwd();
    const required = [
      'lib/admin/customerSuccess/playbooks.js',
      'lib/admin/customerSuccess/plans.js',
      'lib/admin/customerSuccess/handoffs.js',
      'lib/admin/customerSuccess/foundations.js',
      'lib/admin/customerSuccess/export.js',
      'app/api/admin/customer-success/playbooks/route.js',
      'app/api/admin/customer-success/plans/route.js',
      'app/api/admin/customer-success/handoffs/route.js',
      'app/api/admin/customer-success/foundations/route.js',
      'app/api/admin/customer-success/export/route.js',
      'docs/admin-intelligence-crm/phase-08/FINAL_PHASE_08_REPORT.md',
      'docs/admin-intelligence-crm/phase-08/PHASE_09_INPUTS.md',
      'docs/admin-intelligence-crm/phase-08/PHASE_09_READINESS_CHECKLIST.md',
    ];
    for (const rel of required) {
      expect(existsSync(join(root, rel)), `missing ${rel}`).toBe(true);
    }
    const report = readFileSync(
      join(root, 'docs/admin-intelligence-crm/phase-08/FINAL_PHASE_08_REPORT.md'),
      'utf8'
    );
    expect(report).toContain('READY_FOR_PHASE_9_WITH_BLOCKERS');
    const checklist = readFileSync(
      join(root, 'docs/admin-intelligence-crm/phase-08/PHASE_09_READINESS_CHECKLIST.md'),
      'utf8'
    );
    expect(checklist).toContain('READY_FOR_PHASE_9_WITH_BLOCKERS');
  });
});
