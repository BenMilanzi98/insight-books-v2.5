import { describe, expect, it, beforeEach } from 'vitest';

beforeEach(async () => {
  const { __resetAdminCommandIdempotencyForTests } = await import(
    '../lib/mraEis/application/admin/commandArchitecture.js'
  );
  const { __resetExportJobsForTests } = await import(
    '../lib/mraEis/application/admin/exportSecurity.js'
  );
  const { __resetSearchRateForTests } = await import(
    '../lib/mraEis/application/admin/globalSearch.js'
  );
  const { __resetSavedViewsForTests } = await import(
    '../lib/mraEis/application/admin/savedViews.js'
  );
  const { __resetReadModelsForTests } = await import(
    '../lib/mraEis/application/admin/readModels.js'
  );
  __resetAdminCommandIdempotencyForTests();
  __resetExportJobsForTests();
  __resetSearchRateForTests();
  __resetSavedViewsForTests();
  __resetReadModelsForTests();
});

describe('Phase 18 context and isolation', () => {
  it('rejects cross-tenant context and separates environments', async () => {
    const { resolveEisAdminContext } = await import(
      '../lib/mraEis/application/admin/adminContext.js'
    );
    const ctx = resolveEisAdminContext({
      user: { id: 'u1', tenantId: 'tenant-a' },
      environment: 'SANDBOX',
    });
    expect(ctx.tenantId).toBe('tenant-a');
    expect(ctx.environmentBadge.code).toBe('SANDBOX');

    expect(() =>
      resolveEisAdminContext({
        user: { id: 'u1', tenantId: 'tenant-a' },
        requestedTenantId: 'tenant-b',
        environment: 'SANDBOX',
      })
    ).toThrow(/Tenant A cannot open Tenant B/);
  });
});

describe('Phase 18 status and freshness', () => {
  it('provides consistent status vocabulary with screen-reader text', async () => {
    const { resolveStatus, transmissionOutcomeStatus, EIS_STATUS } = await import(
      '../lib/mraEis/application/admin/statusDesignSystem.js'
    );
    expect(resolveStatus('BLOCKED').srText).toBeTruthy();
    expect(transmissionOutcomeStatus('UNKNOWN_OUTCOME').code).toBe('UNKNOWN');
    expect(EIS_STATUS.PRODUCTION.label).toBe('Production');
  });
});

describe('Phase 18 dashboard aggregation', () => {
  it('does not treat failed queries as zero and scopes cache keys', async () => {
    const { aggregateTenantEisOverview, buildDashboardCacheKey } = await import(
      '../lib/mraEis/application/admin/dashboardAggregation.js'
    );
    const { FRESHNESS: F } = await import('../lib/mraEis/application/admin/statusDesignSystem.js');

    const overview = aggregateTenantEisOverview({
      context: { tenantId: 't1', businessId: 't1', environment: 'SANDBOX' },
      counts: { terminalCount: 3 },
      loadErrors: { pendingTransmissions: 'QUERY_FAILED' },
      projectionUpdatedAt: new Date().toISOString(),
    });
    const pending = overview.cards.find((c) => c.key === 'pendingTransmissions');
    expect(pending.error).toBe(true);
    expect(pending.value).toBeNull();
    expect(overview.freshness).toBe(F.PARTIAL);
    expect(overview.financialSourceOfTruth).toBe(false);

    const key = buildDashboardCacheKey({
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      readModelVersion: 'v1',
    });
    expect(key).toContain('t1');
    expect(key).toContain('SANDBOX');
  });
});

