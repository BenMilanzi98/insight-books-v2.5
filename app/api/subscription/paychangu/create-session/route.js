import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

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

    // Normalize plan ID
    let planId = plan || '1month';
    const planAliases = {
      annual: '1year', '1_year': '1year', year: '1year',
      '3_months': '3months',
      '1_month': '1month', month: '1month',
    };
    planId = planAliases[planId] || planId;

    const tenantId = user.tenantId;
    const tx_ref = `IB-${tenantId.slice(-6)}-${Date.now()}`;

    const apiKey = process.env.PAYCHANGU_SECRET_KEY;
    if (!apiKey) {
      console.error('PAYCHANGU_SECRET_KEY is not configured');
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error('APP_URL is not configured');
      return NextResponse.json({ error: 'Application URL not configured' }, { status: 500 });
    }

    const planConfig = Object.values(SUBSCRIPTION_PLANS).find(p => p.id === planId);
    const planLabel = planConfig?.displayName || planId;

    const paychanguPayload = {
      currency: 'MWK',
      tx_ref,
      amount: String(amount),
      callback_url: `${appUrl}/api/subscription/paychangu/callback`,
      return_url: `${appUrl}/subscription/cancel`,
      email: user.email,
      first_name: user.name.split(' ')[0] || user.name,
      last_name: user.name.split(' ').slice(1).join(' ') || '',
      customization: {
        title: 'InsightBooks Subscription',
        description: `${planLabel} subscription payment`,
      },
    };

    console.log('[PayChangu] Creating session:', { tx_ref, planId, amount, tenantId });

    const response = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(paychanguPayload),
    });

    const data = await response.json();
    console.log('[PayChangu] API response status:', response.status, 'body:', JSON.stringify(data).slice(0, 500));

    if (!response.ok || data.status !== 'success') {
      console.error('[PayChangu] API error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to create checkout session' },
        { status: 400 },
      );
    }

    // Extract checkout URL and tx_ref from the response (PayChangu nests data)
    const checkoutUrl = data?.data?.checkout_url || data?.data?.link || data?.checkout_url;
    const paychanguTxRef = data?.data?.data?.tx_ref || data?.data?.tx_ref || tx_ref;

    if (!checkoutUrl) {
      console.error('[PayChangu] No checkout URL in response:', data);
      return NextResponse.json({ error: 'Payment gateway did not return a checkout URL' }, { status: 500 });
    }

    // Upsert subscription record: update existing trial/pending or create new
    const existingSubscription = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        OR: [{ isTrial: true }, { isActive: true }, { status: 'Pending' }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubscription) {
      await prisma.accountSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          plan: planId,
          txRef: paychanguTxRef,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          isTrial: false,
          paymentDate: new Date(),
          notes: `Awaiting PayChangu payment for ${planLabel}`,
        },
      });
    } else {
      await prisma.accountSubscription.create({
        data: {
          tenantId,
          plan: planId,
          txRef: paychanguTxRef,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          isTrial: false,
          paymentDate: new Date(),
          notes: `Awaiting PayChangu payment for ${planLabel}`,
        },
      });
    }

    console.log('[PayChangu] Session created successfully:', { tx_ref: paychanguTxRef, checkoutUrl: checkoutUrl.slice(0, 80) });

    return NextResponse.json({
      message: 'Checkout session created successfully',
      checkout_url: checkoutUrl,
      tx_ref: paychanguTxRef,
    });
  } catch (error) {
    console.error('[PayChangu] Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 },
    );
  }
}
