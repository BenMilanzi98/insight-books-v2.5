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

    // Backfill permissions for full-access roles (Admin/Owner) that were created
    // before newer permission modules/actions were added to permissionModules.
    try {
      const isFullAccessRole = ['Admin', 'Owner'].includes(user?.role?.name);
      if (isFullAccessRole) {
        const existingPerms = user?.role?.permissions || {};
        const nextPerms = JSON.parse(JSON.stringify(existingPerms));
        let changed = false;

        for (const [moduleKey, { actions }] of Object.entries(permissionModules)) {
          if (!nextPerms[moduleKey]) {
            nextPerms[moduleKey] = {};
          }
          for (const action of actions) {
            if (nextPerms[moduleKey][action] !== true) {
              nextPerms[moduleKey][action] = true;
              changed = true;
            }
          }
        }

        if (changed) {
          const updatedRole = await prisma.role.update({
            where: { id: user.role.id },
            data: { permissions: nextPerms },
          });
          user.role = updatedRole;
        }
      }
    } catch (e) {
      console.error('Permissions backfill failed:', e?.message || e);
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
