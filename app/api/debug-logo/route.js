import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

export async function GET(request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const perm = await requirePermission(request, 'system.view');
    if (perm) return perm;

    const userItem = await getUserFromSession(request);
    if (!userItem) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tenantId = userItem.tenantId;
    
    console.log('Debug Logo API - Checking tenant:', tenantId);
    
    // Get tenant data directly
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true
      }
    });

    console.log('Debug Logo API - Tenant data from database:', tenant);

    // Also get user data with tenant include
    const user = await prisma.user.findUnique({
      where: { id: userItem.id },
      include: {
        tenant: {
          include: { settings: true }
        }
      }
    });

    console.log('Debug Logo API - User data with tenant include:', {
      tenantId: user?.tenant?.id,
      tenantName: user?.tenant?.name,
      logoUrl: user?.tenant?.logoUrl,
      faviconUrl: user?.tenant?.faviconUrl
    });

    return NextResponse.json({
      success: true,
      tenantDirect: tenant,
      userWithTenant: {
        tenantId: user?.tenant?.id,
        tenantName: user?.tenant?.name,
        logoUrl: user?.tenant?.logoUrl,
        faviconUrl: user?.tenant?.faviconUrl,
        primaryColor: user?.tenant?.primaryColor,
        secondaryColor: user?.tenant?.secondaryColor
      },
      message: 'Debug information retrieved'
    });

  } catch (error) {
    console.error('Debug Logo API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to debug logo',
      details: error.message 
    }, { status: 500 });
  }
} 