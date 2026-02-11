// lib/incomeStatementService.js
/**
 * Income Statement Service
 * Generates income statement from Transaction/TransactionLine data using Phase 1 accounting foundation
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';

/**
 * Generate income statement from account balances
 */
export async function generateIncomeStatementFromAccounts(
  tenantId, 
  startDate, 
  endDate, 
  companyName = 'Company', 
  logoUrl = null,
  branchId = null
) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all revenue and expense accounts
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
      accountName: true,
      accountSubtype: true
    }
  });

  const expenseAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      isActive: true
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountSubtype: true
    }
  });

  // Calculate revenue balances for the period
  const revenue = {
    salesRevenue: 0,
    serviceRevenue: 0,
    otherIncome: 0,
    details: [],
    // Dynamic line items for UI rendering
    lineItems: []
  };

  for (const account of revenueAccounts) {
    // Get balance as of end date
    const endBalance = await getAccountBalanceDetails(account.id, tenantId, end, prisma, branchId);
    
    // Get balance as of start date (day before)
    const startDateMinusOne = new Date(start);
    startDateMinusOne.setDate(startDateMinusOne.getDate() - 1);
    const startBalance = await getAccountBalanceDetails(account.id, tenantId, startDateMinusOne, prisma, branchId);
    
    // Period revenue = end balance - start balance
    const periodRevenue = endBalance.balance - startBalance.balance;
    
    if (periodRevenue > 0) {
      const subtype = (account.accountSubtype || '').toLowerCase();
      const accountName = (account.accountName || '').toLowerCase();
      
      if (subtype.includes('sales') || accountName.includes('sales') || 
          accountName.includes('product') || accountName.includes('goods')) {
        revenue.salesRevenue += periodRevenue;
      } else if (subtype.includes('service') || accountName.includes('service')) {
        revenue.serviceRevenue += periodRevenue;
      } else {
        revenue.otherIncome += periodRevenue;
      }
      
      revenue.details.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: periodRevenue
      });
    }
  }

  const totalRevenue = revenue.salesRevenue + revenue.serviceRevenue + revenue.otherIncome;

  // Build dynamic revenue line items (per revenue account)
  revenue.lineItems = revenue.details
    .filter(d => d.amount && d.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
    .map(d => ({
      key: `rev-${d.accountCode || d.accountName}`,
      label: d.accountName || 'Revenue',
      amount: d.amount,
      details: [d]
    }));

  // Calculate COGS from expense accounts
  const cogs = {
    costOfProductsSold: 0,
    freightShippingCosts: 0,
    details: [],
    // Dynamic line items for UI rendering
    lineItems: []
  };

  // Find COGS account
  const cogsAccount = expenseAccounts.find(acc => {
    const name = (acc.accountName || '').toLowerCase();
    const subtype = (acc.accountSubtype || '').toLowerCase();
    return name.includes('cost of goods') || name.includes('cogs') || 
           subtype.includes('cogs') || subtype.includes('cost of goods');
  });

  if (cogsAccount) {
    const endBalance = await getAccountBalanceDetails(cogsAccount.id, tenantId, end, prisma, branchId);
    const startDateMinusOne = new Date(start);
    startDateMinusOne.setDate(startDateMinusOne.getDate() - 1);
    const startBalance = await getAccountBalanceDetails(cogsAccount.id, tenantId, startDateMinusOne, prisma, branchId);
    
    const periodCOGS = endBalance.balance - startBalance.balance;
    if (periodCOGS > 0) {
      cogs.costOfProductsSold = periodCOGS;
      cogs.details.push({
        accountCode: cogsAccount.accountCode,
        accountName: cogsAccount.accountName,
        amount: periodCOGS
      });
    }
  }

  // Build dynamic COGS line items
  cogs.lineItems = cogs.details
    .filter(d => d.amount && d.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
    .map(d => ({
      key: `cogs-${d.accountCode || d.accountName}`,
      label: d.accountName || 'Cost of Goods Sold',
      amount: d.amount,
      details: [d]
    }));

  const grossProfit = totalRevenue - cogs.costOfProductsSold;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ========== OPERATING EXPENSES SECTION - DYNAMIC CATEGORIES ==========
  // Get all expenses from Expense table and group by actual category names
  let expenses = [];
  try {
    expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        date: { gte: start, lte: end },
        isDeleted: false,
        ...(branchId ? { branchId } : {})
      },
      include: {
        submittedBy: {
          select: {
            name: true
          }
        },
        expenseAccount: {
          select: {
            id: true,
            accountName: true,
            accountCode: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });
  } catch (expenseQueryError) {
    console.error('Error fetching expenses for income statement:', expenseQueryError);
    console.error('Expense query error details:', {
      message: expenseQueryError.message,
      code: expenseQueryError.code,
      meta: expenseQueryError.meta
    });
    // Continue with empty expenses array to allow report to generate
    expenses = [];
  }

  // Group expenses by their actual category names dynamically
  const expensesByCategory = {};
  const expenseDetails = [];

  expenses.forEach(expense => {
    const account = expense.expenseAccount;
    if (!account) {
      throw new Error('Expense record missing expenseAccountId; reporting is blocked.');
    }
    const accountLabel = account.accountCode ? `${account.accountCode} - ${account.accountName}` : account.accountName;
    const amount = expense.amount || 0;

    if (!expensesByCategory[accountLabel]) {
      expensesByCategory[accountLabel] = {
        amount: 0,
        details: []
      };
    }

    expensesByCategory[accountLabel].amount += amount;
    expensesByCategory[accountLabel].details.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      accountId: account?.id,
      accountName: account?.accountName,
      accountCode: account?.accountCode,
      amount: amount,
      submittedBy: expense.submittedBy?.name || 'N/A',
      paymentMethod: expense.paymentMethod,
      reference: expense.paymentReference || expense.id
    });

    expenseDetails.push({
      id: expense.id,
      date: expense.date,
      description: expense.description,
      accountId: account?.id,
      accountName: account?.accountName,
      accountCode: account?.accountCode,
      amount: amount,
      submittedBy: expense.submittedBy?.name || 'N/A'
    });
  });

  // Get depreciation from assets
  const depreciationSchedules = await prisma.depreciationSchedule.findMany({
    where: {
      asset: {
        tenantId
      },
      periodStart: { lte: end },
      periodEnd: { gte: start }
    },
    include: {
      asset: true
    }
  });

  depreciationSchedules.forEach(schedule => {
    const scheduleStart = new Date(schedule.periodStart);
    const scheduleEnd = new Date(schedule.periodEnd);
    const reportStart = new Date(start);
    const reportEnd = new Date(end);
    
    // Calculate prorated depreciation for the period
    const overlapStart = scheduleStart > reportStart ? scheduleStart : reportStart;
    const overlapEnd = scheduleEnd < reportEnd ? scheduleEnd : reportEnd;
    
    if (overlapStart <= overlapEnd) {
      const daysInPeriod = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
      const daysInSchedule = Math.ceil((scheduleEnd - scheduleStart) / (1000 * 60 * 60 * 24)) + 1;
      const proratedDepreciation = (schedule.depreciationAmount / daysInSchedule) * daysInPeriod;
      
      const depCategory = 'Depreciation';
      if (!expensesByCategory[depCategory]) {
        expensesByCategory[depCategory] = {
          amount: 0,
          details: []
        };
      }
      
      expensesByCategory[depCategory].amount += proratedDepreciation;
      expensesByCategory[depCategory].details.push({
        id: `depreciation-${schedule.id}`,
        date: schedule.periodStart,
        description: `Depreciation - ${schedule.asset.name}`,
        category: depCategory,
        amount: proratedDepreciation,
        submittedBy: 'System',
        reference: `DEP-${schedule.id}`
      });
      
      expenseDetails.push({
        id: `depreciation-${schedule.id}`,
        date: schedule.periodStart,
        description: `Depreciation - ${schedule.asset.name}`,
        category: depCategory,
        amount: proratedDepreciation,
        submittedBy: 'System'
      });
    }
  });

  // Convert to array format sorted by amount (descending) for better presentation
  const operatingExpensesCategories = Object.entries(expensesByCategory)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      details: data.details
    }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate total operating expenses
  const totalOperatingExpenses = operatingExpensesCategories.reduce(
    (sum, cat) => sum + cat.amount,
    0
  );

  // Create operatingExpenses object with dynamic categories
  const operatingExpenses = {
    categories: operatingExpensesCategories,
    total: totalOperatingExpenses,
    details: expenseDetails
  };

  const operatingIncome = grossProfit - totalOperatingExpenses;
  const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0;

  // Calculate other income/expenses (non-operating)
  const otherIncomeExpenses = {
    interestIncome: 0,
    interestExpense: 0,
    otherIncome: 0,
    otherExpenses: 0,
    total: 0
  };

  // Note: Other income/expenses would come from specific accounts
  // For now, we'll calculate net other income/expenses
  otherIncomeExpenses.total = otherIncomeExpenses.interestIncome + 
                              otherIncomeExpenses.otherIncome - 
                              otherIncomeExpenses.interestExpense - 
                              otherIncomeExpenses.otherExpenses;

  const incomeBeforeTax = operatingIncome + otherIncomeExpenses.total;

  // Calculate tax (if tax accounts exist)
  let taxExpense = 0;
  const taxAccount = expenseAccounts.find(acc => {
    const name = (acc.accountName || '').toLowerCase();
    return name.includes('tax') || name.includes('income tax');
  });

  if (taxAccount) {
    const endBalance = await getAccountBalanceDetails(taxAccount.id, tenantId, end, prisma, branchId);
    const startDateMinusOne = new Date(start);
    startDateMinusOne.setDate(startDateMinusOne.getDate() - 1);
    const startBalance = await getAccountBalanceDetails(taxAccount.id, tenantId, startDateMinusOne, prisma, branchId);
    taxExpense = endBalance.balance - startBalance.balance;
  }

  const netIncome = incomeBeforeTax - taxExpense;
  const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  return {
    companyName,
    logoUrl,
    period: {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    },
    revenue,
    totalRevenue,
    cogs,
    grossProfit,
    grossProfitMargin,
    operatingExpenses,
    totalOperatingExpenses,
    operatingIncome,
    operatingMargin,
    otherIncomeExpenses,
    incomeBeforeTax,
    taxExpense,
    netIncome,
    netProfitMargin,
    metadata: {
      revenueAccounts: revenueAccounts.length,
      expenseAccounts: expenseAccounts.length,
      expenseCategories: operatingExpensesCategories.length,
      generatedAt: new Date().toISOString()
    }
  };
}










