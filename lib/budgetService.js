// lib/budgetService.js
/**
 * Revenue Budget Service
 * Manages revenue budget creation, updates, comparisons, and reporting
 * Supports Monthly, Quarterly, and Yearly budget periods
 */

import prisma from './prisma';
import { ensureExpenseAccountsForTenant, EXPENSE_ACCOUNTS_TEMPLATE } from './expenseCategoriesTemplate';

/**
 * Period type constants
 */
export const PERIOD_TYPES = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly'
};

export const BUDGET_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed'
};

/**
 * Check if a budget is locked (end date has passed)
 */
export function isBudgetLocked(budget) {
  if (budget.isLocked) return true;
  const now = new Date();
  const endDate = new Date(budget.endDate);
  return endDate < now;
}

/**
 * Check if budget period is in the future
 */
export function isBudgetFuture(budget) {
  const now = new Date();
  const startDate = new Date(budget.startDate);
  return startDate > now;
}

/**
 * Validate budget creation data
 */
export async function validateBudgetData(tenantId, budgetData, existingBudgetId = null) {
  const errors = [];
  const budgetType = budgetData.budgetType || 'revenue';

  // Required fields validation
  if (!budgetData.name || budgetData.name.trim() === '') {
    errors.push('Budget name is required');
  }

  if (!budgetData.startDate) {
    errors.push('Start date is required');
  }

  if (!budgetData.endDate) {
    errors.push('End date is required');
  }

  if (!budgetData.periodType || !Object.values(PERIOD_TYPES).includes(budgetData.periodType)) {
    errors.push('Valid period type (monthly, quarterly, yearly) is required');
  }

  if (!['revenue', 'expense'].includes(budgetType)) {
    errors.push('Budget type must be revenue or expense');
  }

  // Date validation
  if (budgetData.startDate && budgetData.endDate) {
    const startDate = new Date(budgetData.startDate);
    const endDate = new Date(budgetData.endDate);

    if (startDate >= endDate) {
      errors.push('End date must be after start date');
    }
    // Note: Overlapping budgets are allowed - businesses can have multiple budgets in the same period
  }

  // Budget amount validation
  if (!budgetData.expectedRevenue || budgetData.expectedRevenue <= 0) {
    errors.push(budgetType === 'expense'
      ? 'Expected expense must be greater than zero'
      : 'Expected revenue must be greater than zero');
  }

  // Breakdown validation (revenue budgets only)
  if (budgetType === 'expense' && budgetData.breakdowns && budgetData.breakdowns.length > 0) {
    errors.push('Breakdowns are only supported for revenue budgets');
  }

  // Revenue category/branch breakdown is optional — amounts do not need to sum to expected revenue
  // (used for forecasting / tracking which inventory categories sell more).

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a new revenue budget
 */
export async function createRevenueBudget(tenantId, userId, budgetData) {
  // Validate data first
  const validation = await validateBudgetData(tenantId, budgetData);
  if (!validation.isValid) {
    throw new Error(validation.errors.join('; '));
  }

  const {
    name,
    description,
    periodType,
    startDate,
    endDate,
    expectedRevenue,
    budgetType = 'revenue',
    currency = 'MWK',
    breakdowns,
    items
  } = budgetData;

  const accountIds = (items || []).map(item => item.accountId).filter(Boolean);
  const accounts = accountIds.length > 0
    ? await prisma.account.findMany({
        where: {
          tenantId,
          id: { in: accountIds },
          accountType: 'Expense',
          isActive: true
        },
        select: { id: true, accountName: true }
      })
    : [];
  const accountMap = new Map(accounts.map(acc => [acc.id, acc.accountName]));

  // Create the budget with approved status
  const budget = await prisma.budget.create({
    data: {
      tenantId,
      name,
      description,
      budgetType,
      periodType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      expectedRevenue,
      currency,
      status: 'approved', // Created as approved
      approvedById: userId, // Auto-approved by creator
      approvedAt: new Date(),
      activatedById: userId, // Also auto-activated
      activatedAt: new Date(),
      version: 1,
      items: items && items.length > 0 ? {
        create: items.map(item => ({
          accountId: item.accountId || null,
          category: item.accountId ? (accountMap.get(item.accountId) || null) : null,
          branchId: item.branchId || null,
          categoryId: item.categoryId || null,
          period: new Date(item.period),
          budgetedAmount: item.budgetedAmount,
          notes: item.notes
        }))
      } : undefined,
      breakdowns: breakdowns && breakdowns.length > 0 ? {
        create: breakdowns.map(breakdown => ({
          breakdownType: breakdown.breakdownType, // 'branch' or 'product_category'
          referenceId: breakdown.referenceId,
          referenceName: breakdown.referenceName,
          budgetedAmount: breakdown.budgetedAmount
        }))
      } : undefined
    },
    include: {
      items: true,
      breakdowns: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return budget;
}

/**
 * Update an existing revenue budget
 */
export async function updateRevenueBudget(budgetId, tenantId, userId, updates) {
  // Check if budget exists and is not locked
  const existingBudget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId }
  });

  if (!existingBudget) {
    throw new Error('Budget not found');
  }

  if (isBudgetLocked(existingBudget)) {
    throw new Error('Cannot update a locked budget. The budget period has ended.');
  }

  if (existingBudget.status === 'closed') {
    throw new Error('Cannot update a closed budget');
  }

  // Validate update data
  const validation = await validateBudgetData(tenantId, updates, budgetId);
  if (!validation.isValid) {
    throw new Error(validation.errors.join('; '));
  }

  const {
    name,
    description,
    periodType,
    startDate,
    endDate,
    expectedRevenue,
    budgetType,
    currency,
    breakdowns,
    items
  } = updates;

  const updateData = {
    updatedAt: new Date()
  };

  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (periodType) updateData.periodType = periodType;
  if (budgetType) updateData.budgetType = budgetType;
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);
  if (expectedRevenue) updateData.expectedRevenue = expectedRevenue;
  if (currency) updateData.currency = currency;

  // Increment version if critical fields change
  if (startDate || endDate || expectedRevenue) {
    updateData.version = { increment: 1 };
  }

  const accountIds = (items || []).map(item => item.accountId).filter(Boolean);
  const accounts = accountIds.length > 0
    ? await prisma.account.findMany({
        where: {
          tenantId,
          id: { in: accountIds },
          accountType: 'Expense',
          isActive: true
        },
        select: { id: true, accountName: true }
      })
    : [];
  const accountMap = new Map(accounts.map(acc => [acc.id, acc.accountName]));

  // Update budget with transaction to handle items and breakdowns
  const budget = await prisma.$transaction(async (tx) => {
    // Delete existing items and breakdowns if being replaced
    if (items && Array.isArray(items)) {
      await tx.budgetItem.deleteMany({ where: { budgetId } });
      updateData.items = {
        create: items.map(item => ({
          accountId: item.accountId || null,
          category: item.accountId ? (accountMap.get(item.accountId) || null) : null,
          branchId: item.branchId || null,
          categoryId: item.categoryId || null,
          period: new Date(item.period),
          budgetedAmount: item.budgetedAmount,
          notes: item.notes
        }))
      };
    }

    if (breakdowns && Array.isArray(breakdowns)) {
      await tx.revenueBudgetBreakdown.deleteMany({ where: { budgetId } });
      updateData.breakdowns = {
        create: breakdowns.map(breakdown => ({
          breakdownType: breakdown.breakdownType,
          referenceId: breakdown.referenceId,
          referenceName: breakdown.referenceName,
          budgetedAmount: breakdown.budgetedAmount
        }))
      };
    }

    return await tx.budget.update({
      where: { id: budgetId },
      data: updateData,
      include: {
        items: true,
        breakdowns: true
      }
    });
  });

  return budget;
}

