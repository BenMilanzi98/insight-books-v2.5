import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const branches = await prisma.branch.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: {
        id: true,
        tenantId: true,
        name: true,
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
      { success: false, error: 'Failed to fetch branches' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
