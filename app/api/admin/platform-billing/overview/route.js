import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  activeCommercialSubscriptionWhere,
  activePaidSubscriptionWhere,
  computeSaasBillingKpis,
} from '@/lib/admin/saasBillingKpis';

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * GET /api/admin/platform-billing/overview
 * Metrics from PlatformInvoice / PlatformPayment / AccountSubscription only.
 * Never mixes tenant AR revenue. On failure returns error (no false zeroes as success).
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

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeSubscriptions,
      activePaidSubscriptions,
      saasKpis,
      platformInvoices,
      paidPayments,
      outstandingInvoices,
      overdueInvoices,
      openCredits,
      refundsThisPeriod,
    ] = await Promise.all([
      // Includes Completed + trial — not only status='active'
      prisma.accountSubscription.count({
        where: activeCommercialSubscriptionWhere(now),
      }),
      prisma.accountSubscription.count({
        where: activePaidSubscriptionWhere(now),
      }),
      computeSaasBillingKpis(prisma, { periodStart }),
      prisma.platformInvoice.findMany({
        select: {
          total: true,
          amountPaid: true,
          outstanding: true,
          status: true,
          currency: true,
          periodEnd: true,
          createdAt: true,
        },
      }),
      prisma.platformPayment.findMany({
        where: {
          status: { in: ['COMPLETED', 'SUCCESSFUL', 'FULLY_ALLOCATED'] },
          createdAt: { gte: periodStart },
        },
        select: { amount: true, currency: true },
      }),
      prisma.platformInvoice.count({
        where: {
          outstanding: { gt: 0 },
          status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      }),
      prisma.platformInvoice.count({
        where: {
          outstanding: { gt: 0 },
          OR: [
            { status: 'OVERDUE' },
            {
              status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID'] },
              periodEnd: { lt: now },
            },
          ],
        },
      }),
      prisma.platformCredit
        ? prisma.platformCredit.count({ where: { status: 'OPEN', remaining: { gt: 0 } } })
        : Promise.resolve(0),
      prisma.platformRefund
        ? prisma.platformRefund.aggregate({
            where: {
              status: { in: ['COMPLETED', 'SUCCESSFUL'] },
              createdAt: { gte: periodStart },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
    ]);

    const currency = 'MWK';
    let billedTotal = 0;
    let collectedAllTime = 0;
    let outstandingTotal = 0;
    for (const inv of platformInvoices) {
      billedTotal += toNumber(inv.total);
      collectedAllTime += toNumber(inv.amountPaid);
      outstandingTotal += toNumber(inv.outstanding);
    }

    const paymentsThisPeriod = paidPayments.reduce((s, p) => s + toNumber(p.amount), 0);
    // Prefer PlatformPayment cash when invoice ledger is sparse (PayChangu path)
    const collectedFromPayments = toNumber(saasKpis.paymentsCollectedAllTime);
    const collectedEffective =
      collectedFromPayments > 0 ? collectedFromPayments : collectedAllTime;

    return NextResponse.json({
      success: true,
      source: 'platform_billing',
      currency,
      checkedAt: now.toISOString(),
      periodStart: periodStart.toISOString(),
      stats: {
        activeSubscriptions,
        activePaidSubscriptions,
        distinctActivePaidTenants: saasKpis.distinctActivePaidTenants,
        estimatedMrr: saasKpis.estimatedMrr,
        invoicesCount: platformInvoices.length,
        billedTotal,
        collectedAllTime: collectedEffective,
        collectedFromInvoices: collectedAllTime,
        collectedFromPayments,
        outstandingTotal,
        outstandingInvoiceCount: outstandingInvoices,
        overdueInvoiceCount: overdueInvoices,
        paymentsThisPeriod:
          paymentsThisPeriod || toNumber(saasKpis.paymentsCollectedThisPeriod),
        openCredits,
        refundsThisPeriod: toNumber(refundsThisPeriod._sum.amount),
      },
      saasKpis,
      note: 'Amounts are InsightBooks platform SaaS billing, not tenant customer AR.',
      caveats: saasKpis.caveats,
    });
  } catch (error) {
    console.error('platform-billing overview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load platform billing overview',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
