import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  invoiceIdempotencyKey,
  reconcileInvoiceLine,
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

function serializeInvoice(inv) {
  if (!inv) return inv;
  return {
    ...inv,
    subtotal: toNumber(inv.subtotal),
    discount: toNumber(inv.discount),
    tax: toNumber(inv.tax),
    total: toNumber(inv.total),
    amountPaid: toNumber(inv.amountPaid),
    outstanding: toNumber(inv.outstanding),
  };
}

/**
 * GET /api/admin/platform-billing/invoices
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

    const invoices = await prisma.platformInvoice.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      invoices: invoices.map(serializeInvoice),
    });
  } catch (error) {
    console.error('Platform invoices list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list platform invoices',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/platform-billing/invoices
 * Creates a platform invoice with idempotency (retries return existing).
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.invoicesCreate)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const tenantId = body?.tenantId;
    const subscriptionId = body?.subscriptionId || null;
    const periodStart = body?.periodStart ? new Date(body.periodStart) : null;
    const periodEnd = body?.periodEnd ? new Date(body.periodEnd) : null;
    const currency = String(body?.currency || 'MWK').toUpperCase();
    const subtotal = toNumber(body?.subtotal);
    const discount = toNumber(body?.discount, 0);
    const tax = toNumber(body?.tax, 0);
    const status = String(body?.status || 'ISSUED').toUpperCase();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }
    if (subtotal < 0 || discount < 0 || tax < 0) {
      return NextResponse.json(
        { success: false, error: 'Amounts cannot be negative' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const total =
      body?.total != null
        ? toNumber(body.total)
        : Math.round((subtotal - discount + tax) * 100) / 100;

    const lineCheck = reconcileInvoiceLine({ subtotal, discount, tax, total });
    if (!lineCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice line math does not reconcile',
          reconciliation: lineCheck,
        },
        { status: 400 }
      );
    }

    const idempotencyKey =
      String(body?.idempotencyKey || '').trim() ||
      invoiceIdempotencyKey({
        tenantId,
        subscriptionId: subscriptionId || 'none',
        periodStart: periodStart ? periodStart.toISOString() : 'none',
        periodEnd: periodEnd ? periodEnd.toISOString() : 'none',
      });

    const existing = await prisma.platformInvoice.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        invoice: serializeInvoice(existing),
        idempotentReplay: true,
      });
    }

    const invoiceNumber =
      String(body?.invoiceNumber || '').trim() ||
      `PINV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let invoice;
    try {
      invoice = await prisma.platformInvoice.create({
        data: {
          invoiceNumber,
          tenantId,
          subscriptionId,
          periodStart,
          periodEnd,
          currency,
          subtotal,
          discount,
          tax,
          total,
          amountPaid: 0,
          outstanding: total,
          status,
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
            invoice: serializeInvoice(raced),
            idempotentReplay: true,
          });
        }
        return NextResponse.json(
          { success: false, error: 'Duplicate invoice constraint' },
          { status: 409 }
        );
      }
      throw error;
    }

    const meta = clientMeta(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_INVOICE_CREATE',
        entityType: 'PLATFORM_INVOICE',
        entityId: invoice.id,
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          tenantId,
          total,
          currency,
          idempotencyKey,
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json(
      { success: true, invoice: serializeInvoice(invoice), idempotentReplay: false },
      { status: 201 }
    );
  } catch (error) {
    console.error('Platform invoice create error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create platform invoice',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
