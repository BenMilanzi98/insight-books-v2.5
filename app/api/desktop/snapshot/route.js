import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { buildDesktopSnapshot } from '@/lib/desktop/cloud/snapshot.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const deviceId =
    request.nextUrl?.searchParams.get('deviceId') ||
    new URL(request.url).searchParams.get('deviceId') ||
    '';

  const device = await prisma.desktopDevice.findFirst({
    where: {
      tenantId: user.tenantId,
      deviceId,
      unboundAt: null,
    },
    select: { id: true },
  });

  if (!device) {
    return NextResponse.json(
      { error: 'Desktop device is not bound', code: DESKTOP_CODES.NOT_BOUND },
      { status: 403 }
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
