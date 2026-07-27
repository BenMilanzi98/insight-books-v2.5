import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';
import { seedDefaultRolesForTenant } from '@/lib/seedTenantRoles';
import { getSubscriptionStatusFromSubscriptions } from '@/lib/subscriptionService';

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    // Fetch all tenants with subscription data (same source of truth as tenant-management)
    const tenantsRaw = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        subscriptionPlan: true,
        createdAt: true,
        updatedAt: true,
        accountSubscriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            isTrial: true,
            isActive: true,
            status: true,
            trialEndDate: true,
            expiresAt: true,
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const tenants = tenantsRaw.map((t) => {
      const subs = Array.isArray(t.accountSubscriptions) ? t.accountSubscriptions : [];
      const subscriptionStatus = getSubscriptionStatusFromSubscriptions(subs);
      const currentSub = subs[0];
      const plan = currentSub?.plan ?? t.subscriptionPlan ?? null;
      const { accountSubscriptions, ...rest } = t;
      return {
        ...rest,
        subscriptionStatus,
        plan,
      };
    });

    return NextResponse.json({
      success: true,
      tenants
    });

  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tenants', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.create)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tenant name is required' },
        { status: 400 }
      );
    }

    // Create the actual tenant in the database
    const baseSubdomain = name.toLowerCase().replace(/\s+/g, '');
    let subdomain = baseSubdomain;

    // Avoid 500s on duplicate tenant creation: tenant.subdomain is @unique.
    // If it already exists, append a small numeric suffix until unique (or until attempts run out).
    for (let i = 0; i < 10; i++) {
      const existing = await prisma.tenant.findUnique({ where: { subdomain } });
      if (!existing) break;
      subdomain = `${baseSubdomain}-${Date.now().toString().slice(-6)}-${i + 1}`;
    }

    let newTenant;
    try {
      newTenant = await prisma.tenant.create({
        data: {
          name: name.trim(),
          subdomain,
          subscriptionPlan: '1month',
          status: 'active',
          logoUrl: null,
          primaryColor: null,
          secondaryColor: null
        }
      });
    } catch (error) {
      // If we still hit a unique collision, return a clean 409 instead of 500.
      if (error?.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'Tenant subdomain already exists',
            details: 'Please use a different tenant name or subdomain.'
          },
          { status: 409 }
        );
      }
      throw error;
    }

    // Create admin audit log for tenant creation (after real id exists)
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'TENANT_CREATE',
        entityType: 'TENANT',
        entityId: newTenant.id,
        details: `Created new tenant: ${name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Create default tenant settings
    await prisma.tenantSettings.create({
      data: {
        tenantId: newTenant.id,
        businessEmail: `admin@${newTenant.subdomain}.com`, // Set a default business email
        businessPhone: '',
        businessAddress: '',
        businessCity: ''
      }
    });

    // Create a default account subscription for the new tenant
    await prisma.accountSubscription.create({
      data: {
        tenantId: newTenant.id,
        plan: '1month',
        txRef: `TRIAL_${newTenant.id}_${Date.now()}`,
        amount: 0.00,
        currency: 'MWK',
        status: 'Pending',
        isActive: false,
        isTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentMethod: 'trial'
      }
    });

    // Same financial bootstrap as self-serve signup: CoA, tax GL, open period, Cash payment account active.
    // Used by /insightbooks/tenant-management when an admin creates a tenant.
    try {
      const { initializeNewTenantFinancialDefaults } = await import('@/lib/initializeNewTenantFinancialDefaults');
      await initializeNewTenantFinancialDefaults(newTenant.id, prisma);
    } catch (financialInitErr) {
      console.error(
        'initializeNewTenantFinancialDefaults failed for admin-created tenant (tenant still created):',
        financialInitErr?.message || financialInitErr
      );
    }

    // Seed default role templates for this tenant
    try {
      await seedDefaultRolesForTenant(newTenant.id, prisma);
    } catch (e) {
      console.error('Default role seeding failed for admin-created tenant:', e?.message || e);
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant created successfully',
      tenant: {
        id: newTenant.id,
        name: newTenant.name,
        email: `admin@${newTenant.subdomain}.com`,
        subdomain: newTenant.subdomain,
        status: newTenant.status,
        subscriptionStatus: 'trial',
        plan: newTenant.subscriptionPlan,
        userCount: 0,
        createdAt: newTenant.createdAt.toISOString().split('T')[0],
        updatedAt: newTenant.updatedAt.toISOString().split('T')[0],
        subscriptionEndsAt: null,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        logoUrl: newTenant.logoUrl,
        primaryColor: newTenant.primaryColor,
        secondaryColor: newTenant.secondaryColor,
        amount: 0,
        currency: 'MWK',
        isTrial: true
      }
    });

  } catch (error) {
    console.error('Admin tenant creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tenant', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
} 