// lib/analyticsService.js
/**
 * Advanced Analytics Service
 * Provides financial ratios, KPIs, trend analysis, and profitability metrics
 */

import prisma from './prisma';
import { getAccountBalanceDetails } from './accountBalanceService';
import {
  invoiceItemNetRevenueExTax,
  saleItemNetRevenueExTax,
} from './reportLineNetRevenue';
import { addMoney, multiplyMoney, parseMoney, subtractMoney } from './money';

/**
 * Calculate financial ratios
 */
export async function calculateFinancialRatios(tenantId, asOfDate = null) {
  const reportDate = asOfDate ? new Date(asOfDate) : new Date();
  reportDate.setHours(23, 59, 59, 999);

  // Get account balances
  const accounts = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true
    }
  });

  const balances = {};
  for (const account of accounts) {
    const details = await getAccountBalanceDetails(account.id, tenantId, reportDate, prisma);
    balances[account.id] = details.balance;
  }

  // Calculate key metrics
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let currentAssets = 0;
  let currentLiabilities = 0;
  let cash = 0;
  let accountsReceivable = 0;
  let inventory = 0;
  let accountsPayable = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;
  let netIncome = 0;

  for (const account of accounts) {
    const balance = Math.abs(balances[account.id] || 0);
    const accountType = account.accountType;
    const accountName = (account.accountName || '').toLowerCase();
    const accountCode = account.accountCode || '';

    if (accountType === 'Asset') {
      totalAssets += balance;
      if (accountCode === '1000' || accountCode === '1020' || accountName.includes('cash') || accountName.includes('bank')) {
        cash += balance;
        currentAssets += balance;
      } else if (accountName.includes('receivable')) {
        accountsReceivable += balance;
        currentAssets += balance;
      } else if (accountName.includes('inventory')) {
        inventory += balance;
        currentAssets += balance;
      }
    } else if (accountType === 'Liability') {
      totalLiabilities += balance;
      if (accountName.includes('payable')) {
        accountsPayable += balance;
        currentLiabilities += balance;
      }
    } else if (accountType === 'Equity') {
      totalEquity += balance;
    } else if (accountType === 'Revenue') {
      totalRevenue += balance;
    } else if (accountType === 'Expense') {
      totalExpenses += balance;
    }
  }

  netIncome = totalRevenue - totalExpenses;

  // Calculate ratios
  const ratios = {
    // Liquidity Ratios
    currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
    quickRatio: currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0,
    cashRatio: currentLiabilities > 0 ? cash / currentLiabilities : 0,

    // Profitability Ratios
    grossProfitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
    netProfitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    returnOnAssets: totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0,
    returnOnEquity: totalEquity > 0 ? (netIncome / totalEquity) * 100 : 0,

    // Efficiency Ratios
    accountsReceivableTurnover: accountsReceivable > 0 ? totalRevenue / accountsReceivable : 0,
    inventoryTurnover: inventory > 0 ? totalExpenses / inventory : 0,
    accountsPayableTurnover: accountsPayable > 0 ? totalExpenses / accountsPayable : 0,

    // Leverage Ratios
    debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
    debtToAssets: totalAssets > 0 ? totalLiabilities / totalAssets : 0,
    equityRatio: totalAssets > 0 ? totalEquity / totalAssets : 0,

    // Base Metrics
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentAssets,
    currentLiabilities,
    cash,
    accountsReceivable,
    inventory,
    accountsPayable,
    totalRevenue,
    totalExpenses,
    netIncome
  };

  return {
    asOfDate: reportDate.toISOString().split('T')[0],
    ratios,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Calculate trend analysis
 */
export async function calculateTrends(tenantId, startDate, endDate, metric = 'revenue') {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get monthly data points
  const trends = [];
  let current = new Date(start);

  while (current <= end) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    let value = 0;

    if (metric === 'revenue') {
      const revenueAccounts = await prisma.account.findMany({
        where: {
          tenantId,
          accountType: 'Revenue',
          isActive: true
        }
      });

      for (const account of revenueAccounts) {
        const details = await getAccountBalanceDetails(account.id, tenantId, monthEnd, prisma);
        value += Math.abs(details.balance);
      }
    } else if (metric === 'expenses') {
      const expenseAccounts = await prisma.account.findMany({
        where: {
          tenantId,
          accountType: 'Expense',
          isActive: true
        }
      });

      for (const account of expenseAccounts) {
        const details = await getAccountBalanceDetails(account.id, tenantId, monthEnd, prisma);
        value += Math.abs(details.balance);
      }
    } else if (metric === 'net_income') {
      const revenueAccounts = await prisma.account.findMany({
        where: {
          tenantId,
          accountType: 'Revenue',
          isActive: true
        }
      });

      const expenseAccounts = await prisma.account.findMany({
        where: {
          tenantId,
          accountType: 'Expense',
          isActive: true
        }
      });

      let revenue = 0;
      let expenses = 0;

      for (const account of revenueAccounts) {
        const details = await getAccountBalanceDetails(account.id, tenantId, monthEnd, prisma);
        revenue += Math.abs(details.balance);
      }

      for (const account of expenseAccounts) {
        const details = await getAccountBalanceDetails(account.id, tenantId, monthEnd, prisma);
        expenses += Math.abs(details.balance);
      }

      value = revenue - expenses;
    }

    trends.push({
      period: new Date(monthEnd),
      value
    });

    current.setMonth(current.getMonth() + 1);
  }

  // Calculate growth rates
  const growthRates = [];
  for (let i = 1; i < trends.length; i++) {
    const prevValue = trends[i - 1].value;
    const currentValue = trends[i].value;
    const growthRate = prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0;
    
    growthRates.push({
      period: trends[i].period,
      growthRate,
      value: currentValue,
      previousValue: prevValue
    });
  }

  // Calculate average growth rate
  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((sum, g) => sum + g.growthRate, 0) / growthRates.length
    : 0;

  return {
    metric,
    startDate,
    endDate,
    trends,
    growthRates,
    averageGrowthRate: avgGrowthRate,
    totalGrowth: trends.length > 1
      ? ((trends[trends.length - 1].value - trends[0].value) / trends[0].value) * 100
      : 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Calculate profitability by product
 */
export async function calculateProductProfitability(tenantId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all products with sales
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      isDeleted: false
    },
    include: {
      saleItems: {
        where: {
          sale: {
            saleDate: { gte: start, lte: end },
            status: 'completed'
          }
        },
        include: {
          sale: {
            select: {
              id: true,
              saleDate: true,
              total: true
            }
          }
        }
      },
      invoiceItems: {
        where: {
          invoice: {
            issueDate: { gte: start, lte: end },
            status: { in: ['Paid', 'Completed', 'Pending'] }
          }
        },
        include: {
          invoice: {
            select: {
              id: true,
              issueDate: true,
              total: true
            }
          }
        }
      }
    }
  });

  const profitability = products.map(product => {
    // Calculate revenue
    const saleRevenue = product.saleItems.reduce(
      (sum, item) => sum + saleItemNetRevenueExTax(item),
      0
    );

    const invoiceRevenue = product.invoiceItems.reduce(
      (sum, item) => sum + invoiceItemNetRevenueExTax(item),
      0
    );

    const totalRevenue = saleRevenue + invoiceRevenue;

    // Calculate COGS
    const saleQuantity = product.saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const invoiceQuantity = product.invoiceItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalQuantity = saleQuantity + invoiceQuantity;

    const avgCost = parseFloat(product.averageCost || product.cost || 0);
    const totalCOGS = totalQuantity * avgCost;

    // Calculate profit
    const grossProfit = totalRevenue - totalCOGS;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantitySold: totalQuantity,
      revenue: totalRevenue,
      cogs: totalCOGS,
      grossProfit,
      grossProfitMargin,
      averageCost: avgCost,
      averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0
    };
  }).filter(p => p.quantitySold > 0); // Only products with sales

  // Sort by profitability
  profitability.sort((a, b) => b.grossProfit - a.grossProfit);

  return {
    startDate,
    endDate,
    products: profitability,
    totalRevenue: profitability.reduce((sum, p) => sum + p.revenue, 0),
    totalCOGS: profitability.reduce((sum, p) => sum + p.cogs, 0),
    totalGrossProfit: profitability.reduce((sum, p) => sum + p.grossProfit, 0),
    averageProfitMargin: profitability.length > 0
      ? profitability.reduce((sum, p) => sum + p.grossProfitMargin, 0) / profitability.length
      : 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Calculate profitability by customer
 */
export async function calculateCustomerProfitability(tenantId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all customers with sales/invoices
  const customers = await prisma.client.findMany({
    where: {
      tenantId
    },
    include: {
      sales: {
        where: {
          saleDate: { gte: start, lte: end },
          status: 'completed'
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      },
      invoices: {
        where: {
          issueDate: { gte: start, lte: end },
          status: { in: ['Paid', 'Completed', 'Pending'] }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

  const profitability = customers.map(customer => {
    // Calculate revenue from sales
    const saleRevenue = customer.sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);

    // Calculate revenue from invoices
    const invoiceRevenue = customer.invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);

    const totalRevenue = addMoney(saleRevenue, invoiceRevenue);

    // Calculate COGS
    let totalCOGS = 0;

    // From sales
    for (const sale of customer.sales) {
      for (const item of sale.items) {
        if (item.product && !item.product.isService) {
          const cost = parseMoney(item.product.averageCost || item.product.cost || 0);
          totalCOGS = addMoney(totalCOGS, multiplyMoney(cost, item.quantity));
        }
      }
    }

    // From invoices
    for (const invoice of customer.invoices) {
      for (const item of invoice.items) {
        if (item.product && !item.product.isService) {
          const cost = parseMoney(item.product.averageCost || item.product.cost || 0);
          totalCOGS = addMoney(totalCOGS, multiplyMoney(cost, item.quantity));
        }
      }
    }

    const grossProfit = subtractMoney(totalRevenue, totalCOGS);
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      customerId: customer.id,
      customerName: customer.name,
      revenue: totalRevenue,
      cogs: totalCOGS,
      grossProfit,
      grossProfitMargin,
      transactionCount: customer.sales.length + customer.invoices.length
    };
  }).filter(c => c.revenue > 0); // Only customers with transactions

  // Sort by profitability
  profitability.sort((a, b) => b.grossProfit - a.grossProfit);

  return {
    startDate,
    endDate,
    customers: profitability,
    totalRevenue: profitability.reduce((sum, c) => addMoney(sum, c.revenue), 0),
    totalCOGS: profitability.reduce((sum, c) => addMoney(sum, c.cogs), 0),
    totalGrossProfit: profitability.reduce((sum, c) => addMoney(sum, c.grossProfit), 0),
    averageProfitMargin: profitability.length > 0
      ? profitability.reduce((sum, c) => sum + c.grossProfitMargin, 0) / profitability.length
      : 0,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Get key performance indicators (KPIs)
 */
export async function getKPIs(tenantId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get revenue
  const revenueAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Revenue',
      isActive: true
    }
  });

  let totalRevenue = 0;
  for (const account of revenueAccounts) {
    const endBalance = await getAccountBalanceDetails(account.id, tenantId, end, prisma);
    const startBalance = await getAccountBalanceDetails(account.id, tenantId, start, prisma);
    totalRevenue += Math.abs(endBalance.balance - startBalance.balance);
  }

  // Get expenses
  const expenseAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      isActive: true
    }
  });

  let totalExpenses = 0;
  for (const account of expenseAccounts) {
    const endBalance = await getAccountBalanceDetails(account.id, tenantId, end, prisma);
    const startBalance = await getAccountBalanceDetails(account.id, tenantId, start, prisma);
    totalExpenses += Math.abs(endBalance.balance - startBalance.balance);
  }

  const netIncome = totalRevenue - totalExpenses;

  // Get sales count
  const salesCount = await prisma.sale.count({
    where: {
      tenantId,
      saleDate: { gte: start, lte: end },
      status: 'completed'
    }
  });

  // Get invoice count
  const invoiceCount = await prisma.invoice.count({
    where: {
      tenantId,
      issueDate: { gte: start, lte: end },
      status: { in: ['Paid', 'Completed', 'Pending'] }
    }
  });

  // Get average transaction value
  const avgSaleValue = salesCount > 0
    ? await prisma.sale.aggregate({
        where: {
          tenantId,
          saleDate: { gte: start, lte: end },
          status: 'completed'
        },
        _avg: { total: true }
      })
    : { _avg: { total: 0 } };

  const avgInvoiceValue = invoiceCount > 0
    ? await prisma.invoice.aggregate({
        where: {
          tenantId,
          issueDate: { gte: start, lte: end },
          status: { in: ['Paid', 'Completed', 'Pending'] }
        },
        _avg: { total: true }
      })
    : { _avg: { total: 0 } };

  return {
    period: {
      startDate,
      endDate
    },
    revenue: {
      total: totalRevenue,
      growth: 0 // Would need previous period comparison
    },
    expenses: {
      total: totalExpenses,
      growth: 0
    },
    netIncome: {
      total: netIncome,
      margin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0
    },
    transactions: {
      salesCount,
      invoiceCount,
      totalCount: salesCount + invoiceCount,
      averageSaleValue: avgSaleValue._avg.total || 0,
      averageInvoiceValue: avgInvoiceValue._avg.total || 0
    },
    generatedAt: new Date().toISOString()
  };
}










