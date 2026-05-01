import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getTenantSubscription, getRemainingTrialDays, isTenantTrialActive } from '@/lib/subscriptionService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Helper function to get subscription status for a tenant
    const getSubscriptionStatus = async (tenantId) => {
      const subscription = await getTenantSubscription(tenantId);
      if (!subscription) {
        return {
          isExpired: true,
          daysRemaining: 0,
          isTrial: false,
          expiresAt: null,
          trialEndDate: null
        };
      }

      const now = new Date();
      const expiryDate = subscription.isTrial ? subscription.trialEndDate : subscription.expiresAt;
      const isExpired = expiryDate ? now > expiryDate : true;
      const daysRemaining = expiryDate && !isExpired 
        ? Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)) 
        : 0;

      return {
        isExpired,
        daysRemaining: Math.max(0, daysRemaining),
        isTrial: subscription.isTrial || false,
        expiresAt: subscription.expiresAt,
        trialEndDate: subscription.trialEndDate
      };
    };

    // If user is MASTER_ADMIN, return all tenants
    if (user.role?.name === 'MASTER_ADMIN') {
      const allTenants = await prisma.tenant.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // Add subscription status to each tenant
      const tenantsWithSubscription = await Promise.all(
        allTenants.map(async (tenant) => ({
          ...tenant,
          subscription: await getSubscriptionStatus(tenant.id)
        }))
      );

      return NextResponse.json({
        tenants: tenantsWithSubscription,
        currentTenantId: user.tenantId
      });
    }

    // Businesses the user may access:
    // 1) TenantMembership (canonical for multi-business RBAC) — may exist without User↔Tenant M2M rows
    // 2) Legacy UserTenants many-to-many
    // 3) Primary user.tenantId (active session / home tenant)
    const [membershipRows, userWithTenants] = await Promise.all([
      prisma.tenantMembership.findMany({
        where: {
          userId: user.id,
          status: { equals: 'active', mode: 'insensitive' },
        },
        select: {
          tenant: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        include: {
          tenants: {
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          },
        },
      }),
    ]);

    const byTenantId = new Map();
    for (const row of membershipRows) {
      if (row.tenant?.id) {
        byTenantId.set(row.tenant.id, {
          id: row.tenant.id,
          name: row.tenant.name,
        });
      }
    }
    for (const t of userWithTenants?.tenants || []) {
      if (t?.id && !byTenantId.has(t.id)) {
        byTenantId.set(t.id, { id: t.id, name: t.name });
      }
    }

    let allTenants = Array.from(byTenantId.values());

    // Always include the current tenant if it exists
    if (user.tenantId) {
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, name: true },
      });

      if (currentTenant) {
        if (!byTenantId.has(currentTenant.id)) {
          byTenantId.set(currentTenant.id, currentTenant);
        }
        allTenants = Array.from(byTenantId.values());

        // Ensure user is in the many-to-many relationship with current tenant (legacy consumers)
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenants: {
                connect: { id: currentTenant.id },
              },
            },
          });
        } catch (error) {
          console.log('User already connected to tenant or error:', error.message);
        }
      }
    }

    // If still empty but user has a tenantId, return at least that tenant
    if (allTenants.length === 0 && user.tenantId) {
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, name: true },
      });

      if (currentTenant) {
        allTenants = [currentTenant];
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenants: {
                connect: { id: currentTenant.id },
              },
            },
          });
        } catch (error) {
          console.log('Error connecting user to tenant:', error.message);
        }
      }
    }

    allTenants.sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base',
      })
    );

    // Add subscription status to each tenant
    const tenantsWithSubscription = await Promise.all(
      allTenants.map(async (tenant) => ({
        ...tenant,
        subscription: await getSubscriptionStatus(tenant.id)
      }))
    );

    return NextResponse.json({
      tenants: tenantsWithSubscription,
      currentTenantId: user.tenantId
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
