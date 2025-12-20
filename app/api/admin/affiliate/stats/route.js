import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAdminFromRequest } from '@/lib/adminAuth';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    const now = new Date();
    let startOfMonth;
    
    switch (range) {
      case '7d':
        startOfMonth = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '90d':
        startOfMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      default:
        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch all required data in parallel
    const [
      totalAffiliates,
      activeAffiliates,
      totalCommissions,
      pendingPayouts,
      conversionRate,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalSales,
      monthlyCommissions
    ] = await Promise.all([
      // Total affiliates
      prisma.affiliate.count(),
      
      // Active affiliates
      prisma.affiliate.count({
        where: { status: 'active' }
      }),
      
      // Total commissions (from completed referrals)
      prisma.affiliateReferral.aggregate({
        where: { status: 'completed' },
        _sum: { commissionAmount: true }
      }),
      
      // Pending payouts
      prisma.affiliatePayout.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true }
      }),
      
      // Monthly revenue from referrals (using updatedAt instead of completedAt)
      prisma.affiliateReferral.aggregate({
        where: {
          status: 'completed',
          updatedAt: { gte: startOfMonth }
        },
        _sum: { commissionAmount: true }
      }),
      
      // Conversion rate (referrals that resulted in sales)
      prisma.affiliateReferral.groupBy({
        by: ['status'],
        _count: { id: true }
      }),

      // Total referrals
      prisma.affiliateReferral.count(),

      // Completed referrals
      prisma.affiliateReferral.count({
        where: { status: 'completed' }
      }),

      // Pending referrals
      prisma.affiliateReferral.count({
        where: { status: 'pending' }
      }),

      // Total sales from referrals (using commission amount as proxy for sales)
      prisma.affiliateReferral.aggregate({
        where: { status: 'completed' },
        _sum: { commissionAmount: true }
      }),

      // Monthly commissions
      prisma.affiliateReferral.aggregate({
        where: {
          status: 'completed',
          updatedAt: { gte: startOfMonth }
        },
        _sum: { commissionAmount: true }
      })
    ]);

    // Calculate conversion rate
    let calculatedConversionRate = 0;
    if (totalReferrals > 0) {
      calculatedConversionRate = Math.round((completedReferrals / totalReferrals) * 100);
    }

    // Calculate average commission per referral
    const avgCommissionPerReferral = completedReferrals > 0 
      ? (totalCommissions._sum.commissionAmount || 0) / completedReferrals 
      : 0;

    // Calculate monthly growth
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthCommissions = await prisma.affiliateReferral.aggregate({
      where: {
        status: 'completed',
        updatedAt: { gte: lastMonthStart, lt: startOfMonth }
      },
      _sum: { commissionAmount: true }
    });

    const monthlyGrowth = lastMonthCommissions._sum.commissionAmount > 0
      ? ((monthlyCommissions._sum.commissionAmount - lastMonthCommissions._sum.commissionAmount) / lastMonthCommissions._sum.commissionAmount) * 100
      : monthlyCommissions._sum.commissionAmount > 0 ? 100 : 0;

    const stats = {
      totalAffiliates: totalAffiliates || 0,
      activeAffiliates: activeAffiliates || 0,
      totalCommissions: (totalCommissions._sum.commissionAmount || 0),
      pendingPayouts: (pendingPayouts._sum.amount || 0),
      monthlyRevenue: (monthlyCommissions._sum.commissionAmount || 0),
      conversionRate: calculatedConversionRate,
      totalReferrals: totalReferrals || 0,
      completedReferrals: completedReferrals || 0,
      pendingReferrals: pendingReferrals || 0,
      totalSales: (totalSales._sum.commissionAmount || 0),
      monthlyCommissions: (monthlyCommissions._sum.commissionAmount || 0),
      avgCommissionPerReferral: avgCommissionPerReferral,
      monthlyGrowth: monthlyGrowth
    };

    return NextResponse.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch affiliate stats' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 