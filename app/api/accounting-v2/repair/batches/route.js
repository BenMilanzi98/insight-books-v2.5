/**
 * /api/accounting-v2/repair/batches — repair batch management.
 *
 * GET  — list batches for the session business.
 * POST — create a DRAFT batch { repairCategory, description, ... }.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { listBatches, createBatch } from '@/lib/accountingV2/repair/repairBatchService.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_VIEW]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const batches = await listBatches(prisma, guard.context, {
      status: searchParams.get('status') || undefined,
      limit: Number(searchParams.get('limit') ?? 50),
    });
    return NextResponse.json({ batches });
  } catch (error) {
    return accountingErrorResponse(error, 'repair batches list');
  }
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_MANAGE_BATCHES]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const batch = await createBatch(prisma, guard.context, body);
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'repair batch create');
  }
}
