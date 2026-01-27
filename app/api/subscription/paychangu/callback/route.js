// api/subscription/paychangu/callback/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateSubscriptionExpiry } from '@/lib/subscriptionConfig';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) {
      return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Missing tx_ref`);
    }

    const url = `https://api.paychangu.com/verify-payment/${tx_ref}`;
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`
      }
    };

    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok || data.status !== 'success' || data.data.status !== 'success') {
      console.error('PayChangu verification failed:', data);
      return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Verification failed`);
    }

    const payment = data.data;
    const completedAt = payment.authorization?.completed_at
      ? new Date(payment.authorization.completed_at)
      : new Date();

    // Try tenant subscription first
    const existingTenantSub = await prisma.accountSubscription.findFirst({
      where: { txRef: tx_ref },
    });

    // If not a tenant subscription, try branch subscription
    const existingBranchSub = existingTenantSub
      ? null
      : await prisma.branchSubscription.findFirst({
          where: { txRef: tx_ref },
        });

    if (!existingTenantSub && !existingBranchSub) {
      console.error('Subscription not found for tx_ref:', tx_ref);
      return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Subscription not found`);
    }

    if (existingBranchSub) {
      const plan = existingBranchSub.plan || '1month';
      const expiresAt = calculateSubscriptionExpiry(plan, completedAt);

      // Deactivate any other active subscriptions for this branch
      await prisma.branchSubscription.updateMany({
        where: {
          branchId: existingBranchSub.branchId,
          isActive: true,
          id: { not: existingBranchSub.id },
        },
        data: { isActive: false, status: 'Expired' },
      });

      // Activate the branch subscription
      await prisma.branchSubscription.update({
        where: { id: existingBranchSub.id },
        data: {
          status: 'Completed',
          isActive: true,
          paymentDate: completedAt,
          startedAt: completedAt,
          expiresAt,
          amount: Number(payment.amount),
          currency: payment.currency,
          paymentMethod: payment.authorization?.channel || 'Unknown',
          gatewayResponse: data,
        },
      });

      // Activate the branch itself (so it becomes selectable/usable)
      await prisma.branch.update({
        where: { id: existingBranchSub.branchId },
        data: { isActive: true },
      });

      return NextResponse.redirect(`${process.env.APP_URL}/branches?success=true&scope=branch`);
    }

    // Tenant subscription flow
    const plan = existingTenantSub.plan || '1month'; // Default to 1month if plan is missing
    const expiresAt = calculateSubscriptionExpiry(plan, completedAt);

    // Deactivate any other active subscriptions for the tenant (to prevent duplicates)
    if (existingTenantSub?.tenantId) {
      await prisma.accountSubscription.updateMany({
        where: {
          tenantId: existingTenantSub.tenantId,
          isActive: true,
          id: { not: existingTenantSub.id }, // Exclude the current subscription
        },
        data: {
          isActive: false,
          status: 'Expired', // Mark other subscriptions as expired
        },
      });
    }

    // Update the existing subscription record (not creating a new one)
    await prisma.accountSubscription.update({
      where: { id: existingTenantSub.id },
      data: {
        status: 'Completed',
        isActive: true,
        isTrial: false, // Ensure it's marked as paid, not trial
        paymentDate: completedAt,
        startedAt: completedAt,
        expiresAt,
        amount: Number(payment.amount),
        currency: payment.currency,
        paymentMethod: payment.authorization?.channel || 'Unknown',
        gatewayResponse: data,
      },
    });

    return NextResponse.redirect(`${process.env.APP_URL}/subscription?success=true`);

  } catch (error) {
    console.error('Error in PayChangu callback:', error);
    return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Server error`);
  }
}
