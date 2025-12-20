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

    // Get the subscription to find the plan
    const existing = await prisma.accountSubscription.findFirst({
      where: { txRef: tx_ref }
    });

    if (!existing) {
      console.error('Subscription not found for tx_ref:', tx_ref);
      return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Subscription not found`);
    }

    // Calculate expiry date based on the plan
    const plan = existing.plan || '1month'; // Default to 1month if plan is missing
    const expiresAt = calculateSubscriptionExpiry(plan, completedAt);

    // Deactivate any other active subscriptions for the tenant (to prevent duplicates)
    if (existing?.tenantId) {
      await prisma.accountSubscription.updateMany({
        where: {
          tenantId: existing.tenantId,
          isActive: true,
          id: { not: existing.id } // Exclude the current subscription
        },
        data: { 
          isActive: false,
          status: 'Expired' // Mark other subscriptions as expired
        }
      });
    }

    // Update the existing subscription record (not creating a new one)
    await prisma.accountSubscription.update({
      where: { id: existing.id },
      data: {
        status: 'Completed',
        isActive: true,
        isTrial: false, // Ensure it's marked as paid, not trial
        paymentDate: completedAt,
        startedAt: completedAt,
        expiresAt: expiresAt,
        amount: Number(payment.amount),
        currency: payment.currency,
        paymentMethod: payment.authorization?.channel || 'Unknown',
        gatewayResponse: data
      }
    });

    return NextResponse.redirect(`${process.env.APP_URL}/subscription`);

  } catch (error) {
    console.error('Error in PayChangu callback:', error);
    return NextResponse.redirect(`${process.env.APP_URL}/subscription/error?msg=Server error`);
  }
}
