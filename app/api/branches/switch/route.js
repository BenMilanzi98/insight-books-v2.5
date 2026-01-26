import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { branchId } = body;
    
    // Allow null/empty to clear branch selection
    if (branchId === undefined) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // If branchId is provided, validate it belongs to user's tenant
    if (branchId) {
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
    }

    // Update session cookie with branchId
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    let sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    sessionData.branchId = branchId || null; // Store null if clearing branch
    const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');

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
      branchId: branchId || null
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

    // If branchId exists, validate and return branch info
    if (branchId) {
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






