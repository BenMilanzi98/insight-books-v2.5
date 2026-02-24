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

    const branchSubscriptions = await prisma.branchSubscription.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const transformed = branchSubscriptions.map(subscription => ({
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      isActive: subscription.isActive,
      amount: subscription.amount,
      currency: subscription.currency,
      paymentMethod: subscription.paymentMethod,
      txRef: subscription.txRef,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      tenant: subscription.tenant,
      tenantId: subscription.tenantId,
      branch: subscription.branch,
      branchId: subscription.branchId,
      notes: subscription.notes
    }));

    return NextResponse.json({
      success: true,
      branchSubscriptions: transformed
    });
  } catch (error) {
    console.error('Error fetching branch subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch branch subscriptions', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
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

    const body = await request.json();
    const {
      tenantId,
      branchId,
      durationDays,
      amount,
      currency = 'MWK',
      notes
    } = body || {};

    if (!tenantId || !branchId) {
      return NextResponse.json(
        { success: false, error: 'Tenant and branch are required' },
        { status: 400 }
      );
    }

    const duration = Number(durationDays);
    if (!Number.isFinite(duration) || duration <= 0) {
      return NextResponse.json(
        { success: false, error: 'Duration must be a positive number of days' },
        { status: 400 }
      );
    }

    const amountValue = amount === '' || amount === null || typeof amount === 'undefined'
      ? 0
      : Number(amount);
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a valid non-negative number' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true }
    });
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, tenantId: true }
    });
    if (!branch || branch.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: 'Branch not found for this tenant' },
        { status: 404 }
      );
    }

    await prisma.branchSubscription.updateMany({
      where: { branchId, isActive: true },
      data: { isActive: false, status: 'Replaced' }
    });

    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + duration);

    const plan = amountValue > 0 ? 'custom' : 'trial';
    const status = amountValue > 0 ? 'Active' : 'Trial';

    const subscription = await prisma.branchSubscription.create({
      data: {
        tenantId,
        branchId,
        plan,
        txRef: `ADMIN_BRANCH_${branchId}_${Date.now()}`,
        amount: amountValue,
        currency,
        status,
        paymentMethod: 'admin',
        notes,
        isActive: true,
        startedAt,
        expiresAt
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        }
      }
    });

    await prisma.branch.update({
      where: { id: branchId },
      data: { isActive: true }
    });

    return NextResponse.json({
      success: true,
      branchSubscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        isActive: subscription.isActive,
        amount: subscription.amount,
        currency: subscription.currency,
        paymentMethod: subscription.paymentMethod,
        txRef: subscription.txRef,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
        tenant: subscription.tenant,
        tenantId: subscription.tenantId,
        branch: subscription.branch,
        branchId: subscription.branchId,
        notes: subscription.notes
      }
    });
  } catch (error) {
    console.error('Error creating branch subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create branch subscription', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
