import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

// GET /api/admin/dashboard/test - Test endpoint to verify dashboard data
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test basic queries
    const [
      totalUsers,
      totalTenants,
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      totalAuditLogs,
      recentLogins
    ] = await Promise.all([
      prisma.user.count(),
      prisma.tenant.count(),
      prisma.accountSubscription.count(),
      prisma.accountSubscription.count({
        where: { 
          OR: [
            { isActive: true, status: { not: 'cancelled' } },
            { isTrial: true, trialEndDate: { gt: new Date() }, status: { not: 'Expired' } }
          ]
        }
      }),
      prisma.accountSubscription.count({
        where: { 
          isTrial: true, 
          trialEndDate: { gt: new Date() }, 
          status: { not: 'Expired' } 
        }
      }),
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: { 
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          action: 'USER_LOGIN'
        }
      })
    ]);

    // Test plan distribution
    const planDistribution = await prisma.accountSubscription.groupBy({
      by: ['plan'],
      _count: { plan: true },
      where: { 
        OR: [
          { isActive: true, status: { not: 'cancelled' } },
          { isTrial: true, trialEndDate: { gt: new Date() }, status: { not: 'Expired' } }
        ]
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Dashboard data queries successful',
      data: {
        users: totalUsers,
        tenants: totalTenants,
        subscriptions: totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        auditLogs: totalAuditLogs,
        recentLogins,
        planDistribution
      }
    });

  } catch (error) {
    console.error('Dashboard test error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Dashboard data query failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 