import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { applyDesktopOutboxBatch } from '@/lib/desktop/cloud/outboxApply.js';
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

  const perm = await requireAnyPermission(request, [
    'sales.create',
    'invoices.create',
    'inventory.update',
    'payments.create',
    'clients.create',
  ]);
  if (perm) return perm;

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

  const batch = await applyDesktopOutboxBatch({
    prisma,
    tenantId: user.tenantId,
    user,
    deviceId,
    items,
    request,
  });

  if (batch.error) {
    console.error('Desktop outbox apply failed:', {
      id: batch.stoppedAt,
      kind: batch.error.kind,
      message: batch.error.message,
      code: batch.error.code,
    });
    return NextResponse.json(batch, { status: batch.error.status || 400 });
  }

  return NextResponse.json({ results: batch.results });
}
