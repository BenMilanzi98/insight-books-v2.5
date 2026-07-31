/**
 * GET /api/coa-v2/accounts/[id]/usage — account usage and dependency facts.
 *
 * Read-only impact analysis used before restricted updates, deprecation,
 * consolidation, and delete rejection.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getAccountUsage } from '@/lib/coaV2/application/lifecycleService.js';

export async function GET(request, { params }) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  const resolvedParams = typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;

  try {
    const account = await prisma.account.findFirst({
      where: { id, tenantId: context.businessId },
      select: {
        id: true, accountCode: true, accountName: true, coaV2Status: true,
        coaV2Behaviour: true, systemPurpose: true, replacementAccountId: true,
      },
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    const usage = await getAccountUsage(context, id);
    const mappings = await prisma.coaV2AccountMapping.findMany({
      where: { accountId: id, tenantId: context.businessId, status: 'ACTIVE' },
      select: { id: true, purpose: true, moduleKey: true, transactionType: true, currency: true, branchKey: true },
    });
    const aliases = await prisma.coaV2AccountAlias.findMany({
      where: { tenantId: context.businessId, OR: [{ canonicalAccountId: id }, { legacyAccountId: id }] },
      select: { id: true, aliasCode: true, aliasName: true, canonicalAccountId: true, legacyAccountId: true },
    });
    return NextResponse.json({ account, usage, mappings, aliases });
  } catch (error) {
    return coaErrorResponse(error, 'load account usage');
  }
}
