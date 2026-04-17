import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveBranchId } from '@/lib/branchHelpers';

function canManageRentals(user) {
  return hasPermission(user, 'rentals.create') || hasPermission(user, 'rentals.update');
}

function canViewRentals(user) {
  return (
    hasPermission(user, 'rentals.view') ||
    hasPermission(user, 'rentals.create') ||
    hasPermission(user, 'invoices.view') ||
    hasPermission(user, 'invoices.create')
  );
}

/** GET — list bookable rental/hiring assets */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canViewRentals(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const branchIdParam = searchParams.get('branchId');

    const where = {
      tenantId: user.tenantId,
      isActive: true,
      ...(kind && ['rental', 'hiring'].includes(kind) ? { kind } : {}),
    };
    if (branchIdParam) {
      where.branchId = branchIdParam;
    }

    const assets = await prisma.rentalAsset.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ assets });
  } catch (e) {
    console.error('[rental-assets GET]', e);
    return NextResponse.json({ error: 'Failed to load rental assets' }, { status: 500 });
  }
}

/** POST — create bookable asset */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!canManageRentals(user)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      name,
      description,
      category = 'general',
      kind,
      totalQuantity = 1,
      defaultRate = 0,
      rateUnit = 'day',
      branchId: bodyBranchId,
    } = body;

    if (!name || !kind) {
      return NextResponse.json({ error: 'name and kind are required' }, { status: 400 });
    }
    if (!['rental', 'hiring'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be rental or hiring' }, { status: 400 });
    }
    if (!['day', 'hour'].includes(String(rateUnit))) {
      return NextResponse.json({ error: 'rateUnit must be day or hour' }, { status: 400 });
    }

    let branchId = null;
    try {
      branchId = await resolveBranchId(user, bodyBranchId, user.tenantId);
    } catch (branchErr) {
      return NextResponse.json({ error: branchErr.message || 'Invalid branch' }, { status: 403 });
    }

    const qty = kind === 'rental' ? 1 : Math.max(1, Math.floor(Number(totalQuantity) || 1));

    const asset = await prisma.rentalAsset.create({
      data: {
        tenantId: user.tenantId,
        branchId,
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        category: String(category).trim(),
        kind,
        status: 'available',
        totalQuantity: qty,
        defaultRate: Number(defaultRate) || 0,
        rateUnit: String(rateUnit),
        isActive: true,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (e) {
    console.error('[rental-assets POST]', e);
    return NextResponse.json({ error: 'Failed to create rental asset' }, { status: 500 });
  }
}
