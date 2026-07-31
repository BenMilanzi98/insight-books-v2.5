/**
 * Phase 17 Wave 4 — UI hubs, metrics/reliability, DQ/recon, reports, Phase 8 migrate, i18n.
 * Gate fail → UNAVAILABLE / value: null (never false zero).
 * Portfolio My Work excludes other CS owners; search excludes inaccessible ONB;
 * export strips credentials; Phase 8 linked record projects Project status;
 * EN key smoke; certificate still idempotent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyOnboardingReportHonesty,
  ONBOARDING_REPORT_STATUS,
  getOnboardingMetric,
  getOnboardingOverviewCards,
  getOnboardingMyWork,
  searchOnboardingIndex,
  exportOnboardingReport,
  migratePhase8OnboardingRecords,
  getFoundationStatusWithProject,
  issueCompletionCertificate,
  getOnboardingDomainContract,
} from '@/lib/admin/customerSuccess/onboarding';
import { getFoundationStatus } from '@/lib/admin/customerSuccess/foundations.js';

function superAdmin(id = 'super-onb-4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csAgent(id = 'cs-agent-a') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csViewerOnly(id = 'cs-viewer-only') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
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
      if (where.idempotencyKey) {
        return store.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
      }
      if (where.projectId) {
        return store.find((r) => r.projectId === where.projectId) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.onboardingProjectId) {
        rows = rows.filter((r) => r.onboardingProjectId === where.onboardingProjectId);
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.onboardingProjectId === null) {
        rows = rows.filter((r) => r.onboardingProjectId == null);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.onboardingNumber?.contains) {
              return String(r.onboardingNumber || '').includes(clause.onboardingNumber.contains);
            }
            if (clause.requestNumber?.contains) {
              return String(r.requestNumber || '').includes(clause.requestNumber.contains);
            }
            if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
            if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
            return false;
          })
        );
      }
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
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.csOwnerAdminId) {
        rows = rows.filter((r) => r.csOwnerAdminId === where.csOwnerAdminId);
      }
      if (where.ownerAdminId) {
        rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
      }
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
            if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
            return Object.entries(clause).every(([k, v]) => r[k] === v);
          })
        );
      }
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const projectStore = overrides._projectStore || [];
  const requestStore = overrides._requestStore || [];
  const certificateStore = overrides._certificateStore || [];
  const completionStore = overrides._completionStore || [];
  const handoverStore = overrides._handoverStore || [];
  const migrationStore = overrides._migrationStore || [];
  const goLiveStore = overrides._goLiveStore || [];
  const stabilisationStore = overrides._stabilisationStore || [];
  const csOnboardingStore = overrides._csOnboardingStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _projectStore: projectStore,
    _requestStore: requestStore,
    _certificateStore: certificateStore,
    _csOnboardingStore: csOnboardingStore,
    _stabilisationStore: stabilisationStore,
    customerOnboardingProject: {
      ...makeStoreCrud(projectStore, 'onb'),
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
        if (where.onboardingNumber) {
          return projectStore.find((r) => r.onboardingNumber === where.onboardingNumber) || null;
        }
        return null;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where.csOwnerAdminId) {
          rows = rows.filter((r) => r.csOwnerAdminId === where.csOwnerAdminId);
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
              if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
              return Object.entries(clause).every(([k, v]) => r[k] === v);
            })
          );
        }
        return rows.length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.customerId) {
          rows = rows.filter((r) => r.customerId === where.customerId);
        }
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.csOwnerAdminId) {
          rows = rows.filter((r) => r.csOwnerAdminId === where.csOwnerAdminId);
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.onboardingNumber?.contains) {
                return String(r.onboardingNumber || '').includes(
                  clause.onboardingNumber.contains
                );
              }
              if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
              if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
              return Object.entries(clause).every(([k, v]) => r[k] === v);
            })
          );
        }
        if (where.onboardingNumber?.contains) {
          rows = rows.filter((r) =>
            String(r.onboardingNumber || '').includes(where.onboardingNumber.contains)
          );
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = projectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequest: {
      ...makeStoreCrud(requestStore, 'onr'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        }
        if (where.requestNumber?.contains) {
          rows = rows.filter((r) =>
            String(r.requestNumber || '').includes(where.requestNumber.contains)
          );
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.requestNumber?.contains) {
                return String(r.requestNumber || '').includes(clause.requestNumber.contains);
              }
              return false;
            })
          );
        }
        return rows;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows.length;
      }),
    },
    customerOnboardingProjectStatusHistory: makeStoreCrud(projectHistoryStore, 'ph'),
    customerOnboardingCompletion: makeStoreCrud(completionStore, 'cmp'),
    customerOnboardingCompletionCertificate: makeStoreCrud(certificateStore, 'cert'),
    customerOnboardingHandover: makeStoreCrud(handoverStore, 'ho'),
    customerOnboardingMigration: makeStoreCrud(migrationStore, 'mig'),
    customerOnboardingGoLive: makeStoreCrud(goLiveStore, 'gl'),
    customerOnboardingStabilisation: makeStoreCrud(stabilisationStore, 'stb'),
    csOnboardingRecord: {
      ...makeStoreCrud(csOnboardingStore, 'csob'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...csOnboardingStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.onboardingProjectId === null) {
          rows = rows.filter((r) => r.onboardingProjectId == null);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = csOnboardingStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
  };

  return prisma;
}

describe('Phase 17 Wave 4 — metrics / reliability / hubs / Phase 8 / i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reliability gate fail → UNAVAILABLE / value null — never false zero', async () => {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.customerOnboardingProject.count = vi.fn(async () => {
      throw new Error('db down');
    });

    const metric = await getOnboardingMetric(broken, {
      admin: superAdmin(),
      metric: 'project_count',
    });
    expect(metric.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);

    const cards = await getOnboardingOverviewCards(broken, {
      admin: superAdmin(),
    });
    expect(cards.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    const values = Object.values(cards.cards || {}).map((c) => c?.value);
    for (const v of values) {
      expect(v).not.toBe(0);
      expect(v === null || v === undefined).toBe(true);
    }
  });

  it('metrics/overview counts are portfolio-scoped (not global) for CS agents', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-agent-metrics');

    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-m-owned',
        onboardingNumber: 'ONB-2026-000450',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
      },
    });
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-m-other',
        onboardingNumber: 'ONB-2026-000451',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'cs-agent-b',
      },
    });

    // Empty / missing portfolio → UNAVAILABLE (not global fleet count)
    const unscoped = await getOnboardingMetric(prisma, {
      admin: agent,
      metric: 'project_count',
    });
    expect(unscoped.value).toBeNull();
    expect(unscoped.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(unscoped.meta?.failClosed || unscoped.reason).toBeTruthy();

    const scoped = await getOnboardingMetric(prisma, {
      admin: agent,
      metric: 'project_count',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    expect(scoped.value).toBe(1);

    const cards = await getOnboardingOverviewCards(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(cards.ok).toBe(true);
    expect(cards.cards.inProgress.value).toBe(1);
  });

  it('My Work portfolio scope excludes other CS owner projects', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');
    const agentB = csAgent('cs-agent-b');

    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-mine',
        onboardingNumber: 'ONB-2026-000401',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        csOwnerAdminId: agentA.id,
        ownerAdminId: agentA.id,
      },
    });
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-other',
        onboardingNumber: 'ONB-2026-000402',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-b',
        customerId: 'cust-b',
        csOwnerAdminId: agentB.id,
        ownerAdminId: agentB.id,
      },
    });

    const mine = await getOnboardingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
    });
    expect(mine.ok).toBe(true);
    expect(mine.count).toBe(1);
    expect(mine.projects.every((p) => p.id === 'onb-mine')).toBe(true);
    expect(mine.projects.some((p) => p.id === 'onb-other')).toBe(false);

    // JSON-only ownerAssignments without column pins must not appear in My Work query
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-json-only',
        onboardingNumber: 'ONB-2026-000403',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-c',
        customerId: 'cust-c',
        ownerAssignmentsJson: { csOwnerAdminId: agentA.id, ownerAdminId: agentA.id },
        // intentionally omit csOwnerAdminId / ownerAdminId columns
      },
    });
    const afterJsonOnly = await getOnboardingMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
    });
    expect(afterJsonOnly.projects.some((p) => p.id === 'onb-json-only')).toBe(false);
    expect(afterJsonOnly.count).toBe(1);
  });

  it('search excludes inaccessible ONB and never returns migration file contents or credentials', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');

    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-vis',
        onboardingNumber: 'ONB-2026-000410',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-1',
        csOwnerAdminId: agentA.id,
        migrationFileContents: 'SECRET_FILE_BLOB',
        mraCredentials: { user: 'x', password: 'y' },
      },
    });
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-hid',
        onboardingNumber: 'ONB-2026-000411',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-2',
        csOwnerAdminId: 'cs-agent-b',
      },
    });

    // Agent without Super Admin — portfolio scoped to owned tenant only via stub scope
    const scoped = await searchOnboardingIndex(prisma, {
      admin: agentA,
      query: 'ONB-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    const ids = (scoped.results || []).map((r) => r.id);
    expect(ids).toContain('onb-vis');
    expect(ids).not.toContain('onb-hid');
    const payload = JSON.stringify(scoped.results);
    expect(payload).not.toMatch(/SECRET_FILE_BLOB|password|mraCredentials/i);

    // Fail closed: omitted / empty portfolio scope must never return all tenants for CS agents
    const omitted = await searchOnboardingIndex(prisma, {
      admin: agentA,
      query: 'ONB-2026',
    });
    expect(omitted.ok).toBe(true);
    expect(omitted.results).toEqual([]);
    expect(omitted.meta?.failClosed || omitted.reason).toBeTruthy();
    expect((omitted.results || []).map((r) => r.id)).not.toContain('onb-hid');
    expect((omitted.results || []).map((r) => r.id)).not.toContain('onb-vis');

    const emptyScope = await searchOnboardingIndex(prisma, {
      admin: agentA,
      query: 'ONB-2026',
      portfolioTenantIds: [],
    });
    expect(emptyScope.ok).toBe(true);
    expect(emptyScope.results).toEqual([]);
    expect(emptyScope.meta?.failClosed).toBe(true);
  });

  it('export strips credentials and rechecks permission', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-exp',
        onboardingNumber: 'ONB-2026-000420',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        mraApiKey: 'sk-live-secret',
        credentialPassword: 'hunter2',
      },
    });

    const denied = await exportOnboardingReport(prisma, {
      admin: { id: 'no-perm', role: 'Viewer', permissions: {} },
      reportKey: 'overview',
      format: 'csv',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden || denied.error).toBeTruthy();

    const exported = await exportOnboardingReport(prisma, {
      admin,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exported.ok).toBe(true);
    const body = typeof exported.body === 'string' ? exported.body : JSON.stringify(exported.rows);
    expect(body).not.toMatch(/sk-live-secret|hunter2|credentialPassword|mraApiKey/i);
  });

  it('Phase 8 linked CsOnboardingRecord projects Project status — never invent COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const viewer = csViewerOnly();

    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-p8',
        onboardingNumber: 'ONB-2026-000430',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
      },
    });
    // Ambiguous multi-project same tenant — must NOT auto-link first match
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-p8-b',
        onboardingNumber: 'ONB-2026-000431',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-a',
      },
    });
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-p8-c',
        onboardingNumber: 'ONB-2026-000432',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-b',
      },
    });
    await prisma.csOnboardingRecord.create({
      data: {
        id: 'csob-1',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
        checklistKey: 'kickoff',
        status: 'COMPLETED', // historical free-text — must not invent completion via foundations
        completedAt: new Date('2026-01-01'),
        sourceNote: 'legacy',
      },
    });
    await prisma.csOnboardingRecord.create({
      data: {
        id: 'csob-orphan',
        tenantId: 'tenant-orphan',
        checklistKey: 'unknown-item',
        status: 'DONE',
      },
    });
    await prisma.csOnboardingRecord.create({
      data: {
        id: 'csob-ambiguous',
        tenantId: 'tenant-ambiguous',
        checklistKey: 'kickoff',
        status: 'COMPLETED',
      },
    });

    const viewDenied = await migratePhase8OnboardingRecords(prisma, {
      admin: viewer,
      actorContext: { admin: viewer },
    });
    expect(viewDenied.ok).toBe(false);
    expect(viewDenied.forbidden).toBe(true);

    const migrated = await migratePhase8OnboardingRecords(prisma, {
      admin,
      actorContext: { admin },
    });
    expect(migrated.ok).toBe(true);
    expect(migrated.linked).toBeGreaterThanOrEqual(1);
    expect(migrated.explicitMatchOnly).toBe(true);

    const linked = prisma._csOnboardingStore.find((r) => r.id === 'csob-1');
    expect(linked.onboardingProjectId).toBe('onb-p8');

    const orphan = prisma._csOnboardingStore.find((r) => r.id === 'csob-orphan');
    expect(orphan.onboardingProjectId == null || orphan.migrationStatus === 'UNKNOWN').toBe(true);
    expect(orphan.status).not.toBe('COMPLETED'); // migrate must not invent COMPLETED on orphan

    const ambiguous = prisma._csOnboardingStore.find((r) => r.id === 'csob-ambiguous');
    expect(ambiguous.onboardingProjectId).toBeFalsy();
    expect(ambiguous.migrationStatus).toBe('UNKNOWN');

    const foundation = await getFoundationStatus(prisma, {
      admin,
      kind: 'onboarding',
      tenantId: 'tenant-p8',
    });
    expect(foundation.ok).toBe(true);
    const item = foundation.items?.find((i) => i.id === 'csob-1');
    expect(item).toBeTruthy();
    expect(item.projectedFromProject).toBe(true);
    expect(item.status).toBe('IN_PROGRESS');
    expect(item.status).not.toBe('COMPLETED');

    // Broken link: onboardingProjectId set but Project missing — never invent COMPLETED
    await prisma.csOnboardingRecord.create({
      data: {
        id: 'csob-broken-link',
        tenantId: 'tenant-p8',
        checklistKey: 'orphan-link',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-02'),
        onboardingProjectId: 'onb-does-not-exist',
        migrationStatus: 'UNKNOWN',
      },
    });
    const foundationBroken = await getFoundationStatus(prisma, {
      admin,
      kind: 'onboarding',
      tenantId: 'tenant-p8',
    });
    const broken = foundationBroken.items?.find((i) => i.id === 'csob-broken-link');
    expect(broken).toBeTruthy();
    expect(broken.linkBroken).toBe(true);
    expect(broken.projectedFromProject).toBe(false);
    expect(broken.status).not.toBe('COMPLETED');
    expect(['UNKNOWN', 'NOT_INSTRUMENTED', 'LINK_BROKEN']).toContain(broken.status);
    expect(broken.completedAt).toBeNull();

    // Helper alias still available
    const viaHelper = await getFoundationStatusWithProject(prisma, {
      admin,
      kind: 'onboarding',
      tenantId: 'tenant-p8',
    });
    expect(viaHelper.items?.find((i) => i.id === 'csob-1')?.status).toBe('IN_PROGRESS');
  });

  it('EN i18n keys for onboarding surfaces resolve (smoke)', () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/en/admin-pages.json'), 'utf8')
    );
    const ny = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/ny/admin-pages.json'), 'utf8')
    );
    const keys = [
      'customerSuccess.onboardingHub.title',
      'customerSuccess.onboardingHub.overview',
      'customerSuccess.onboardingHub.myWork',
      'customerSuccess.onboardingHub.queues',
      'customerSuccess.onboardingHub.reports',
      'customerSuccess.onboardingHub.contextBar',
    ];
    for (const path of keys) {
      const parts = path.split('.');
      let nodeEn = en;
      let nodeNy = ny;
      for (const p of parts) {
        nodeEn = nodeEn?.[p];
        nodeNy = nodeNy?.[p];
      }
      expect(typeof nodeEn).toBe('string');
      expect(nodeEn.length).toBeGreaterThan(0);
      expect(typeof nodeNy).toBe('string');
      expect(nodeNy.length).toBeGreaterThan(0);
    }
  });

  it('completion certificate still idempotent after Wave 4', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const project = await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-w4-cert',
        onboardingNumber: 'ONB-2026-000440',
        status: 'COMPLETION_PENDING',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        templateVersionId: 'tmplv-1',
      },
    });
    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        status: 'READY',
        customerSignOffAt: new Date('2026-09-15T12:00:00Z'),
        customerSignOffByContactId: 'contact-1',
        internalSignOffAt: new Date('2026-09-15T13:00:00Z'),
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingMigration.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        reconciliationStatus: 'PASSED',
      },
    });
    await prisma.customerOnboardingGoLive.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        outcome: 'SUCCESSFUL',
      },
    });
    await prisma.customerOnboardingStabilisation.create({
      data: {
        projectId: project.id,
        status: 'EXITED',
        exitApprovedAt: new Date('2026-09-14T10:00:00Z'),
        createdByAdminId: admin.id,
      },
    });

    const args = {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:onb-w4-cert:1',
    };
    const first = await issueCompletionCertificate(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.certificate.checksumSha256).toMatch(/^[a-f0-9]{64}$/i);

    const second = await issueCompletionCertificate(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.certificate.id).toBe(first.certificate.id);
    expect(second.certificate.checksumSha256).toBe(first.certificate.checksumSha256);
    expect(prisma._certificateStore.length).toBe(1);

    expect(getOnboardingDomainContract().inventZeroesForbidden).toBe(true);
    expect(getOnboardingDomainContract().wave).toBeGreaterThanOrEqual(4);
  });
});
