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

    // Get all tenants that the user is a member of via many-to-many relationship
    const userWithTenants = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        tenants: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    let allTenants = userWithTenants?.tenants || [];
    
    // Always include the current tenant if it exists
    if (user.tenantId) {
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true
        }
      });
      
      if (currentTenant) {
        // Add current tenant to the list if not already there
        if (!allTenants.find(t => t.id === currentTenant.id)) {
          allTenants.push(currentTenant);
        }
        
        // Ensure user is in the many-to-many relationship with current tenant
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenants: {
                connect: { id: currentTenant.id }
              }
            }
          });
        } catch (error) {
          // Ignore errors if the relationship already exists
          console.log('User already connected to tenant or error:', error.message);
        }
      }
    }

    // If no tenants found, but user has a tenantId, ensure we return at least that tenant
    if (allTenants.length === 0 && user.tenantId) {
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true
        }
      });
      
      if (currentTenant) {
        allTenants = [currentTenant];
        
        // Try to add user to the many-to-many relationship
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tenants: {
                connect: { id: currentTenant.id }
              }
            }
          });
        } catch (error) {
          console.log('Error connecting user to tenant:', error.message);
        }
      }
    }

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
