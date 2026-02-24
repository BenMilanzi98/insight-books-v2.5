import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import prisma from '@/lib/prisma';

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
    const { subscriptionId } = body || {};

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    const subscription = await prisma.branchSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, branchId: true, tenantId: true }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Branch subscription not found' },
        { status: 404 }
      );
    }

    await prisma.branchSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: false, status: 'Expired' }
    });

    const now = new Date();
    const otherActive = await prisma.branchSubscription.findFirst({
      where: {
        branchId: subscription.branchId,
        isActive: true,
        expiresAt: { gt: now },
        status: { in: ['Completed', 'Active', 'Trial'] }
      },
      select: { id: true }
    });

    if (!otherActive) {
      const freeBranch = await prisma.branch.findFirst({
        where: { tenantId: subscription.tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });

      if (!freeBranch || freeBranch.id !== subscription.branchId) {
        await prisma.branch.update({
          where: { id: subscription.branchId },
          data: { isActive: false }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deactivating branch subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to deactivate branch subscription', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}
