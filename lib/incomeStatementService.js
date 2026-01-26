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
      accountType: 'Revenue',
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
    details: []
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

  // Calculate COGS from expense accounts
  const cogs = {
    costOfProductsSold: 0,
    freightShippingCosts: 0,
    details: []
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

  const grossProfit = totalRevenue - cogs.costOfProductsSold;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Calculate operating expenses
  const operatingExpenses = {
    salaries: 0,
    rent: 0,
    utilities: 0,
    marketing: 0,
    depreciation: 0,
    otherOperatingExpenses: 0,
    details: []
  };

  for (const account of expenseAccounts) {
    // Skip COGS account (already counted)
    if (cogsAccount && account.id === cogsAccount.id) {
      continue;
    }

    const endBalance = await getAccountBalanceDetails(account.id, tenantId, end, prisma, branchId);
    const startDateMinusOne = new Date(start);
    startDateMinusOne.setDate(startDateMinusOne.getDate() - 1);
    const startBalance = await getAccountBalanceDetails(account.id, tenantId, startDateMinusOne, prisma, branchId);
    
    const periodExpense = endBalance.balance - startBalance.balance;
    
    if (periodExpense > 0) {
      const subtype = (account.accountSubtype || '').toLowerCase();
      const accountName = (account.accountName || '').toLowerCase();
      
      if (subtype.includes('salary') || accountName.includes('salary') || 
          accountName.includes('wage') || accountName.includes('payroll')) {
        operatingExpenses.salaries += periodExpense;
      } else if (subtype.includes('rent') || accountName.includes('rent')) {
        operatingExpenses.rent += periodExpense;
      } else if (subtype.includes('utility') || accountName.includes('utility') || 
                 accountName.includes('electric') || accountName.includes('water')) {
        operatingExpenses.utilities += periodExpense;
      } else if (subtype.includes('marketing') || accountName.includes('marketing') || 
                 accountName.includes('advertising') || accountName.includes('promotion')) {
        operatingExpenses.marketing += periodExpense;
      } else if (subtype.includes('depreciation') || accountName.includes('depreciation')) {
        operatingExpenses.depreciation += periodExpense;
      } else {
        operatingExpenses.otherOperatingExpenses += periodExpense;
      }
      
      operatingExpenses.details.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount: periodExpense
      });
    }
  }

  const totalOperatingExpenses = 
    operatingExpenses.salaries +
    operatingExpenses.rent +
    operatingExpenses.utilities +
    operatingExpenses.marketing +
    operatingExpenses.depreciation +
    operatingExpenses.otherOperatingExpenses;

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
      generatedAt: new Date().toISOString()
    }
  };
}










