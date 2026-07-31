/**
 * Phase 20 Wave 4 — UI queues / metrics / reliability / DQ / recon / exports /
 * search / Phase 21 pack / exit.
 *
 * Mirror Training/Adoption Wave 4 fail-closed:
 * - Gate fail → UNAVAILABLE / value null (never false zero)
 * - Search/export/DQ/recon fail-closed for sales-team/territory/customer/tenant
 * - Never invent lineageIntact:true
 * - Closed-Won / accepted value ≠ collected/recognised Revenue
 * - Exit READY_FOR_PHASE_21_WITH_BLOCKERS + Phase 21 pack
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyConversionReportHonesty,
  getConversionMetric,
  getConversionReport,
  getConversionOverview,
  runConversionDataQuality,
  runConversionReconciliation,
  exportConversionReport,
  searchConversionIndex,
  getConversionValueLabelHonesty,
  getConversionDomainContract,
  CRM_CONVERSION_REPORT_STATUS,
  CRM_CONVERSION_HUB_ROUTES,
} from '@/lib/admin/crm';

function superAdmin(id = 'super-p20-w4') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.export': true,
      'systemAdmin.crm.reconciliation.run': true,
    },
  };
}

function salesRep(id = 'sales-rep-p20-w4') {
  return {
    id,
    role: 'Sales Rep',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.export': true,
    },
  };
}

function matchesWhere(row, where = {}) {
  if (!where || typeof where !== 'object') return true;
  if (where.AND) return where.AND.every((w) => matchesWhere(row, w));
  if (where.OR) return where.OR.some((w) => matchesWhere(row, w));
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR') continue;
    const val = row[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if (Array.isArray(cond.in)) {
        if (!cond.in.map(String).includes(String(val))) return false;
      } else if (typeof cond.contains === 'string') {
        if (!String(val || '').includes(cond.contains)) return false;
      }
    } else if (cond !== undefined && String(val) !== String(cond)) {
      return false;
    }
  }
  return true;
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
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      return store.find((r) => matchesWhere(r, where)) || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      return store.filter((r) => matchesWhere(r, where));
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      return store.filter((r) => matchesWhere(r, where)).length;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
  };
}

function makePrisma() {
  const conversionStore = [];
  const requestStore = [];
  const handoffStore = [];
  const prisma = {
    _conversionStore: conversionStore,
    _requestStore: requestStore,
    _handoffStore: handoffStore,
    crmConversion: simpleCrud(conversionStore, 'cvn'),
    crmConversionRequest: simpleCrud(requestStore, 'cvr'),
    crmConversionDomainHandoff: simpleCrud(handoffStore, 'hd'),
  };
  return prisma;
}

describe('Phase 20 Wave 4 — metrics / reliability / scope / Phase 21 exit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reliability gate fail → UNAVAILABLE / value null — never false zero', async () => {
    const honesty = applyConversionReportHonesty({
      modelAvailable: false,
      permissionOk: true,
      queryOk: true,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(honesty.inventZeroesForbidden).toBe(true);
    expect(honesty.falseZeroes).toBe(false);

    const broken = makePrisma();
    broken.crmConversion.count = vi.fn(async () => {
      throw new Error('db down');
    });

    const metric = await getConversionMetric(broken, {
      admin: superAdmin(),
      metric: 'conversion_count',
    });
    expect(metric.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(metric.value).toBeNull();
    expect(metric.value).not.toBe(0);

    const report = await getConversionReport(broken, { admin: superAdmin() });
    expect(report.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(report.report).toBeNull();

    const overview = await getConversionOverview(broken, { admin: superAdmin() });
    expect(overview.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(overview.overview).toBeNull();
  });

  it('metrics fail-closed without sales-team/territory/customer/tenant scope', async () => {
    const prisma = makePrisma();
    const rep = salesRep();

    await prisma.crmConversion.create({
      data: {
        id: 'cvn-owned',
        conversionNumber: 'CVN-2026-000101',
        status: 'IN_PROGRESS',
        conversionRequestId: 'cvr-1',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        teamId: 'team-a',
        territoryId: 'terr-a',
      },
    });
    await prisma.crmConversion.create({
      data: {
        id: 'cvn-other',
        conversionNumber: 'CVN-2026-000102',
        status: 'IN_PROGRESS',
        conversionRequestId: 'cvr-2',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        teamId: 'team-b',
        territoryId: 'terr-b',
      },
    });

    const unscoped = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
    });
    expect(unscoped.value).toBeNull();
    expect(unscoped.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(unscoped.meta?.failClosed || unscoped.reason).toBeTruthy();

    const emptyTeam = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
      salesTeamIds: [],
    });
    expect(emptyTeam.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(emptyTeam.value).toBeNull();
    expect(emptyTeam.meta?.failClosed).toBe(true);

    const scopedTeam = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
      salesTeamIds: ['team-a'],
    });
    expect(scopedTeam.ok).toBe(true);
    expect(scopedTeam.value).toBe(1);

    const scopedTerr = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
      territoryIds: ['terr-a'],
    });
    expect(scopedTerr.value).toBe(1);

    const scopedCust = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
      customerIds: ['cust-a'],
    });
    expect(scopedCust.value).toBe(1);

    const scopedTenant = await getConversionMetric(prisma, {
      admin: rep,
      metric: 'conversion_count',
      tenantIds: ['tenant-owned'],
    });
    expect(scopedTenant.value).toBe(1);
  });

  it('search / export / DQ / recon apply scope; never invent zeroes or lineageIntact:true', async () => {
    const prisma = makePrisma();
    const rep = salesRep('sales-export-dq');

    await prisma.crmConversion.create({
      data: {
        id: 'cvn-exp-owned',
        conversionNumber: 'CVN-2026-000160',
        status: 'IN_PROGRESS',
        conversionRequestId: 'cvr-owned',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
        teamId: 'team-a',
        territoryId: 'terr-a',
        accessToken: 'tok-export-secret',
        secretNote: 'SECRET_ANSWER_EXPORT',
      },
    });
    await prisma.crmConversion.create({
      data: {
        id: 'cvn-exp-other',
        conversionNumber: 'CVN-2026-000161',
        status: 'IN_PROGRESS',
        conversionRequestId: 'cvr-other',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
        teamId: 'team-b',
        territoryId: 'terr-b',
      },
    });
    await prisma.crmConversionRequest.create({
      data: {
        id: 'cvr-owned',
        requestNumber: 'CVR-2026-000160',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-owned',
        customerId: 'cust-a',
      },
    });
    await prisma.crmConversionRequest.create({
      data: {
        id: 'cvr-other',
        requestNumber: 'CVR-2026-000161',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-b',
      },
    });

    const searchClosed = await searchConversionIndex(prisma, {
      admin: rep,
      query: 'CVN-2026',
    });
    expect(searchClosed.ok).toBe(true);
    expect(searchClosed.results).toEqual([]);
    expect(searchClosed.meta?.failClosed || searchClosed.reason).toBeTruthy();

    const searchScoped = await searchConversionIndex(prisma, {
      admin: rep,
      query: 'CVN-2026',
      tenantIds: ['tenant-owned'],
    });
    expect(searchScoped.ok).toBe(true);
    const ids = (searchScoped.results || []).map((r) => r.id);
    expect(ids).toContain('cvn-exp-owned');
    expect(ids).not.toContain('cvn-exp-other');
    const payload = JSON.stringify(searchScoped.results);
    expect(payload).not.toMatch(/tok-secret|SECRET_ANSWER|accessToken|secretNote/i);

    const exportClosed = await exportConversionReport(prisma, {
      admin: rep,
      reportKey: 'overview',
      format: 'csv',
    });
    expect(exportClosed.ok).toBe(true);
    expect(exportClosed.rows).toEqual([]);
    expect(exportClosed.meta?.failClosed || exportClosed.reason).toBeTruthy();

    const exportScoped = await exportConversionReport(prisma, {
      admin: rep,
      reportKey: 'overview',
      format: 'csv',
      salesTeamIds: ['team-a'],
    });
    expect(exportScoped.ok).toBe(true);
    expect(exportScoped.rows).toHaveLength(1);
    expect(exportScoped.rows[0].id).toBe('cvn-exp-owned');
    const exportBody =
      typeof exportScoped.body === 'string'
        ? exportScoped.body
        : JSON.stringify(exportScoped.rows);
    expect(exportBody).not.toMatch(
      /SECRET_ANSWER|tok-export|accessToken|secretNote/i
    );
    expect(exportBody).not.toMatch(/^=|^\+|^\-|@/m);

    prisma.crmConversion.findMany.mockRejectedValueOnce(
      new Error('conversion_export_db_down')
    );
    const exportQueryFail = await exportConversionReport(prisma, {
      admin: rep,
      reportKey: 'overview',
      format: 'csv',
      tenantIds: ['tenant-owned'],
    });
    expect(exportQueryFail.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(exportQueryFail.ok).toBe(false);
    expect(exportQueryFail.rows).toBeNull();
    expect(exportQueryFail.body).toBeNull();
    expect(exportQueryFail.rows).not.toEqual([]);

    const dqClosed = await runConversionDataQuality(prisma, { admin: rep });
    expect(dqClosed.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(dqClosed.checks).toBeNull();
    expect(dqClosed.meta?.failClosed || dqClosed.reason).toBeTruthy();

    const dqScoped = await runConversionDataQuality(prisma, {
      admin: rep,
      tenantIds: ['tenant-owned'],
    });
    expect(dqScoped.ok).toBe(true);
    expect(dqScoped.status).toBe(CRM_CONVERSION_REPORT_STATUS.READY);
    expect(dqScoped.checks.totalConversions).toBe(1);
    expect(dqScoped.checks.blockingDq).toBeNull();
    expect(dqScoped.checks.blockingDq).not.toBe(false);

    const reconClosed = await runConversionReconciliation(prisma, { admin: rep });
    expect(reconClosed.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(reconClosed.cards).toBeNull();
    expect(reconClosed.meta?.failClosed || reconClosed.reason).toBeTruthy();

    const reconScoped = await runConversionReconciliation(prisma, {
      admin: rep,
      customerIds: ['cust-a'],
    });
    expect(reconScoped.ok).toBe(true);
    expect(reconScoped.status).toBe(CRM_CONVERSION_REPORT_STATUS.READY);
    expect(reconScoped.cards.conversions).toBe(1);
    expect(reconScoped.cards.lineageIntact).toBeNull();
    expect(reconScoped.cards.lineageIntact).not.toBe(true);

    // Missing request model → UNAVAILABLE / totalRequests null — never invent 0.
    const noRequestPrisma = makePrisma();
    delete noRequestPrisma.crmConversionRequest;
    await noRequestPrisma.crmConversion.create({
      data: {
        id: 'cvn-dq-only',
        conversionNumber: 'CVN-2026-000170',
        status: 'IN_PROGRESS',
        conversionRequestId: 'cvr-x',
        tenantId: 'tenant-owned',
      },
    });
    const dqNoRequest = await runConversionDataQuality(noRequestPrisma, {
      admin: superAdmin(),
    });
    expect(dqNoRequest.status).toBe(CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE);
    expect(dqNoRequest.checks?.totalRequests).toBeNull();
    expect(dqNoRequest.checks?.totalRequests).not.toBe(0);
    expect(dqNoRequest.honesty?.falseZeroes).toBe(false);
  });

  it('Closed-Won / accepted value is never labelled collected/recognised Revenue', () => {
    const label = getConversionValueLabelHonesty({
      acceptedValue: 125000,
      closedWonValue: 125000,
      currency: 'MWK',
    });
    expect(label.isRevenue).toBe(false);
    expect(label.isCollectedRevenue).toBe(false);
    expect(label.isRecognisedRevenue).toBe(false);
    expect(label.isRecognizedRevenue).toBe(false);
    expect(label.label).toMatch(/not_.*revenue|accepted_value|closed_won/i);
    // Honesty slug may mention "not_collected_*" — must not claim positive Revenue.
    expect(label.label).not.toMatch(/^(collected|recognised|recognized)_revenue$/i);
    expect(getConversionDomainContract().phase).toBe(20);
    expect(CRM_CONVERSION_HUB_ROUTES.closedWonAlias).toMatch(/closed-won/);
  });

  it('EN + NY i18n keys for conversion hub resolve (smoke)', () => {
    const en = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/en/admin-pages.json'), 'utf8')
    );
    const ny = JSON.parse(
      readFileSync(join(process.cwd(), 'locales/ny/admin-pages.json'), 'utf8')
    );
    const keys = [
      'crm.conversionHub.title',
      'crm.conversionHub.overview',
      'crm.conversionHub.myWork',
      'crm.conversionHub.queues',
      'crm.conversionHub.reports',
      'crm.conversionHub.acceptedValueNotRevenue',
      'crm.conversionHub.closedWonNotCollectedRevenue',
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
    // Must deny collected/recognised Revenue labelling (negation OK).
    expect(en.crm.conversionHub.acceptedValueNotRevenue.toLowerCase()).toMatch(
      /not .*revenue/
    );
    expect(en.crm.conversionHub.closedWonNotCollectedRevenue.toLowerCase()).toMatch(
      /not .*revenue/
    );
  });

  it('Phase 21 pack present with READY_FOR_PHASE_21_WITH_BLOCKERS', () => {
    const base = join(process.cwd(), 'docs/admin-intelligence-crm/phase-20');
    const inputs = join(base, 'PHASE_21_INPUTS.md');
    const checklist = join(base, 'PHASE_21_READINESS_CHECKLIST.md');
    const finalReport = join(base, 'FINAL_PHASE_20_REPORT.md');
    const decision = join(base, 'FINAL_READINESS_DECISION.md');
    for (const p of [inputs, checklist, finalReport, decision]) {
      expect(existsSync(p)).toBe(true);
    }
    const decisionBody = readFileSync(decision, 'utf8');
    expect(decisionBody).toMatch(/READY_FOR_PHASE_21_WITH_BLOCKERS/);
    const inputsBody = readFileSync(inputs, 'utf8');
    expect(inputsBody).toMatch(/blocker|carry/i);
    expect(inputsBody).toMatch(/handoff/i);
    expect(inputsBody).toMatch(/tree-17|phase-17|FUTURE/i);
    expect(inputsBody).toMatch(/MISLABELLED_PHASE_ARTIFACT_AUDIT|mislabel/i);
    const reportBody = readFileSync(finalReport, 'utf8');
    expect(reportBody).toMatch(/READY_FOR_PHASE_21_WITH_BLOCKERS/);
    const checklistBody = readFileSync(checklist, 'utf8');
    expect(checklistBody).toMatch(/READY_FOR_PHASE_21_WITH_BLOCKERS/);
  });

  it('thin closed-won alias route is documented on hub keys', () => {
    expect(CRM_CONVERSION_HUB_ROUTES.overview).toMatch(/conversions\/overview/);
    expect(CRM_CONVERSION_HUB_ROUTES.closedWonAlias).toMatch(
      /\/insightbooks\/crm\/closed-won/
    );
    const aliasPage = join(
      process.cwd(),
      'app/insightbooks/crm/closed-won/page.js'
    );
    expect(existsSync(aliasPage)).toBe(true);
  });
});