/**
 * Delete a revenue budget
 */
export async function deleteRevenueBudget(budgetId, tenantId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  if (isBudgetLocked(budget)) {
    throw new Error('Cannot delete a locked budget. The budget period has ended.');
  }

  if (budget.status === 'closed') {
    throw new Error('Cannot delete a closed budget');
  }

  // For draft, active, or approved budgets - allow deletion
  if (budget.status === 'draft' || budget.status === 'active' || budget.status === 'approved') {
    await prisma.budget.delete({
      where: { id: budgetId }
    });
    return { success: true, message: 'Budget deleted successfully' };
  }

  throw new Error('Cannot delete this budget');
}

/**
 * Activate a budget (transition from draft to active)
 */
export async function activateBudget(budgetId, tenantId, userId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  if (budget.status !== 'draft') {
    throw new Error('Only draft budgets can be activated');
  }

  if (isBudgetLocked(budget)) {
    throw new Error('Cannot activate a budget that has already ended');
  }

  const existingBudgetRecord = await prisma.budget.update({
    where: { id: budgetId },
    data: {
      status: 'active',
      activatedById: userId,
      activatedAt: new Date(),
      updatedAt: new Date()
    }
  });

  return existingBudgetRecord;
}

/**
 * Approve a budget
 */
export async function approveBudget(budgetId, tenantId, approvedById) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  if (budget.status !== 'active') {
    throw new Error('Only active budgets can be approved');
  }

  return await prisma.budget.update({
    where: { id: budgetId },
    data: {
      status: 'approved',
      approvedById,
      approvedAt: new Date(),
      updatedAt: new Date()
    },
    include: {
      items: true,
      breakdowns: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });
}

