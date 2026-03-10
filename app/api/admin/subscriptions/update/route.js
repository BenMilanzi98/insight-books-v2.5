import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

/** Return a Date if the value is a valid date string/number; otherwise undefined (so we don't pass Invalid Date to Prisma). */
function parseDate(value) {
  if (value == null || value === '') return undefined;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

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
    if (!tenantId || !plan || (amount !== 0 && !amount)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tenantId, plan, and amount are required' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a valid non-negative number' },
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

    // Build update payload: only include defined fields; use valid dates only to avoid Prisma errors
    const prismaUpdatePayload = {
      tenantId,
      plan: String(plan).trim() || existingSubscription.plan,
      amount: parsedAmount,
      startedAt: isActive ? (existingSubscription.startedAt || new Date()) : existingSubscription.startedAt
    };
    if (currency != null && String(currency).trim() !== '') prismaUpdatePayload.currency = String(currency).trim();
    if (status != null && String(status).trim() !== '') prismaUpdatePayload.status = String(status).trim();
    if (paymentMethod !== undefined) prismaUpdatePayload.paymentMethod = paymentMethod ? String(paymentMethod).trim() : null;
    if (notes !== undefined) prismaUpdatePayload.notes = notes != null ? String(notes).trim() || null : undefined;
    if (typeof isActive === 'boolean') prismaUpdatePayload.isActive = isActive;
    if (typeof isTrial === 'boolean') prismaUpdatePayload.isTrial = isTrial;
    const parsedTrialStart = parseDate(trialStartDate);
    if (parsedTrialStart) prismaUpdatePayload.trialStartDate = parsedTrialStart;
    const parsedTrialEnd = parseDate(trialEndDate);
    if (parsedTrialEnd) prismaUpdatePayload.trialEndDate = parsedTrialEnd;
    const parsedExpires = parseDate(expiresAt);
    if (parsedExpires) prismaUpdatePayload.expiresAt = parsedExpires;

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
