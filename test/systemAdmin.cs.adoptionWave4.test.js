/**
 * Phase 19 Wave 4 — UI hubs, metrics/reliability, DQ/recon, Phase 8 reconcile, Phase 20 pack.
 * Gate fail → UNAVAILABLE / value: null (never false zero).
 * Portfolio My Work excludes other CS owners; search excludes inaccessible ADR/ADP;
 * export/DQ/recon fail-closed; never invent totalRequests:0 / lineageIntact:true;
 * Phase 8 foundations broken link ≠ COMPLETED; EN+NY adoptionHub; Phase 20 WITH_BLOCKERS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyAdoptionReportHonesty,
  ADOPTION_REPORT_STATUS,
  getAdoptionMetric,
  getAdoptionOverviewCards,
  getAdoptionMyWork,
  getAdoptionLineage,
  searchAdoptionIndex,
  exportAdoptionReport,
  runAdoptionDataQuality,
  runAdoptionReconciliation,
  migratePhase8SuccessPlans,
  getFoundationStatusWithPlan,
  getAdoptionDomainContract,
  listAdoptionPlans,
} from '@/lib/admin/customerSuccess/adoption';
import { getFoundationStatus } from '@/lib/admin/customerSuccess/foundations.js';

function superAdmin(id = 'super-adp-4') {
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
      if (where.planNumber) {
        return store.find((r) => r.planNumber === where.planNumber) || null;
      }
      if (where.requestNumber) {
        return store.find((r) => r.requestNumber === where.requestNumber) || null;
      }
      if (where.idempotencyKey) {
        return store.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.planId) rows = rows.filter((r) => r.planId === where.planId);
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.adoptionPlanId === null) {
        rows = rows.filter((r) => r.adoptionPlanId == null);
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.tenantId) {
        if (where.tenantId.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
      }
      if (where.customerId) rows = rows.filter((r) => r.customerId === where.customerId);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.planId) {
        if (where.planId.in) {
          rows = rows.filter((r) => where.planId.in.includes(r.planId));
        } else {
          rows = rows.filter((r) => r.planId === where.planId);
        }
      }
      if (where.adoptionPlanId === null) {
        rows = rows.filter((r) => r.adoptionPlanId == null);
      }
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.planNumber?.contains) {
              return String(r.planNumber || '').includes(clause.planNumber.contains);
            }
            if (clause.requestNumber?.contains) {
              return String(r.requestNumber || '').includes(clause.requestNumber.contains);
            }
            if (clause.id?.contains) {
              return String(r.id || '').includes(clause.id.contains);
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
  const planStore = overrides._planStore || [];
  const requestStore = overrides._requestStore || [];
  const expansionStore = overrides._expansionStore || [];
  const csSuccessPlanStore = overrides._csSuccessPlanStore || [];
  const seqStore = overrides._seqStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _planStore: planStore,
    _requestStore: requestStore,
    _expansionStore: expansionStore,
    _csSuccessPlanStore: csSuccessPlanStore,
    _seqStore: seqStore,
    crmNumberSeq: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => {
        seqStore.push(data);
        return data;
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    customerAdoptionPlan: {
      ...makeStoreCrud(planStore, 'adp'),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adp-${planStore.length + 1}`,
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        planStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return planStore.find((r) => r.id === where.id) || null;
        if (where.planNumber) {
          return planStore.find((r) => r.planNumber === where.planNumber) || null;
        }
        return null;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...planStore];
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
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...planStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.customerId) rows = rows.filter((r) => r.customerId === where.customerId);
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.planNumber?.contains) {
                return String(r.planNumber || '').includes(clause.planNumber.contains);
              }
              if (clause.csOwnerAdminId) return r.csOwnerAdminId === clause.csOwnerAdminId;
              if (clause.ownerAdminId) return r.ownerAdminId === clause.ownerAdminId;
              return false;
            })
          );
        }
        return rows;
      }),
    },
    customerAdoptionRequest: {
      ...makeStoreCrud(requestStore, 'adr'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
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
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        return rows.length;
      }),
    },
    customerAdoptionExpansionHandoff: {
      ...makeStoreCrud(expansionStore, 'xph'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...expansionStore];
        if (where.planId) {
          if (where.planId.in) {
            rows = rows.filter((r) => where.planId.in.includes(r.planId));
          } else {
            rows = rows.filter((r) => r.planId === where.planId);
          }
        }
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.id?.contains) {
                return String(r.id || '').includes(clause.id.contains);
              }
              return false;
            })
          );
        }
        return rows;
      }),
    },
    csSuccessPlan: {
      ...makeStoreCrud(csSuccessPlanStore, 'csp'),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...csSuccessPlanStore];
        if (where.tenantId) {
          if (where.tenantId.in) {
            rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
          } else {
            rows = rows.filter((r) => r.tenantId === where.tenantId);
          }
        }
        if (where.adoptionPlanId === null) {
          rows = rows.filter((r) => r.adoptionPlanId == null);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = csSuccessPlanStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
  };

  return prisma;
}

describe('Phase 19 Wave 4 — metrics / reliability / hubs / Phase 8 / Phase 20', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reliability gate fail → UNAVAILABLE / value null — never false zero', async () => {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.customerAdoptionPlan.count = vi.fn(async () => {
      throw new Error('db down');
    });

    const metric = await getAdoptionMetric(broken, {
      admin: superAdmin(),
      metric: 'plan_count',
    });
    expect(metric.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);

    const cards = await getAdoptionOverviewCards(broken, {
      admin: superAdmin(),
    });
    expect(cards.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    const values = Object.values(cards.cards || {}).map((c) => c?.value);
    for (const v of values) {
      expect(v).not.toBe(0);
      expect(v === null || v === undefined).toBe(true);
    }
  });

  it('metrics/overview counts are portfolio-scoped (not global) for CS agents', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-agent-metrics');

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-m-owned',
        planNumber: 'ADP-2026-000450',
        status: 'ACTIVE',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-m-other',
        planNumber: 'ADP-2026-000451',
        status: 'ACTIVE',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'cs-agent-b',
      },
    });

    const unscoped = await getAdoptionMetric(prisma, {
      admin: agent,
      metric: 'plan_count',
    });
    expect(unscoped.value).toBeNull();
    expect(unscoped.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(unscoped.meta?.failClosed || unscoped.reason).toBeTruthy();

    const scoped = await getAdoptionMetric(prisma, {
      admin: agent,
      metric: 'plan_count',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    expect(scoped.value).toBe(1);

    const cards = await getAdoptionOverviewCards(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(cards.ok).toBe(true);
    expect(cards.cards.active.value).toBe(1);

    const listDenied = await listAdoptionPlans(prisma, {
      admin: agent,
    });
    expect(listDenied.ok).toBe(true);
    expect(listDenied.plans).toEqual([]);
    expect(listDenied.meta?.failClosed || listDenied.reason).toBeTruthy();
  });

  it('My Work portfolio scope excludes other CS owner plans', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');
    const agentB = csAgent('cs-agent-b');

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-mine',
        planNumber: 'ADP-2026-000401',
        status: 'ACTIVE',
        tenantId: 'tenant-a',
        customerId: 'cust-a',
        csOwnerAdminId: agentA.id,
        ownerAdminId: agentA.id,
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-other',
        planNumber: 'ADP-2026-000402',
        status: 'ACTIVE',
        tenantId: 'tenant-b',
        customerId: 'cust-b',
        csOwnerAdminId: agentB.id,
        ownerAdminId: agentB.id,
      },
    });

    const closed = await getAdoptionMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
    });
    expect(closed.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(closed.count).toBeNull();
    expect(closed.meta?.failClosed || closed.reason).toBeTruthy();

    const mine = await getAdoptionMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
    });
    expect(mine.ok).toBe(true);
    expect(mine.count).toBe(1);
    expect(mine.plans.every((p) => p.id === 'adp-mine')).toBe(true);
    expect(mine.plans.some((p) => p.id === 'adp-other')).toBe(false);

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-json-only',
        planNumber: 'ADP-2026-000403',
        status: 'ACTIVE',
        tenantId: 'tenant-c',
        customerId: 'cust-c',
        ownerAssignmentsJson: { csOwnerAdminId: agentA.id, ownerAdminId: agentA.id },
      },
    });
    const afterJsonOnly = await getAdoptionMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-a', 'tenant-b', 'tenant-c'],
    });
    expect(afterJsonOnly.plans.some((p) => p.id === 'adp-json-only')).toBe(false);
    expect(afterJsonOnly.count).toBe(1);

    const crossPortfolio = await getAdoptionMyWork(prisma, {
      admin: agentA,
      actorContext: { admin: agentA },
      portfolioTenantIds: ['tenant-other-only'],
    });
    expect(crossPortfolio.ok).toBe(true);
    expect(crossPortfolio.count).toBe(0);
    expect(crossPortfolio.plans).toEqual([]);
  });

  it('search excludes inaccessible ADR/ADP and never returns secrets/tokens', async () => {
    const prisma = makePrisma();
    const agentA = csAgent('cs-agent-a');

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-vis',
        planNumber: 'ADP-2026-000410',
        status: 'ACTIVE',
        tenantId: 'tenant-owned',
        customerId: 'cust-1',
        csOwnerAdminId: agentA.id,
        accessToken: 'tok-secret-xyz',
        secretNote: 'SECRET_NOTE',
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-hid',
        planNumber: 'ADP-2026-000411',
        status: 'ACTIVE',
        tenantId: 'tenant-other',
        customerId: 'cust-2',
        csOwnerAdminId: 'cs-agent-b',
      },
    });
    await prisma.customerAdoptionRequest.create({
      data: {
        id: 'adr-vis',
        requestNumber: 'ADR-2026-000410',
        status: 'NEW',
        tenantId: 'tenant-owned',
        customerId: 'cust-1',
      },
    });
    await prisma.customerAdoptionRequest.create({
      data: {
        id: 'adr-hid',
        requestNumber: 'ADR-2026-000411',
        status: 'NEW',
        tenantId: 'tenant-other',
        customerId: 'cust-2',
      },
    });

    const scoped = await searchAdoptionIndex(prisma, {
      admin: agentA,
      query: 'ADP-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scoped.ok).toBe(true);
    const ids = (scoped.results || []).map((r) => r.id);
    expect(ids).toContain('adp-vis');
    expect(ids).not.toContain('adp-hid');
    const payload = JSON.stringify(scoped.results);
    expect(payload).not.toMatch(/tok-secret|SECRET_NOTE|accessToken|secretNote/i);

    const omitted = await searchAdoptionIndex(prisma, {
      admin: agentA,
      query: 'ADP-2026',
    });
    expect(omitted.ok).toBe(true);
    expect(omitted.results).toEqual([]);
    expect(omitted.meta?.failClosed || omitted.reason).toBeTruthy();

    const emptyScope = await searchAdoptionIndex(prisma, {
      admin: agentA,
      query: 'ADP-2026',
      portfolioTenantIds: [],
    });
    expect(emptyScope.ok).toBe(true);
    expect(emptyScope.results).toEqual([]);
    expect(emptyScope.meta?.failClosed).toBe(true);

    // Expansion handoff search scoped via planId → plan.tenantId
    await prisma.customerAdoptionExpansionHandoff.create({
      data: {
        id: 'xph-vis-handoff',
        planId: 'adp-vis',
        status: 'HANDED_OFF',
      },
    });
    await prisma.customerAdoptionExpansionHandoff.create({
      data: {
        id: 'xph-hid-handoff',
        planId: 'adp-hid',
        status: 'HANDED_OFF',
      },
    });
    await prisma.customerAdoptionExpansionHandoff.create({
      data: {
        id: 'xph-orphan-handoff',
        planId: null,
        status: 'DRAFT',
      },
    });

    const handoffScoped = await searchAdoptionIndex(prisma, {
      admin: agentA,
      query: 'xph-',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(handoffScoped.ok).toBe(true);
    const handoffIds = (handoffScoped.results || []).map((r) => r.id);
    expect(handoffIds).toContain('xph-vis-handoff');
    expect(handoffIds).not.toContain('xph-hid-handoff');
    expect(handoffIds).not.toContain('xph-orphan-handoff');

    const handoffUnscoped = await searchAdoptionIndex(prisma, {
      admin: agentA,
      query: 'xph-',
    });
    expect(handoffUnscoped.ok).toBe(true);
    expect(handoffUnscoped.results).toEqual([]);
    expect(handoffUnscoped.meta?.failClosed || handoffUnscoped.reason).toBeTruthy();
  });

  it('export / DQ / recon apply portfolio scope; DQ never invents request zero', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-agent-export-dq');

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-exp-owned',
        planNumber: 'ADP-2026-000460',
        status: 'ACTIVE',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
        accessToken: 'tok-export-secret',
        secretNote: 'SECRET_ANSWER_EXPORT',
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-exp-other',
        planNumber: 'ADP-2026-000461',
        status: 'ACTIVE',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'cs-agent-b',
      },
    });
    await prisma.customerAdoptionRequest.create({
      data: {
        id: 'adr-owned',
        requestNumber: 'ADR-2026-000460',
        status: 'NEW',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    await prisma.customerAdoptionRequest.create({
      data: {
        id: 'adr-other',
        requestNumber: 'ADR-2026-000461',
        status: 'NEW',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const exportClosed = await exportAdoptionReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exportClosed.ok).toBe(true);
    expect(exportClosed.rows).toEqual([]);
    expect(exportClosed.meta?.failClosed || exportClosed.reason).toBeTruthy();

    const exportScoped = await exportAdoptionReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportScoped.ok).toBe(true);
    expect(exportScoped.rows).toHaveLength(1);
    expect(exportScoped.rows[0].id).toBe('adp-exp-owned');
    expect(exportScoped.rows.some((r) => r.id === 'adp-exp-other')).toBe(false);
    const exportBody =
      typeof exportScoped.body === 'string'
        ? exportScoped.body
        : JSON.stringify(exportScoped.rows);
    expect(exportBody).not.toMatch(
      /SECRET_ANSWER|tok-export|accessToken|secretNote/i
    );

    // findMany failure → UNAVAILABLE — never empty success / false-empty portfolio.
    prisma.customerAdoptionPlan.findMany.mockRejectedValueOnce(
      new Error('adoption_export_db_down')
    );
    const exportQueryFail = await exportAdoptionReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportQueryFail.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(exportQueryFail.ok).toBe(false);
    expect(exportQueryFail.rows).toBeNull();
    expect(exportQueryFail.body).toBeNull();
    expect(exportQueryFail.rows).not.toEqual([]);
    expect(
      exportQueryFail.reason || exportQueryFail.error
    ).toMatch(/export_query_failed|adoption_export_query_failed/);

    const dqClosed = await runAdoptionDataQuality(prisma, { admin: agent });
    expect(dqClosed.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(dqClosed.checks).toBeNull();
    expect(dqClosed.meta?.failClosed || dqClosed.reason).toBeTruthy();

    const dqScoped = await runAdoptionDataQuality(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(dqScoped.ok).toBe(true);
    expect(dqScoped.status).toBe(ADOPTION_REPORT_STATUS.READY);
    expect(dqScoped.checks.totalPlans).toBe(1);
    expect(dqScoped.checks.totalRequests).toBe(1);

    const reconClosed = await runAdoptionReconciliation(prisma, { admin: agent });
    expect(reconClosed.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(reconClosed.cards).toBeNull();
    expect(reconClosed.meta?.failClosed || reconClosed.reason).toBeTruthy();

    const reconScoped = await runAdoptionReconciliation(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(reconScoped.ok).toBe(true);
    expect(reconScoped.status).toBe(ADOPTION_REPORT_STATUS.READY);
    expect(reconScoped.cards.plans).toBe(1);
    expect(reconScoped.cards.lineageIntact).toBeNull();
    expect(reconScoped.cards.lineageIntact).not.toBe(true);
    expect(dqScoped.checks.blockingDq).toBeNull();
    expect(dqScoped.checks.blockingDq).not.toBe(false);

    // Missing request model → UNAVAILABLE / totalRequests null — never invent 0.
    const noRequestPrisma = makePrisma();
    delete noRequestPrisma.customerAdoptionRequest;
    await noRequestPrisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-dq-only',
        planNumber: 'ADP-2026-000470',
        status: 'ACTIVE',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    const dqNoRequest = await runAdoptionDataQuality(noRequestPrisma, {
      admin: superAdmin(),
    });
    expect(dqNoRequest.status).toBe(ADOPTION_REPORT_STATUS.UNAVAILABLE);
    expect(dqNoRequest.checks?.totalRequests).toBeNull();
    expect(dqNoRequest.checks?.totalRequests).not.toBe(0);
    expect(dqNoRequest.honesty?.falseZeroes).toBe(false);
  });

  it('Phase 8 linked CsSuccessPlan projects Plan status — never invent COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const viewer = csViewerOnly();

    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-p8',
        planNumber: 'ADP-2026-000430',
        status: 'ACTIVE',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-p8-b',
        planNumber: 'ADP-2026-000431',
        status: 'ACTIVE',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-a',
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-p8-c',
        planNumber: 'ADP-2026-000432',
        status: 'ACTIVE',
        tenantId: 'tenant-ambiguous',
        customerId: 'cust-amb-b',
      },
    });
    await prisma.csSuccessPlan.create({
      data: {
        id: 'csp-1',
        tenantId: 'tenant-p8',
        customerId: 'cust-p8',
        title: 'Legacy success plan',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-01'),
        sourceNote: 'legacy',
      },
    });
    await prisma.csSuccessPlan.create({
      data: {
        id: 'csp-orphan',
        tenantId: 'tenant-orphan',
        title: 'Orphan plan',
        status: 'DONE',
      },
    });
    await prisma.csSuccessPlan.create({
      data: {
        id: 'csp-ambiguous',
        tenantId: 'tenant-ambiguous',
        title: 'Ambiguous',
        status: 'COMPLETED',
      },
    });

    const viewDenied = await migratePhase8SuccessPlans(prisma, {
      admin: viewer,
      actorContext: { admin: viewer },
    });
    expect(viewDenied.ok).toBe(false);
    expect(viewDenied.forbidden).toBe(true);

    const migrated = await migratePhase8SuccessPlans(prisma, {
      admin,
      actorContext: { admin },
    });
    expect(migrated.ok).toBe(true);
    expect(migrated.linked).toBeGreaterThanOrEqual(1);
    expect(migrated.explicitMatchOnly).toBe(true);

    const linked = prisma._csSuccessPlanStore.find((r) => r.id === 'csp-1');
    expect(linked.adoptionPlanId).toBe('adp-p8');

    const orphan = prisma._csSuccessPlanStore.find((r) => r.id === 'csp-orphan');
    expect(orphan.adoptionPlanId == null || orphan.migrationStatus === 'UNKNOWN').toBe(
      true
    );
    expect(orphan.status).not.toBe('COMPLETED');

    const ambiguous = prisma._csSuccessPlanStore.find((r) => r.id === 'csp-ambiguous');
    expect(ambiguous.adoptionPlanId).toBeFalsy();
    expect(ambiguous.migrationStatus).toBe('UNKNOWN');

    const foundation = await getFoundationStatus(prisma, {
      admin,
      kind: 'plans',
      tenantId: 'tenant-p8',
    });
    expect(foundation.ok).toBe(true);
    const item = foundation.items?.find((i) => i.id === 'csp-1');
    expect(item).toBeTruthy();
    expect(item.projectedFromPlan || item.projectedFromProgram).toBe(true);
    expect(item.status).toBe('ACTIVE');
    expect(item.status).not.toBe('COMPLETED');

    await prisma.csSuccessPlan.create({
      data: {
        id: 'csp-broken-link',
        tenantId: 'tenant-p8',
        title: 'Broken link',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-02'),
        adoptionPlanId: 'adp-does-not-exist',
        migrationStatus: 'UNKNOWN',
      },
    });
    const foundationBroken = await getFoundationStatus(prisma, {
      admin,
      kind: 'plans',
      tenantId: 'tenant-p8',
    });
    const broken = foundationBroken.items?.find((i) => i.id === 'csp-broken-link');
    expect(broken).toBeTruthy();
    expect(broken.linkBroken).toBe(true);
    expect(broken.projectedFromPlan || broken.projectedFromProgram).toBe(false);
    expect(broken.status).not.toBe('COMPLETED');
    expect(['UNKNOWN', 'NOT_INSTRUMENTED', 'LINK_BROKEN']).toContain(broken.status);
    expect(broken.completedAt).toBeNull();

    const viaHelper = await getFoundationStatusWithPlan(prisma, {
      admin,
      kind: 'plans',
      tenantId: 'tenant-p8',
    });
    expect(viaHelper.items?.find((i) => i.id === 'csp-1')?.status).toBe('ACTIVE');
    expect(getAdoptionDomainContract().phase).toBe(19);
  });

  it('EN + NY i18n keys for adoption surfaces resolve (smoke)', () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/en/admin-pages.json'), 'utf8')
    );
    const ny = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/ny/admin-pages.json'), 'utf8')
    );
    const keys = [
      'customerSuccess.adoptionHub.title',
      'customerSuccess.adoptionHub.overview',
      'customerSuccess.adoptionHub.myWork',
      'customerSuccess.adoptionHub.queues',
      'customerSuccess.adoptionHub.reports',
      'customerSuccess.adoptionHub.contextBar',
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

  it('Phase 20 pack present with READY_FOR_PHASE_20_WITH_BLOCKERS', () => {
    const base = join(process.cwd(), 'docs/admin-intelligence-crm/phase-19');
    const inputs = join(base, 'PHASE_20_INPUTS.md');
    const checklist = join(base, 'PHASE_20_READINESS_CHECKLIST.md');
    const finalReport = join(base, 'FINAL_PHASE_19_REPORT.md');
    const decision = join(base, 'FINAL_READINESS_DECISION.md');
    for (const p of [inputs, checklist, finalReport, decision]) {
      expect(existsSync(p)).toBe(true);
    }
    const decisionBody = readFileSync(decision, 'utf8');
    expect(decisionBody).toMatch(/READY_FOR_PHASE_20_WITH_BLOCKERS/);
    const inputsBody = readFileSync(inputs, 'utf8');
    expect(inputsBody).toMatch(/blocker|carry/i);
    const reportBody = readFileSync(finalReport, 'utf8');
    expect(reportBody).toMatch(/READY_FOR_PHASE_20_WITH_BLOCKERS/);
  });

  it('lineage is portfolio-scoped (fail-closed)', async () => {
    const prisma = makePrisma();
    const agent = csAgent('cs-lineage');
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-lin-owned',
        planNumber: 'ADP-2026-000480',
        status: 'ACTIVE',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        adoptionRequestId: 'adr-1',
        trainingProgramId: 'trn-1',
        onboardingHandoverId: 'handover-1',
      },
    });
    await prisma.customerAdoptionPlan.create({
      data: {
        id: 'adp-lin-other',
        planNumber: 'ADP-2026-000481',
        status: 'ACTIVE',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const denied = await getAdoptionLineage(prisma, {
      admin: agent,
      planId: 'adp-lin-other',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(denied.ok).toBe(false);
    expect(denied.error || denied.reason).toMatch(/out.?of.?scope|forbidden|denied/i);
    expect(denied.lineage).toBeNull();

    const ok = await getAdoptionLineage(prisma, {
      admin: agent,
      planId: 'adp-lin-owned',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(ok.ok).toBe(true);
    expect(ok.lineage.plan.id).toBe('adp-lin-owned');
    expect(ok.lineage.adoptionRequestId).toBe('adr-1');
    expect(ok.lineage.trainingProgramId).toBe('trn-1');
  });
});
