/**
 * POST /api/coa-v2/accounts/[id]/lifecycle — controlled lifecycle transitions.
 *
 * Body: { action: 'deprecate'|'archive'|'restore', reason, replacementAccountId? }
 * Deprecation/archival never deletes rows or touches historical journal lines.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  deprecateAccount,
  archiveAccount,
  restoreAccount,
} from '@/lib/coaV2/application/lifecycleService.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

const ACTION_CONFIG = {
  deprecate: {
    permission: ACCOUNTING_PERMISSIONS.COA_DEPRECATE,
    audit: COA_AUDIT_ACTIONS.ACCOUNT_DEPRECATE,
    run: (args) => deprecateAccount(args),
  },
  archive: {
    permission: ACCOUNTING_PERMISSIONS.COA_ARCHIVE,
    audit: COA_AUDIT_ACTIONS.ACCOUNT_ARCHIVE,
    run: (args) => archiveAccount(args),
  },
  restore: {
    permission: ACCOUNTING_PERMISSIONS.COA_RESTORE,
    audit: COA_AUDIT_ACTIONS.ACCOUNT_RESTORE,
    run: (args) => restoreAccount(args),
  },
};

export async function POST(request, { params }) {
  const resolvedParams = typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = String(body?.action || '').toLowerCase();
  const config = ACTION_CONFIG[action];
  if (!config) {
    return NextResponse.json(
      { error: `Unknown lifecycle action "${action}". Expected deprecate, archive, or restore.` },
      { status: 400 }
    );
  }

  const guard = await guardCoaRoute(request, [config.permission, ACCOUNTING_PERMISSIONS.COA_MANAGE]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const before = await prisma.account.findFirst({
      where: { id, tenantId: context.businessId },
      select: { coaV2Status: true, isActive: true, deprecationReason: true, replacementAccountId: true },
    });
    if (!before) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const result = await config.run({
      context,
      accountId: id,
      reason: body?.reason,
      replacementAccountId: body?.replacementAccountId ?? undefined,
    });

    await recordCoaAudit({
      action: config.audit,
      context,
      entityType: 'Account',
      entityId: id,
      previousValues: before,
      newValues: {
        coaV2Status: result.account.coaV2Status,
        isActive: result.account.isActive,
        replacementAccountId: result.account.replacementAccountId ?? null,
      },
      reason: body?.reason ?? null,
    });

    return NextResponse.json({
      account: result.account,
      usage: result.usage ?? null,
      message: `Account ${action}d successfully`,
    });
  } catch (error) {
    return coaErrorResponse(error, `${action} account`);
  }
}
