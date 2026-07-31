/**
 * Phase 21 Wave 4 — UI / metrics / reliability / DQ / recon / Phase 22 pack / exit.
 *
 * Hardens tree-17 Wave 4 for PRD 21:
 * - Gate fail → UNAVAILABLE / value null (never false zero)
 * - Search/export/DQ/recon fail-closed + tenant/portfolio scoped
 * - Never invent lineageIntact:true
 * - Progress ≠ readiness ≠ completion; completion ≠ adoption
 * - Phase 22 pack honest (tree-18 Training = PRD 22; not Adoption Phase 20)
 * - Exit READY_FOR_PHASE_22_WITH_BLOCKERS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyOnboardingReportHonesty,
  ONBOARDING_REPORT_STATUS,
  getOnboardingMetric,
  getOnboardingOverviewCards,
  searchOnboardingIndex,
  exportOnboardingReport,
  runOnboardingDataQuality,
  runOnboardingReconciliation,
  getOnboardingStatusLabelHonesty,
  getOnboardingDomainContract,
  ONBOARDING_HUB_ROUTES,
  calculateOnboardingProgress,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-p21-w4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csAgent(id = 'cs-agent-p21-w4') {
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
      return store.find((r) => {
        if (where.id && r.id !== where.id) return false;
        if (where.projectId && r.projectId !== where.projectId) return false;
        if (where.tenantId && r.tenantId !== where.tenantId) return false;
        return true;
      }) || null;
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
      if (where.OR) {
        rows = rows.filter((r) =>
          where.OR.some((clause) => {
            if (clause.onboardingNumber?.contains) {
              return String(r.onboardingNumber || '').includes(
                clause.onboardingNumber.contains
              );
            }
            if (clause.requestNumber?.contains) {
              return String(r.requestNumber || '').includes(
                clause.requestNumber.contains
              );
            }
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
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const projectStore = overrides._projectStore || [];
  const requestStore = overrides._requestStore || [];
  const prisma = {
    _projectStore: projectStore,
    _requestStore: requestStore,
    customerOnboardingProject: makeStoreCrud(projectStore, 'onb'),
    customerOnboardingRequest: makeStoreCrud(requestStore, 'onr'),
  };
  return prisma;
}

describe('Phase 21 Wave 4 — metrics / reliability / scope / Phase 22 exit', () => {
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
    expect(cards.status || cards.cards?.inProgress?.status).toBe(
      ONBOARDING_REPORT_STATUS.UNAVAILABLE
    );
    expect(cards.cards?.inProgress?.value ?? null).toBeNull();
    expect(cards.cards?.inProgress?.value).not.toBe(0);
  });

  it('metrics / search / export / DQ / recon fail-closed without portfolio scope', async () => {
    const prisma = makePrisma();
    const agent = csAgent();

    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-owned',
        onboardingNumber: 'ONB-2026-000501',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        csOwnerAdminId: agent.id,
      },
    });
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-other',
        onboardingNumber: 'ONB-2026-000502',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        csOwnerAdminId: 'other-agent',
      },
    });
    await prisma.customerOnboardingRequest.create({
      data: {
        id: 'onr-owned',
        requestNumber: 'ONR-2026-000501',
        status: 'ACCEPTED',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });

    const unscopedMetric = await getOnboardingMetric(prisma, {
      admin: agent,
      metric: 'project_count',
    });
    expect(unscopedMetric.value).toBeNull();
    expect(unscopedMetric.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(unscopedMetric.meta?.failClosed || unscopedMetric.reason).toBeTruthy();

    const scopedMetric = await getOnboardingMetric(prisma, {
      admin: agent,
      metric: 'project_count',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(scopedMetric.ok).toBe(true);
    expect(scopedMetric.value).toBe(1);

    const searchClosed = await searchOnboardingIndex(prisma, {
      admin: agent,
      query: 'ONB-2026',
    });
    expect(searchClosed.ok).toBe(true);
    expect(searchClosed.results).toEqual([]);
    expect(searchClosed.meta?.failClosed || searchClosed.reason).toBeTruthy();

    const searchScoped = await searchOnboardingIndex(prisma, {
      admin: agent,
      query: 'ONB-2026',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(searchScoped.ok).toBe(true);
    const ids = (searchScoped.results || []).map((r) => r.id);
    expect(ids).toContain('onb-owned');
    expect(ids).not.toContain('onb-other');

    const exportClosed = await exportOnboardingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exportClosed.ok).toBe(true);
    expect(exportClosed.rows).toEqual([]);
    expect(exportClosed.meta?.failClosed || exportClosed.reason).toBeTruthy();

    const exportScoped = await exportOnboardingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportScoped.ok).toBe(true);
    expect(exportScoped.rows).toHaveLength(1);
    expect(exportScoped.rows[0].id).toBe('onb-owned');
    const exportBody =
      typeof exportScoped.body === 'string'
        ? exportScoped.body
        : JSON.stringify(exportScoped.rows);
    expect(exportBody).not.toMatch(/password|credential|secret|apiKey/i);

    prisma.customerOnboardingProject.findMany.mockRejectedValueOnce(
      new Error('onboarding_export_db_down')
    );
    const exportQueryFail = await exportOnboardingReport(prisma, {
      admin: agent,
      reportKey: 'overview',
      format: 'csv',
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(exportQueryFail.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(exportQueryFail.ok).toBe(false);
    expect(exportQueryFail.rows).toBeNull();
    expect(exportQueryFail.body).toBeNull();
    expect(exportQueryFail.rows).not.toEqual([]);

    const dqClosed = await runOnboardingDataQuality(prisma, { admin: agent });
    expect(dqClosed.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(dqClosed.checks).toBeNull();
    expect(dqClosed.meta?.failClosed || dqClosed.reason).toBeTruthy();

    const dqScoped = await runOnboardingDataQuality(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(dqScoped.ok).toBe(true);
    expect(dqScoped.status).toBe(ONBOARDING_REPORT_STATUS.READY);
    expect(dqScoped.checks.totalProjects).toBe(1);
    expect(dqScoped.checks.blockingDq).toBeNull();
    expect(dqScoped.checks.blockingDq).not.toBe(false);

    const reconClosed = await runOnboardingReconciliation(prisma, { admin: agent });
    expect(reconClosed.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(reconClosed.cards).toBeNull();
    expect(reconClosed.meta?.failClosed || reconClosed.reason).toBeTruthy();

    const reconScoped = await runOnboardingReconciliation(prisma, {
      admin: agent,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(reconScoped.ok).toBe(true);
    expect(reconScoped.status).toBe(ONBOARDING_REPORT_STATUS.READY);
    expect(reconScoped.cards.projects).toBe(1);
    expect(reconScoped.cards.lineageIntact).toBeNull();
    expect(reconScoped.cards.lineageIntact).not.toBe(true);

    // Missing request model → UNAVAILABLE / totalRequests null — never invent 0.
    const noRequestPrisma = makePrisma();
    delete noRequestPrisma.customerOnboardingRequest;
    await noRequestPrisma.customerOnboardingProject.create({
      data: {
        id: 'onb-dq-only',
        onboardingNumber: 'ONB-2026-000510',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
      },
    });
    const dqNoRequest = await runOnboardingDataQuality(noRequestPrisma, {
      admin: superAdmin(),
    });
    expect(dqNoRequest.status).toBe(ONBOARDING_REPORT_STATUS.UNAVAILABLE);
    expect(dqNoRequest.checks?.totalRequests).toBeNull();
    expect(dqNoRequest.checks?.totalRequests).not.toBe(0);
    expect(dqNoRequest.honesty?.falseZeroes).toBe(false);
  });

  it('progress ≠ readiness ≠ completion; completion ≠ adoption', async () => {
    const label = getOnboardingStatusLabelHonesty({
      progressPercent: 80,
      readinessStatus: 'READY',
      completionStatus: 'COMPLETED',
    });
    expect(label.progressEqualsReadiness).toBe(false);
    expect(label.progressEqualsCompletion).toBe(false);
    expect(label.readinessEqualsCompletion).toBe(false);
    expect(label.completionEqualsAdoption).toBe(false);
    expect(label.isAdoption).toBe(false);
    expect(label.label).toMatch(
      /progress.*not.*completion|not_adoption|not_readiness/i
    );

    const prisma = makePrisma();
    const admin = superAdmin();
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-prog',
        onboardingNumber: 'ONB-2026-000520',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-1',
        customerId: 'cust-1',
      },
    });
    // Stub load path via findUnique
    prisma.customerOnboardingProject.findUnique = vi.fn(async ({ where }) =>
      prisma._projectStore.find((r) => r.id === where.id) || null
    );
    prisma.customerOnboardingTask = {
      findMany: vi.fn(async () => [
        { id: 't1', projectId: 'onb-prog', status: 'COMPLETED' },
        { id: 't2', projectId: 'onb-prog', status: 'OPEN' },
      ]),
    };
    prisma.customerOnboardingMilestone = {
      findMany: vi.fn(async () => []),
    };

    const progress = await calculateOnboardingProgress(prisma, {
      admin,
      actorContext: { admin },
      projectId: 'onb-prog',
    });
    expect(progress.ok).toBe(true);
    expect(progress.complete).toBe(false);
    expect(progress.isComplete).toBe(false);
    expect(progress.isReadiness).toBe(false);
    expect(progress.isAdoption).toBe(false);
    expect(progress.percent).toBeLessThan(100);

    const contract = getOnboardingDomainContract();
    expect(contract.phase).toBe(21);
    expect(contract.prdPhase).toBe(21);
    expect(contract.treePhaseAlias).toBe(17);
    expect(contract.progressEqualsCompletionForbidden).toBe(true);
    expect(contract.completionEqualsAdoptionForbidden).toBe(true);
    expect(ONBOARDING_HUB_ROUTES.overview).toMatch(/customer-success\/onboarding/);
  });

  it('EN + NY i18n keys for onboarding honesty resolve (smoke)', () => {
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
      'customerSuccess.onboardingHub.progressNotReadiness',
      'customerSuccess.onboardingHub.progressNotCompletion',
      'customerSuccess.onboardingHub.completionNotAdoption',
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
    expect(en.customerSuccess.onboardingHub.progressNotCompletion.toLowerCase()).toMatch(
      /not .*complet/
    );
    expect(en.customerSuccess.onboardingHub.completionNotAdoption.toLowerCase()).toMatch(
      /not .*adopt/
    );
  });

  it('Phase 22 pack present with READY_FOR_PHASE_22_WITH_BLOCKERS', () => {
    const base = join(process.cwd(), 'docs/admin-intelligence-crm/phase-21');
    const inputs = join(base, 'PHASE_22_INPUTS.md');
    const checklist = join(base, 'PHASE_22_READINESS_CHECKLIST.md');
    const finalReport = join(base, 'FINAL_PHASE_21_REPORT.md');
    const decision = join(base, 'FINAL_READINESS_DECISION.md');
    for (const p of [inputs, checklist, finalReport, decision]) {
      expect(existsSync(p)).toBe(true);
    }
    const decisionBody = readFileSync(decision, 'utf8');
    expect(decisionBody).toMatch(/READY_FOR_PHASE_22_WITH_BLOCKERS/);
    const inputsBody = readFileSync(inputs, 'utf8');
    expect(inputsBody).toMatch(/blocker|carry/i);
    expect(inputsBody).toMatch(/training.?handoff|PHASE_22/i);
    expect(inputsBody).toMatch(/tree-18|phase-18|PRD\s*22|FUTURE/i);
    expect(inputsBody).toMatch(/MISLABELLED_ONBOARDING_ARTIFACT_AUDIT|mislabel/i);
    expect(inputsBody).toMatch(/do not claim Adoption|not Adoption|≠ Adoption|≠ adoption/i);
    // Must not affirmatively label Training as Adoption Phase 20.
    expect(inputsBody).not.toMatch(
      /Training\s*=\s*Adoption Phase 20|Adoption Phase 20\s*=\s*PRD\s*22/i
    );
    const reportBody = readFileSync(finalReport, 'utf8');
    expect(reportBody).toMatch(/READY_FOR_PHASE_22_WITH_BLOCKERS/);
    const checklistBody = readFileSync(checklist, 'utf8');
    expect(checklistBody).toMatch(/READY_FOR_PHASE_22_WITH_BLOCKERS/);
  });

  it('thin onboarding overview hub remains real (no fake dashboard)', () => {
    const overview = join(
      process.cwd(),
      'app/insightbooks/customer-success/onboarding/page.js'
    );
    expect(existsSync(overview)).toBe(true);
    const body = readFileSync(overview, 'utf8');
    expect(body).toMatch(/getOnboardingOverviewCards|UNAVAILABLE|null/);
    expect(body).toMatch(/Phase 21|PRD 21|prdPhase/i);
    expect(body).toMatch(/No fake dashboard/i);
    expect(body).toMatch(/never invents? zeroes?/i);
  });
});
