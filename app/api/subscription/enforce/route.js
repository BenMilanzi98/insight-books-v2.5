import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasStandardAccess } from '@/lib/subscriptionService';

// GET - Returns 200 if user has standard access, 401/403 otherwise
export async function GET(request) {
  try {
    console.log('[enforce] called');
    const user = await getUserFromSession(request);
    if (!user) {
      console.warn('[enforce] no user');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!user.tenantId) {
      console.warn('[enforce] no tenantId for user', user.id);
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 });
    }

    const allowed = await hasStandardAccess(user.tenantId);
    console.log('[enforce] tenant', user.tenantId, 'allowed=', allowed);
    if (!allowed) {
      console.warn('[enforce] access denied for tenant', user.tenantId);
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[enforce] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


