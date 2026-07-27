import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * GET /api/admin/affiliate/stats
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
    const range = searchParams.get('range') || '30d';
    const now = new Date();

    let startOfPeriod;
    switch (range) {
      case '7d':
        startOfPeriod = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startOfPeriod = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '30d':
      default:
        startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalAffiliates,
      activeAffiliates,
      totalCommissionsAgg,
      pendingPayoutsAgg,
      periodCommissionsAgg,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      lastMonthCommissionsAgg,
    ] = await Promise.all([
      prisma.affiliate.count(),
      prisma.affiliate.count({ where: { status: 'active' } }),
      prisma.affiliateReferral.aggregate({
        where: { status: 'completed' },
        _sum: { commissionAmount: true },
      }),
      prisma.affiliatePayout.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
      }),
      prisma.affiliateReferral.aggregate({
        where: {
          status: 'completed',
          updatedAt: { gte: startOfPeriod },
        },
        _sum: { commissionAmount: true },
      }),
      prisma.affiliateReferral.count(),
      prisma.affiliateReferral.count({ where: { status: 'completed' } }),
      prisma.affiliateReferral.count({ where: { status: 'pending' } }),
      prisma.affiliateReferral.aggregate({
        where: {
          status: 'completed',
          updatedAt: { gte: lastMonthStart, lt: thisMonthStart },
        },
        _sum: { commissionAmount: true },
      }),
    ]);

    const totalCommissions = Number(totalCommissionsAgg._sum?.commissionAmount || 0);
    const pendingPayouts = Number(pendingPayoutsAgg._sum?.amount || 0);
    const monthlyCommissions = Number(periodCommissionsAgg._sum?.commissionAmount || 0);
    const lastMonthCommissions = Number(lastMonthCommissionsAgg._sum?.commissionAmount || 0);

    const conversionRate =
      totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0;
    const avgCommissionPerReferral =
      completedReferrals > 0 ? totalCommissions / completedReferrals : 0;
    const monthlyGrowth =
      lastMonthCommissions > 0
        ? ((monthlyCommissions - lastMonthCommissions) / lastMonthCommissions) * 100
        : monthlyCommissions > 0
          ? 100
          : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalAffiliates,
        activeAffiliates,
        totalCommissions,
        pendingPayouts,
        monthlyRevenue: monthlyCommissions,
        conversionRate,
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        totalSales: totalCommissions,
        monthlyCommissions,
        avgCommissionPerReferral,
        monthlyGrowth,
      },
    });
  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch affiliate stats',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
