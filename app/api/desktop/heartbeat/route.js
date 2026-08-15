import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { heartbeatDesktopDevice } from '@/lib/desktop/cloud/heartbeat.js';

export async function POST(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const result = await heartbeatDesktopDevice({
      prisma,
      tenantId: user.tenantId,
      deviceId: String(body.deviceId || ''),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status || 400 }
    );
  }
}
