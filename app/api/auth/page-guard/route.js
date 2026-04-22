import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission, getDefaultPostLoginPath } from '@/lib/auth';
import { isPosOnlyShellRoleName } from '@/lib/tenantRoleAccess';
import { getRouteRuleForPath } from '@/lib/tenantPageAccess';

/**
 * GET /api/auth/page-guard?path=/users
 * Used by middleware to enforce tenant page access from persisted role permissions.
 */
export async function GET(request) {
  try {
    const pathname = request.nextUrl.searchParams.get('path') || '';
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ allowed: false, reason: 'auth' }, { status: 401 });
    }

    if (isPosOnlyShellRoleName(user.role?.name)) {
      return NextResponse.json({ allowed: true, posShell: true });
    }

    const rule = getRouteRuleForPath(pathname);
    if (!rule) {
      return NextResponse.json({ allowed: true });
    }

    const candidates = rule.anyOf || [];
    const ok = candidates.some((p) => hasPermission(user, p));
    if (ok) {
      return NextResponse.json({ allowed: true });
    }

    return NextResponse.json({
      allowed: false,
      redirect: getDefaultPostLoginPath(user),
      required: candidates,
    });
  } catch (e) {
    console.error('page-guard:', e);
    return NextResponse.json({ allowed: true, warn: 'guard_error' });
  }
}
