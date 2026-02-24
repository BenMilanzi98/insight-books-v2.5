import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

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

    // Fetch all subscriptions with tenant information
    const subscriptions = await prisma.accountSubscription.findMany({
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

    // Transform the data for frontend
    const transformedSubscriptions = subscriptions.map(subscription => ({
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      isActive: subscription.isActive,
      isTrial: subscription.isTrial,
      amount: subscription.amount,
      currency: subscription.currency,
      paymentMethod: subscription.paymentMethod,
      txRef: subscription.txRef,
      trialStartDate: subscription.trialStartDate,
      trialEndDate: subscription.trialEndDate,
      expiresAt: subscription.expiresAt,
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
    }));

    return NextResponse.json({
      success: true,
      subscriptions: transformedSubscriptions
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
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
      plan,
      amount,
      currency,
      status,
      isActive,
      isTrial,
      trialStartDate,
      trialEndDate,
      expiresAt,
      paymentMethod,
      notes
    } = body;

    // Validate required fields
    if (!tenantId || !plan || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, plan, and amount are required' },
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

    // Generate unique transaction reference
    const txRef = `SUB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create subscription
    const subscription = await prisma.accountSubscription.create({
      data: {
        tenantId,
        plan,
        txRef,
        amount: parseFloat(amount),
        currency,
        status: status || 'Pending',
        paymentMethod,
        notes,
        isActive: isActive || false,
        isTrial: isTrial || false,
        trialStartDate: trialStartDate ? new Date(trialStartDate) : null,
        trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        startedAt: isActive ? new Date() : null
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

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        isActive: subscription.isActive,
        isTrial: subscription.isTrial,
        amount: subscription.amount,
        currency: subscription.currency,
        paymentMethod: subscription.paymentMethod,
        txRef: subscription.txRef,
        trialStartDate: subscription.trialStartDate,
        trialEndDate: subscription.trialEndDate,
        expiresAt: subscription.expiresAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        tenant: subscription.tenant,
        tenantId: subscription.tenantId,
        notes: subscription.notes
      }
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
} 