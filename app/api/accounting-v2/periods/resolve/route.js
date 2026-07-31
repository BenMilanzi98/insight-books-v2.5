/**
 * /api/accounting-v2/periods/resolve
 *
 * POST — server-side posting-date validation / period resolution for
 * operational modules, imports, webhooks and background jobs (§17). Dry-run:
 * never posts; returns the typed rejection or the resolved year + period.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { validatePostingDate } from '@/lib/accountingV2/periods/periodResolutionService.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW,
    ACCOUNTING_PERMISSIONS.POSTING_PREVIEW,
    ACCOUNTING_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await validatePostingDate(prisma, guard.context, {
      transactionDate: body.transactionDate,
      requestedPostingDate: body.requestedPostingDate ?? null,
      sourceModule: body.sourceModule ?? null,
      sourceType: body.sourceType ?? null,
      eventType: body.eventType ?? null,
      reason: body.reason ?? null,
      hasPermission: guard.can,
    });
    return NextResponse.json(result, { status: result.allowed ? 200 : 422 });
  } catch (error) {
    return accountingErrorResponse(error, 'resolve posting period');
  }
}
