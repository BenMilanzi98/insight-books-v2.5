/**
 * GET  /api/setup/runs — active run (+ optional classification)
 * POST /api/setup/runs — create or return existing active run
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import {
  createSetupRun,
  getActiveSetupRun,
} from '@/lib/setupWizard/setupRunService.js';
import { classifyBusinessActivity } from '@/lib/setupWizard/activityClassifier.js';
import { setupErrorResponse } from '@/lib/setupWizard/errors.js';
import { SETUP_PERMISSION_ALIASES } from '@/lib/setupWizard/constants.js';

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

export async function GET(request) {
  const guard = await guardSetup(request, 'setup.view');
  if (guard.response) return guard.response;
  const { user } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const includeClassification = searchParams.get('classify') === '1';

    const [run, classification] = await Promise.all([
      getActiveSetupRun(user.tenantId),
      includeClassification
        ? classifyBusinessActivity(user.tenantId)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      run,
      classification,
    });
  } catch (error) {
    const { status, body } = setupErrorResponse(error, 'Failed to load setup run.');
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  const guard = await guardSetup(request, 'setup.start');
  if (guard.response) return guard.response;
  const { user } = guard;

  try {
    const body = await request.json().catch(() => ({}));
    const run = await createSetupRun({
      tenantId: user.tenantId,
      userId: user.id,
      setupType: body.setupType,
      conversionApproved: Boolean(body.conversionApproved),
      baseCurrency: body.baseCurrency ?? null,
      timezone: body.timezone ?? null,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    const { status, body } = setupErrorResponse(error, 'Failed to start setup.');
    return NextResponse.json(body, { status });
  }
}