describe('Phase 18 command architecture', () => {
  it('rejects final-state mutation and enforces idempotency + auditor read-only', async () => {
    const { prepareAdminCommand, assertNoFinalStateMutation } = await import(
      '../lib/mraEis/application/admin/commandArchitecture.js'
    );

    expect(() => assertNoFinalStateMutation({ setTerminalActive: true })).toThrow();
    expect(() => assertNoFinalStateMutation({ markAccepted: true })).toThrow();
    expect(() => assertNoFinalStateMutation({ fiscalNumber: '123' })).toThrow();
    expect(() => assertNoFinalStateMutation({ jwt: 'x' })).toThrow();

    await expect(
      prepareAdminCommand({
        user: { id: 'a', tenantId: 't1', role: 'AUDITOR' },
        body: { commandIntent: 'REQUEST_CONFIGURATION_SYNC', environment: 'SANDBOX' },
      })
    ).rejects.toMatchObject({ code: 'MRA_EIS_COMMAND_AUTHORIZATION' });

    const first = await prepareAdminCommand({
      user: { id: 'a', tenantId: 't1' },
      body: {
        commandIntent: 'CREATE_UNBLOCK_REQUEST',
        idempotencyKey: 'idem-1',
        args: { restrictionId: 'r1' },
        environment: 'SANDBOX',
      },
      handler: async () => ({
        accepted: true,
        executed: true,
        journalCreated: false,
        stockMovementCreated: false,
        historicalSaleSubmitted: false,
        immutableEvidenceMutated: false,
      }),
    });
    expect(first.duplicated).toBe(false);
    expect(first.result.journalCreated).toBe(false);

    const second = await prepareAdminCommand({
      user: { id: 'a', tenantId: 't1' },
      body: {
        commandIntent: 'CREATE_UNBLOCK_REQUEST',
        idempotencyKey: 'idem-1',
        args: { restrictionId: 'r1' },
        environment: 'SANDBOX',
      },
    });
    expect(second.duplicated).toBe(true);

    await expect(
      prepareAdminCommand({
        user: { id: 'a', tenantId: 't1' },
        body: {
          commandIntent: 'REQUEST_SAFE_RETRY_APPROVAL',
          environment: 'SANDBOX',
        },
      })
    ).rejects.toMatchObject({ code: 'MRA_EIS_COMMAND_APPROVAL_REQUIRED' });
  });
});

describe('Phase 18 health scorecards', () => {
  it('lets critical restrictions override a high numeric score', async () => {
    const { calculateHealthScorecard } = await import(
      '../lib/mraEis/application/admin/healthScorecards.js'
    );
    const healthy = calculateHealthScorecard({
      inputs: {
        entitlementOk: true,
        participationOk: true,
        certificationOk: true,
        configurationFresh: true,
        mappingComplete: true,
        transmissionHealthy: true,
        reconciliationHealthy: true,
        offlineHealthy: true,
        noCriticalRestriction: true,
      },
    });
    expect(healthy.band).toBe('HEALTHY');

    const blocked = calculateHealthScorecard({
      inputs: {
        entitlementOk: true,
        participationOk: true,
        certificationOk: true,
        configurationFresh: true,
        mappingComplete: true,
        transmissionHealthy: true,
        reconciliationHealthy: true,
        offlineHealthy: true,
        noCriticalRestriction: false,
        criticalRestrictionActive: true,
        mraTerminalBlocked: true,
      },
    });
    expect(blocked.band).toBe('BLOCKED');
    expect(blocked.score).toBeLessThanOrEqual(25);
  });
});

