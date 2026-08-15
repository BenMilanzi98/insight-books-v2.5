import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { applyDesktopOutboxItem } from '@/lib/desktop/cloud/outboxApply.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';

/**
 * Drain a desktop till's outbox. Items are applied strictly in array order and the
 * first failure stops the batch: later mutations usually depend on earlier ones
 * (a payment on an invoice that has not been created yet, etc.).
 */
export async function POST(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const deviceId = String(body.deviceId || '');
  const items = Array.isArray(body.items) ? body.items : [];

  const device = deviceId
    ? await prisma.desktopDevice.findUnique({
        where: { deviceId },
        select: { id: true, tenantId: true, unboundAt: true },
      })
    : null;

  if (!device || device.tenantId !== user.tenantId || device.unboundAt) {
    return NextResponse.json(
      { error: 'Desktop device is not bound', code: DESKTOP_CODES.NOT_BOUND },
      { status: 403 }
    );
  }

  const results = [];
  for (const item of items) {
    try {
      const applied = await applyDesktopOutboxItem({
        prisma,
        tenantId: user.tenantId,
        user,
        deviceId,
        item,
        request,
      });
      results.push({
        id: item?.id ?? null,
        kind: item?.kind ?? null,
        serverId: applied.serverId,
        duplicate: applied.duplicate,
      });
    } catch (error) {
      console.error('Desktop outbox apply failed:', {
        id: item?.id,
        kind: item?.kind,
        message: error?.message,
        code: error?.code,
      });
      return NextResponse.json(
        {
          results,
          stoppedAt: item?.id ?? null,
          error: {
            message: error?.message || 'Outbox item failed',
            code: error?.code || null,
            kind: item?.kind ?? null,
          },
        },
        { status: error?.status || 400 }
      );
    }
  }

  return NextResponse.json({ results });
}
