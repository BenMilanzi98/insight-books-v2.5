// lib/budgetService.js
/**
 * Revenue Budget Service
 * Manages revenue budget creation, updates, comparisons, and reporting
 * Supports Monthly, Quarterly, and Yearly budget periods
 */

import prisma from './prisma';

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

  if (budgetType === 'revenue' && budgetData.breakdowns && Array.isArray(budgetData.breakdowns)) {
    const breakdownTotal = budgetData.breakdowns.reduce(
      (sum, item) => sum + (item.budgetedAmount || 0), 
      0
    );
    
    const tolerance = 0.01; // Allow for floating point precision
    if (Math.abs(breakdownTotal - budgetData.expectedRevenue) > tolerance) {
      errors.push(
        `Breakdown total (${breakdownTotal.toFixed(2)}) must match expected revenue (${budgetData.expectedRevenue.toFixed(2)})`
      );
    }
  }

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
 * Get actual revenue from sales data for a given period
 */
export async function getActualRevenue(tenantId, startDate, endDate, filters = {}) {
  const { branchId, categoryId } = filters;

  const where = {
    tenantId,
    saleDate: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    },
    status: { in: ['completed', 'finalized'] } // Only completed sales
  };

  if (branchId) {
    where.branchId = branchId;
  }

  // Get sales aggregation
  const salesAggregation = await prisma.sale.aggregate({
    where,
    _sum: {
      total: true
    },
    _count: true
  });

  // If category filter is provided, we need to aggregate by sale items
  let categoryBreakdown = null;
  if (categoryId) {
    const itemsWithCategory = await prisma.saleItem.findMany({
      where: {
        sale: where,
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

  return {
    totalRevenue: salesAggregation._sum.total || 0,
    transactionCount: salesAggregation._count,
    breakdown: categoryBreakdown
  };
}

/**
 * Get actual expenses for a given period
 */
export async function getActualExpenses(tenantId, startDate, endDate, filters = {}) {
  const { accountIds } = filters;

  const where = {
    tenantId,
    isDeleted: false,
    date: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    },
    ...(accountIds && accountIds.length > 0 && {
      expenseAccountId: { in: accountIds }
    })
  };

  const expenseAggregation = await prisma.expense.aggregate({
    where,
    _sum: { amount: true },
    _count: true
  });

  return {
    totalExpenses: expenseAggregation._sum.amount || 0,
    transactionCount: expenseAggregation._count
  };
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
      { accountIds }
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

  // Determine status
  let status;
  const tolerance = 0.05; // 5% tolerance for "on target"
  const varianceRatio = variance / budgetedAmount;

  if (varianceRatio >= tolerance) {
    status = 'over'; // Over target
  } else if (varianceRatio <= -tolerance) {
    status = 'under'; // Under target
  } else {
    status = 'on_target';
  }

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
  const accounts = await prisma.account.findMany({
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

  return accounts.map(account => ({
    id: account.id,
    name: account.accountName,
    code: account.accountCode,
    type: account.accountType
  }));
}

/**
 * Validate budget breakdown totals match expected revenue
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
  validateBreakdownTotals,
  isBudgetLocked,
  validateBudgetData
};