/**
 * Close a budget (automatically or manually)
 * Budgets are locked after their end date
 */
export async function closeBudget(budgetId, tenantId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  if (budget.status === 'closed') {
    return budget; // Already closed
  }

  return await prisma.budget.update({
    where: { id: budgetId },
    data: {
      status: 'closed',
      isLocked: true,
      lockedAt: new Date(),
      updatedAt: new Date()
    },
    include: {
      items: true,
      breakdowns: true
    }
  });
}

/**
 * Check and close any budgets that have passed their end date
 */
export async function autoCloseExpiredBudgets(tenantId) {
  const now = new Date();

  const expiredBudgets = await prisma.budget.findMany({
    where: {
      tenantId,
      status: { in: ['draft', 'active', 'approved'] },
      endDate: { lt: now },
      isLocked: false
    }
  });

  const closedBudgets = [];
  for (const budget of expiredBudgets) {
    const closed = await closeBudget(budget.id, tenantId);
    closedBudgets.push(closed);
  }

  return closedBudgets;
}

/**
 * Get actual revenue from General Ledger (TransactionLine) for a given period
 * This ensures consistency with financial reports and accounting entries
 */
export async function getActualRevenue(tenantId, startDate, endDate, filters = {}) {
  const { branchId, categoryId } = filters;
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all revenue accounts (Income/Revenue type)
  const revenueAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      OR: [
        { accountType: 'Revenue' },
        { accountType: 'Income' }
      ],
      isActive: true
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true
    }
  });

  if (revenueAccounts.length === 0) {
    console.warn('⚠️ No revenue accounts found for budget calculation');
    return {
      totalRevenue: 0,
      transactionCount: 0,
      breakdown: null
    };
  }

  const revenueAccountIds = revenueAccounts.map(acc => acc.id);

  // Build transaction filter
  const transactionWhere = {
    tenantId,
    status: 'posted',
    date: {
      gte: start,
      lte: end
    },
    ...(branchId ? { branchId } : {})
  };

  // Get all transaction lines for revenue accounts from General Ledger
  const transactionLines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: revenueAccountIds },
      transaction: transactionWhere
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          reference: true,
          description: true,
          sourceType: true,
          sourceId: true,
          branchId: true
        }
      },
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true
        }
      }
    }
  });

  // Calculate total revenue from TransactionLine records
  // For Revenue accounts: Credit increases revenue, Debit decreases
  const totalCredits = transactionLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
  const totalDebits = transactionLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
  const totalRevenue = totalCredits - totalDebits;

  // If category filter is provided, we need to filter by product category
  // This requires checking the source transaction (Sale) and its items
  let categoryBreakdown = null;
  if (categoryId) {
    // Get sales that contributed to these transactions
    const saleIds = transactionLines
      .filter(line => line.transaction.sourceType === 'Sale' && line.transaction.sourceId)
      .map(line => line.transaction.sourceId);

    if (saleIds.length > 0) {
      const itemsWithCategory = await prisma.saleItem.findMany({
        where: {
          saleId: { in: saleIds },
          product: {
            categoryId: categoryId
          }
        },
        include: {
          product: {
            select: {
              categoryId: true,
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      const categoryTotal = itemsWithCategory.reduce(
        (sum, item) => sum + (item.amount || 0), 
        0
      );

      categoryBreakdown = {
        categoryId,
        actualAmount: categoryTotal
      };
    }
  }

  // Get unique transaction count
  const uniqueTransactions = new Set(transactionLines.map(line => line.transaction.id));

  return {
    totalRevenue,
    transactionCount: uniqueTransactions.size,
    breakdown: categoryBreakdown,
    dataSource: 'General Ledger (TransactionLine)'
  };
}

/**
 * Get actual expenses from General Ledger (TransactionLine) for a given period
 * This ensures consistency with financial reports and accounting entries
 */
export async function getActualExpenses(tenantId, startDate, endDate, filters = {}) {
  const { accountIds } = filters;
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get expense accounts
  let expenseAccountIds = accountIds;
  if (!expenseAccountIds || expenseAccountIds.length === 0) {
    // If no specific accounts provided, get all expense accounts
    const expenseAccounts = await prisma.account.findMany({
      where: {
        tenantId,
        accountType: 'Expense',
        isActive: true
      },
      select: {
        id: true
      }
    });
    expenseAccountIds = expenseAccounts.map(acc => acc.id);
  }

  if (expenseAccountIds.length === 0) {
    console.warn('⚠️ No expense accounts found for budget calculation');
    return {
      totalExpenses: 0,
      transactionCount: 0,
      dataSource: 'General Ledger (TransactionLine)'
    };
  }

  // Get all transaction lines for expense accounts from General Ledger
  const transactionLines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: expenseAccountIds },
      transaction: {
        tenantId,
        status: 'posted',
        date: {
          gte: start,
          lte: end
        }
      }
    },
    include: {
      transaction: {
        select: {
          id: true,
          date: true,
          reference: true,
          description: true,
          sourceType: true,
          sourceId: true
        }
      },
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true
        }
      }
    }
  });

  // Calculate total expenses from TransactionLine records
  // For Expense accounts: Debit increases expense, Credit decreases
  const totalDebits = transactionLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
  const totalCredits = transactionLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
  const totalExpenses = totalDebits - totalCredits;

  // Get unique transaction count
  const uniqueTransactions = new Set(transactionLines.map(line => line.transaction.id));

  return {
    totalExpenses,
    transactionCount: uniqueTransactions.size,
    dataSource: 'General Ledger (TransactionLine)'
  };
}

