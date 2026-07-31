/**
 * /api/accounting-v2/events — accounting-event history (read-only).
 *
 * GET — paginated event registry for the session business with optional
 * status/eventType/source filters. Includes attempts and shadow comparisons.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.POSTING_VIEW,
    ACCOUNTING_PERMISSIONS.POSTING_VIEW_FAILURES,
    ACCOUNTING_PERMISSIONS.DIAGNOSTICS_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const eventType = searchParams.get('eventType');
    const sourceType = searchParams.get('sourceType');
    const sourceId = searchParams.get('sourceId');
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? 25)));

    const where = {
      tenantId: context.businessId,
      ...(status ? { status } : {}),
      ...(eventType ? { eventType } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
    };
    const [events, total] = await Promise.all([
      prisma.acctV2EventRegistry.findMany({
        where,
        include: {
          attempts: { orderBy: { attemptNumber: 'asc' } },
          shadowJournals: { select: { id: true, status: true, totalDebit: true, totalCredit: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.acctV2EventRegistry.count({ where }),
    ]);
    return NextResponse.json({ events, total, page, pageSize });
  } catch (error) {
    return accountingErrorResponse(error, 'list accounting events');
  }
}
