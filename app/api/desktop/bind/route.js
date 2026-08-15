import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { bindDesktopDevice } from '@/lib/desktop/cloud/bind.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';

export async function POST(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  try {
    const result = await bindDesktopDevice({
      prisma,
      tenantId: user.tenantId,
      deviceId: String(body.deviceId || ''),
      name: String(body.name || 'Till'),
    });
    return NextResponse.json(result);
  } catch (error) {
    const status =
      error.status || (error.code === DESKTOP_CODES.DEVICE_BOUND ? 409 : 400);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status }
    );
  }
}
