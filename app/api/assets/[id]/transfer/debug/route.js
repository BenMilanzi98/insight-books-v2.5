import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

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

    // 2 — requireStandardAccess (subscription check — THIS is the step the previous debug missed)
    try {
      const accessError = await requireStandardAccess(request);
      if (accessError) {
        const body = await accessError.json().catch(() => ({}));
        push('requireStandardAccess (subscription)', false, {
          status: accessError.status,
          body,
          note: 'This is likely the cause of the 500! The subscription check failed or returned an error.',
        });
      } else {
        push('requireStandardAccess (subscription)', true, 'Access granted');
      }
    } catch (e) {
      push('requireStandardAccess (subscription)', false, {
        error: e?.message,
        note: 'requireStandardAccess threw an exception — this would cause a 500 in the transfer handler',
      });
    }

    // 3 — session / auth
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

    // 4 — Prisma client has assetInterBusinessTransfer model
    const hasModel = typeof prisma.assetInterBusinessTransfer?.create === 'function';
    push('prisma.assetInterBusinessTransfer exists', hasModel);

    // 5 — table exists in connected DB
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

    // 6 — accessible tenants (must run before asset lookup)
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

    // 7 — asset lookup (searches across ALL accessible tenants, not just session tenant)
    let asset;
    if (assetId && accessible.length > 0) {
      try {
        asset = await prisma.asset.findFirst({
          where: { id: assetId, tenantId: { in: accessible } },
          include: { category: true },
        });
        push('asset lookup (across accessible tenants)', !!asset, asset ? {
          id: asset.id,
          name: asset.name,
          status: asset.status,
          assetTenantId: asset.tenantId,
          sessionTenantId: user?.tenantId,
          sameAsSession: asset.tenantId === user?.tenantId,
          categoryId: asset.categoryId,
          categoryName: asset.category?.name,
        } : 'not found in any of your accessible tenants');
      } catch (e) {
        push('asset lookup (across accessible tenants)', false, e?.message);
      }
    } else {
      push('asset lookup (across accessible tenants)', false, 'skipped (no assetId or no accessible tenants)');
    }

    // 8 — pick a target tenant and simulate category resolution (read-only)
    if (user?.tenantId && accessible.length > 1 && asset?.category) {
      const targetTenantId = accessible.find((id) => id !== user.tenantId);
      if (targetTenantId) {
        try {
          const sourceName = asset.category.name;
          const existing = await prisma.assetCategory.findFirst({
            where: {
              tenantId: targetTenantId,
              name: { equals: sourceName, mode: 'insensitive' },
            },
          });
          push('category resolution (simulated)', true, {
            targetTenantId,
            sourceCategoryName: sourceName,
            matchFound: !!existing,
            matchId: existing?.id,
            note: existing
              ? 'Would reuse existing category'
              : 'Would create a new category in target business',
          });
        } catch (e) {
          push('category resolution (simulated)', false, e?.message);
        }
      }
    }

    // 9 — quick transactional write test (rollback immediately)
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

    // 10 — AuditLog write test (rollback)
    try {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            action: 'DEBUG_TEST',
            entityType: 'Asset',
            entityId: assetId || 'test',
            userId: user?.id || 'test',
            tenantId: user?.tenantId || null,
            details: '{}',
          },
        });
        throw new Error('ROLLBACK_AUDIT_TEST');
      });
    } catch (e) {
      if (e?.message === 'ROLLBACK_AUDIT_TEST') {
        push('auditLog create (rollback test)', true, 'AuditLog write succeeded');
      } else {
        push('auditLog create (rollback test)', false, {
          error: e?.message,
          code: e?.code,
          note: 'AuditLog creation failed — this could cause the 500',
        });
      }
    }

    // 11 — DATABASE_URL hint (show host only, never credentials)
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

    // 12 — NODE_ENV
    push('NODE_ENV', true, { value: process.env.NODE_ENV || '(not set)' });

    const allOk = checks.every((c) => c.ok);
    return NextResponse.json({
      allOk,
      summary: allOk
        ? 'All checks passed — the transfer should work. Try the transfer again; the red alert should now show the actual server error message.'
        : 'Some checks FAILED — see the items with ok:false below for the root cause.',
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
