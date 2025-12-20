import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/dashboard/debug - Debug endpoint to see what data exists
export async function GET() {
  try {
    // Test basic queries without authentication
    const [
      totalUsers,
      totalTenants,
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      totalAuditLogs,
      recentLogins,
      allSubscriptions
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
      }),
      prisma.accountSubscription.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Test plan distribution
    const planDistribution = await prisma.accountSubscription.groupBy({
      by: ['plan', 'isActive', 'isTrial', 'status'],
      _count: { plan: true }
    });

    return NextResponse.json({
      success: true,
      message: 'Debug data retrieved successfully',
      data: {
        users: totalUsers,
        tenants: totalTenants,
        subscriptions: totalSubscriptions,
        activeSubscriptions,
        trialSubscriptions,
        auditLogs: totalAuditLogs,
        recentLogins,
        planDistribution,
        allSubscriptions: allSubscriptions.map(sub => ({
          id: sub.id,
          plan: sub.plan,
          isActive: sub.isActive,
          isTrial: sub.isTrial,
          status: sub.status,
          tenantId: sub.tenantId,
          createdAt: sub.createdAt,
          trialEndDate: sub.trialEndDate
        }))
      }
    });

  } catch (error) {
    console.error('Dashboard debug error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Dashboard debug failed',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
} 