/**
 * Actual expense debits minus credits per account (GL) for the period.
 * @param {string[]} accountIds
 * @returns {Record<string, number>}
 */
export async function getActualExpensesByAccount(tenantId, startDate, endDate, accountIds) {
  const uniqueIds = [...new Set((accountIds || []).filter(Boolean))];
  const result = {};
  for (const id of uniqueIds) result[id] = 0;
  if (uniqueIds.length === 0) return result;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: uniqueIds },
      transaction: {
        tenantId,
        status: 'posted',
        date: { gte: start, lte: end },
      },
    },
    select: {
      accountId: true,
      debitAmount: true,
      creditAmount: true,
    },
  });

  for (const line of lines) {
    const deb = parseFloat(line.debitAmount || 0);
    const cred = parseFloat(line.creditAmount || 0);
    const net = deb - cred;
    result[line.accountId] = (result[line.accountId] || 0) + net;
  }

  return result;
}

/**
 * Calculate budget vs actual comparison
 */
export async function getBudgetVsActual(budgetId, tenantId, asOfDate = null) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId },
    include: {
      items: true,
      breakdowns: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  // Determine the effective date for comparison
  const reportDate = asOfDate ? new Date(asOfDate) : new Date();
  const budgetEndDate = new Date(budget.endDate);
  
  // Use budget end date if it's in the past
  const effectiveEndDate = budgetEndDate < reportDate ? budgetEndDate : reportDate;

  const budgetType = budget.budgetType || 'revenue';
  let actualAmount = 0;
  let budgetedAmount = budget.expectedRevenue;

  if (budgetType === 'expense') {
    const accountIds = (budget.items || []).map(item => item.accountId).filter(Boolean);
    const actualExpenses = await getActualExpenses(
      tenantId,
      budget.startDate,
      effectiveEndDate,
      { accountIds: accountIds.length > 0 ? accountIds : undefined }
    );
    actualAmount = actualExpenses.totalExpenses;
  } else {
    const actualRevenue = await getActualRevenue(
      tenantId,
      budget.startDate,
      effectiveEndDate
    );
    actualAmount = actualRevenue.totalRevenue;
  }

  // Calculate variance
  // For revenue budgets: Positive variance = over budget (good), Negative = under budget (bad)
  // For expense budgets: Positive variance = over budget (bad), Negative = under budget (good)
  const variance = actualAmount - budgetedAmount;
  const variancePercent = budgetedAmount > 0 
    ? ((variance / budgetedAmount) * 100) 
    : 0;

  // Determine status (revenue: over = beat revenue target; expense: over = over-spent)
  let status;
  const tolerance = 0.05; // 5% tolerance for "on target"
  const varianceRatio = budgetedAmount > 0 ? variance / budgetedAmount : 0;

  if (varianceRatio >= tolerance) status = 'over';
  else if (varianceRatio <= -tolerance) status = 'under';
  else status = 'on_target';

  // Calculate achievement percentage
  const achievementPercent = budgetedAmount > 0
    ? ((actualAmount / budgetedAmount) * 100)
    : 0;

  // Get breakdown actuals if available
  let breakdownActuals = null;
  if (budgetType === 'revenue' && budget.breakdowns && budget.breakdowns.length > 0) {
    breakdownActuals = await Promise.all(
      budget.breakdowns.map(async (breakdown) => {
        const actuals = await getActualRevenue(
          tenantId,
          budget.startDate,
          effectiveEndDate,
          {
            branchId: breakdown.breakdownType === 'branch' ? breakdown.referenceId : undefined,
            categoryId: breakdown.breakdownType === 'product_category' ? breakdown.referenceId : undefined
          }
        );

        const breakdownVariance = actuals.totalRevenue - breakdown.budgetedAmount;
        const breakdownVariancePercent = breakdown.budgetedAmount > 0
          ? ((breakdownVariance / breakdown.budgetedAmount) * 100)
          : 0;

        return {
          ...breakdown,
          actualAmount: actuals.totalRevenue,
          variance: breakdownVariance,
          variancePercent: breakdownVariancePercent
        };
      })
    );
  }

  /** Expense budget: line-level budget vs actual per expense account (optional detail). */
  let expenseLines = null;
  if (budgetType === 'expense' && budget.items && budget.items.length > 0) {
    const withAccount = budget.items.filter((i) => i.accountId);
    const accountIds = [...new Set(withAccount.map((i) => i.accountId))];
    const actualByAccount = await getActualExpensesByAccount(
      tenantId,
      budget.startDate,
      effectiveEndDate,
      accountIds
    );
    const budgetByAccount = new Map();
    for (const item of withAccount) {
      const cur = budgetByAccount.get(item.accountId) || 0;
      budgetByAccount.set(item.accountId, cur + Number(item.budgetedAmount || 0));
    }
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, tenantId },
      select: { id: true, accountCode: true, accountName: true },
    });
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    expenseLines = accountIds.map((aid) => {
      const budgeted = budgetByAccount.get(aid) || 0;
      const actual = actualByAccount[aid] || 0;
      const v = actual - budgeted;
      const vPct = budgeted > 0 ? (v / budgeted) * 100 : 0;
      const acc = accMap.get(aid);
      return {
        accountId: aid,
        accountCode: acc?.accountCode || '',
        accountName: acc?.accountName || 'Expense',
        budgetedAmount: budgeted,
        actualAmount: actual,
        variance: v,
        variancePercent: vPct,
      };
    });
    expenseLines.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }

  return {
    budget: {
      id: budget.id,
      name: budget.name,
      description: budget.description,
      budgetType,
      periodType: budget.periodType,
      startDate: budget.startDate,
      endDate: budget.endDate,
      status: budget.status,
      isLocked: isBudgetLocked(budget),
      currency: budget.currency
    },
    comparison: {
      budgetedRevenue: budgetedAmount,
      actualRevenue: actualAmount,
      variance: {
        amount: variance,
        isOver: variance >= 0,
        percent: variancePercent
      },
      achievement: {
        percent: achievementPercent,
        status
      },
      period: {
        start: budget.startDate,
        end: effectiveEndDate,
        asOf: reportDate
      }
    },
    breakdowns: breakdownActuals,
    expenseLines,
    approvedBy: budget.approvedBy
  };
}

