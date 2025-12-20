import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

// GET /api/admin/users/stats - Get user statistics for dashboard
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date for "this month" calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all statistics in parallel for better performance
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      pendingUsers,
      usersThisMonth,
      usersByRole,
      usersByTenant,
      recentActivity
    ] = await Promise.all([
      // Total users count
      prisma.user.count(),
      
      // Active users count
      prisma.user.count({
        where: { isActive: true }
      }),
      
      // Inactive users count
      prisma.user.count({
        where: { isActive: false }
      }),
      
      // Pending users count (users with no status set)
      prisma.user.count({
        where: { 
          OR: [
            { isActive: false },
            { status: 'pending' }
          ]
        }
      }),
      
      // Users created this month
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      }),
      
      // Users grouped by role
      prisma.user.groupBy({
        by: ['roleId'],
        _count: {
          roleId: true
        }
      }),
      
      // Users grouped by tenant
      prisma.user.groupBy({
        by: ['tenantId'],
        _count: {
          tenantId: true
        },
        where: {
          tenantId: {
            not: null
          }
        }
      }),
      
      // Recent user activity (last 7 days)
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Get unique tenant count
    const uniqueTenants = await prisma.tenant.count();

    // Get role names for the role breakdown
    const roleIds = usersByRole.map(group => group.roleId).filter(Boolean);
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true }
    });

    // Transform role data
    const roleBreakdown = usersByRole.reduce((acc, item) => {
      const role = roles.find(r => r.id === item.roleId);
      if (role) {
        acc[role.name] = item._count.roleId;
      }
      return acc;
    }, {});

    // Get top tenants with user counts
    const topTenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        users: {
          _count: 'desc'
        }
      },
      take: 5
    });

    // Get user growth over the last 6 months
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const count = await prisma.user.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });
      
      monthlyGrowth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count
      });
    }

    const stats = {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        pendingUsers,
        uniqueTenants
      },
      growth: {
        usersThisMonth,
        monthlyGrowth,
        recentActivity
      },
      breakdown: {
        byRole: roleBreakdown,
        topTenants: topTenants.map(tenant => ({
          name: tenant.name,
          userCount: tenant._count.users
        }))
      },
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 