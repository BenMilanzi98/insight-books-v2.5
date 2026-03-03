import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';
import { EIS_PLAN_IDS } from '@/lib/subscriptionConfig';

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
    const { subscriptionId, deactivateReason } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'subscriptionId is required' },
        { status: 400 }
      );
    }

    // Find the subscription
    const subscription = await prisma.accountSubscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Verify it's an EIS subscription
    if (!EIS_PLAN_IDS.includes(subscription.plan)) {
      return NextResponse.json(
        { success: false, error: 'Not an EIS subscription' },
        { status: 400 }
      );
    }

    // Deactivate the subscription
    const updatedSubscription = await prisma.accountSubscription.update({
      where: { id: subscriptionId },
      data: {
        isActive: false,
        status: 'Cancelled',
        notes: deactivateReason 
          ? `${subscription.notes || ''}\n\nDeactivation Reason: ${deactivateReason}`
          : subscription.notes
      }
    });

    return NextResponse.json({
      success: true,
      message: 'EIS subscription deactivated successfully',
      subscription: {
        id: updatedSubscription.id,
        plan: updatedSubscription.plan,
        status: updatedSubscription.status,
        isActive: updatedSubscription.isActive,
        expiresAt: updatedSubscription.expiresAt
      }
    });

  } catch (error) {
    console.error('Error deactivating EIS subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate EIS subscription', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
