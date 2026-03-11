import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import prisma from '@/lib/prisma';
import eisService from '@/lib/eisService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const hasEIS = await hasEISAccess(user.tenantId);
    if (!hasEIS) {
      return NextResponse.json({ error: 'EIS subscription required' }, { status: 403 });
    }

    const tenantId = user.tenantId;

    const [totalInvoices, statusCounts, monthlyUsage, recentInvoices, config] = await Promise.all([
      prisma.eISInvoice.count({ where: { tenantId } }),

      prisma.eISInvoice.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true }
      }),

      eisService.getMonthlyUsage(tenantId),

      prisma.eISInvoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      prisma.eISConfiguration.findFirst({
        where: { tenantId },
        select: { isActive: true, environment: true, lastSyncAt: true, syncStatus: true }
      })
    ]);

    const statusMap = {};
    for (const s of statusCounts) {
      statusMap[s.status] = s._count.id;
    }

    const approved = statusMap['Approved'] || 0;
    const submitted = statusMap['Submitted'] || 0;
    const pending = statusMap['Pending'] || 0;
    const rejected = statusMap['Rejected'] || 0;
    const errors = statusMap['Error'] || 0;
    const successRate = totalInvoices > 0 ? ((approved / totalInvoices) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        totalInvoices,
        approved,
        submitted,
        pending,
        rejected,
        errors,
        successRate: parseFloat(successRate),
        monthlyUsage,
        recentInvoices,
        configuration: config ? {
          isActive: config.isActive,
          environment: config.environment,
          lastSyncAt: config.lastSyncAt,
          syncStatus: config.syncStatus
        } : null
      }
    });
  } catch (error) {
    console.error('GET /api/eis/dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
