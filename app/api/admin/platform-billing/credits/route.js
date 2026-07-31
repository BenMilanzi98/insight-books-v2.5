import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  applyCreditToInvoice,
  creditIdempotencyKey,
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

    if (typeof prisma.platformCredit?.findMany !== 'function') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Platform credit model unavailable. Stop the Next.js server, run `npx prisma generate`, then start it again.',
          credits: [],
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const credits = await prisma.platformCredit.findMany({
      where: { ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      credits: credits.map((c) => ({
        ...c,
        amount: toNumber(c.amount),
        remaining: toNumber(c.remaining),
      })),
    });
  } catch (error) {
    console.error('credits GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list credits',
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
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.creditsManage)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const invoiceId = body.invoiceId ? String(body.invoiceId) : null;
    const amount = toNumber(body.amount);
    const reason = body.reason ? String(body.reason) : null;
    const currency = String(body.currency || 'MWK').toUpperCase();

    if (!tenantId || !(amount > 0)) {
      return NextResponse.json(
        { success: false, error: 'tenantId and positive amount are required' },
        { status: 400 }
      );
    }

    const idempotencyKey =
      String(body.idempotencyKey || '').trim() ||
      creditIdempotencyKey({
        tenantId,
        invoiceId,
        amount,
        reasonCode: reason || 'credit',
      });

    const existing = await prisma.platformCredit.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({
        success: true,
        credit: existing,
        idempotentReplay: true,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let applied = 0;
      let remaining = amount;
      let invoiceStatus = null;

      if (invoiceId) {
        const invoice = await tx.platformInvoice.findUnique({ where: { id: invoiceId } });
        if (!invoice || invoice.tenantId !== tenantId) {
          throw new Error('Platform invoice not found for tenant');
        }
        const alloc = applyCreditToInvoice({
          outstanding: invoice.outstanding,
          creditAmount: amount,
        });
        if (!alloc.ok) throw new Error(alloc.error);
        applied = alloc.applied;
        remaining = alloc.remainingCredit;
        invoiceStatus = alloc.invoiceStatus;
        await tx.platformInvoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: toNumber(invoice.amountPaid) + applied,
            outstanding: alloc.remainingOutstanding,
            status: alloc.invoiceStatus === 'CREDITED' ? 'CREDITED' : invoice.status,
          },
        });
      }

      const credit = await tx.platformCredit.create({
        data: {
          creditNumber: `PCR-${Date.now().toString(36).toUpperCase()}`,
          tenantId,
          invoiceId,
          currency,
          amount,
          remaining,
          reason,
          status: remaining > 0 ? 'OPEN' : 'APPLIED',
          idempotencyKey,
          createdBy: admin.id,
        },
      });

      return { credit, applied, invoiceStatus };
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_CREDIT_CREATE',
        entityType: 'PLATFORM_CREDIT',
        entityId: result.credit.id,
        details: JSON.stringify({ tenantId, invoiceId, amount, applied: result.applied }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { success: true, credit: result.credit, applied: result.applied, idempotentReplay: false },
      { status: 201 }
    );
  } catch (error) {
    console.error('credits POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create credit' },
      { status: 500 }
    );
  }
}
