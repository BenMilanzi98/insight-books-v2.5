import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { getApiRuleForPath, isApiPublicPath } from '@/lib/tenantApiAccess';

/**
 * GET /api/auth/api-guard?path=/api/invoices
 * Used by middleware to enforce API RBAC centrally.
 */
export async function GET(request) {
  try {
    const path = request.nextUrl.searchParams.get('path') || '';
    if (!path.startsWith('/api/')) {
      return NextResponse.json({ allowed: true });
    }

    if (isApiPublicPath(path)) {
      return NextResponse.json({ allowed: true, public: true });
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ allowed: false, reason: 'auth' }, { status: 401 });
    }

    const rule = getApiRuleForPath(path);
    if (!rule) {
      return NextResponse.json({ allowed: false, reason: 'no_rule' }, { status: 403 });
    }

    const ok = rule.anyOf.some((perm) => hasPermission(user, perm));
    if (!ok) {
      return NextResponse.json(
        { allowed: false, reason: 'permission', required: rule.anyOf },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error('api-guard:', error);
    return NextResponse.json({ allowed: false, reason: 'guard_error' }, { status: 500 });
  }
}

