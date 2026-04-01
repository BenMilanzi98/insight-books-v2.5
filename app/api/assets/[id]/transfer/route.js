import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';
import { getErrorChain, findInChain, findPrismaCode, joinChainMessages } from '@/lib/prismaErrorChain';

/** Prisma + DB drivers require Node (not Edge). */
export const runtime = 'nodejs';

/** Avoid accidental caching of auth-bound routes. */
export const dynamic = 'force-dynamic';

/**
 * Prisma models can carry Date instances; ensure response JSON never throws (e.g. BigInt edge cases).
 * @param {unknown} value
 */
function jsonSafe(value) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Date) return v.toISOString();
        return v;
      })
    );
  } catch (serializeErr) {
    console.error('jsonSafe failed, returning minimal payload:', serializeErr);
    return { _serializationNote: 'Partial response; see server logs.' };
  }
}

async function findCategoryByNameCaseInsensitive(tx, targetTenantId, sourceName) {
  try {
    const row = await tx.assetCategory.findFirst({
      where: {
        tenantId: targetTenantId,
        name: { equals: sourceName, mode: 'insensitive' },
      },
    });
    if (row) return row;
  } catch (lookupErr) {
    console.warn('Insensitive category lookup failed, using JS fallback:', lookupErr?.message || lookupErr);
  }
  const all = await tx.assetCategory.findMany({
    where: { tenantId: targetTenantId },
    take: 500,
  });
  return all.find((c) => c.name.toLowerCase() === sourceName.toLowerCase()) || null;
}

/** True if the *connected* DB (DATABASE_URL for this process) has the transfer table. */
async function assetTransferTableExistsOnConnectedDb() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'AssetInterBusinessTransfer'
      LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    console.warn('Could not verify AssetInterBusinessTransfer table (information_schema):', e?.message || e);
    return true;
  }
}

async function resolveTargetCategory(tx, targetTenantId, sourceCategory, explicitCategoryId) {
  const sourceName = (sourceCategory?.name || 'Uncategorized').trim() || 'Uncategorized';

  if (explicitCategoryId) {
    const cat = await tx.assetCategory.findFirst({
      where: { id: explicitCategoryId, tenantId: targetTenantId },
    });
    return cat;
  }
  const byName = await findCategoryByNameCaseInsensitive(tx, targetTenantId, sourceName);
  if (byName) return byName;

  try {
    return await tx.assetCategory.create({
      data: {
        tenantId: targetTenantId,
        name: sourceName,
        description:
          sourceCategory?.description?.trim() ||
          'Category created when an asset was transferred from another business',
      },
    });
  } catch (e) {
    // Concurrent transfer / race: unique (tenantId, name) — re-fetch by case-insensitive name
    if (/** @type {{ code?: string }} */ (e).code === 'P2002') {
      const retry = await findCategoryByNameCaseInsensitive(tx, targetTenantId, sourceName);
      if (retry) return retry;
    }
    throw e;
  }
}

/**
 * POST — move asset from session tenant to another business the user may access.
 * Creates AssetInterBusinessTransfer + audit logs; depreciation/journal rows stay on the asset.
 */
