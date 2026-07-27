import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  calculateCommission,
  commissionIdempotencyKey,
} from '@/lib/admin/affiliateIntegrity';

/**
 * GET /api/admin/affiliate/commissions
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get('affiliateId') || undefined;
    const status = searchParams.get('status') || undefined;

    const referrals = await prisma.affiliateReferral.findMany({
      where: {
        ...(affiliateId ? { affiliateId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, commissions: referrals });
  } catch (error) {
    console.error('affiliate commissions GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list commissions' },
      { status: 500 }
    );
  }
}

/**
 * POST — create/complete one commission for a verified payment (idempotent).
 * Body: { affiliateId, tenantId, paymentId, paymentAmount, status? }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.manageCommissions)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const affiliateId = String(body.affiliateId || '').trim();
    const tenantId = String(body.tenantId || '').trim();
    const paymentId = String(body.paymentId || body.conversionId || '').trim();
    const paymentAmount = Number(body.paymentAmount);

    if (!affiliateId || !tenantId || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'affiliateId, tenantId, and paymentId are required' },
        { status: 400 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) {
      return NextResponse.json({ success: false, error: 'Affiliate not found' }, { status: 404 });
    }

    const calc = calculateCommission({
      paymentAmount,
      commissionRatePercent: affiliate.commissionRate ?? 20,
    });
    if (!calc.ok) {
      return NextResponse.json({ success: false, error: calc.error }, { status: 400 });
    }

    const idempotencyKey =
      String(body.idempotencyKey || '').trim() ||
      commissionIdempotencyKey(tenantId, paymentId);

    const existing = await prisma.affiliateReferral.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        commission: existing,
        idempotentReplay: true,
      });
    }

    const status = String(body.status || 'completed').toLowerCase();

    let commission;
    try {
      commission = await prisma.affiliateReferral.create({
        data: {
          affiliateId,
          tenantId,
          paymentId,
          idempotencyKey,
          commissionAmount: calc.commission,
          status,
          completedAt: status === 'completed' ? new Date() : null,
          userId: body.userId || null,
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const raced = await prisma.affiliateReferral.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return NextResponse.json({
            success: true,
            commission: raced,
            idempotentReplay: true,
          });
        }
      }
      throw error;
    }

    if (status === 'completed') {
      await prisma.affiliate.update({
        where: { id: affiliateId },
        data: {
          totalCommissions: { increment: calc.commission },
          totalReferrals: { increment: 1 },
        },
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_COMMISSION_CREATE',
        entityType: 'AFFILIATE_REFERRAL',
        entityId: commission.id,
        details: JSON.stringify({
          affiliateId,
          tenantId,
          paymentId,
          commission: calc.commission,
          idempotencyKey,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { success: true, commission, idempotentReplay: false },
      { status: 201 }
    );
  } catch (error) {
    console.error('affiliate commissions POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create commission',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
