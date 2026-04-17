import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';

function canManage(user) {
  return hasPermission(user, 'rentals.create') || hasPermission(user, 'rentals.update');
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, 'rentals.view') && !canManage(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const asset = await prisma.rentalAsset.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (e) {
    console.error('[rental-assets id GET]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManage(user)) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.rentalAsset.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description;
    if (body.category != null) data.category = String(body.category).trim();
    if (body.defaultRate != null) data.defaultRate = Number(body.defaultRate) || 0;
    if (body.rateUnit != null && ['day', 'hour'].includes(body.rateUnit)) data.rateUnit = body.rateUnit;
    if (body.status != null) data.status = String(body.status);
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    if (body.totalQuantity != null && existing.kind === 'hiring') {
      data.totalQuantity = Math.max(1, Math.floor(Number(body.totalQuantity) || 1));
    }
    if (body.branchId !== undefined) {
      try {
        data.branchId = await resolveBranchId(user, body.branchId, user.tenantId);
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
    }

    const asset = await prisma.rentalAsset.update({
      where: { id },
      data,
    });
    return NextResponse.json({ asset });
  } catch (e) {
    console.error('[rental-assets PATCH]', e);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(user, 'rentals.delete') && !hasPermission(user, 'rentals.update')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.rentalAsset.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.rentalAsset.update({
      where: { id },
      data: { isActive: false, status: 'maintenance' },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[rental-assets DELETE]', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
