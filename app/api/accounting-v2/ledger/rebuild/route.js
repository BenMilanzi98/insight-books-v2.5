/**
 * /api/accounting-v2/ledger/rebuild — ledger projection rebuild.
 *
 * POST — rebuilds the non-authoritative `AcctV2LedgerBalance` summary
 * projection from canonical posted journal lines for the session business.
 * Body: { dryRun?: boolean, reason?: string }. Validation runs BEFORE the old
 * projection is replaced; a failed validation leaves it untouched. Journals
 * are never modified. Restricted to ledger.rebuild.
 *
 * GET — current projection status (active version, row count).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  rebuildLedgerProjection,
  getActiveProjectionVersion,
} from '@/lib/accountingV2/ledger/ledgerRebuildService.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.LEDGER_REBUILD,
    ACCOUNTING_PERMISSIONS.LEDGER_VIEW_INTEGRITY,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;
  try {
    const version = await getActiveProjectionVersion(prisma, context.businessId);
    const rowCount =
      version > 0
        ? await prisma.acctV2LedgerBalance.count({
            where: { tenantId: context.businessId, projectionVersion: version },
          })
        : 0;
    return NextResponse.json({ projectionVersion: version, rowCount, authoritative: false });
  } catch (error) {
    return accountingErrorResponse(error, 'projection status');
  }
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.LEDGER_REBUILD]);
  if (guard.response) return guard.response;
  const { context } = guard;
  try {
    const body = await request.json().catch(() => ({}));
    const report = await rebuildLedgerProjection(prisma, context, {
      dryRun: body.dryRun === true,
      reason: body.reason ?? null,
    });
    return NextResponse.json({ report });
  } catch (error) {
    return accountingErrorResponse(error, 'ledger rebuild');
  }
}