/**
 * Get all revenue budgets for tenant with optional filters
 */
export async function getRevenueBudgets(tenantId, filters = {}) {
  const {
    status,
    periodType,
    startDateFrom,
    startDateTo,
    includeLocked = false,
    budgetType
  } = filters;

  // Closed budgets should always be visible, even if locked
  // Only filter out non-closed locked budgets
  const where = {
    tenantId,
    ...(budgetType && { budgetType }),
    ...(status && { status }),
    ...(periodType && { periodType }),
    ...(startDateFrom && startDateTo && {
      startDate: {
        gte: new Date(startDateFrom),
        lte: new Date(startDateTo)
      }
    }),
    ...(!includeLocked && {
      OR: [
        { isLocked: false },
        { status: 'closed' }
      ]
    })
  };

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      items: true,
      breakdowns: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: [
      { startDate: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  // Add computed fields
  return budgets.map(budget => ({
    ...budget,
    isLocked: isBudgetLocked(budget),
    isFuture: isBudgetFuture(budget)
  }));
}

/**
 * Get single budget with all details
 */
export async function getBudgetById(budgetId, tenantId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, tenantId },
    include: {
      items: true,
      breakdowns: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  if (!budget) {
    return null;
  }

  return {
    ...budget,
    isLocked: isBudgetLocked(budget),
    isFuture: isBudgetFuture(budget)
  };
}

/**
 * Generate budget vs actual report
 */
export async function generateBudgetReport(tenantId, options = {}) {
  const {
    startDate,
    endDate,
    periodType,
    branchId,
    categoryId,
    includeComparison = true
  } = options;

  const where = {
    tenantId,
    status: { in: ['active', 'approved', 'closed'] },
    ...(periodType && { periodType }),
    ...(startDate && endDate && {
      startDate: { gte: new Date(startDate) },
      endDate: { lte: new Date(endDate) }
    })
  };

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      items: true,
      breakdowns: true
    },
    orderBy: { startDate: 'asc' }
  });

  const reportData = await Promise.all(
    budgets.map(async (budget) => {
      const comparison = includeComparison
        ? await getBudgetVsActual(budget.id, tenantId)
        : null;

      // Filter breakdown if branch/category specified
      let filteredBreakdowns = budget.breakdowns;
      if (branchId || categoryId) {
        filteredBreakdowns = budget.breakdowns.filter(b => {
          if (branchId && b.breakdownType === 'branch') {
            return b.referenceId === branchId;
          }
          if (categoryId && b.breakdownType === 'product_category') {
            return b.referenceId === categoryId;
          }
          return true;
        });
      }

      return {
        budget: {
          id: budget.id,
          name: budget.name,
          budgetType: budget.budgetType || 'revenue',
          periodType: budget.periodType,
          startDate: budget.startDate,
          endDate: budget.endDate,
          status: budget.status,
          currency: budget.currency
        },
        budgetedAmount: budget.expectedRevenue,
        breakdowns: filteredBreakdowns,
        comparison: comparison ? {
          actualRevenue: comparison.comparison.actualRevenue,
          variance: comparison.comparison.variance,
          achievement: comparison.comparison.achievement
        } : null
      };
    })
  );

  // Calculate totals
  const totals = {
    totalBudgeted: reportData.reduce((sum, r) => sum + r.budgetedAmount, 0),
    totalActual: reportData.reduce(
      (sum, r) => sum + (r.comparison?.actualRevenue || 0), 
      0
    ),
    budgetCount: reportData.length
  };

  totals.totalVariance = totals.totalActual - totals.totalBudgeted;
  totals.totalAchievementPercent = totals.totalBudgeted > 0
    ? ((totals.totalActual / totals.totalBudgeted) * 100)
    : 0;

  return {
    period: {
      start: startDate,
      end: endDate,
      periodType
    },
    filters: {
      branchId,
      categoryId
    },
    data: reportData,
    totals
  };
}

