// lib/budgetService.js
/**
 * Budget Service
 * Manages budget creation, updates, and budget vs actual comparisons
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Create a new budget
 */
export async function createBudget(tenantId, budgetData) {
  const {
    name,
    description,
    periodType = 'annual',
    startDate,
    endDate,
    items = []
  } = budgetData;

  return await prisma.budget.create({
    data: {
      tenantId,
      name,
      description,
      periodType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'draft',
      version: 1,
      items: {
        create: items.map(item => ({
          accountId: item.accountId,
          period: new Date(item.period),
          budgetedAmount: item.budgetedAmount,
          notes: item.notes
        }))
      }
    },
    include: {
      items: {
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true
            }
          }
        }
      }
    }
  });
}

/**
 * Update budget
 */
export async function updateBudget(budgetId, tenantId, updates) {
  const { items, ...budgetUpdates } = updates;

  const updateData = {
    ...budgetUpdates,
    updatedAt: new Date()
  };

  // Ensure date fields are stored as DateTime
  if (updateData.startDate) {
    updateData.startDate = new Date(updateData.startDate);
  }
  if (updateData.endDate) {
    updateData.endDate = new Date(updateData.endDate);
  }

  // If items are provided, update them
  if (items && Array.isArray(items)) {
    // Delete existing items and create new ones
    await prisma.budgetItem.deleteMany({
      where: { budgetId }
    });

    updateData.items = {
      create: items.map(item => ({
        accountId: item.accountId,
        period: new Date(item.period),
        budgetedAmount: item.budgetedAmount,
        notes: item.notes
      }))
    };
  }

  return await prisma.budget.update({
    where: {
      id: budgetId,
      tenantId
    },
    data: updateData,
    include: {
      items: {
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true
            }
          }
        }
      }
    }
  });
}

/**
 * Approve budget
 */
export async function approveBudget(budgetId, tenantId, approvedById) {
  return await prisma.budget.update({
    where: {
      id: budgetId,
      tenantId
    },
    data: {
      status: 'approved',
      approvedById,
      approvedAt: new Date()
    },
    include: {
      items: {
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true
            }
          }
        }
      },
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
 * Calculate actual amounts for budget items
 */
export async function calculateBudgetActuals(budgetId, tenantId, asOfDate = null) {
  const budget = await prisma.budget.findUnique({
    where: {
      id: budgetId,
      tenantId
    },
    include: {
      items: {
        include: {
          account: true
        }
      }
    }
  });

  if (!budget) {
    throw new Error('Budget not found');
  }

  const reportDate = asOfDate ? new Date(asOfDate) : new Date();
  reportDate.setHours(23, 59, 59, 999);

  // Calculate actual amounts for each budget item
  const updatedItems = await Promise.all(
    budget.items.map(async (item) => {
      // Get account balance as of the period end date
      const periodEnd = new Date(item.period);
      periodEnd.setHours(23, 59, 59, 999);
      
      // Use the earlier of: period end or report date
      const balanceDate = periodEnd > reportDate ? reportDate : periodEnd;
      
      // Get start of period
      const periodStart = new Date(item.period);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      periodStart.setDate(periodStart.getDate() - 1); // Day before period start

      // Calculate period change (actual amount for this period)
      const endBalance = await getAccountBalanceDetails(
        item.accountId,
        tenantId,
        balanceDate,
        prisma
      );
      
      const startBalance = await getAccountBalanceDetails(
        item.accountId,
        tenantId,
        periodStart,
        prisma
      );

      // For revenue accounts, actual = increase in balance
      // For expense accounts, actual = increase in balance
      const actualAmount = Math.abs(endBalance.balance - startBalance.balance);
      // Variance spec: Budgeted - Actual
      const variance = item.budgetedAmount - actualAmount;

      // Update the budget item
      return await prisma.budgetItem.update({
        where: { id: item.id },
        data: {
          actualAmount,
          variance
        },
        include: {
          account: true
        }
      });
    })
  );

  return {
    ...budget,
    items: updatedItems
  };
}

/**
 * Get budget vs actual comparison
 */
export async function getBudgetVsActual(budgetId, tenantId, asOfDate = null) {
  const budget = await calculateBudgetActuals(budgetId, tenantId, asOfDate);

  // Group by account type for summary
  const summary = {
    income: {
      budgeted: 0,
      actual: 0,
      variance: 0,
      variancePercent: 0
    },
    expense: {
      budgeted: 0,
      actual: 0,
      variance: 0,
      variancePercent: 0
    },
    total: {
      budgeted: 0,
      actual: 0,
      variance: 0,
      variancePercent: 0
    }
  };

  budget.items.forEach(item => {
    const accountType = item.account.accountType;
    const budgeted = item.budgetedAmount;
    const actual = item.actualAmount;
    const variance = item.variance || 0;

    // COA uses Income / Expense (some legacy data may use Revenue)
    if (accountType === 'Income' || accountType === 'Revenue') {
      summary.income.budgeted += budgeted;
      summary.income.actual += actual;
      summary.income.variance += variance;
    } else if (accountType === 'Expense') {
      summary.expense.budgeted += budgeted;
      summary.expense.actual += actual;
      summary.expense.variance += variance;
    }

    summary.total.budgeted += budgeted;
    summary.total.actual += actual;
    summary.total.variance += variance;
  });

  // Calculate variance percentages
  if (summary.income.budgeted > 0) {
    summary.income.variancePercent = (summary.income.variance / summary.income.budgeted) * 100;
  }
  if (summary.expense.budgeted > 0) {
    summary.expense.variancePercent = (summary.expense.variance / summary.expense.budgeted) * 100;
  }
  if (summary.total.budgeted > 0) {
    summary.total.variancePercent = (summary.total.variance / summary.total.budgeted) * 100;
  }

  return {
    budget,
    summary,
    asOfDate: asOfDate || new Date().toISOString().split('T')[0]
  };
}

/**
 * Get all budgets for tenant
 */
export async function getBudgets(tenantId, filters = {}) {
  const where = {
    tenantId,
    ...(filters.status && { status: filters.status }),
    ...(filters.periodType && { periodType: filters.periodType })
  };

  return await prisma.budget.findMany({
    where,
    include: {
      items: {
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              accountType: true
            }
          }
        }
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}










