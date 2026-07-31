/**
 * DELETE /api/coa-v2/mappings/[id] — retire a purpose mapping.
 *
 * Retired mappings stop resolving for future postings; the row is preserved
 * for audit history (no hard delete).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { retireMapping } from '@/lib/coaV2/application/accountMappingRegistry.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function DELETE(request, { params }) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_MAP_ACCOUNTS,
    ACCOUNTING_PERMISSIONS.COA_MANAGE,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  const resolvedParams = typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;

  try {
    const retired = await prisma.$transaction((tx) => retireMapping({ db: tx, context, mappingId: id }));
    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.MAPPING_RETIRE,
      context,
      entityType: 'CoaV2AccountMapping',
      entityId: id,
      previousValues: { status: 'ACTIVE' },
      newValues: { status: retired.status, purpose: retired.purpose, accountId: retired.accountId },
    });
    return NextResponse.json({ mapping: retired, message: 'Mapping retired' });
  } catch (error) {
    return coaErrorResponse(error, 'retire account mapping');
  }
}
