import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getUserFromSession, getSessionTokenFromRequest } from '@/lib/auth';

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

    const sessionValue = await getSessionTokenFromRequest(request);
    if (!sessionValue) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    let sessionData = JSON.parse(Buffer.from(sessionValue, 'base64').toString());
    sessionData.tenantId = tenantId;
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
