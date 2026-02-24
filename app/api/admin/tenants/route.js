import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
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
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
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

    // Create admin audit log for tenant creation
    await prisma.adminAuditLog.create({
      data: {
        adminId: decoded.adminId,
        action: 'TENANT_CREATE',
        entityType: 'TENANT',
        entityId: Date.now().toString(),
        details: `Created new tenant: ${name}`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Create the actual tenant in the database
    const newTenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        subdomain: name.toLowerCase().replace(/\s+/g, ''),
        subscriptionPlan: '1month',
        status: 'active',
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null
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

    // Initialize default payment accounts
    const { initializeDefaultPaymentAccounts } = await import('@/lib/paymentAccountInitialization');
    await initializeDefaultPaymentAccounts(newTenant.id);

    // Get tenant settings for business email
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: newTenant.id }
    });

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