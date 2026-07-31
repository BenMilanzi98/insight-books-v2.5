/**
 * /api/coa-v2/mappings — business-scoped account mapping registry.
 *
 * GET  — list mappings for the session business (optionally by purpose/status).
 * POST — assign (create or replace) a purpose mapping. Validated against the
 *        system-purpose constraints; audited; elevated purposes require the
 *        system-account permission.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { hasPermission } from '@/lib/auth';
import { assignMapping } from '@/lib/coaV2/application/accountMappingRegistry.js';
import { ELEVATED_PURPOSES, isSystemAccountPurpose } from '@/lib/coaV2/domain/systemPurposes.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get('purpose');
    const status = searchParams.get('status') ?? 'ACTIVE';
    const mappings = await prisma.coaV2AccountMapping.findMany({
      where: {
        tenantId: context.businessId,
        ...(purpose ? { purpose } : {}),
        ...(status && status !== 'all' ? { status } : {}),
      },
      include: {
        account: {
          select: {
            id: true, accountCode: true, accountName: true,
            coaV2Category: true, coaV2Behaviour: true, coaV2Status: true, isActive: true,
          },
        },
      },
      orderBy: [{ purpose: 'asc' }, { priority: 'desc' }],
    });
    return NextResponse.json({ mappings, total: mappings.length });
  } catch (error) {
    return coaErrorResponse(error, 'list account mappings');
  }
}

export async function POST(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_MAP_ACCOUNTS,
    ACCOUNTING_PERMISSIONS.COA_MANAGE,
  ]);
  if (guard.response) return guard.response;
  const { user, context } = guard;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const purpose = String(body?.purpose || '').trim();
  const accountId = String(body?.accountId || '').trim();
  if (!purpose || !accountId) {
    return NextResponse.json({ error: 'purpose and accountId are required' }, { status: 400 });
  }
  if (!isSystemAccountPurpose(purpose)) {
    return NextResponse.json({ error: `Unknown system account purpose: ${purpose}` }, { status: 400 });
  }
  // Protected purposes (retained earnings, control accounts, suspense, …) need
  // the elevated system-account permission on top of coa.mapAccounts.
  if (ELEVATED_PURPOSES.includes(purpose)) {
    const elevated =
      hasPermission(user, ACCOUNTING_PERMISSIONS.COA_MANAGE_SYSTEM_ACCOUNTS) ||
      hasPermission(user, ACCOUNTING_PERMISSIONS.COA_MANAGE_CONTROL_ACCOUNTS);
    if (!elevated) {
      return NextResponse.json(
        { error: `Mapping ${purpose} requires the coa.manageSystemAccounts permission.` },
        { status: 403 }
      );
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return assignMapping({
        db: tx,
        context,
        purpose,
        accountId,
        scope: {
          module: body?.module ?? undefined,
          transactionType: body?.transactionType ?? undefined,
          currency: body?.currency ?? undefined,
          branchId: body?.branchId ?? undefined,
        },
        approvedBy: null,
      });
    });

    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.MAPPING_ASSIGN,
      context,
      entityType: 'CoaV2AccountMapping',
      entityId: result.mapping.id,
      previousValues: result.previous
        ? { accountId: result.previous.accountId, status: result.previous.status }
        : null,
      newValues: { purpose, accountId, scope: result.mapping.moduleKey },
      reason: body?.reason ?? null,
    });

    return NextResponse.json(
      { mapping: result.mapping, replaced: Boolean(result.previous), message: 'Mapping assigned' },
      { status: result.previous ? 200 : 201 }
    );
  } catch (error) {
    return coaErrorResponse(error, 'assign account mapping');
  }
}
