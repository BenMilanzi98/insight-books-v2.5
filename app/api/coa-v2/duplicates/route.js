/**
 * GET /api/coa-v2/duplicates — duplicate account candidates for the session
 * business, classified per Phase 3 §17. Read-only; nothing is merged here.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { classifyDuplicateAccounts } from '@/lib/coaV2/application/duplicateClassifier.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const rows = await classifyDuplicateAccounts(prisma, { tenantId: context.businessId });
    return NextResponse.json({ candidates: rows, total: rows.length });
  } catch (error) {
    return coaErrorResponse(error, 'classify duplicate accounts');
  }
}
