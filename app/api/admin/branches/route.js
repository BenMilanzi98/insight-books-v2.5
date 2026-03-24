import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const includeInactive = searchParams.get('includeInactive');

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (includeInactive === 'false') where.isActive = true;

    const branches = await prisma.branch.findMany({
      where: Object.keys(where).length ? where : undefined,
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        isActive: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
            settings: {
              select: {
                businessEmail: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    const transformed = branches.map((branch) => ({
      ...branch,
      tenant: branch.tenant
        ? {
            id: branch.tenant.id,
            name: branch.tenant.name,
            subdomain: branch.tenant.subdomain,
            status: branch.tenant.status,
            email: branch.tenant.settings?.businessEmail || null
          }
        : null
    }));

    return NextResponse.json({ success: true, branches: transformed });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branches', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
