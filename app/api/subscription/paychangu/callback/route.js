import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateSubscriptionExpiry } from '@/lib/subscriptionConfig';
import {
  PLAN_CATEGORY,
  categoryForPlanCode,
  planCodesInCategory,
} from '@/lib/admin/mraEisPlans';
import { ensurePaychanguPlatformLedger } from '@/lib/admin/paychanguPlatformLedger';
import { requestEntitlementPendingFromSubscription } from '@/lib/mraEis/application/entitlementService';

const appUrl = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function recordPlatformLedgerIdempotent({
  tenantId,
  subscriptionId,
  periodStart,
  periodEnd,
  amount,
  currency,
  planCode,
  gatewayReference,
  method,
}) {
  if (!tenantId || !subscriptionId || !gatewayReference) return null;
  try {
    const result = await ensurePaychanguPlatformLedger(prisma, {
      tenantId,
      subscriptionId,
      periodStart,
      periodEnd,
      amount,
      currency,
      planCode,
      gatewayReference,
      method,
    });
    if (!result.ok) {
      console.warn('[PayChangu Callback] Platform ledger skipped:', result.error);
      return null;
    }
    console.log('[PayChangu Callback] Platform ledger:', {
      invoiceId: result.invoice?.id,
      paymentId: result.payment?.id,
      createdInvoice: result.createdInvoice,
      createdPayment: result.createdPayment,
    });
    return result;
  } catch (e) {
    console.warn('[PayChangu Callback] Platform ledger write skipped:', e?.message || e);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tx_ref = searchParams.get('tx_ref');
    const status = searchParams.get('status');

    console.log('[PayChangu Callback] Received:', { tx_ref, status });

    if (!tx_ref) {
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Missing+transaction+reference`);
    }

    // If PayChangu explicitly reports failure via query param
    if (status === 'failed' || status === 'cancelled') {
      console.warn('[PayChangu Callback] Payment failed/cancelled:', tx_ref);
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Payment+${status}`);
    }

    // Verify payment with PayChangu
    const apiKey = process.env.PAYCHANGU_SECRET_KEY;
    if (!apiKey) {
      console.error('[PayChangu Callback] PAYCHANGU_SECRET_KEY not set');
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Configuration+error`);
    }

    const verifyUrl = `https://api.paychangu.com/verify-payment/${tx_ref}`;
    console.log('[PayChangu Callback] Verifying:', verifyUrl);

    const res = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await res.json();
    console.log('[PayChangu Callback] Verify response:', res.status, JSON.stringify(data).slice(0, 500));

    // PayChangu returns { status: 'success', data: { status: 'success', ... } }
    const paymentStatus = data?.data?.status || data?.status;
    if (!res.ok || paymentStatus !== 'success') {
      console.error('[PayChangu Callback] Verification failed:', data);
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Payment+verification+failed`);
    }

    const payment = data.data;
    const completedAt = payment?.authorization?.completed_at
      ? new Date(payment.authorization.completed_at)
      : new Date();

    // Look up tenant subscription first
    const tenantSub = await prisma.accountSubscription.findFirst({
      where: { txRef: tx_ref },
    });

    // If not found, try branch subscription
    const branchSub = tenantSub
      ? null
      : await prisma.branchSubscription.findFirst({ where: { txRef: tx_ref } });

    if (!tenantSub && !branchSub) {
      console.error('[PayChangu Callback] No subscription found for tx_ref:', tx_ref);
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Subscription+not+found`);
    }

    const subRecord = tenantSub || branchSub;

    // --- Security checks per PayChangu docs ---
    // 1. Verify tx_ref matches what we generated
    if (payment.tx_ref && payment.tx_ref !== tx_ref) {
      console.error('[PayChangu Callback] tx_ref mismatch:', { expected: tx_ref, received: payment.tx_ref });
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Transaction+reference+mismatch`);
    }

    // 2. Verify currency matches expected
    const paidCurrency = (payment.currency || '').toUpperCase();
    const expectedCurrency = (subRecord.currency || 'MWK').toUpperCase();
    if (paidCurrency && paidCurrency !== expectedCurrency) {
      console.error('[PayChangu Callback] Currency mismatch:', { expected: expectedCurrency, received: paidCurrency });
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Currency+mismatch`);
    }

    // 3. Verify amount paid >= expected amount
    const paidAmount = Number(payment.amount || 0);
    const expectedAmount = Number(subRecord.amount || 0);
    if (expectedAmount > 0 && paidAmount < expectedAmount) {
      console.error('[PayChangu Callback] Underpayment:', { expected: expectedAmount, received: paidAmount });
      return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Insufficient+payment+amount`);
    }

    console.log('[PayChangu Callback] Security checks passed:', { paidAmount, expectedAmount, paidCurrency });

    // --- Branch subscription activation ---
    if (branchSub) {
      const plan = branchSub.plan || '1month';
      const expiresAt = calculateSubscriptionExpiry(plan, completedAt);

      await prisma.branchSubscription.updateMany({
        where: { branchId: branchSub.branchId, isActive: true, id: { not: branchSub.id } },
        data: { isActive: false, status: 'Expired' },
      });

      await prisma.branchSubscription.update({
        where: { id: branchSub.id },
        data: {
          status: 'Completed',
          isActive: true,
          paymentDate: completedAt,
          startedAt: completedAt,
          expiresAt,
          amount: paidAmount,
          currency: paidCurrency || 'MWK',
          paymentMethod: payment.authorization?.channel || 'PayChangu',
          gatewayResponse: data,
        },
      });

      await prisma.branch.update({
        where: { id: branchSub.branchId },
        data: { isActive: true },
      });

      if (branchSub.tenantId) {
        await recordPlatformLedgerIdempotent({
          tenantId: branchSub.tenantId,
          subscriptionId: branchSub.id,
          periodStart: completedAt,
          periodEnd: expiresAt,
          amount: paidAmount,
          currency: paidCurrency || 'MWK',
          planCode: plan,
          gatewayReference: tx_ref,
          method: payment.authorization?.channel || 'PayChangu',
        });
      }

      console.log('[PayChangu Callback] Branch subscription activated:', branchSub.id);
      return NextResponse.redirect(`${appUrl()}/dashboard?subscription=branch`);
    }

    // --- Tenant (account) subscription activation ---
    const plan = tenantSub.plan || '1month';
    const category = categoryForPlanCode(plan);
    const familyCodes = planCodesInCategory(category);
    const expiresAt = calculateSubscriptionExpiry(plan, completedAt);

    // Coexistence: only deactivate other actives in the same product family
    if (tenantSub.tenantId) {
      await prisma.accountSubscription.updateMany({
        where: {
          tenantId: tenantSub.tenantId,
          isActive: true,
          id: { not: tenantSub.id },
          plan: { in: familyCodes },
        },
        data: { isActive: false, status: 'Expired' },
      });
    }

    // Activate the subscription
    const activatedSub = await prisma.accountSubscription.update({
      where: { id: tenantSub.id },
      data: {
        status: 'Completed',
        isActive: true,
        isTrial: false,
        paymentDate: completedAt,
        startedAt: completedAt,
        expiresAt,
        amount: paidAmount,
        currency: paidCurrency || 'MWK',
        paymentMethod: payment.authorization?.channel || 'PayChangu',
        gatewayResponse: data,
        notes: `Paid via PayChangu — ${plan} plan (${category}), expires ${expiresAt.toISOString().split('T')[0]}`,
      },
    });

    try {
      const { emitSubscriptionStarted } = await import('@/lib/admin/analytics/emit');
      await emitSubscriptionStarted(prisma, { subscription: activatedSub, renewed: false });
    } catch (e) {
      console.warn('[PayChangu Callback] analytics subscription emit skipped:', e?.message || e);
    }

    await recordPlatformLedgerIdempotent({
      tenantId: tenantSub.tenantId,
      subscriptionId: tenantSub.id,
      periodStart: completedAt,
      periodEnd: expiresAt,
      amount: paidAmount,
      currency: paidCurrency || 'MWK',
      planCode: plan,
      gatewayReference: tx_ref,
      method: payment.authorization?.channel || 'PayChangu',
    });

    // Core plan denormalized field only — do not overwrite with EIS SKU
    if (category === PLAN_CATEGORY.CORE) {
      try {
        await prisma.tenant.update({
          where: { id: tenantSub.tenantId },
          data: { subscriptionPlan: plan, status: 'active' },
        });
      } catch (tenantUpdateErr) {
        console.warn('[PayChangu Callback] Could not update tenant plan:', tenantUpdateErr.message);
      }
    } else {
      try {
        await prisma.tenant.update({
          where: { id: tenantSub.tenantId },
          data: { status: 'active' },
        });
      } catch {
        /* non-fatal */
      }
    }

    // Subscription-first: paid EIS opens entitlement review (not operational grant)
    if (category === PLAN_CATEGORY.MRA_EIS && tenantSub.tenantId) {
      try {
        const pending = await requestEntitlementPendingFromSubscription({
          tenantId: tenantSub.tenantId,
          subscriptionId: tenantSub.id,
          planCode: plan,
          requestId: `paychangu:${tx_ref}`,
        });
        console.log('[PayChangu Callback] Entitlement pending result:', {
          ok: pending?.ok,
          idempotent: pending?.idempotent,
          status: pending?.entitlement?.status,
        });
      } catch (entErr) {
        console.warn(
          '[PayChangu Callback] Entitlement pending request failed:',
          entErr?.message || entErr
        );
      }
    }

    console.log('[PayChangu Callback] Tenant subscription activated:', {
      id: tenantSub.id,
      tenantId: tenantSub.tenantId,
      plan,
      category,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.redirect(`${appUrl()}/subscription?success=true`);
  } catch (error) {
    console.error('[PayChangu Callback] Error:', error);
    return NextResponse.redirect(`${appUrl()}/subscription/error?msg=Server+error`);
  }
}
