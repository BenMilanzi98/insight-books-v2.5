import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';
import prisma from '@/lib/prisma';
import { syncUserTenantBusinessLinks } from '@/lib/syncUserTenantBusinessLinks';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tenant/sync-my-businesses
 *
 * Owner / Admin / tenant record owner / MASTER_ADMIN: reconciles M2M User↔Tenant links
 * and TenantMembership (Owner role) for every business this user owns or is already a member of.
 * Then clients should call GET /api/tenant/list again.
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownsAnyTenant =
      (await prisma.tenant.count({ where: { ownerUserId: user.id } })) > 0;

    const ownsCurrentSessionTenant = user.tenantId
      ? !!(await prisma.tenant.findFirst({
          where: { id: user.tenantId, ownerUserId: user.id },
          select: { id: true },
        }))
      : false;

    const canSync =
      user.role?.name === 'MASTER_ADMIN' ||
      isFullAccessTenantRole(user) ||
      hasPermission(user, 'system.switchTenant') ||
      ownsAnyTenant ||
      ownsCurrentSessionTenant;

    if (!canSync) {
      return NextResponse.json(
        {
          error:
            'Only business owners and administrators can sync linked businesses.',
          code: 'SYNC_NOT_ALLOWED',
        },
        { status: 403 }
      );
    }

    const summary = await syncUserTenantBusinessLinks(user.id, prisma);

    return NextResponse.json({
      ok: true,
      summary: {
        tenantsConsidered: summary.tenantIds.length,
        m2mLinksApplied: summary.m2mLinksApplied,
        ownerMembershipsEnsured: summary.membershipsEnsured,
        partialErrors: summary.errors,
      },
    });
  } catch (err) {
    console.error('sync-my-businesses:', err);
    return NextResponse.json(
      { error: 'Server error', message: err?.message },
      { status: 500 }
    );
  }
}
