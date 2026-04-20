// app/api/expenses/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sumNetCogsDebitMinusCredit } from '@/lib/dashboardCogsNet';

// GET - Fetch expense statistics
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse date parameters
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build date filter
    const dateFilter = {};
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom);
    }
    // Remove default current month filter to include all historical expenses
    
    if (dateTo) {
      dateFilter.lte = new Date(dateTo);
    }
    
    // Base query filter for tenant's expenses (exclude deleted).
    // Branch rule must match GET /api/expenses: strict current branch when set (no OR null),
    // so totals match the on-screen table and CSV export.
    const baseFilter = {
      tenantId: user.tenantId,
      isDeleted: false
    };
    if (user?.currentBranchId) {
      baseFilter.branchId = user.currentBranchId;
    }
    
    // Only add date filter if there are actual date constraints
    if (Object.keys(dateFilter).length > 0) {
      baseFilter.date = dateFilter;
    }
    
    // Get total expenses count and sum
    const totalExpenses = await prisma.expense.aggregate({
      where: baseFilter,
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get approved expenses count and sum
    const approvedExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Approved'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get pending expenses count and sum
    const pendingExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Pending'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Get rejected expenses count and sum
    const rejectedExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Rejected'
      },
      _count: true,
      _sum: {
        amount: true
      }
    });

    const APPROVAL_BUCKET_STATUSES = ['Approved', 'Pending', 'Rejected', 'Draft'];
    const draftExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: 'Draft'
      },
      _count: true,
      _sum: { amount: true }
    });
    const otherApprovalExpenses = await prisma.expense.aggregate({
      where: {
        ...baseFilter,
        status: { notIn: APPROVAL_BUCKET_STATUSES }
      },
      _count: true,
      _sum: { amount: true }
    });

    // Approved expenses that still need cash/settlement (matches grid "Payment status")
    const outstandingPaymentRows = await prisma.expense.findMany({
      where: {
        ...baseFilter,
        status: 'Approved',
        paymentStatus: { in: ['Pending', 'Partially'] }
      },
      select: {
        amount: true,
        taxAmount: true,
        paidAmount: true
      }
    });
    let outstandingPaymentSum = 0;
    for (const row of outstandingPaymentRows) {
      const totalDue =
        Number(row.amount) + Number(row.taxAmount != null ? row.taxAmount : 0);
      const paid = Number(row.paidAmount != null ? row.paidAmount : 0);
      outstandingPaymentSum += Math.max(0, totalDue - paid);
    }
    
    // Get expenses by category (only categories that have at least one expense)
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: baseFilter,
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    // Default (hardcoded) expense category names so section always shows a base set
    const DEFAULT_EXPENSE_CATEGORY_NAMES = [
      'Rent Expense', 'Utilities Expense', 'Salaries & Wages', 'Advertising Expense',
      'Office Supplies', 'Insurance Expense', 'Depreciation Expense', 'Bank Charges',
      'Other Expenses', 'Travel & Transportation', 'Marketing & Advertising',
      'Professional Fees', 'Maintenance & Repairs', 'Miscellaneous Expenses'
    ];

    // Build full list: default + custom (ExpenseCategory) + Chart of Accounts expense accounts
    const allCategoryNames = new Set(DEFAULT_EXPENSE_CATEGORY_NAMES);
    try {
      const expenseCategories = await prisma.expenseCategory.findMany({
        where: { tenantId: user.tenantId },
        select: { name: true }
      });
      expenseCategories.forEach(cat => {
        if (cat.name && cat.name.trim()) allCategoryNames.add(cat.name.trim());
      });
      const expenseAccounts = await prisma.account.findMany({
        where: {
          tenantId: user.tenantId,
          accountType: 'Expense',
          isActive: true
        },
        select: { accountName: true, name: true }
      });
      expenseAccounts.forEach(acc => {
        const name = (acc.accountName || acc.name || '').trim();
        if (name) allCategoryNames.add(name);
      });
    } catch (e) {
      console.warn('Statistics: could not load full category list', e?.message || e);
    }
    
    // Find COGS account(s) for this tenant to include in statistics
    const cogsAccounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        accountType: 'Expense',
        OR: [
          { accountCode: '5000' },
          { code: '5000' },
          { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
          { accountName: { contains: 'cogs', mode: 'insensitive' } },
          { name: { contains: 'cost of goods', mode: 'insensitive' } },
          { name: { contains: 'cogs', mode: 'insensitive' } }
        ]
      },
      select: { id: true }
    });
    const cogsAccountIds = cogsAccounts.map(acc => acc.id);
    
    // Get COGS transactions for the period
    let cogsTotal = 0;
    let cogsTransactionCount = 0;
    if (cogsAccountIds.length > 0) {
      // Build date filter for transactions
      const transactionDateFilter = {};
      if (dateFrom) {
        transactionDateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        transactionDateFilter.lte = new Date(dateTo);
      }
      
      const transactionWhere = {
        tenantId: user.tenantId,
        status: { in: ['posted', 'Posted'] },
        ...(Object.keys(transactionDateFilter).length > 0 ? { date: transactionDateFilter } : {}),
        ...(user?.currentBranchId ? { branchId: user.currentBranchId } : {}),
      };

      cogsTotal = await sumNetCogsDebitMinusCredit(prisma, {
        cogsAccountIds,
        transactionWhere,
      });

      cogsTransactionCount = await prisma.transactionLine.count({
        where: {
          accountId: { in: cogsAccountIds },
          OR: [{ debitAmount: { gt: 0 } }, { creditAmount: { gt: 0 } }],
          transaction: transactionWhere,
        },
      });
    }
    
    const operatingSum = totalExpenses._sum.amount || 0;
    const operatingCount = totalExpenses._count || 0;
    // Grand total (expense rows + GL COGS net) — used for category % and "all-in" view
    const totalExpenseAmount = operatingSum + cogsTotal;
    const approvedAmount = approvedExpenses._sum.amount || 0;
    const pendingAmount = pendingExpenses._sum.amount || 0;
    const rejectedAmount = rejectedExpenses._sum.amount || 0;
    const draftAmount = draftExpenses._sum.amount || 0;
    const otherAmount = otherApprovalExpenses._sum.amount || 0;
    const approvalBucketsOperatingSum =
      approvedAmount + pendingAmount + rejectedAmount + draftAmount + otherAmount;
    
    // Map: category name (as stored in Expense) -> sum amount
    const amountByCategory = new Map();
    expensesByCategory.forEach(row => {
      const name = (row.category || '').trim();
      if (name) amountByCategory.set(name, row._sum.amount || 0);
    });
    const getAmountForName = (name) => {
      const exact = amountByCategory.get(name);
      if (exact !== undefined) return exact;
      const lower = name.toLowerCase();
      for (const [key, val] of amountByCategory) {
        if (key.toLowerCase() === lower) return val;
      }
      return 0;
    };

    // Build byCategory: every category (custom + CoA) with amount 0 if no expenses
    const formattedCategoryStats = [];
    allCategoryNames.forEach(categoryName => {
      const amount = getAmountForName(categoryName);
      const percentage = totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0;
      formattedCategoryStats.push({
        category: categoryName,
        amount: amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        percentage
      });
    });

    // Add COGS as a separate category when net COGS is non-zero
    if (cogsTotal !== 0) {
      const cogsPercentage = totalExpenseAmount > 0 ? Math.round((cogsTotal / totalExpenseAmount) * 100) : 0;
      formattedCategoryStats.push({
        category: 'Cost of Goods Sold',
        amount: cogsTotal.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        percentage: cogsPercentage
      });
    }

    // Include any expense category that appeared in data but is not in allCategoryNames (e.g. legacy names)
    expensesByCategory.forEach(row => {
      const name = (row.category || '').trim();
      if (name && !allCategoryNames.has(name)) {
        const amount = row._sum.amount || 0;
        const percentage = totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0;
        formattedCategoryStats.push({
          category: name,
          amount: amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          percentage
        });
      }
    });
    
    // Sort by amount descending (categories with 0 at the end)
    formattedCategoryStats.sort((a, b) => {
      const amountA = parseFloat(String(a.amount).replace(/,/g, ''));
      const amountB = parseFloat(String(b.amount).replace(/,/g, ''));
      return amountB - amountA;
    });
    
    const fmt = (n) =>
      Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

    // Return statistics
    const res = NextResponse.json({
      total: {
        // Expense rows only (matches list + export); COGS is separate
        count: operatingCount,
        amount: fmt(operatingSum),
        cogsIncluded: cogsTotal !== 0,
        cogsAmount: cogsTotal,
        cogsPostingCount: cogsTransactionCount,
        grandTotalAmount: fmt(totalExpenseAmount)
      },
      approved: {
        count: approvedExpenses._count || 0,
        amount: approvedAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      // Approval workflow: status === 'Pending' (not payment column)
      pending: {
        count: pendingExpenses._count || 0,
        amount: (pendingExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      pendingApproval: {
        count: pendingExpenses._count || 0,
        amount: fmt(pendingAmount)
      },
      outstandingPayment: {
        count: outstandingPaymentRows.length,
        amount: fmt(outstandingPaymentSum)
      },
      rejected: {
        count: rejectedExpenses._count || 0,
        amount: (rejectedExpenses._sum.amount || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
      },
      draft: {
        count: draftExpenses._count || 0,
        amount: fmt(draftAmount)
      },
      otherStatuses: {
        count: otherApprovalExpenses._count || 0,
        amount: fmt(otherAmount)
      },
      reconciliation: {
        operatingSum,
        approvalBucketsOperatingSum,
        matches:
          Math.abs(operatingSum - approvalBucketsOperatingSum) < 0.01
      },
      byCategory: formattedCategoryStats
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('Error fetching expense statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense statistics. Please try again.' },
      { status: 500 }
    );
  }
}