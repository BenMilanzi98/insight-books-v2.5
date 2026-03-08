import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    console.log('Update subscription endpoint called');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { subscriptionId, ...updateData } = body;
    
    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('Admin authenticated:', admin.email);

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
    } = updateData;

    // Validate required fields
    if (!tenantId || !plan || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, plan, and amount are required' },
        { status: 400 }
      );
    }

    console.log('Attempting to update subscription with ID:', subscriptionId);

    // Check if subscription exists
    const existingSubscription = await prisma.accountSubscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!existingSubscription) {
      console.log('Subscription not found:', subscriptionId);
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      console.log('Tenant not found:', tenantId);
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    console.log('Subscription and tenant found, proceeding with update');

    // Build update payload: only include defined fields to avoid Prisma errors
    const prismaUpdatePayload = {
      tenantId,
      plan,
      amount: parseFloat(amount),
      startedAt: isActive ? (existingSubscription.startedAt || new Date()) : existingSubscription.startedAt
    };
    if (currency != null) prismaUpdatePayload.currency = currency;
    if (status != null) prismaUpdatePayload.status = status;
    if (paymentMethod !== undefined) prismaUpdatePayload.paymentMethod = paymentMethod;
    if (notes !== undefined) prismaUpdatePayload.notes = notes;
    if (typeof isActive === 'boolean') prismaUpdatePayload.isActive = isActive;
    if (typeof isTrial === 'boolean') prismaUpdatePayload.isTrial = isTrial;
    if (trialStartDate != null) prismaUpdatePayload.trialStartDate = new Date(trialStartDate);
    if (trialEndDate != null) prismaUpdatePayload.trialEndDate = new Date(trialEndDate);
    if (expiresAt != null) prismaUpdatePayload.expiresAt = new Date(expiresAt);

    const subscription = await prisma.accountSubscription.update({
      where: { id: subscriptionId },
      data: prismaUpdatePayload,
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

    console.log('Subscription updated successfully:', subscriptionId);

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
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
