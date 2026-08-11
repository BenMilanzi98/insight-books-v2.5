import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { EIS_PLAN_IDS, EIS_PLANS } from '@/lib/subscriptionConfig';
import { requestEntitlementPendingFromSubscription } from '@/lib/mraEis/application/entitlementService.js';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'active', 'expired', 'all'
    const planType = searchParams.get('planType'); // 'monthly', 'yearly', 'all'
    const search = searchParams.get('search'); // search term

    // Build where clause with defensive fallbacks
    const eisPlanIds = Array.isArray(EIS_PLAN_IDS)
      ? EIS_PLAN_IDS
      : (EIS_PLANS ? [EIS_PLANS.MONTHLY, EIS_PLANS.YEARLY].filter(Boolean) : []);

    // Ensure we always pass an array to Prisma; an empty array will simply match none.
    const where = {
      plan: {
        in: eisPlanIds
      }
    };

    // If status is specified, filter by it
    if (status === 'active') {
      where.isActive = true;
      where.expiresAt = {
        gt: new Date()
      };
    } else if (status === 'expired') {
      where.OR = [
        { isActive: false },
        {
          expiresAt: {
            lt: new Date()
          }
        }
      ];
    }

    // Fetch all EIS subscriptions with tenant information
    const subscriptions = await prisma.accountSubscription.findMany({
      where,
      include: {
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
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Filter by plan type
    let filteredSubscriptions = subscriptions;
    if (planType === 'monthly') {
      filteredSubscriptions = subscriptions.filter(sub => sub.plan === 'eis-monthly');
    } else if (planType === 'yearly') {
      filteredSubscriptions = subscriptions.filter(sub => sub.plan === 'eis-yearly');
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filteredSubscriptions = filteredSubscriptions.filter(sub => 
        sub.tenant?.name?.toLowerCase().includes(searchLower) ||
        sub.tenant?.subdomain?.toLowerCase().includes(searchLower) ||
        sub.tenant?.settings?.businessEmail?.toLowerCase().includes(searchLower) ||
        sub.txRef?.toLowerCase().includes(searchLower)
      );
    }

    // Transform the data for frontend
    const transformedSubscriptions = filteredSubscriptions.map(subscription => {
      const isExpired = subscription.expiresAt && new Date(subscription.expiresAt) < new Date();
      const isActive = subscription.isActive && !isExpired;
      
      return {
        id: subscription.id,
        plan: subscription.plan,
        planType: subscription.plan === EIS_PLANS.MONTHLY ? 'monthly' : 'yearly',
        status: isActive ? 'Active' : (isExpired ? 'Expired' : subscription.status),
        isActive: isActive,
        isExpired: isExpired,
        isTrial: subscription.isTrial,
        amount: subscription.amount,
        currency: subscription.currency,
        paymentMethod: subscription.paymentMethod,
        txRef: subscription.txRef,
        trialStartDate: subscription.trialStartDate,
        trialEndDate: subscription.trialEndDate,
        expiresAt: subscription.expiresAt,
        startedAt: subscription.startedAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        tenant: subscription.tenant
          ? {
              id: subscription.tenant.id,
              name: subscription.tenant.name,
              subdomain: subscription.tenant.subdomain,
              status: subscription.tenant.status,
              email: subscription.tenant.settings?.businessEmail || null
            }
          : null,
        tenantId: subscription.tenantId,
        notes: subscription.notes
      };
    });

    // Calculate statistics
    const stats = {
      total: transformedSubscriptions.length,
      active: transformedSubscriptions.filter(s => s.isActive).length,
      expired: transformedSubscriptions.filter(s => s.isExpired).length,
      monthly: transformedSubscriptions.filter(s => s.planType === 'monthly').length,
      yearly: transformedSubscriptions.filter(s => s.planType === 'yearly').length,
      monthlyActive: transformedSubscriptions.filter(s => s.planType === 'monthly' && s.isActive).length,
      yearlyActive: transformedSubscriptions.filter(s => s.planType === 'yearly' && s.isActive).length,
      totalRevenue: transformedSubscriptions
        .filter(s => s.isActive)
        .reduce((sum, s) => sum + (s.amount || 0), 0)
    };

    return NextResponse.json({
      success: true,
      subscriptions: transformedSubscriptions,
      stats
    });

  } catch (error) {
    console.error('Error fetching EIS subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch EIS subscriptions', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      tenantId,
      plan, // 'eis-monthly' or 'eis-yearly'
      amount,
      currency,
      status,
      isActive,
      expiresAt,
      paymentMethod,
      notes
    } = body;

    // Validate required fields
    if (!tenantId || !plan) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId and plan are required' },
        { status: 400 }
      );
    }

    // Defensive fallback for plan ids in POST as well
    const eisPlanIds = Array.isArray(EIS_PLAN_IDS)
      ? EIS_PLAN_IDS
      : (EIS_PLANS ? [EIS_PLANS.MONTHLY, EIS_PLANS.YEARLY].filter(Boolean) : []);

    // Validate plan is an EIS plan (defensive)
    if (!Array.isArray(eisPlanIds) || !eisPlanIds.includes(plan)) {
      return NextResponse.json(
        { success: false, error: 'Invalid EIS plan. Must be one of: ' + (eisPlanIds.join ? eisPlanIds.join(', ') : '') },
        { status: 400 }
      );
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Check if tenant already has an active EIS subscription (null expiresAt = open-ended)
    const existingEIS = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        plan: {
          in: eisPlanIds
        },
        isActive: true,
        isTrial: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      }
    });

    if (existingEIS && isActive !== false) {
      return NextResponse.json(
        { success: false, error: 'Tenant already has an active EIS subscription' },
        { status: 400 }
      );
    }

    // Generate unique transaction reference
    const txRef = `EIS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate expiry date based on plan
    const expiryDate = expiresAt 
      ? new Date(expiresAt) 
      : (plan === EIS_PLANS.MONTHLY 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days for monthly
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year for yearly
        );

    // Get default amount based on plan if not provided
    const subscriptionAmount = amount || (plan === EIS_PLANS.MONTHLY ? 150000 : 950000);

    // Create subscription
    const subscription = await prisma.accountSubscription.create({
      data: {
        tenantId,
        plan,
        txRef,
        amount: parseFloat(subscriptionAmount),
        currency: currency || 'MWK',
        status: status || 'Active',
        paymentMethod,
        notes,
        isActive: isActive !== false,
        isTrial: false,
        startedAt: isActive !== false ? new Date() : null,
        expiresAt: expiryDate
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        }
      }
    });

    // Paid/active EIS package: open entitlement review (does not replace subscription unlock)
    if (subscription.isActive) {
      try {
        await requestEntitlementPendingFromSubscription({
          tenantId,
          subscriptionId: subscription.id,
          planCode: subscription.plan,
          reason: 'Admin-created MRA EIS subscription — entitlement review required',
          requestId: `admin-eis-sub:${subscription.id}`,
        });
      } catch (entitlementErr) {
        console.warn('EIS subscription created but entitlement pending failed:', entitlementErr?.message || entitlementErr);
      }
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        planType: subscription.plan === EIS_PLANS.MONTHLY ? 'monthly' : 'yearly',
        status: subscription.status,
        isActive: subscription.isActive,
        amount: subscription.amount,
        currency: subscription.currency,
        txRef: subscription.txRef,
        expiresAt: subscription.expiresAt,
        startedAt: subscription.startedAt,
        createdAt: subscription.createdAt,
        tenant: subscription.tenant,
        tenantId: subscription.tenantId,
        notes: subscription.notes
      }
    });

  } catch (error) {
    console.error('Error creating EIS subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create EIS subscription', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
