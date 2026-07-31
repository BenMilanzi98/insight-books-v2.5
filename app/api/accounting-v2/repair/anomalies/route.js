/**
 * /api/accounting-v2/repair/anomalies — Historical Anomaly Registry.
 *
 * GET  — list anomalies for the session business (filters: status, type,
 *        severity, confidence, module, accountId, page, pageSize).
 * POST — { action: "detect" } runs the read-only detection pass and persists
 *        findings idempotently into the registry.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { listAnomalies } from '@/lib/accountingV2/repair/anomalyRegistryService.js';
import { runAnomalyDetection } from '@/lib/accountingV2/repair/anomalyDetectionService.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_VIEW]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const result = await listAnomalies(prisma, guard.context, {
      status: searchParams.get('status') || undefined,
      anomalyType: searchParams.get('anomalyType') || undefined,
      severity: searchParams.get('severity') || undefined,
      confidence: searchParams.get('confidence') || undefined,
      module: searchParams.get('module') || undefined,
      accountId: searchParams.get('accountId') || undefined,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'repair anomalies list');
  }
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_INVESTIGATE]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'detect') {
      return NextResponse.json({ error: 'Unknown action; supported: detect' }, { status: 400 });
    }
    const result = await runAnomalyDetection(prisma, guard.context, {});
    return NextResponse.json({ detection: result });
  } catch (error) {
    return accountingErrorResponse(error, 'repair anomaly detection');
  }
}
