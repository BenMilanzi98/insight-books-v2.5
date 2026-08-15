import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { buildDesktopSnapshot } from '@/lib/desktop/cloud/snapshot.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';

export function assertBoundDesktopDevice(device, tenantId) {
  if (!device || device.tenantId !== tenantId || device.unboundAt) {
    const error = new Error('Desktop device is not bound');
    error.code = DESKTOP_CODES.NOT_BOUND;
    error.status = 403;
    throw error;
  }
  return device;
}

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const deviceId =
    request.nextUrl?.searchParams.get('deviceId') ||
    new URL(request.url).searchParams.get('deviceId') ||
    '';

  const device = await prisma.desktopDevice.findUnique({
    where: { deviceId },
    select: { id: true, tenantId: true, unboundAt: true },
  });

  try {
    assertBoundDesktopDevice(device, user.tenantId);
  } catch (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  try {
    const snapshot = await buildDesktopSnapshot({
      prisma,
      tenantId: user.tenantId,
      userId: user.id,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Desktop snapshot build failed:', error);
    return NextResponse.json({ error: 'Unable to build desktop snapshot' }, { status: 500 });
  }
}
