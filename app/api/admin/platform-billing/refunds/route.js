import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  assertRefundWithinPaid,
  refundIdempotencyKey,
} from '@/lib/admin/platformBilling';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (typeof prisma.platformRefund?.findMany !== 'function') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Platform refund model unavailable. Stop the Next.js server, run `npx prisma generate`, then start it again.',
          refunds: [],
        },
        { status: 500 }
      );
    }

    const refunds = await prisma.platformRefund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      refunds: refunds.map((r) => ({ ...r, amount: toNumber(r.amount) })),
    });
  } catch (error) {
    console.error('refunds GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list refunds',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.refundsManage)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = String(body.paymentId || '').trim();
    const amount = toNumber(body.amount);
    const reason = body.reason ? String(body.reason) : null;

    if (!paymentId || !(amount > 0)) {
      return NextResponse.json(
        { success: false, error: 'paymentId and positive amount are required' },
        { status: 400 }
      );
    }

    const payment = await prisma.platformPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const alreadyRefundedAgg = await prisma.platformRefund.aggregate({
      where: {
        paymentId,
        status: { in: ['COMPLETED', 'SUCCESSFUL'] },
      },
      _sum: { amount: true },
    });
    const alreadyRefunded = toNumber(alreadyRefundedAgg._sum.amount);

    const check = assertRefundWithinPaid({
      amountPaid: payment.amount,
      alreadyRefunded,
      refundAmount: amount,
    });
    if (!check.ok) {
      return NextResponse.json({ success: false, error: check.error }, { status: 400 });
    }

    const idempotencyKey =
      String(body.idempotencyKey || '').trim() ||
      refundIdempotencyKey({
        paymentId,
        amount,
        gatewayReference: body.gatewayReference || 'manual',
      });

    const existing = await prisma.platformRefund.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({
        success: true,
        refund: existing,
        idempotentReplay: true,
      });
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.platformRefund.create({
        data: {
          refundNumber: `PRF-${Date.now().toString(36).toUpperCase()}`,
          tenantId: payment.tenantId,
          paymentId,
          invoiceId: payment.invoiceId,
          currency: payment.currency,
          amount,
          status: 'COMPLETED',
          reason,
          gatewayReference: body.gatewayReference ? String(body.gatewayReference) : null,
          idempotencyKey,
          createdBy: admin.id,
        },
      });

      if (payment.invoiceId) {
        const invoice = await tx.platformInvoice.findUnique({
          where: { id: payment.invoiceId },
        });
        if (invoice) {
          const newPaid = Math.max(0, toNumber(invoice.amountPaid) - amount);
          const newOutstanding = toNumber(invoice.outstanding) + amount;
          await tx.platformInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newPaid,
              outstanding: newOutstanding,
              status: newOutstanding > 0 ? 'PARTIALLY_PAID' : invoice.status,
            },
          });
        }
      }

      await tx.platformPayment.update({
        where: { id: paymentId },
        data: {
          status:
            alreadyRefunded + amount >= toNumber(payment.amount)
              ? 'REFUNDED'
              : 'PARTIALLY_REFUNDED',
        },
      });

      return created;
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_REFUND_CREATE',
        entityType: 'PLATFORM_REFUND',
        entityId: refund.id,
        details: JSON.stringify({ paymentId, amount, reason }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { success: true, refund, idempotentReplay: false },
      { status: 201 }
    );
  } catch (error) {
    console.error('refunds POST error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'Duplicate refund (idempotency)' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create refund' },
      { status: 500 }
    );
  }
}