/**
 * Generate period-based comparison report
 * Compares performance across periods (e.g., month over month, quarter over quarter)
 */
export async function generatePeriodComparisonReport(tenantId, options = {}) {
  const {
    baseStartDate,
    baseEndDate,
    comparisonStartDate,
    comparisonEndDate,
    periodType = 'monthly',
    includeActuals = true
  } = options;

  // Get budgets for both periods
  const [baseBudgets, comparisonBudgets] = await Promise.all([
    prisma.budget.findMany({
      where: {
        tenantId,
        periodType,
        startDate: { gte: new Date(baseStartDate), lte: new Date(baseEndDate) },
        status: { in: ['active', 'approved', 'closed'] }
      },
      include: { breakdowns: true }
    }),
    prisma.budget.findMany({
      where: {
        tenantId,
        periodType,
        startDate: { gte: new Date(comparisonStartDate), lte: new Date(comparisonEndDate) },
        status: { in: ['active', 'approved', 'closed'] }
      },
      include: { breakdowns: true }
    })
  ]);

  // Calculate actuals for each period
  const baseData = await Promise.all(
    baseBudgets.map(async (budget) => {
      const actuals = includeActuals
        ? await getActualRevenue(tenantId, budget.startDate, budget.endDate)
        : { totalRevenue: 0 };

      return {
        budgetId: budget.id,
        name: budget.name,
        startDate: budget.startDate,
        endDate: budget.endDate,
        budgeted: budget.expectedRevenue,
        actual: actuals.totalRevenue,
        variance: actuals.totalRevenue - budget.expectedRevenue,
        achievement: budget.expectedRevenue > 0
          ? ((actuals.totalRevenue / budget.expectedRevenue) * 100)
          : 0
      };
    })
  );

  const comparisonData = await Promise.all(
    comparisonBudgets.map(async (budget) => {
      const actuals = includeActuals
        ? await getActualRevenue(tenantId, budget.startDate, budget.endDate)
        : { totalRevenue: 0 };

      return {
        budgetId: budget.id,
        name: budget.name,
        startDate: budget.startDate,
        endDate: budget.endDate,
        budgeted: budget.expectedRevenue,
        actual: actuals.totalRevenue,
        variance: actuals.totalRevenue - budget.expectedRevenue,
        achievement: budget.expectedRevenue > 0
          ? ((actuals.totalRevenue / budget.expectedRevenue) * 100)
          : 0
      };
    })
  );

  // Calculate period totals
  const baseTotals = {
    budgeted: baseData.reduce((sum, b) => sum + b.budgeted, 0),
    actual: baseData.reduce((sum, b) => sum + b.actual, 0)
  };
  baseTotals.variance = baseTotals.actual - baseTotals.budgeted;
  baseTotals.achievement = baseTotals.budgeted > 0
    ? ((baseTotals.actual / baseTotals.budgeted) * 100)
    : 0;

  const comparisonTotals = {
    budgeted: comparisonData.reduce((sum, b) => sum + b.budgeted, 0),
    actual: comparisonData.reduce((sum, b) => sum + b.actual, 0)
  };
  comparisonTotals.variance = comparisonTotals.actual - comparisonTotals.budgeted;
  comparisonTotals.achievement = comparisonTotals.budgeted > 0
    ? ((comparisonTotals.actual / comparisonTotals.budgeted) * 100)
    : 0;

  // Calculate period-over-period change
  const poPChange = {
    budgeted: baseTotals.budgeted - comparisonTotals.budgeted,
    actual: baseTotals.actual - comparisonTotals.actual,
    variance: baseTotals.variance - comparisonTotals.variance,
    achievement: baseTotals.achievement - comparisonTotals.achievement
  };

  return {
    periodType,
    periods: {
      base: {
        start: baseStartDate,
        end: baseEndDate,
        data: baseData,
        totals: baseTotals
      },
      comparison: {
        start: comparisonStartDate,
        end: comparisonEndDate,
        data: comparisonData,
        totals: comparisonTotals
      }
    },
    periodOverPeriod: {
      change: poPChange,
      percentChange: {
        budgeted: comparisonTotals.budgeted > 0
          ? ((poPChange.budgeted / comparisonTotals.budgeted) * 100)
          : 0,
        actual: comparisonTotals.actual > 0
          ? ((poPChange.actual / comparisonTotals.actual) * 100)
          : 0,
        achievement: comparisonTotals.achievement > 0
          ? ((poPChange.achievement / comparisonTotals.achievement) * 100)
          : 0
      }
    }
  };
}

