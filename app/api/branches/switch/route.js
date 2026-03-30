import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getUserFromSession, getSessionTokenFromRequest } from '@/lib/auth';
import { getFreeBranchId, hasActiveBranchSubscription, syncBranchActiveStatus } from '@/lib/branchSubscriptionService';

export async function POST(request) {
  try {
    const body = await request.json();
    const { branchId } = body;
    
    // null clears branch in session; undefined is invalid
    if (branchId === undefined) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Branch-assigned users cannot switch to "all branches" (would bypass isolation).
    if (!branchId && user.allowedBranchIds != null) {
      return NextResponse.json(
        {
          error: 'Select a branch. You do not have access to all branches.',
          code: 'BRANCH_REQUIRED',
        },
        { status: 403 }
      );
    }

    // Keep branch activeness in sync with subscription expiry.
    // This ensures expired branches auto-deactivate.
    await syncBranchActiveStatus(user.tenantId);

    // If branchId is provided, validate it belongs to user's tenant and user is allowed to access it
    if (branchId) {
      if (user.allowedBranchIds && !user.allowedBranchIds.includes(branchId)) {
        return NextResponse.json(
          { error: 'You do not have access to this branch.', code: 'BRANCH_ACCESS_DENIED' },
          { status: 403 }
        );
      }
      const branch = await prisma.branch.findFirst({
        where: { 
          id: branchId,
          tenantId: user.tenantId,
          isActive: true
        }
      });
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found or inactive' }, { status: 404 });
      }

      // Enforce branch subscription for non-free branch (even if it isActive=true due to stale state)
      const freeBranchId = await getFreeBranchId(user.tenantId);
      const isFreeBranch = freeBranchId && freeBranchId === branchId;
      if (!isFreeBranch) {
        const ok = await hasActiveBranchSubscription(user.tenantId, branchId);
        if (!ok) {
          // Make sure it's inactive in DB
          await prisma.branch.update({ where: { id: branchId }, data: { isActive: false } });
          return NextResponse.json(
            {
              error: 'Branch subscription required to use this branch.',
              code: 'BRANCH_SUBSCRIPTION_REQUIRED',
              scope: 'branch',
              branchId,
            },
            { status: 403 }
          );
        }
      }
    }

    const sessionValue = await getSessionTokenFromRequest(request);
    if (!sessionValue) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    let sessionData = JSON.parse(Buffer.from(sessionValue, 'base64').toString());
    sessionData.branchId = branchId || null; // Store null if clearing branch
    const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: updatedSession,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return NextResponse.json({
      success: true,
      branchId: branchId || null,
      token: updatedSession
    });
  } catch (err) {
    console.error('Branch switch error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET - Get current branch from session
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ branchId: null });
    }

    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    const branchId = sessionData.branchId || null;

    // If branchId exists, validate user can access it and return branch info
    if (branchId) {
      if (user.allowedBranchIds && !user.allowedBranchIds.includes(branchId)) {
        sessionData.branchId = null;
        const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        cookieStore.set({
          name: 'session',
          value: updatedSession,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
        return NextResponse.json({ branchId: null });
      }
      const branch = await prisma.branch.findFirst({
        where: { 
          id: branchId,
          tenantId: user.tenantId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          code: true,
          isActive: true
        }
      });
      
      if (branch) {
        return NextResponse.json({ branchId: branch.id, branch });
      } else {
        // Branch no longer exists or is inactive, clear from session
        sessionData.branchId = null;
        const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');
        cookieStore.set({
          name: 'session',
          value: updatedSession,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
        return NextResponse.json({ branchId: null });
      }
    }

    return NextResponse.json({ branchId: null });
  } catch (err) {
    console.error('Get branch error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}






