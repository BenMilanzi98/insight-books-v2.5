import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { validateSetupRun } from '@/lib/setupWizard/lifecycleService.js';
import { setupErrorResponse } from '@/lib/setupWizard/errors.js';
import { SETUP_PERMISSION_ALIASES } from '@/lib/setupWizard/constants.js';

export async function GET(request, { params }) {
  const denied = await requirePermission(
    request,
    SETUP_PERMISSION_ALIASES['setup.view'] || 'settings.view'
  );
  if (denied) return denied;
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const preview = await validateSetupRun(id, user.tenantId);
    return NextResponse.json({ preview });
  } catch (error) {
    const { status, body } = setupErrorResponse(error, 'Failed to validate setup.');
    return NextResponse.json(body, { status });
  }
}
