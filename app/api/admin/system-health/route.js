import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

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

    // Get system statistics
    const [
      totalTenants,
      totalUsers,
      totalInvoices,
      totalExpenses,
      totalSales,
      activeTenants,
      trialTenants,
      overdueInvoices,
      pendingInvoices,
      recentAuditLogs,
      recentAdminLogs
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.invoice.count(),
      prisma.expense.count(),
      prisma.sale.count(),
      prisma.tenant.count({ where: { status: 'active' } }),
      prisma.tenant.count({ 
        where: { 
          accountSubscriptions: { 
            some: { isTrial: true } 
          } 
        } 
      }),
      prisma.invoice.count({ 
        where: { 
          dueDate: { lt: new Date() },
          status: 'PENDING'
        } 
      }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      prisma.auditLog.count({ 
        where: { 
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        } 
      }),
      prisma.adminAuditLog.count({ 
        where: { 
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        } 
      })
    ]);

    // Calculate system health metrics
    const systemHealth = {
      status: 'Good',
      uptime: 99.8, // This would be real uptime in production
      lastUpdated: new Date().toISOString(),
      
      // Database metrics
      database: {
        status: 'Healthy',
        totalRecords: totalTenants + totalUsers + totalInvoices + totalExpenses + totalSales,
        recentActivity: recentAuditLogs + recentAdminLogs
      },
      
      // Performance metrics (mock for now, would be real in production)
      performance: {
        cpuUsage: Math.floor(Math.random() * 30) + 20, // 20-50%
        memoryUsage: Math.floor(Math.random() * 40) + 30, // 30-70%
        storageUsage: Math.floor(Math.random() * 30) + 50, // 50-80%
        responseTime: Math.floor(Math.random() * 100) + 50 // 50-150ms
      },
      
      // Business metrics
      business: {
        totalTenants,
        activeTenants,
        trialTenants,
        totalUsers,
        totalInvoices,
        overdueInvoices,
        pendingInvoices,
        totalExpenses,
        totalSales
      },
      
      // Security metrics
      security: {
        recentLogins: recentAdminLogs,
        failedAttempts: Math.floor(Math.random() * 5), // Mock data
        lastSecurityScan: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    return NextResponse.json({
      success: true,
      health: systemHealth
    });

  } catch (error) {
    console.error('Error fetching system health:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system health' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 