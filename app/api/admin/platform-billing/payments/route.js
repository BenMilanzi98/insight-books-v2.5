import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  allocatePayment,
  isSuccessfulPaymentStatus,
  paymentIdempotencyKey,
} from '@/lib/admin/platformBilling';

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function serializePayment(p) {
  if (!p) return p;
  return {
    ...p,
    amount: toNumber(p.amount),
  };
}

/**
 * GET /api/admin/platform-billing/payments
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.paymentsView) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)
    ) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const invoiceId = searchParams.get('invoiceId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

    const payments = await prisma.platformPayment.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      payments: payments.map(serializePayment),
    });
  } catch (error) {
    console.error('Platform payments list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list platform payments',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-billing/payments
 * Uses paymentIdempotencyKey from gateway+reference (or explicit idempotencyKey).
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.paymentsManage)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body?.tenantId;
    const invoiceId = body?.invoiceId || null;
    const amount = toNumber(body?.amount);
    const currency = String(body?.currency || 'MWK').toUpperCase();
    const method = body?.method ? String(body.method) : null;
    const gateway = body?.gateway ? String(body.gateway) : 'manual';
    const gatewayReference = body?.gatewayReference
      ? String(body.gatewayReference).trim()
      : null;
    const status = String(body?.status || 'COMPLETED').toUpperCase();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }
    if (!(amount > 0)) {
      return NextResponse.json(
        { success: false, error: 'amount must be greater than zero' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const derivedKey = paymentIdempotencyKey({ gateway, gatewayReference });
    const idempotencyKey =
      String(body?.idempotencyKey || '').trim() ||
      derivedKey ||
      `manual:${tenantId}:${invoiceId || 'none'}:${amount}:${Date.now()}`;

    const existing = await prisma.platformPayment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        payment: serializePayment(existing),
        idempotentReplay: true,
      });
    }

    let invoice = null;
    if (invoiceId) {
      invoice = await prisma.platformInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) {
        return NextResponse.json(
          { success: false, error: 'Platform invoice not found' },
          { status: 404 }
        );
      }
      if (invoice.tenantId !== tenantId) {
        return NextResponse.json(
          { success: false, error: 'Invoice does not belong to tenant' },
          { status: 400 }
        );
      }
    }

    const paymentNumber =
      String(body?.paymentNumber || '').trim() ||
      `PPAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      let payment;
      try {
        payment = await tx.platformPayment.create({
          data: {
            paymentNumber,
            tenantId,
            invoiceId,
            currency,
            amount,
            method,
            gateway,
            gatewayReference,
            status,
            idempotencyKey,
          },
        });
      } catch (error) {
        if (error?.code === 'P2002') {
          const raced = await tx.platformPayment.findUnique({
            where: { idempotencyKey },
          });
          if (raced) {
            return { payment: raced, idempotentReplay: true, allocation: null };
          }
        }
        throw error;
      }

      let allocation = null;
      if (invoice && isSuccessfulPaymentStatus(status)) {
        allocation = allocatePayment({
          invoiceOutstanding: invoice.outstanding,
          paymentAmount: amount,
        });
        if (!allocation.ok) {
          throw new Error(allocation.error || 'Payment allocation failed');
        }
        const amountPaid = toNumber(invoice.amountPaid) + allocation.applied;
        await tx.platformInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid,
            outstanding: allocation.remaining,
            status: allocation.invoiceStatus,
          },
        });
      }

      return { payment, idempotentReplay: false, allocation };
    });

    const meta = clientMeta(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_PAYMENT_CREATE',
        entityType: 'PLATFORM_PAYMENT',
        entityId: result.payment.id,
        details: JSON.stringify({
          paymentNumber: result.payment.paymentNumber,
          tenantId,
          invoiceId,
          amount,
          gateway,
          gatewayReference,
          idempotencyKey,
          allocation: result.allocation,
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json(
      {
        success: true,
        payment: serializePayment(result.payment),
        allocation: result.allocation,
        idempotentReplay: result.idempotentReplay,
      },
      { status: result.idempotentReplay ? 200 : 201 }
    );
  } catch (error) {
    console.error('Platform payment create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create platform payment',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
