// pages/api/paychangu/create-session.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, plan } = body;

    if (!user.email || !user.name || !user.tenantId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Normalize plan ID - handle different formats
    let planId = plan || '1month';
    if (planId === 'annual' || planId === '1_year' || planId === 'year') {
      planId = '1year';
    } else if (planId === '3_months' || planId === '3months') {
      planId = '3months';
    } else if (planId === '1_month' || planId === '1month') {
      planId = '1month';
    }

    const tenantId = user.tenantId;
    const tx_ref = `${Math.floor(Math.random() * 1000000000) + 1}`;

    // Call PayChangu API
    const url = 'https://api.paychangu.com/payment';
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`
      },
      body: JSON.stringify({
        currency: 'MWK',
        tx_ref,
        amount: amount.toString(),
        callback_url: `${process.env.APP_URL}/api/subscription/paychangu/callback`,
        return_url: `${process.env.APP_URL}/subscription/cancel`,
        email: user.email,
        first_name: user.name,
        uuid: user.tenantId,  // use tenantId for tracking
        customization: {
          title: 'Account Subscription',
          description: 'Subscription payment for your account'
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      console.error('PayChangu API error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to create checkout session' },
        { status: 400 }
      );
    }

    // Find existing subscription (trial or active) for this tenant
    const existingSubscription = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        OR: [
          { isTrial: true },
          { isActive: true }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (existingSubscription) {
      // Update existing subscription instead of creating a new one
      await prisma.accountSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: planId,  // Use the normalized plan ID
          txRef: data.data.data.tx_ref,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          isTrial: false, // Mark as no longer a trial
          paymentDate: new Date()
        }
      });
    } else {
      // Only create new subscription if none exists (shouldn't happen normally)
      await prisma.accountSubscription.create({
        data: {
          tenantId,
          plan: planId,  // Use the normalized plan ID
          txRef: data.data.data.tx_ref,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          isTrial: false,
          paymentDate: new Date()
        }
      });
    }

    return NextResponse.json({
      message: 'Checkout session created successfully',
      checkout_url: data.data.checkout_url,
      tx_ref: data.data.data.tx_ref
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}
