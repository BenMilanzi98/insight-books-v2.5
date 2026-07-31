import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  resolveEisAdminContext,
  buildContextBarModel,
  EIS_ADMIN_SECTIONS,
  SYSTEM_EIS_ADMIN_SECTIONS,
  aggregateTenantEisOverview,
  aggregatePlatformEisOverview,
  calculateHealthScorecard,
  HEALTH_DOMAIN,
  listReportDefinitions,
  buildReportTraceability,
  reconcileReportTotals,
  createExportJob,
  generateExportJob,
  downloadExportJob,
  listExportJobs,
  searchEisEntities,
  prepareAdminCommand,
  assertNoFinalStateMutation,
  getReadModel,
  upsertReadModel,
  evaluateSla,
  FRESHNESS,
  AdminErrors,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

function errResponse(error) {
  if (error instanceof MraEisControlError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requiredAction: error.requiredAction } },
      { status: error.httpStatus || 400 }
    );
  }
  return NextResponse.json({ error: error.message || 'Admin error' }, { status: 500 });
}

async function loadTenantCounts(tenantId, environment) {
  const loadErrors = {};
  const counts = {};
  try {
    counts.terminalCount = await prisma.mraEisTerminal.count({
      where: { tenantId, businessId: tenantId, ...(environment ? { environment } : {}) },
    });
  } catch (e) {
    loadErrors.terminalCount = 'QUERY_FAILED';
  }
  try {
    counts.activeRestrictions = await prisma.mraEisRestriction
      .count({
        where: {
          OR: [{ tenantId }, { tenantId: null }],
          state: { in: ['ACTIVE', 'ACKNOWLEDGED', 'UNBLOCK_REQUEST_PENDING'] },
          ...(environment ? { environment } : {}),
        },
      })
      .catch(() => {
        loadErrors.activeRestrictions = 'QUERY_FAILED';
        return null;
      });
    if (counts.activeRestrictions == null && !loadErrors.activeRestrictions) {
      // already set
    }
  } catch {
    loadErrors.activeRestrictions = 'QUERY_FAILED';
  }
  try {
    counts.activeAgents = await prisma.mraEisTrustedAgent.count({
      where: { tenantId, businessId: tenantId, lifecycleState: 'ACTIVE' },
    });
  } catch {
    loadErrors.activeAgents = 'QUERY_FAILED';
  }
  try {
    counts.pendingTransmissions = await prisma.mraEisTransmission.count({
      where: {
        tenantId,
        businessId: tenantId,
        state: { in: ['READY', 'QUEUED', 'DISPATCHING', 'SUBMITTING'] },
      },
    });
  } catch {
    loadErrors.pendingTransmissions = 'QUERY_FAILED';
  }
  try {
    counts.manualReviewBacklog = await prisma.mraEisManualReviewCase.count({
      where: { tenantId, businessId: tenantId, status: { in: ['OPEN', 'ASSIGNED'] } },
    });
  } catch {
    loadErrors.manualReviewBacklog = 'QUERY_FAILED';
  }
  // Defaults for cards without queries yet — explicit null error not zero-fake for failed
  for (const k of [
    'entitlementActive',
    'participationActive',
    'blockedTerminals',
    'acceptedTransmissions',
    'rejectedTransmissions',
    'unknownOutcomes',
    'reconciliationBacklog',
    'offlineQueueDepth',
    'receiptBacklog',
    'pendingUnblockRequests',
    'openIncidents',
    'criticalAlerts',
  ]) {
    if (counts[k] === undefined && !loadErrors[k]) counts[k] = 0;
  }
  return { counts, loadErrors };
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const environment = searchParams.get('environment') || 'SANDBOX';
    const requestedTenantId = searchParams.get('tenantId');

    const context = resolveEisAdminContext({
      user,
      requestedTenantId,
      environment,
    });

    if (action === 'navigation') {
      return NextResponse.json({
        context: buildContextBarModel(context, {
          dataFreshness: FRESHNESS.CURRENT,
          platformEisStatus: 'AVAILABLE',
        }),
        sections: context.isPlatformAdmin ? SYSTEM_EIS_ADMIN_SECTIONS : EIS_ADMIN_SECTIONS,
      });
    }

    if (action === 'overview') {
      const { counts, loadErrors } = await loadTenantCounts(context.tenantId, environment);
      const overview = aggregateTenantEisOverview({
        context,
        counts,
        loadErrors,
        projectionUpdatedAt: new Date().toISOString(),
        sourceUpdatedAt: new Date().toISOString(),
      });
      upsertReadModel({
        name: 'TENANT_EIS_OVERVIEW',
        tenantId: context.tenantId,
        businessId: context.businessId,
        environment,
        payload: { cardKeys: overview.cards.map((c) => c.key) },
      });
      const health = calculateHealthScorecard({
        domain: HEALTH_DOMAIN.TENANT_EIS_HEALTH,
        inputs: {
          entitlementOk: true,
          participationOk: true,
          certificationOk: true,
          configurationFresh: true,
          mappingComplete: true,
          transmissionHealthy: (counts.pendingTransmissions || 0) < 100,
          reconciliationHealthy: true,
          offlineHealthy: true,
          noCriticalRestriction: (counts.activeRestrictions || 0) === 0,
          criticalRestrictionActive: (counts.activeRestrictions || 0) > 0,
        },
      });
      return NextResponse.json({
        context: buildContextBarModel(context, {
          dataFreshness: overview.freshness,
          effectiveCapabilityStatus: health.band,
          primaryRestriction:
            (counts.activeRestrictions || 0) > 0 ? 'ACTIVE_RESTRICTIONS_PRESENT' : null,
        }),
        overview,
        health,
        sections: EIS_ADMIN_SECTIONS,
        note: 'Phase 18 is an operational window. Commands invoke Phase 1–17 domain services only.',
      });
    }

    if (action === 'platform-overview') {
      if (!context.isPlatformAdmin) {
        throw AdminErrors.authorization();
      }
      const platform = aggregatePlatformEisOverview({
        context,
        counts: {
          entitledTenants: 0,
          productionBusinesses: 0,
          sandboxBusinesses: 0,
          activeTerminals: 0,
          blockedTerminals: 0,
          activeAgents: 0,
          pendingTransmissions: 0,
          unknownOutcomes: 0,
          activeRestrictions: 0,
          certificationExpirations: 0,
          openIncidents: 0,
          manualReviewBacklog: 0,
        },
        loadErrors: {},
        projectionUpdatedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        context: buildContextBarModel(context, { dataFreshness: platform.freshness }),
        overview: platform,
        sections: SYSTEM_EIS_ADMIN_SECTIONS,
      });
    }

    if (action === 'reports') {
      return NextResponse.json({
        reports: listReportDefinitions(),
        note: 'Every report total must reconcile to source detail rows. Credentials excluded.',
      });
    }

    if (action === 'report-trace') {
      const reportId = searchParams.get('reportId');
      return NextResponse.json({
        traceability: buildReportTraceability({ reportId, timezone: 'Africa/Blantyre' }),
      });
    }

    if (action === 'exports') {
      return NextResponse.json({ exports: listExportJobs({ tenantId: context.tenantId }) });
    }

    if (action === 'download-export') {
      const jobId = searchParams.get('jobId');
      const token = searchParams.get('token');
      const result = downloadExportJob({
        jobId,
        tenantId: context.tenantId,
        token,
        userPermissions: ['*'],
        stillAuthorized: true,
      });
      return new NextResponse(result.body, {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="eis-export-${jobId}.csv"`,
          'X-Export-Checksum': result.job.checksum,
        },
      });
    }

    if (action === 'read-model') {
      const name = searchParams.get('name') || 'TENANT_EIS_OVERVIEW';
      return NextResponse.json(
        getReadModel({
          name,
          tenantId: context.tenantId,
          businessId: context.businessId,
          environment,
        })
      );
    }

    if (action === 'sla') {
      const slaId = searchParams.get('slaId') || 'MANUAL_REVIEW';
      const startedAt = searchParams.get('startedAt') || new Date(Date.now() - 60 * 60 * 1000).toISOString();
      return NextResponse.json(evaluateSla({ slaId, startedAt }));
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return errResponse(error);
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    assertNoFinalStateMutation(body);

    const action = body.action;

    if (action === 'search') {
      const context = resolveEisAdminContext({
        user,
        requestedTenantId: body.tenantId,
        environment: body.environment || 'SANDBOX',
      });
      // Only search caller-supplied in-scope records (or empty) — never foreign tenant
      const records = (body.records || []).filter(
        (r) => !r.tenantId || r.tenantId === context.tenantId || context.isPlatformAdmin
      );
      return NextResponse.json(
        searchEisEntities({ context, query: body.query, records, maxResults: body.maxResults || 25 })
      );
    }

    if (action === 'command') {
      const prepared = await prepareAdminCommand({
        user,
        body: {
          ...body,
          commandIntent: body.commandIntent,
          args: body.args || {},
          idempotencyKey: body.idempotencyKey,
          approvalId: body.approvalId,
          tenantId: body.tenantId,
          businessId: body.businessId,
          environment: body.environment || 'SANDBOX',
        },
        handler: async ({ commandIntent, args }) => ({
          accepted: true,
          executed: false,
          delegated: true,
          commandIntent,
          args,
          message:
            'Command accepted for domain delegation. Phase 18 does not mutate fiscal evidence, Journals, or Stock.',
          journalCreated: false,
          stockMovementCreated: false,
          historicalSaleSubmitted: false,
          immutableEvidenceMutated: false,
          terminalSetActive: false,
          transmissionSetAccepted: false,
        }),
      });
      return NextResponse.json(prepared);
    }

    if (action === 'create-export') {
      const context = resolveEisAdminContext({
        user,
        environment: body.environment || 'SANDBOX',
      });
      const job = createExportJob({
        tenantId: context.tenantId,
        businessId: context.businessId,
        environment: context.environment,
        reportId: body.reportId,
        format: body.format || 'CSV',
        filters: body.filters || {},
        requestedBy: user.id,
        userPermissions: body.userPermissions || ['*'],
      });
      return NextResponse.json({ job });
    }

    if (action === 'generate-export') {
      const context = resolveEisAdminContext({ user, environment: body.environment || 'SANDBOX' });
      const rows = body.rows || [];
      const result = generateExportJob({
        jobId: body.jobId,
        tenantId: context.tenantId,
        rows,
        userPermissions: body.userPermissions || ['*'],
        stillAuthorized: body.stillAuthorized !== false,
      });
      const recon = reconcileReportTotals({
        totals: { rowCount: rows.length },
        detailRows: rows,
      });
      return NextResponse.json({ ...result, reconciliation: recon });
    }

    if (action === 'health') {
      return NextResponse.json(
        calculateHealthScorecard({
          domain: body.domain || HEALTH_DOMAIN.BUSINESS_EIS_HEALTH,
          inputs: body.inputs || {},
        })
      );
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return errResponse(error);
  }
}
