import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  PLAN_CATEGORY,
  planCodesInCategory,
  resolveCanonicalPlanPrice,
} from '@/lib/admin/mraEisPlans';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { amount: clientAmount, plan } = body;

    if (!user.email || !user.name || !user.tenantId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolved = resolveCanonicalPlanPrice(plan || '1month');
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const { planId, amount, currency, label, category } = resolved;

    // Never trust browser price — allow tiny float noise only
    if (clientAmount != null && clientAmount !== '') {
      const submitted = Number(clientAmount);
      if (!Number.isFinite(submitted) || Math.abs(submitted - amount) > 0.009) {
        return NextResponse.json(
          {
            error: 'Price mismatch. Refresh the page and try again.',
            expectedAmount: amount,
            currency,
          },
          { status: 400 }
        );
      }
    }

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

    const paychanguPayload = {
      currency,
      tx_ref,
      amount: String(amount),
      callback_url: `${appUrl}/api/subscription/paychangu/callback`,
      return_url: `${appUrl}/subscription/cancel`,
      email: user.email,
      first_name: user.name.split(' ')[0] || user.name,
      last_name: user.name.split(' ').slice(1).join(' ') || '',
      customization: {
        title:
          category === PLAN_CATEGORY.MRA_EIS
            ? 'InsightBooks MRA EIS'
            : 'InsightBooks Subscription',
        description: `${label} subscription payment`,
      },
    };

    console.log('[PayChangu] Creating session:', { tx_ref, planId, amount, tenantId, category });

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
    console.log(
      '[PayChangu] API response status:',
      response.status,
      'body:',
      JSON.stringify(data).slice(0, 500)
    );

    if (!response.ok || data.status !== 'success') {
      console.error('[PayChangu] API error:', data);
      return NextResponse.json(
        { error: data.message || 'Failed to create checkout session' },
        { status: 400 }
      );
    }

    const checkoutUrl = data?.data?.checkout_url || data?.data?.link || data?.checkout_url;
    const paychanguTxRef = data?.data?.data?.tx_ref || data?.data?.tx_ref || tx_ref;

    if (!checkoutUrl) {
      console.error('[PayChangu] No checkout URL in response:', data);
      return NextResponse.json(
        { error: 'Payment gateway did not return a checkout URL' },
        { status: 500 }
      );
    }

    const familyCodes = planCodesInCategory(category);

    // Coexistence: only reuse pending rows in the same product family
    const existingSubscription = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        plan: { in: familyCodes },
        OR: [{ status: 'Pending' }, { isTrial: true }, { isActive: false, status: 'Pending' }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const pendingData = {
      plan: planId,
      txRef: paychanguTxRef,
      amount,
      currency,
      status: 'Pending',
      paymentMethod: 'PayChangu',
      isActive: false,
      isTrial: false,
      paymentDate: new Date(),
      notes: `Awaiting PayChangu payment for ${label} (${category})`,
    };

    if (existingSubscription && existingSubscription.status === 'Pending') {
      await prisma.accountSubscription.update({
        where: { id: existingSubscription.id },
        data: pendingData,
      });
    } else {
      await prisma.accountSubscription.create({
        data: {
          tenantId,
          ...pendingData,
        },
      });
    }

    console.log('[PayChangu] Session created successfully:', {
      tx_ref: paychanguTxRef,
      checkoutUrl: checkoutUrl.slice(0, 80),
    });

    return NextResponse.json({
      message: 'Checkout session created successfully',
      checkout_url: checkoutUrl,
      tx_ref: paychanguTxRef,
      planId,
      amount,
      currency,
      category,
    });
  } catch (error) {
    console.error('[PayChangu] Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}
