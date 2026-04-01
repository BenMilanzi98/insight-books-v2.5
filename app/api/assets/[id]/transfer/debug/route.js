import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/assets/[id]/transfer/debug
 *
 * Diagnostic endpoint — hit this in the browser to see exactly why transfer fails.
 * Returns a JSON checklist of every step that the real POST handler performs.
 * Safe (read-only, no mutations).
 */
export async function GET(request, routeContext) {
  const checks = [];
  const push = (label, ok, detail) => checks.push({ label, ok, detail });

  try {
    // 1 — params resolution
    let assetId;
    try {
      const rawParams = routeContext?.params;
      const resolved = typeof rawParams?.then === 'function' ? await rawParams : rawParams;
      assetId = resolved?.id;
      push('params resolution', !!assetId, { assetId, rawType: typeof rawParams });
    } catch (e) {
      push('params resolution', false, e?.message);
    }

    // 2 — session / auth
    let user;
    try {
      user = await getUserFromSession(request);
      push('getUserFromSession', !!(user?.id && user?.tenantId), {
        userId: user?.id,
        tenantId: user?.tenantId,
        roleName: user?.role?.name,
      });
    } catch (e) {
      push('getUserFromSession', false, e?.message);
    }

    // 3 — Prisma client has assetInterBusinessTransfer model
    const hasModel = typeof prisma.assetInterBusinessTransfer?.create === 'function';
    push('prisma.assetInterBusinessTransfer exists', hasModel);

    // 4 — table exists in connected DB
    let tableExists = false;
    try {
      const rows = await prisma.$queryRaw`
        SELECT 1 AS ok FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'AssetInterBusinessTransfer'
        LIMIT 1
      `;
      tableExists = Array.isArray(rows) && rows.length > 0;
      push('AssetInterBusinessTransfer table in DB', tableExists);
    } catch (e) {
      push('AssetInterBusinessTransfer table in DB', false, e?.message);
    }

    // 5 — asset lookup
    let asset;
    if (assetId && user?.tenantId) {
      try {
        asset = await prisma.asset.findFirst({
          where: { id: assetId, tenantId: user.tenantId },
          include: { category: true },
        });
        push('asset lookup', !!asset, asset ? {
          id: asset.id,
          name: asset.name,
          status: asset.status,
          tenantId: asset.tenantId,
          categoryId: asset.categoryId,
          categoryName: asset.category?.name,
        } : 'not found — does this asset belong to your current session tenant?');
      } catch (e) {
        push('asset lookup', false, e?.message);
      }
    } else {
      push('asset lookup', false, 'skipped (no assetId or no user.tenantId)');
    }

    // 6 — accessible tenants
    let accessible = [];
    if (user?.id) {
      try {
        const { getAccessibleTenantIdsForUser } = await import('@/lib/dashboardTenantScope');
        accessible = await getAccessibleTenantIdsForUser(user);
        push('getAccessibleTenantIdsForUser', accessible.length > 1, {
          count: accessible.length,
          ids: accessible.slice(0, 10),
          note: accessible.length <= 1
            ? 'User can only see 1 business — transfer needs at least 2'
            : undefined,
        });
      } catch (e) {
        push('getAccessibleTenantIdsForUser', false, e?.message);
      }
    } else {
      push('getAccessibleTenantIdsForUser', false, 'skipped (no user)');
    }

    // 7 — quick transactional write test (rollback immediately)
    if (hasModel && tableExists) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.assetInterBusinessTransfer.findFirst({ take: 1 });
          throw new Error('ROLLBACK_TEST');
        });
      } catch (e) {
        if (e?.message === 'ROLLBACK_TEST') {
          push('interactive transaction + transfer model query', true, 'read inside $transaction succeeded');
        } else {
          push('interactive transaction + transfer model query', false, e?.message);
        }
      }
    } else {
      push('interactive transaction + transfer model query', false, 'skipped (model or table missing)');
    }

    // 8 — DATABASE_URL hint (show host only, never credentials)
    try {
      const dbUrl = process.env.DATABASE_URL || '';
      const hostMatch = dbUrl.match(/@([^:/]+)/);
      push('DATABASE_URL host', !!hostMatch, {
        host: hostMatch ? hostMatch[1] : '(could not parse)',
        note: 'Is this the DB you expected for this deployment?',
      });
    } catch (e) {
      push('DATABASE_URL host', false, e?.message);
    }

    const allOk = checks.every((c) => c.ok);
    return NextResponse.json({
      allOk,
      summary: allOk
        ? 'All checks passed — the transfer should work. The 500 may be in the request body or a race condition.'
        : 'Some checks failed — see details below.',
      checks,
    });
  } catch (fatal) {
    return NextResponse.json({
      allOk: false,
      summary: 'Diagnostic endpoint itself crashed',
      fatalError: fatal?.message || String(fatal),
      checks,
    }, { status: 500 });
  }
}
