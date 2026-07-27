import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  buildRenewalInvoiceRequest,
  nextBillingPeriod,
} from '@/lib/admin/platformBilling';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * POST /api/admin/platform-billing/renewals
 * Idempotent renewal: creates at most one platform invoice per subscription period.
 * Body: { subscriptionId, cycle? } or { tenantId, subscriptionId, periodStart, periodEnd, subtotal, ... }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.subscriptionsManage) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.invoicesCreate)
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const subscriptionId = String(body.subscriptionId || '').trim();
    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'subscriptionId is required' },
        { status: 400 }
      );
    }

    const sub = await prisma.accountSubscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const cycle = body.cycle || 'month';
    let periodStart = body.periodStart;
    let periodEnd = body.periodEnd;

    if (!periodStart || !periodEnd) {
      const next = nextBillingPeriod({
        periodEnd: sub.expiresAt || sub.trialEndDate || new Date(),
        cycle,
      });
      if (!next.ok) {
        return NextResponse.json({ success: false, error: next.error }, { status: 400 });
      }
      periodStart = next.periodStart;
      periodEnd = next.periodEnd;
    }

    const planRow = await prisma.platformPlanVersion.findFirst({
      where: {
        OR: [{ planCode: sub.plan }, { planCode: String(sub.plan || '').toLowerCase() }],
        status: 'ACTIVE',
      },
      orderBy: { version: 'desc' },
    });

    const subtotal =
      body.subtotal != null
        ? toNumber(body.subtotal)
        : planRow
          ? toNumber(planRow.basePrice)
          : toNumber(sub.amount || 0);

    const built = buildRenewalInvoiceRequest({
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      periodStart,
      periodEnd,
      currency: body.currency || planRow?.currency || 'MWK',
      subtotal,
      discount: toNumber(body.discount, 0),
      tax: toNumber(body.tax, 0),
      planCode: planRow?.planCode || sub.plan,
      planVersion: planRow?.version,
    });

    if (!built.ok) {
      return NextResponse.json({ success: false, error: built.error }, { status: 400 });
    }

    const { idempotencyKey, ...invoiceData } = built.body;

    const existing = await prisma.platformInvoice.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        invoice: {
          ...existing,
          subtotal: toNumber(existing.subtotal),
          discount: toNumber(existing.discount),
          tax: toNumber(existing.tax),
          total: toNumber(existing.total),
          amountPaid: toNumber(existing.amountPaid),
          outstanding: toNumber(existing.outstanding),
        },
        idempotentReplay: true,
        message: 'Renewal invoice already exists for this period',
      });
    }

    const invoiceNumber = `PREN-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    let invoice;
    try {
      invoice = await prisma.platformInvoice.create({
        data: {
          invoiceNumber,
          tenantId: invoiceData.tenantId,
          subscriptionId: invoiceData.subscriptionId,
          periodStart: new Date(invoiceData.periodStart),
          periodEnd: new Date(invoiceData.periodEnd),
          currency: invoiceData.currency,
          subtotal: invoiceData.subtotal,
          discount: invoiceData.discount,
          tax: invoiceData.tax,
          total: invoiceData.total,
          amountPaid: 0,
          outstanding: invoiceData.total,
          status: 'ISSUED',
          idempotencyKey,
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const raced = await prisma.platformInvoice.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return NextResponse.json({
            success: true,
            invoice: raced,
            idempotentReplay: true,
          });
        }
      }
      throw error;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_SUBSCRIPTION_RENEWAL_INVOICE',
        entityType: 'PLATFORM_INVOICE',
        entityId: invoice.id,
        details: JSON.stringify({
          subscriptionId,
          periodStart,
          periodEnd,
          idempotencyKey,
        }),
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      {
        success: true,
        invoice: {
          ...invoice,
          subtotal: toNumber(invoice.subtotal),
          total: toNumber(invoice.total),
          outstanding: toNumber(invoice.outstanding),
        },
        idempotentReplay: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('renewal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to renew subscription period',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