/**
 * Get available branches for budget breakdown
 */
export async function getBranchesForBudget(tenantId) {
  return await prisma.branch.findMany({
    where: {
      tenantId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      code: true
    },
    orderBy: { name: 'asc' }
  });
}

/**
 * Get available expense categories for budget line items
 * Uses the same logic as /api/categories endpoint with type=expense
 */
export async function getCategoriesForBudget(tenantId) {
  const loadAccounts = async () =>
    prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        accountType: 'Expense'
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true
      },
      orderBy: {
        accountCode: 'asc'
      }
    });

  let accounts = await loadAccounts();

  // Ensure the standard expense accounts exist so dropdowns are never empty.
  if (accounts.length === 0) {
    try {
      const templateCodes = EXPENSE_ACCOUNTS_TEMPLATE.map((t) => t.code);
      const existingTemplateCount = await prisma.account.count({
        where: { tenantId, accountCode: { in: templateCodes } }
      });
      if (existingTemplateCount < EXPENSE_ACCOUNTS_TEMPLATE.length) {
        await ensureExpenseAccountsForTenant(tenantId, prisma);
        accounts = await loadAccounts();
      }
    } catch (e) {
      console.warn('getCategoriesForBudget: could not ensure expense accounts:', e?.message || e);
    }
  }

  return accounts.map(account => ({
    id: account.id,
    name: account.accountName,
    code: account.accountCode,
    type: account.accountType
  }));
}

