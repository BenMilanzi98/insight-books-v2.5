import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * GET /api/admin/users/roles — real Role rows (+ user counts). No mock catalog.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const platformOnly = searchParams.get('platform') === 'true';

    if (platformOnly) {
      const admins = await prisma.admin.groupBy({
        by: ['role'],
        _count: { id: true },
      });
      return NextResponse.json({
        success: true,
        roles: admins.map((row) => ({
          id: `platform:${row.role}`,
          name: row.role,
          description: 'Platform admin role',
          permissions: [],
          isActive: true,
          userCount: row._count.id,
          scope: 'platform',
        })),
        source: 'admin',
      });
    }

    const roles = await prisma.role.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { name: 'asc' },
      take: 500,
      include: {
        _count: { select: { users: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isActive: true,
        userCount: r._count.users,
        tenantId: r.tenantId,
        tenantName: r.tenant?.name || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        scope: r.tenantId ? 'tenant' : 'global',
      })),
      source: 'database',
    });
  } catch (error) {
    console.error('users/roles GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load roles' },
      { status: 500 }
    );
  }
}
