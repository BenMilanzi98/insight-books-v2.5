import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';

async function resolveTargetCategory(tx, targetTenantId, sourceCategory, explicitCategoryId) {
  if (explicitCategoryId) {
    const cat = await tx.assetCategory.findFirst({
      where: { id: explicitCategoryId, tenantId: targetTenantId },
    });
    return cat;
  }
  const byName = await tx.assetCategory.findFirst({
    where: {
      tenantId: targetTenantId,
      name: { equals: sourceCategory.name, mode: 'insensitive' },
    },
  });
  if (byName) return byName;
  return tx.assetCategory.create({
    data: {
      tenantId: targetTenantId,
      name: sourceCategory.name,
      description:
        sourceCategory.description?.trim() ||
        'Category created when an asset was transferred from another business',
    },
  });
}

/**
 * POST — move asset from session tenant to another business the user may access.
 * Creates AssetInterBusinessTransfer + audit logs; depreciation/journal rows stay on the asset.
 */
export async function POST(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Next.js 15: dynamic route params may be a Promise
    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const { id: assetId } = resolvedParams || {};
    if (!assetId || typeof assetId !== 'string') {
      return NextResponse.json({ error: 'Invalid asset id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const targetTenantId = typeof body.targetTenantId === 'string' ? body.targetTenantId.trim() : '';
    const targetCategoryId =
      typeof body.targetCategoryId === 'string' && body.targetCategoryId.trim()
        ? body.targetCategoryId.trim()
        : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';

    if (!targetTenantId) {
      return NextResponse.json({ error: 'targetTenantId is required' }, { status: 400 });
    }

    const fromTenantId = user.tenantId;
    if (targetTenantId === fromTenantId) {
      return NextResponse.json(
        { error: 'Choose a different business than the current one' },
        { status: 400 }
      );
    }

    const accessible = await getAccessibleTenantIdsForUser(user);
    const allowed = new Set(accessible);
    if (!allowed.has(fromTenantId) || !allowed.has(targetTenantId)) {
      return NextResponse.json(
        { error: 'You do not have access to transfer between these businesses' },
        { status: 403 }
      );
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, tenantId: fromTenantId },
      include: { category: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active assets can be transferred to another business' },
        { status: 400 }
      );
    }

    const [fromTenant, toTenant] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: fromTenantId }, select: { id: true, name: true } }),
      prisma.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true, name: true } }),
    ]);

    if (!fromTenant || !toTenant) {
      return NextResponse.json({ error: 'Invalid business' }, { status: 400 });
    }

    const latest = await prisma.depreciationSchedule.findFirst({
      where: { assetId: asset.id },
      orderBy: { periodStart: 'desc' },
    });
    const currentAccumulatedDepreciation =
      latest?.accumulatedDepreciation ?? asset.accumulatedDepreciation ?? 0;
    const currentNetBookValue = asset.originalCost - currentAccumulatedDepreciation;

    const snapshot = {
      transferredAt: new Date().toISOString(),
      name: asset.name,
      originalCost: asset.originalCost,
      accumulatedDepreciation: currentAccumulatedDepreciation,
      netBookValue: currentNetBookValue,
      status: asset.status,
      serialNumber: asset.serialNumber,
      categoryName: asset.category.name,
      fromTenantId,
      toTenantId,
    };

    const result = await prisma.$transaction(async (tx) => {
      const targetCategory = await resolveTargetCategory(
        tx,
        targetTenantId,
        asset.category,
        targetCategoryId
      );

      if (!targetCategory) {
        throw Object.assign(new Error('INVALID_TARGET_CATEGORY'), { code: 'INVALID_TARGET_CATEGORY' });
      }

      const transfer = await tx.assetInterBusinessTransfer.create({
        data: {
          assetId: asset.id,
          fromTenantId,
          toTenantId,
          fromTenantName: fromTenant.name,
          toTenantName: toTenant.name,
          fromCategoryId: asset.categoryId,
          toCategoryId: targetCategory.id,
          fromCategoryName: asset.category.name,
          toCategoryName: targetCategory.name,
          transferredById: user.id,
          notes: notes || null,
          snapshotJson: JSON.stringify(snapshot),
        },
      });

      const updated = await tx.asset.update({
        where: { id: asset.id },
        data: {
          tenantId: targetTenantId,
          categoryId: targetCategory.id,
        },
        include: {
          category: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      const detailOut = {
        transferId: transfer.id,
        assetId: asset.id,
        assetName: asset.name,
        toTenantId,
        toTenantName: toTenant.name,
        netBookValue: currentNetBookValue,
      };
      const detailIn = {
        transferId: transfer.id,
        assetId: asset.id,
        assetName: asset.name,
        fromTenantId,
        fromTenantName: fromTenant.name,
        netBookValue: currentNetBookValue,
      };

      await tx.auditLog.create({
        data: {
          action: 'ASSET_TRANSFER_OUT',
          entityType: 'Asset',
          entityId: asset.id,
          userId: user.id,
          tenantId: fromTenantId,
          details: JSON.stringify(detailOut),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ASSET_TRANSFER_IN',
          entityType: 'Asset',
          entityId: asset.id,
          userId: user.id,
          tenantId: targetTenantId,
          details: JSON.stringify(detailIn),
        },
      });

      return { transfer, asset: updated };
    });

    return NextResponse.json({
      message: 'Asset transferred successfully',
      transfer: result.transfer,
      asset: result.asset,
    });
  } catch (error) {
    if (error?.code === 'INVALID_TARGET_CATEGORY') {
      return NextResponse.json({ error: 'Invalid category for the target business' }, { status: 400 });
    }
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Could not create matching category in target business (duplicate name). Pick a category manually.' },
        { status: 409 }
      );
    }
    // Table missing if migrations not applied
    if (error?.code === 'P2021' || /AssetInterBusinessTransfer/i.test(String(error?.message || ''))) {
      return NextResponse.json(
        {
          error:
            'Asset transfer is not available until the database is updated. Run: npx prisma migrate deploy',
        },
        { status: 503 }
      );
    }
    console.error('Asset transfer error:', error);
    return NextResponse.json(
      { error: 'Failed to transfer asset', details: error?.message },
      { status: 500 }
    );
  }
}
