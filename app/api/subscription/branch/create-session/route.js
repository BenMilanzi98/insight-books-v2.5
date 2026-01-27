import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

function normalizePlanId(plan) {
  let planId = plan || '1month';
  if (planId === 'annual' || planId === '1_year' || planId === 'year') {
    planId = '1year';
  } else if (planId === '3_months' || planId === '3months') {
    planId = '3months';
  } else if (planId === '1_month' || planId === '1month') {
    planId = '1month';
  }
  return planId;
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // If Prisma Client hasn't been regenerated/reloaded since adding BranchSubscription,
    // this delegate will be undefined in the running dev server process.
    if (!prisma.branchSubscription) {
      return NextResponse.json(
        {
          error:
            'Server needs restart after DB/schema update. Please restart `npm run dev` and try again.',
          code: 'PRISMA_CLIENT_OUTDATED',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { amount, plan, branchId } = body || {};

    if (!user.email || !user.name || !user.tenantId || !amount || !branchId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate branch belongs to tenant
    const branch = await prisma.branch.findFirst({
      where: { id: String(branchId), tenantId: user.tenantId },
      select: { id: true, name: true, isActive: true },
    });
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const planId = normalizePlanId(plan);

    // Create PayChangu checkout
    const url = 'https://api.paychangu.com/payment';
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
      },
      body: JSON.stringify({
        currency: 'MWK',
        tx_ref: `${Math.floor(Math.random() * 1000000000) + 1}`,
        amount: amount.toString(),
        callback_url: `${process.env.APP_URL}/api/subscription/paychangu/callback`,
        return_url: `${process.env.APP_URL}/subscription/cancel`,
        email: user.email,
        first_name: user.name,
        uuid: `${user.tenantId}:${branch.id}`, // track both tenant + branch
        customization: {
          title: 'Branch Subscription',
          description: `Subscription payment for branch: ${branch.name}`,
        },
      }),
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      console.error('PayChangu API error (branch):', data);
      return NextResponse.json(
        { error: data.message || 'Failed to create checkout session' },
        { status: 400 }
      );
    }

    const txRef = data?.data?.data?.tx_ref;
    const checkoutUrl = data?.data?.checkout_url;
    if (!txRef || !checkoutUrl) {
      return NextResponse.json({ error: 'Invalid gateway response' }, { status: 400 });
    }

    // Upsert latest pending branch subscription for this branch
    const existing = await prisma.branchSubscription.findFirst({
      where: {
        tenantId: user.tenantId,
        branchId: branch.id,
        isActive: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.branchSubscription.update({
        where: { id: existing.id },
        data: {
          plan: planId,
          txRef,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          paymentDate: new Date(),
        },
      });
    } else {
      await prisma.branchSubscription.create({
        data: {
          tenantId: user.tenantId,
          branchId: branch.id,
          plan: planId,
          txRef,
          amount: Number(amount),
          currency: 'MWK',
          status: 'Pending',
          paymentMethod: 'PayChangu',
          isActive: false,
          notes: 'Branch subscription payment initiated',
          paymentDate: new Date(),
        },
      });
    }

    return NextResponse.json({
      message: 'Checkout session created successfully',
      checkout_url: checkoutUrl,
      tx_ref: txRef,
      branchId: branch.id,
    });
  } catch (error) {
    console.error('Error creating branch checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}


