/**
 * POST /api/setup/runs/[id]/[action]
 * actions: submit | approve | post | reopen-request | reopen-approve
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission, hasPermission } from '@/lib/auth';
import {
  submitSetupForReview,
  approveSetupRun,
  postSetupRun,
  requestSetupReopen,
  approveSetupReopen,
} from '@/lib/setupWizard/lifecycleService.js';
import { setupErrorResponse } from '@/lib/setupWizard/errors.js';
import { SETUP_PERMISSION_ALIASES } from '@/lib/setupWizard/constants.js';
import { contextFromSessionUser } from '@/lib/accountingV2/domain/accountingContext.js';
import { accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { AccountingV2Error } from '@/lib/accountingV2/domain/errors.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';

async function guard(request, setupKey) {
  const denied = await requirePermission(
    request,
    SETUP_PERMISSION_ALIASES[setupKey] || 'settings.view'
  );
  if (denied) return { response: denied };
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}

function setupCan(user) {
  return (key) => {
    if (hasPermission(user, key)) return true;
    if (
      hasPermission(user, 'settings.view') &&
      (String(key).startsWith('openingBalances') ||
        key === ACCOUNTING_PERMISSIONS.POSTING_PREVIEW)
    ) {
      return true;
    }
    return false;
  };
}

export async function POST(request, { params }) {
  const { id, action } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (action === 'submit') {
      const g = await guard(request, 'setup.submit');
      if (g.response) return g.response;
      const run = await submitSetupForReview(id, g.user.tenantId, g.user.id);
      return NextResponse.json({ run });
    }

    if (action === 'approve') {
      const g = await guard(request, 'setup.approve');
      if (g.response) return g.response;
      const run = await approveSetupRun(id, g.user.tenantId, g.user.id);
      return NextResponse.json({ run });
    }

    if (action === 'post') {
      const g = await guard(request, 'setup.post');
      if (g.response) return g.response;
      const context = contextFromSessionUser(g.user, {
        branchId: g.user.currentBranchId ?? null,
        requestId: request.headers.get('x-request-id') ?? undefined,
        correlationId: request.headers.get('x-correlation-id') ?? undefined,
      });
      const result = await postSetupRun(
        id,
        g.user.tenantId,
        g.user.id,
        context,
        setupCan(g.user)
      );
      return NextResponse.json(result);
    }

    if (action === 'reopen-request') {
      const g = await guard(request, 'setup.reopen.request');
      if (g.response) return g.response;
      const run = await requestSetupReopen(id, g.user.tenantId, g.user.id, body.reason);
      return NextResponse.json({ run });
    }

    if (action === 'reopen-approve') {
      const g = await guard(request, 'setup.reopen.approve');
      if (g.response) return g.response;
      const run = await approveSetupReopen(id, g.user.tenantId, g.user.id);
      return NextResponse.json({ run });
    }

    return NextResponse.json(
      { error: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof AccountingV2Error) {
      return accountingErrorResponse(error, `setup ${action}`);
    }
    const { status, body: errBody } = setupErrorResponse(error, `Failed to ${action} setup.`);
    return NextResponse.json(errBody, { status });
  }
}