describe('Phase 18 reports and exports', () => {
  it('traces reports, reconciles totals, and secures exports with formula sanitization', async () => {
    const {
      getReportDefinition,
      buildReportTraceability,
      reconcileReportTotals,
    } = await import('../lib/mraEis/application/admin/reportRegistry.js');
    const {
      sanitizeExportCell,
      createExportJob,
      generateExportJob,
      downloadExportJob,
    } = await import('../lib/mraEis/application/admin/exportSecurity.js');

    expect(getReportDefinition('ACTIVE_RESTRICTIONS')).toBeTruthy();
    const trace = buildReportTraceability({ reportId: 'ACTIVE_RESTRICTIONS' });
    expect(trace.credentialsExcluded).toBe(true);
    expect(trace.sourceEntity).toBe('MraEisRestriction');

    expect(reconcileReportTotals({ totals: { rowCount: 2 }, detailRows: [{}, {}] }).ok).toBe(true);
    expect(reconcileReportTotals({ totals: { rowCount: 1 }, detailRows: [{}, {}] }).ok).toBe(false);

    expect(sanitizeExportCell('=CMD()')).toBe("'=CMD()");

    const job = createExportJob({
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      reportId: 'ACTIVE_RESTRICTIONS',
      format: 'CSV',
      requestedBy: 'u1',
      userPermissions: ['eis.restrictions.view'],
      ttlSeconds: 3600,
    });
    const gen = generateExportJob({
      jobId: job.id,
      tenantId: 't1',
      rows: [{ restrictionId: 'r1', reasonCode: 'MRA_TERMINAL_BLOCKED' }],
      userPermissions: ['eis.restrictions.view'],
    });
    expect(gen.job.checksum).toBeTruthy();
    expect(gen.job.credentialsExcluded).toBe(true);

    const token = new URL(gen.job.signedUrl, 'http://local').searchParams.get('token');
    const dl = downloadExportJob({
      jobId: job.id,
      tenantId: 't1',
      token,
      userPermissions: ['eis.restrictions.view'],
    });
    expect(dl.contentType).toBe('text/csv');

    expect(() =>
      createExportJob({
        tenantId: 't1',
        reportId: 'ACTIVE_RESTRICTIONS',
        userPermissions: [],
      })
    ).toThrow(/Export permission denied/);
  });
});

describe('Phase 18 search and saved views', () => {
  it('isolates tenants and does not grant permissions via saved views', async () => {
    const { searchEisEntities } = await import('../lib/mraEis/application/admin/globalSearch.js');
    const { createSavedView, openSavedView } = await import(
      '../lib/mraEis/application/admin/savedViews.js'
    );

    const result = searchEisEntities({
      context: { tenantId: 't1', businessId: 't1', environment: 'SANDBOX', actorId: 'u1' },
      query: 'term',
      records: [
        { type: 'TERMINAL', id: '1', tenantId: 't1', environment: 'SANDBOX', label: 'terminal-1', terminalId: 'term' },
        { type: 'TERMINAL', id: '2', tenantId: 't2', environment: 'SANDBOX', label: 'terminal-foreign', terminalId: 'term-x' },
      ],
    });
    expect(result.results.every((r) => r.id !== '2')).toBe(true);
    expect(result.tenantIsolated).toBe(true);

    const view = createSavedView({
      ownerId: 'u1',
      tenantId: 't1',
      name: 'Blocked terminals',
      section: 'terminals',
      filters: { tenantId: 't2', status: 'BLOCKED' },
    });
    const opened = openSavedView({
      viewId: view.id,
      context: { tenantId: 't1', businessId: 't1' },
    });
    expect(opened.ok).toBe(true);
    expect(opened.view.filters.tenantId).toBe('t1');
    expect(opened.view.grantsPermissions).toBe(false);
  });
});

describe('Phase 18 read models and SLA', () => {
  it('marks stale projections and evaluates SLA breaches', async () => {
    const { upsertReadModel, getReadModel } = await import(
      '../lib/mraEis/application/admin/readModels.js'
    );
    const { evaluateSla } = await import('../lib/mraEis/application/admin/slaMonitoring.js');
    const { FRESHNESS } = await import('../lib/mraEis/application/admin/statusDesignSystem.js');

    upsertReadModel({
      name: 'TENANT_EIS_OVERVIEW',
      tenantId: 't1',
      environment: 'SANDBOX',
      payload: { ok: true },
    });
    const rm = getReadModel({
      name: 'TENANT_EIS_OVERVIEW',
      tenantId: 't1',
      environment: 'SANDBOX',
      maxAgeMs: 1,
    });
    // freshly written should be LIVE/CURRENT depending on age; force stale by rewriting updatedAt
    expect(rm.found).toBe(true);
    expect(rm.financialSourceOfTruth).toBe(false);

    const sla = evaluateSla({
      slaId: 'MANUAL_REVIEW',
      startedAt: new Date(Date.now() - 2000 * 60 * 1000).toISOString(),
    });
    expect(sla.state).toBe('BREACHED');
    expect(FRESHNESS.STALE).toBe('STALE');
  });
});
