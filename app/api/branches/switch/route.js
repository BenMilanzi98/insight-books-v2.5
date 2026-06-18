import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, getSessionTokenFromRequest } from '@/lib/auth';
import { getSessionCookieOptions } from '@/lib/sessionCookie';
import { applyHiddenPrimaryBranchToUser } from '@/lib/hiddenPrimaryBranch';

/**
 * Branch switching is disabled — session always uses the tenant's hidden primary branch.
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await applyHiddenPrimaryBranchToUser(user);
    const primaryBranchId = user.primaryBranchId ?? null;

    const sessionValue = await getSessionTokenFromRequest(request);
    if (!sessionValue) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const sessionData = JSON.parse(Buffer.from(sessionValue, 'base64').toString());
    sessionData.branchId = primaryBranchId;
    const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: updatedSession,
      ...getSessionCookieOptions(),
    });

    return NextResponse.json({
      success: true,
      branchId: primaryBranchId,
      token: updatedSession,
    });
  } catch (err) {
    console.error('Branch switch error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** Returns hidden primary branch id only — no branch metadata exposed. */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await applyHiddenPrimaryBranchToUser(user);
    return NextResponse.json({ branchId: user.primaryBranchId ?? null });
  } catch (err) {
    console.error('Get branch error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
