/**
 * /api/accounting-v2/posting-engine — internal diagnostics (read-only).
 *
 * GET — engine status for the session business: architecture version, resolved
 * posting modes, event counters, recent attempts, shadow-comparison summary,
 * template catalogue and in-process metrics. Restricted to
 * accountingDiagnostics.view; never provides a posting capability.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { resolvePostingMode } from '@/lib/accountingV2/infrastructure/featureFlags.js';
import { getAccountingMetrics } from '@/lib/accountingV2/observability/accountingLogger.js';
import { listTemplates } from '@/lib/accountingV2/templates/index.js';
import { ArchitectureVersion, EventRegistryStatus } from '@/lib/accountingV2/domain/enums.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.DIAGNOSTICS_VIEW,
    ACCOUNTING_PERMISSIONS.POSTING_VIEW_FAILURES,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const tenantWhere = { tenantId: context.businessId };

    const [statusCounts, recentAttempts, comparisonCounts, defaultMode] = await Promise.all([
      prisma.acctV2EventRegistry.groupBy({
        by: ['status'],
        where: tenantWhere,
        _count: { _all: true },
      }),
      prisma.acctV2PostingAttempt.findMany({
        where: { eventRegistry: tenantWhere },
        include: {
          eventRegistry: {
            select: {
              id: true, eventType: true, sourceType: true, sourceId: true,
              status: true, postingMode: true, failureCode: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 25,
      }),
      prisma.acctV2ShadowComparison.groupBy({
        by: ['status'],
        where: tenantWhere,
        _count: { _all: true },
      }),
      resolvePostingMode(prisma, { tenantId: context.businessId }),
    ]);

    const counts = Object.fromEntries(statusCounts.map((r) => [r.status, r._count._all]));
    const shadow = Object.fromEntries(comparisonCounts.map((r) => [r.status, r._count._all]));
    const shadowTotal = comparisonCounts.reduce((acc, r) => acc + r._count._all, 0);

    return NextResponse.json({
      engine: {
        architectureVersion: ArchitectureVersion.ACCOUNTING_V2,
        defaultPostingMode: defaultMode,
      },
      events: {
        received: counts[EventRegistryStatus.RECEIVED] ?? 0,
        inProgress: counts[EventRegistryStatus.IN_PROGRESS] ?? 0,
        posted: counts[EventRegistryStatus.POSTED] ?? 0,
        shadowed: counts[EventRegistryStatus.SHADOWED] ?? 0,
        failed: counts[EventRegistryStatus.FAILED] ?? 0,
        rejected: counts[EventRegistryStatus.REJECTED] ?? 0,
      },
      shadowComparisons: {
        total: shadowTotal,
        byStatus: shadow,
        exactMatchRate: shadowTotal > 0 ? (shadow.EXACT_MATCH ?? 0) / shadowTotal : null,
      },
      recentAttempts: recentAttempts.map((a) => ({
        id: a.id,
        attemptNumber: a.attemptNumber,
        status: a.status,
        failureCode: a.failureCode,
        retryable: a.retryable,
        durationMs: a.durationMs,
        startedAt: a.startedAt,
        requestId: a.requestId,
        correlationId: a.correlationId,
        event: a.eventRegistry,
      })),
      templates: listTemplates().map((t) => ({
        templateId: t.templateId,
        templateVersion: t.templateVersion,
        eventType: t.eventType,
        status: t.status,
      })),
      processMetrics: getAccountingMetrics(),
    });
  } catch (error) {
    return accountingErrorResponse(error, 'load posting-engine diagnostics');
  }
}
