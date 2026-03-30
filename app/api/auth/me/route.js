import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { permissionModules } from '@/lib/permissionsMap';
import { applyBranchAccessToSessionUser, getSessionTokenFromRequest } from '@/lib/auth';
import { parseSessionPayload } from '@/lib/sessionCookie';

export async function GET(request) {
  try {
    const sessionValue = await getSessionTokenFromRequest(request);
    if (!sessionValue) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionData = parseSessionPayload(sessionValue);
    if (!sessionData) {
      const cookieStore = await cookies();
      cookieStore.delete('session');
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const cookieStore = await cookies();

    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        defaultBranchId: true,
        isActive: true,
        tenant: sessionData.tenantId
          ? {
              select: {
                id: true,
                name: true,
                subdomain: true,
                status: true,
                logoUrl: true,
              },
            }
          : undefined,
        defaultBranch: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      cookieStore.delete('session');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (!user.isActive) {
      cookieStore.delete('session');
      return NextResponse.json({ error: 'Your account has been deactivated' }, { status: 401 });
    }

    // Backfill permissions for existing tenants that were created before newer modules existed.
    try {
      if (user?.role?.name === 'Admin') {
        const existingPerms = user?.role?.permissions || {};
        const nextPerms = { ...existingPerms };

        const ensureModule = (moduleKey) => {
          if (nextPerms[moduleKey]) return;
          const actions = permissionModules?.[moduleKey]?.actions || [];
          nextPerms[moduleKey] = actions.reduce((acc, action) => {
            acc[action] = true;
            return acc;
          }, {});
        };

        ensureModule('budgets');
        ensureModule('branches');
        ensureModule('journalEntries');
        ensureModule('trialBalance');
        ensureModule('generalLedger');

        const changed = JSON.stringify(nextPerms) !== JSON.stringify(existingPerms);
        if (changed) {
          const updatedRole = await prisma.role.update({
            where: { id: user.role.id },
            data: { permissions: nextPerms },
          });
          user.role = updatedRole;
        }
      }
    } catch (e) {
      console.error('Budget permissions backfill failed:', e?.message || e);
    }

    const effectiveTenantId =
      sessionData.tenantId != null ? sessionData.tenantId : user.tenantId;

    const branchCtxUser = {
      id: user.id,
      tenantId: effectiveTenantId,
      role: user.role,
      currentBranchId: sessionData.branchId || null,
    };
    await applyBranchAccessToSessionUser(branchCtxUser);

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: effectiveTenantId,
      defaultBranchId: branchCtxUser.defaultBranchId ?? user.defaultBranchId ?? null,
      defaultBranch: user.defaultBranch,
      tenant: user.tenant,
      currentBranchId: branchCtxUser.currentBranchId,
      allowedBranchIds: branchCtxUser.allowedBranchIds,
      sessionTenantId: sessionData.tenantId ?? null,
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}
