// app/api/payments/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { paymentMethods } from '@/lib/paymentMethods';

// GET - Fetch payment statistics
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse date filters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom);
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo);
    }
    
    // Build the where clause for filtering
    const where = {
      tenantId: user.tenantId
    };
    
    // Add date filter if provided
    if (Object.keys(dateFilter).length > 0) {
      where.paymentDate = dateFilter;
    }
    
    // Get total payment statistics
    const totalPayments = await prisma.payment.count({
      where
    });

    // Calculate total amount excluding refunded amounts
    const totalAmount = await prisma.payment.aggregate({
      where,
      _sum: {
        amount: true
      }
    });

    // Get total refunded amount to calculate net payments
    const totalRefunded = await prisma.payment.aggregate({
      where: {
        ...where,
        status: { in: ['Refunded', 'Partially_Refunded'] }
      },
      _sum: {
        refundedAmount: true
      }
    });

    // Calculate net amount (total payments - refunds)
    const netAmount = (totalAmount._sum.amount || 0) - (totalRefunded._sum.refundedAmount || 0);

    // Get payment statistics by status
    const paymentByStatus = await prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    // Get payment statistics by method
    const paymentByMethod = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where,
      _count: {
        id: true
      },
      _sum: {
        amount: true
      }
    });

    // Format status statistics
    const statusStats = paymentByStatus.reduce((acc, status) => {
      acc[status.status.toLowerCase()] = {
        count: status._count.id,
        amount: status._sum.amount || 0
      };
      return acc;
    }, {
      completed: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      refunded: { count: 0, amount: 0 },
      partially_refunded: { count: 0, amount: 0 }
    });

    // Fetch account balances
    const accountBalances = await prisma.accountBalance.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        account: true,
        balance: true,
      },
    });

    // Format method statistics
    const methodStats = paymentByMethod.reduce((acc, method) => {
      const methodKey = method.paymentMethod.replace(/\s+/g, '_').toLowerCase();
      acc[methodKey] = {
        count: method._count.id,
        amount: method._sum.amount || 0
      };
      return acc;
    }, {});

    // Create a balance map for lookup
    const balanceMap = accountBalances.reduce((acc, b) => {
      const key = b.account.replace(/\s+/g, '_').toLowerCase();
      acc[key] = b.balance;
      return acc;
    }, {});

    // Filtered and formatted method statistics with only availableBalance
    const methodStatsBalance = paymentMethods.reduce((acc, method) => {
      const methodKey = method.key;
      acc[methodKey] = {
        availableBalance: balanceMap[methodKey] || 0
      };
      return acc;
    }, {});

    // Get recent trend data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trendData = await prisma.payment.groupBy({
      by: ['paymentDate'],
      where: {
        ...where,
        paymentDate: {
          gte: thirtyDaysAgo
        }
      },
      _sum: {
        amount: true
      }
    });

    // Format trend data by day
    const formattedTrendData = trendData.map(day => ({
      date: day.paymentDate.toISOString().split('T')[0],
      amount: day._sum.amount || 0
    }));

    // Return statistics
    return NextResponse.json({
      totalPayments,
      totalAmount: netAmount, // Return net amount instead of gross
      grossAmount: totalAmount._sum.amount || 0, // Keep gross for reference
      totalRefunded: totalRefunded._sum.refundedAmount || 0,
      byStatus: statusStats,
      byMethod: methodStats,
      byMethodBalance: methodStatsBalance,
      trend: formattedTrendData
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment statistics. Please try again.' },
      { status: 500 }
    );
  }
}