import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export async function withBudgetForecastAuth(request, permission, handler) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perms = Array.isArray(permission) ? permission : [permission];
    if (!perms.some((p) => hasPermission(user, p))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return await handler(user);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Request failed', code: error.code },
      { status }
    );
  }
}