async function handleAssetTransferPost(request, routeContext) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId || !user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (typeof prisma.assetInterBusinessTransfer?.create !== 'function') {
      return NextResponse.json(
        {
          error:
            'This server build is missing the asset transfer module. Redeploy after running prisma generate.',
          code: 'PRISMA_CLIENT_STALE',
        },
        { status: 503 }
      );
    }

    const hasTable = await assetTransferTableExistsOnConnectedDb();
    if (!hasTable) {
      return NextResponse.json(
        {
          error:
            'This server is connected to a database that does not have the asset-transfer table yet. Run `npx prisma migrate deploy` using the same DATABASE_URL as this deployment (not only on your laptop).',
          code: 'TABLE_MISSING',
        },
        { status: 503 }
      );
    }

    // Next.js 15: route context may omit params in edge cases; params may be a Promise
    const rawParams = routeContext && typeof routeContext === 'object' ? routeContext.params : undefined;
    const resolvedParams = typeof rawParams?.then === 'function' ? await rawParams : rawParams;
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

    const accessible = await getAccessibleTenantIdsForUser(user);
    const allowed = new Set(accessible);

    // Look up asset across ALL tenants the user can access (not just the session tenant),
    // because the user may be viewing asset-management for a different business.
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, tenantId: { in: [...allowed] } },
      include: { category: true },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const fromTenantId = asset.tenantId;

    if (targetTenantId === fromTenantId) {
      return NextResponse.json(
        { error: 'Choose a different business than the one the asset belongs to' },
        { status: 400 }
      );
    }

    if (!allowed.has(targetTenantId)) {
      return NextResponse.json(
        { error: 'You do not have access to the target business' },
        { status: 403 }
      );
    }

    if (!asset.category) {
      return NextResponse.json(
        { error: 'Asset has no category; assign a category before transferring.' },
        { status: 400 }
      );
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
    const currentNetBookValue = Number(asset.originalCost) - Number(currentAccumulatedDepreciation);

    const snapshot = {
      transferredAt: new Date().toISOString(),
      name: asset.name,
      originalCost: Number(asset.originalCost),
      accumulatedDepreciation: Number(currentAccumulatedDepreciation),
      netBookValue: currentNetBookValue,
      status: asset.status,
      serialNumber: asset.serialNumber,
      categoryName: asset.category.name,
      fromTenantId,
      toTenantId,
    };

    const result = await prisma.$transaction(
      async (tx) => {
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

        return { transfer, asset: updated };
      },
      { timeout: 20000, maxWait: 10000 }
    );

    const detailOut = {
      transferId: result.transfer.id,
      assetId: asset.id,
      assetName: asset.name,
      toTenantId,
      toTenantName: toTenant.name,
      netBookValue: currentNetBookValue,
    };
    const detailIn = {
      transferId: result.transfer.id,
      assetId: asset.id,
      assetName: asset.name,
      fromTenantId,
      fromTenantName: fromTenant.name,
      netBookValue: currentNetBookValue,
    };

    try {
      await prisma.auditLog.create({
        data: {
          action: 'ASSET_TRANSFER_OUT',
          entityType: 'Asset',
          entityId: asset.id,
          userId: user.id,
          tenantId: fromTenantId,
          details: JSON.stringify(detailOut),
        },
      });
    } catch (auditErr) {
      console.error('ASSET_TRANSFER_OUT audit log failed:', auditErr?.message || auditErr);
    }
    try {
      await prisma.auditLog.create({
        data: {
          action: 'ASSET_TRANSFER_IN',
          entityType: 'Asset',
          entityId: asset.id,
          userId: user.id,
          tenantId: targetTenantId,
          details: JSON.stringify(detailIn),
        },
      });
    } catch (auditErr) {
      console.error('ASSET_TRANSFER_IN audit log failed:', auditErr?.message || auditErr);
    }

    return NextResponse.json({
      message: 'Asset transferred successfully',
      transfer: jsonSafe(result.transfer),
      asset: jsonSafe(result.asset),
    });
  } catch (error) {
    const chain = getErrorChain(error);

    if (findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'INVALID_TARGET_CATEGORY')) {
      return NextResponse.json({ error: 'Invalid category for the target business' }, { status: 400 });
    }

    if (findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'P2002')) {
      return NextResponse.json(
        {
          error:
            'Could not complete transfer due to a duplicate record (e.g. category name). Pick a target category manually and try again.',
          code: 'P2002',
        },
        { status: 409 }
      );
    }

    const p2003 = findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'P2003');
    if (p2003) {
      const meta = /** @type {{ meta?: { field_name?: string } }} */ (p2003).meta;
      return NextResponse.json(
        {
          error: 'Database rejected the transfer (related record missing or invalid).',
          code: 'P2003',
          field: meta?.field_name,
        },
        { status: 400 }
      );
    }

    if (findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'P2025')) {
      return NextResponse.json({ error: 'Asset or related record was not found.', code: 'P2025' }, { status: 404 });
    }

    if (findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'P2034')) {
      return NextResponse.json(
        {
          error: 'Transfer conflicted with another update. Please try again.',
          code: 'P2034',
        },
        { status: 409 }
      );
    }

    if (findInChain(chain, (e) => /** @type {{ code?: string }} */ (e).code === 'P2028')) {
      return NextResponse.json(
        {
          error: 'Transfer timed out on the database. Please try again in a moment.',
          code: 'P2028',
        },
        { status: 504 }
      );
    }

    const errMsg = joinChainMessages(chain, error);
    const prismaCode = findPrismaCode(chain);

    // Table missing / wrong schema if migrations not applied
    if (
      findInChain(chain, (e) => ['P2021', 'P2010'].includes(/** @type {{ code?: string }} */ (e).code || '')) ||
      /does not exist/i.test(errMsg) ||
      /AssetInterBusinessTransfer/i.test(errMsg)
    ) {
      return NextResponse.json(
        {
          error:
            'Asset transfer requires a database migration. On the server run: npx prisma migrate deploy',
          code: prismaCode || 'SCHEMA_MISSING',
        },
        { status: 503 }
      );
    }

    console.error('Asset transfer error:', error);
    return NextResponse.json(
      {
        error: 'Failed to transfer asset',
        code: prismaCode,
        hint: errMsg.length > 280 ? `${errMsg.slice(0, 280)}…` : errMsg,
      },
      { status: 500 }
    );
  }
}

export async function POST(request, context) {
  try {
    return await handleAssetTransferPost(request, context);
  } catch (fatal) {
    const chain = getErrorChain(fatal);
    const hint = joinChainMessages(chain, fatal).slice(0, 400);
    console.error('POST /api/assets/[id]/transfer uncaught:', fatal);
    return NextResponse.json(
      {
        error: 'Asset transfer failed unexpectedly',
        code: 'UNHANDLED',
        hint: hint || undefined,
      },
      { status: 500 }
    );
  }
}
