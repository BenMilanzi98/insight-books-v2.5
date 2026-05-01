import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requirePremiumAccess } from '@/lib/accessControl';
import { seedDefaultRolesForTenant } from '@/lib/seedTenantRoles';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Require active paid subscription to create a new business
    const accessError = await requirePremiumAccess(request);
    if (accessError) {
      return NextResponse.json(
        { 
          error: 'Active subscription required to create a new business. Please subscribe first.',
          code: 'SUBSCRIPTION_REQUIRED'
        },
        { status: 403 }
      );
    }

    // Create the tenant (current user is the main tenant / owner)
    const tenant = await prisma.tenant.create({
      data: {
        name,
        subdomain: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        // Set subscription based on the selected plan
        subscriptionPlan: body.selectedPlan === '1year' ? '1year' : 
                         body.selectedPlan === '3months' ? '3months' : 
                         body.selectedPlan === '1month' ? '1month' : '1month',
        status: 'active',
        ownerUserId: user.id,
      }
    });

    // Then connect the user to the tenant via the many-to-many relationship
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tenants: {
          connect: { id: tenant.id }
        }
      }
    });

    const { initializeNewTenantFinancialDefaults } = await import('@/lib/initializeNewTenantFinancialDefaults');
    await initializeNewTenantFinancialDefaults(tenant.id, prisma);

    // Seed role templates for the new tenant + creator membership (required for /api/tenant/list & RBAC)
    let seededRoles = null;
    try {
      seededRoles = await seedDefaultRolesForTenant(tenant.id, prisma);
      const ownerRole = seededRoles?.Owner;
      if (ownerRole?.id) {
        await prisma.tenantMembership.upsert({
          where: {
            userId_tenantId: { userId: user.id, tenantId: tenant.id },
          },
          create: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: ownerRole.id,
            status: 'active',
          },
          update: { status: 'active', roleId: ownerRole.id },
        });
      }
    } catch (e) {
      console.error('tenant/add seed or membership:', e?.message || e);
      try {
        const ownerRole = await prisma.role.findFirst({
          where: { tenantId: tenant.id, name: 'Owner' },
          select: { id: true },
        });
        if (ownerRole?.id) {
          await prisma.tenantMembership.upsert({
            where: {
              userId_tenantId: { userId: user.id, tenantId: tenant.id },
            },
            create: {
              userId: user.id,
              tenantId: tenant.id,
              roleId: ownerRole.id,
              status: 'active',
            },
            update: { status: 'active', roleId: ownerRole.id },
          });
        }
      } catch (e2) {
        console.error('tenant/add membership fallback:', e2?.message || e2);
      }
    }

    const linked = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: { userId: user.id, tenantId: tenant.id },
      },
      select: { id: true },
    });
    if (!linked) {
      const ownerRole = await prisma.role.findFirst({
        where: { tenantId: tenant.id, name: 'Owner' },
        select: { id: true },
      });
      if (ownerRole?.id) {
        try {
          await prisma.tenantMembership.create({
            data: {
              userId: user.id,
              tenantId: tenant.id,
              roleId: ownerRole.id,
              status: 'active',
            },
          });
        } catch (e3) {
          console.error('tenant/add final membership create:', e3?.message || e3);
        }
      }
    }

    return NextResponse.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
