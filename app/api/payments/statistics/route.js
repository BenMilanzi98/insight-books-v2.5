// app/api/payments/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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

    // Format method statistics
    const methodStats = paymentByMethod.reduce((acc, method) => {
      const methodKey = method.paymentMethod.replace(/\s+/g, '_').toLowerCase();
      acc[methodKey] = {
        count: method._count.id,
        amount: method._sum.amount || 0
      };
      return acc;
    }, {});

    // Fetch account balances with account details to map to payment methods
    const accountBalances = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        accountCode: true,
        balance: true,
      },
    });
    
    // Also get account balances (for any additional tracking)
    const accountBalanceRecords = await prisma.accountBalance.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        account: true, // This is the account identifier
        balance: true,
      },
    });
    
    // Combine both sources, prioritizing account balance records
    const allBalances = new Map();
    
    // Add account balance records (these might have different identifiers)
    for (const record of accountBalanceRecords) {
      allBalances.set(record.account, record.balance);
    }
    
    // Add direct account balances
    for (const account of accountBalances) {
      // If not already set by accountBalance record, use the account's direct balance
      if (!allBalances.has(account.id)) {
        allBalances.set(account.id, account.balance);
      }
      // Also add account code if it exists
      if (account.accountCode && !allBalances.has(account.accountCode)) {
        allBalances.set(account.accountCode, account.balance);
      }
    }
    
    // Convert back to array format for processing
    const processedBalances = Array.from(allBalances, ([account, balance]) => ({
      account,
      balance
    }));

    // Create a balance map for lookup from the combined balances map
    const balanceMap = {};
    for (const [account, balance] of allBalances) {
      const key = account.replace(/\s+/g, '_').toLowerCase();
      balanceMap[key] = balance;
    }
    
    // Also fetch account details to map account codes to payment method keys
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        accountCode: true,
      },
    });
    
    // Create a map from account ID to account code
    const accountIdToCodeMap = {};
    accounts.forEach(account => {
      if (account.accountCode) {
        accountIdToCodeMap[account.id] = account.accountCode;
      }
    });
    

    // Get supplier payment statistics to include in the method distribution
    const supplierPaymentsByMethod = await prisma.supplierPayment.groupBy({
      by: ['paymentMethod'],
      where: {
        tenantId: user.tenantId
      },
      _count: {
        id: true
      },
      _sum: {
        totalAmount: true
      }
    });

    // Add supplier payment stats to methodStats
    supplierPaymentsByMethod.forEach(method => {
      const methodKey = method.paymentMethod.replace(/\s+/g, '_').toLowerCase();
      if (methodStats[methodKey]) {
        methodStats[methodKey].count += method._count.id;
        methodStats[methodKey].amount += method._sum.totalAmount || 0;
      } else {
        methodStats[methodKey] = {
          count: method._count.id,
          amount: method._sum.totalAmount || 0
        };
      }
    });

    // Fetch payment accounts for the tenant
    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      }
    });

    // Helper to normalize account names for matching
    const normalizeName = (name) => {
      if (!name) return '';
      return name.toLowerCase().trim().replace(/\s+/g, '_');
    };
    
    // Map balances to payment accounts
    const combinedBalanceMap = {};
    for (const account of paymentAccounts) {
      const normalizedAccountName = normalizeName(account.name);
      let accountBalance = 0;
      
      // Find matching balances from accountBalance records
      for (const record of accountBalanceRecords) {
        const normalizedBalanceName = normalizeName(record.account);
        if (normalizedBalanceName === normalizedAccountName || 
            normalizedBalanceName.includes(normalizedAccountName) ||
            normalizedAccountName.includes(normalizedBalanceName)) {
          accountBalance += parseFloat(record.balance || 0);
        }
      }
      
      combinedBalanceMap[normalizedAccountName] = accountBalance;
      combinedBalanceMap[account.id] = accountBalance;
    }
    
    // Filtered and formatted method statistics with only availableBalance
    const methodStatsBalance = paymentAccounts.reduce((acc, account) => {
      const accountKey = normalizeName(account.name);
      acc[accountKey] = {
        name: account.name,
        availableBalance: combinedBalanceMap[accountKey] || 0
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