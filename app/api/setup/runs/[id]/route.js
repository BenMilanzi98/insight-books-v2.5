/**
 * GET   /api/setup/runs/[id]
 * PATCH /api/setup/runs/[id] — save step payload / navigate
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { getSetupRun, saveSetupStep } from '@/lib/setupWizard/setupRunService.js';
import { setupErrorResponse } from '@/lib/setupWizard/errors.js';
import { SETUP_PERMISSION_ALIASES, SETUP_STEP_STATUS } from '@/lib/setupWizard/constants.js';

async function guardSetup(request, setupPermission) {
  const alias = SETUP_PERMISSION_ALIASES[setupPermission] || 'settings.view';
  const denied = await requirePermission(request, alias);
  if (denied) return { response: denied };
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}

export async function GET(request, { params }) {
  const guard = await guardSetup(request, 'setup.view');
  if (guard.response) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const run = await getSetupRun(id, user.tenantId);
    return NextResponse.json({ run });
  } catch (error) {
    const { status, body } = setupErrorResponse(error, 'Failed to load setup run.');
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request, { params }) {
  const guard = await guardSetup(request, 'setup.businessProfile.manage');
  if (guard.response) return guard.response;
  const { user } = guard;
  const { id } = await params;

  try {
    const body = await request.json();
    if (!body.stepId) {
      return NextResponse.json(
        { error: 'STEP_REQUIRED', message: 'stepId is required.' },
        { status: 400 }
      );
    }

    const run = await saveSetupStep({
      runId: id,
      tenantId: user.tenantId,
      userId: user.id,
      stepId: body.stepId,
      payload: body.payload || {},
      status: body.status || SETUP_STEP_STATUS.IN_PROGRESS,
      expectedDraftVersion: body.expectedDraftVersion,
      currentStepId: body.currentStepId,
      openingBalanceDate: body.openingBalanceDate,
      cutoverDate: body.cutoverDate,
      baseCurrency: body.baseCurrency,
      timezone: body.timezone,
    });

    return NextResponse.json({ run });
  } catch (error) {
    const { status, body } = setupErrorResponse(error, 'Failed to save setup step.');
    return NextResponse.json(body, { status });
  }
}
