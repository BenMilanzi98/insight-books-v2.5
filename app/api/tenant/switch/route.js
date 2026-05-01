import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  applyTenantMembershipRole,
  getUserFromSession,
  getSessionTokenFromRequest,
} from '@/lib/auth';
import { getSessionCookieOptions, parseSessionPayload } from '@/lib/sessionCookie';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tenantId } = body;
    if (!tenantId) return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const hasAccess = await prisma.user.findFirst({
      where: {
        id: user.id,
        OR: [{ tenantId }, { tenants: { some: { id: tenantId } } }],
      },
      select: { id: true },
    });
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    const sessionValue = await getSessionTokenFromRequest(request);
    if (!sessionValue) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const sessionData = parseSessionPayload(sessionValue);
    if (!sessionData) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userForRole = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        tenantId: true,
        role: { select: { id: true, name: true, permissions: true } },
      },
    });
    if (userForRole) {
      await applyTenantMembershipRole(userForRole, tenantId);
      sessionData.role = userForRole.role?.name ?? sessionData.role ?? null;
    }

    sessionData.tenantId = tenantId;
    const updatedSession = Buffer.from(JSON.stringify(sessionData)).toString('base64');

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: updatedSession,
      ...getSessionCookieOptions(),
    });

    await prisma.user.update({
        where: { id: user.id },
        data: { tenantId }
    });

    return NextResponse.json({
      success: true,
      token: updatedSession
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
