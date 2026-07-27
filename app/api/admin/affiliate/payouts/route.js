import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { payoutIdempotencyKey } from '@/lib/admin/affiliateIntegrity';

/**
 * GET /api/admin/affiliate/payouts
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

    const payouts = await prisma.affiliatePayout.findMany({
      where: { ...(affiliateId ? { affiliateId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, payouts });
  } catch (error) {
    console.error('affiliate payouts GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list payouts' },
      { status: 500 }
    );
  }
}

/**
 * POST — create payout once per affiliate+period (idempotent).
 * Body: { affiliateId, amount, periodKey, paymentMethod?, reference? }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.approvePayouts)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const affiliateId = String(body.affiliateId || '').trim();
    const periodKey = String(body.periodKey || '').trim();
    const amount = Number(body.amount);

    if (!affiliateId || !periodKey) {
      return NextResponse.json(
        { success: false, error: 'affiliateId and periodKey are required' },
        { status: 400 }
      );
    }
    if (!(amount > 0)) {
      return NextResponse.json(
        { success: false, error: 'amount must be greater than zero' },
        { status: 400 }
      );
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) {
      return NextResponse.json({ success: false, error: 'Affiliate not found' }, { status: 404 });
    }

    const idempotencyKey =
      String(body.idempotencyKey || '').trim() ||
      payoutIdempotencyKey(affiliateId, periodKey);

    const existing = await prisma.affiliatePayout.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        payout: existing,
        idempotentReplay: true,
      });
    }

    let payout;
    try {
      payout = await prisma.affiliatePayout.create({
        data: {
          affiliateId,
          amount,
          paymentMethod: String(body.paymentMethod || affiliate.paymentMethod || 'bank'),
          reference: body.reference ? String(body.reference) : null,
          status: String(body.status || 'approved'),
          periodKey,
          idempotencyKey,
          processedDate: body.status === 'paid' ? new Date() : null,
        },
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const raced = await prisma.affiliatePayout.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return NextResponse.json({
            success: true,
            payout: raced,
            idempotentReplay: true,
          });
        }
      }
      throw error;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_PAYOUT_CREATE',
        entityType: 'AFFILIATE_PAYOUT',
        entityId: payout.id,
        details: JSON.stringify({ affiliateId, amount, periodKey, idempotencyKey }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { success: true, payout, idempotentReplay: false },
      { status: 201 }
    );
  } catch (error) {
    console.error('affiliate payouts POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payout' },
      { status: 500 }
    );
  }
}