/**
 * Inventory (product) categories for optional revenue forecasting by category.
 */
export async function getInventoryCategoriesForBudget(tenantId) {
  return prisma.inventoryCategory.findMany({
    where: { tenantId },
    select: { id: true, name: true, description: true },
    orderBy: { name: 'asc' },
  });
}

/**
 * Optional check: breakdown totals vs expected revenue (not enforced on create).
 */
export function validateBreakdownTotals(expectedRevenue, breakdowns) {
  if (!breakdowns || breakdowns.length === 0) {
    return { isValid: true };
  }

  const total = breakdowns.reduce(
    (sum, item) => sum + (item.budgetedAmount || 0),
    0
  );

  const tolerance = 0.01; // Allow for floating point precision
  const difference = Math.abs(total - expectedRevenue);

  if (difference > tolerance) {
    return {
      isValid: false,
      error: `Breakdown total (${total.toFixed(2)}) does not match expected revenue (${expectedRevenue.toFixed(2)})`
    };
  }

  return { isValid: true };
}

/**
 * Archive old budgets
 */
export async function archiveBudgets(tenantId, beforeDate) {
  const budgets = await prisma.budget.findMany({
    where: {
      tenantId,
      status: 'closed',
      endDate: { lt: new Date(beforeDate) }
    }
  });

  // In a real implementation, you might move to an archive table
  // For now, we just mark them
  const updated = await prisma.budget.updateMany({
    where: {
      tenantId,
      status: 'closed',
      endDate: { lt: new Date(beforeDate) }
    },
    data: {
      status: 'archived',
      updatedAt: new Date()
    }
  });

  return { count: updated.count };
}

export default {
  // Constants
  PERIOD_TYPES,
  BUDGET_STATUS,
  
  // Core functions
  createRevenueBudget,
  updateRevenueBudget,
  deleteRevenueBudget,
  activateBudget,
  approveBudget,
  closeBudget,
  autoCloseExpiredBudgets,
  
  // Comparison functions
  getActualRevenue,
  getBudgetVsActual,
  
  // Query functions
  getRevenueBudgets,
  getBudgetById,
  
  // Report functions
  generateBudgetReport,
  generatePeriodComparisonReport,
  
  // Helper functions
  getBranchesForBudget,
  getCategoriesForBudget,
  getInventoryCategoriesForBudget,
  getActualExpensesByAccount,
  validateBreakdownTotals,
  isBudgetLocked,
  validateBudgetData
};
