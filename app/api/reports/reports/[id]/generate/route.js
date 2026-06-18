// app/api/reports/reports/[id]/generate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateDateRange } from '@/lib/dateUtils';
import { RETIRED_REPORT_IDS, retiredReportResponse } from '@/lib/retiredReports';
import { addMoney, multiplyMoney, parseMoney, subtractMoney } from '@/lib/money';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

// POST - Generate a specific report
export async function POST(request, context) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const { user, tw, tenantIds, scope, primaryTenantId } = boot;
    const params = await context.params;
    const reportId = params?.id;

    if (reportId && RETIRED_REPORT_IDS.has(reportId)) {
      return retiredReportResponse(reportId);
    }
    
    // Parse the request body
    const body = await request.json();
    const { timeframe = 'thisMonth', format = 'json', detailed = false } = body;
    
    // Calculate date range based on timeframe
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // Create an audit log entry for this report generation
    await prisma.auditLog.create({
      data: {
        action: 'REPORT_GENERATED',
        entityType: 'REPORT',
        entityId: reportId,
        userId: user.id,
        tenantId: primaryTenantId,
        details: JSON.stringify({
          reportId,
          timeframe,
          format,
          detailed,
          tenantIds,
        })
      }
    });

    await auditReportAccess({
      user,
      reportType: reportId,
      tenantIds,
      scope,
      filters: { timeframe, detailed },
    });
    
    // Generate different reports based on the reportId
    switch (reportId) {
      case 'profit-loss':
        return generateProfitLossReport(tw, startDate, endDate, detailed, scope);
        
      case 'balance-sheet':
        return generateBalanceSheetReport(tw, detailed, scope);
        
      case 'cash-flow':
        return generateCashFlowReport(tw, startDate, endDate, detailed, scope);
        
      case 'tax-summary':
        return generateTaxSummaryReport(tw, startDate, endDate, scope);
        
      case 'accounts-receivable':
        return generateAccountsReceivableReport(tw, scope);
        
      case 'accounts-payable':
        return generateAccountsPayableReport(tw, scope);
        
      case 'expense-report':
        return generateExpenseReport(tw, startDate, endDate, detailed, scope);
        
      case 'sales-report':
        return generateSalesReport(tw, startDate, endDate, detailed, scope);
        
      case 'financial-ratios':
        return generateFinancialRatiosReport(tw, timeframe, scope);
        
      default:
        return NextResponse.json(
          { error: 'Report type not supported' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to generate the Profit & Loss report
async function generateProfitLossReport(tw, startDate, endDate, detailed, scope) {
  // Get revenue data (invoices)
  const invoices = await prisma.invoice.findMany({
    where: {
      ...tw,
      issueDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: true
    }
  });
  
  // Get expense data (includes supplier/PO-approved expenses)
  const expenses = await prisma.expense.findMany({
    where: {
      ...tw,
      date: {
        gte: startDate,
        lte: endDate
      },
      status: 'Approved',
      isDeleted: false
    }
  });
  
  // Group expenses by category
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    expensesByCategory[expense.category] = addMoney(expensesByCategory[expense.category], expense.amount);
  });
  
  // Calculate revenue breakdown by type if detailed
  let revenueBreakdown = null;
  if (detailed) {
    // Group items by description or product
    const itemsByType = {};
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const itemType = item.productId || item.description;
        if (!itemsByType[itemType]) {
          itemsByType[itemType] = 0;
        }
        itemsByType[itemType] = addMoney(itemsByType[itemType], multiplyMoney(item.quantity, item.unitPrice));
      });
    });
    
    revenueBreakdown = Object.entries(itemsByType).map(([type, amount]) => ({
      type,
      amount
    }));
  }
  
  // Calculate totals
  const totalRevenue = invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);
  const costOfGoodsSold = multiplyMoney(totalRevenue, 0.4); // Simplified COGS calculation
  const grossProfit = subtractMoney(totalRevenue, costOfGoodsSold);
  const operatingExpenses = expenses.reduce((sum, expense) => addMoney(sum, expense.amount), 0);
  const netProfit = subtractMoney(grossProfit, operatingExpenses);
  
  // Return formatted report
  return NextResponse.json({
    title: "Profit & Loss Statement",
    scope,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      totalRevenue,
      costOfGoodsSold,
      grossProfit,
      operatingExpenses,
      netProfit
    },
    details: detailed ? {
      revenueBreakdown,
      expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
        category,
        amount
      }))
    } : null
  });
}

// Helper function to generate the Balance Sheet report
async function generateBalanceSheetReport(tw, detailed, scope) {
  // For balance sheet, we use the current point in time
  
  // Get unpaid invoices for accounts receivable
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      ...tw,
      status: { in: ['Pending', 'Partial'] }
    },
    include: {
      payments: true
    }
  });
  
  // Calculate accounts receivable
  const accountsReceivable = unpaidInvoices.reduce((total, invoice) => {
    const paidAmount = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
    return addMoney(total, subtractMoney(invoice.total, paidAmount));
  }, 0);
  
  // Get inventory value
  const products = await prisma.product.findMany({
    where: {
      ...tw,
      isService: false
    }
  });
  
  const inventoryValue = products.reduce((total, product) => {
    if (product.stockLevel && product.cost) {
      return addMoney(total, multiplyMoney(product.cost, product.stockLevel));
    }
    return total;
  }, 0);
  
  // In a real implementation, you would get these values from the accounting system
  // For this example, we'll use simplified calculations
  
  const cashAndEquivalents = 5000000;
  const prepaidExpenses = 420000;
  
  const currentAssets = cashAndEquivalents + accountsReceivable + inventoryValue + prepaidExpenses;
  
  const propertyAndEquipment = 5200000;
  const accumulatedDepreciation = 1350000;
  const investments = 750000;
  const fixedAssets = propertyAndEquipment - accumulatedDepreciation + investments;
  
  const totalAssets = currentAssets + fixedAssets;
  
  // Liabilities
  const accountsPayable = 1230000;
  const taxPayable = 785000;
  const shortTermLoans = 520000;
  const currentLiabilities = accountsPayable + taxPayable + shortTermLoans;
  
  const longTermLoans = 1785000;
  const longTermLiabilities = longTermLoans;
  
  const totalLiabilities = currentLiabilities + longTermLiabilities;
  
  // Equity
  const capitalStock = 5000000;
  const retainedEarnings = totalAssets - totalLiabilities - capitalStock;
  const totalEquity = capitalStock + retainedEarnings;
  
  // Return formatted report
  return NextResponse.json({
    title: "Balance Sheet",
    scope,
    reportDate: new Date().toISOString(),
    summary: {
      totalAssets,
      totalLiabilities,
      totalEquity
    },
    assets: {
      current: {
        cashAndEquivalents,
        accountsReceivable,
        inventory: inventoryValue,
        prepaidExpenses,
        total: currentAssets
      },
      fixed: {
        propertyAndEquipment,
        accumulatedDepreciation,
        investments,
        total: fixedAssets
      },
      total: totalAssets
    },
    liabilities: {
      current: {
        accountsPayable,
        taxPayable,
        shortTermLoans,
        total: currentLiabilities
      },
      longTerm: {
        longTermLoans,
        total: longTermLiabilities
      },
      total: totalLiabilities
    },
    equity: {
      capitalStock,
      retainedEarnings,
      total: totalEquity
    },
    details: detailed ? {
      accountsReceivableBreakdown: unpaidInvoices.map(invoice => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        amount: subtractMoney(invoice.total, invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0)),
        dueDate: invoice.dueDate
      })),
      inventoryBreakdown: products.map(product => ({
        productId: product.id,
        name: product.name,
        stockLevel: product.stockLevel || 0,
        unitCost: product.cost || 0,
        totalValue: multiplyMoney(product.cost || 0, product.stockLevel || 0)
      }))
    } : null
  });
}

// Helper function to generate reports for other types
// This is a simplified implementation
async function generateCashFlowReport(tw, startDate, endDate, detailed, scope) {
  // A simple implementation that returns a placeholder
  return NextResponse.json({
    title: "Cash Flow Statement",
    scope,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      operatingActivities: 1250000,
      investingActivities: -350000,
      financingActivities: -200000,
      netCashFlow: 700000,
      beginningCashBalance: 3150000,
      endingCashBalance: 3850000
    }
  });
}

async function generateTaxSummaryReport(tw, startDate, endDate, scope) {
  // Calculate and return tax summary
  return NextResponse.json({
    title: "Tax Summary",
    scope,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      salesTax: 540000,
      incomeTax: 395000,
      payrollTax: 245000,
      totalTaxLiability: 1180000
    },
    filingDeadlines: {
      salesTax: new Date(new Date().setDate(15)).toISOString(), // 15th of current month
      incomeTax: new Date(new Date().setMonth(5, 30)).toISOString(), // June 30
      payrollTax: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString() // 15 days from now
    }
  });
}

async function generateAccountsReceivableReport(tw, scope) {
  // Get unpaid invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      ...tw,
      status: { in: ['Pending', 'Partial'] }
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      payments: true
    }
  });
  
  // Group by aging buckets
  const current = [];
  const oneToThirty = [];
  const thirtyOneToSixty = [];
  const sixtyOneToNinety = [];
  const ninetyPlus = [];
  
  const today = new Date();
  
  unpaidInvoices.forEach(invoice => {
    const dueDate = new Date(invoice.dueDate);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    
    const remainingAmount = subtractMoney(invoice.total, invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0));
    
    const item = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      client: invoice.client,
      amount: remainingAmount,
      dueDate: invoice.dueDate,
      daysPastDue: Math.max(0, daysPastDue)
    };
    
    if (daysPastDue <= 0) {
      current.push(item);
    } else if (daysPastDue <= 30) {
      oneToThirty.push(item);
    } else if (daysPastDue <= 60) {
      thirtyOneToSixty.push(item);
    } else if (daysPastDue <= 90) {
      sixtyOneToNinety.push(item);
    } else {
      ninetyPlus.push(item);
    }
  });
  
  // Return the report
  return NextResponse.json({
    title: "Accounts Receivable Aging",
    scope,
    reportDate: today.toISOString(),
    summary: {
      totalReceivables: unpaidInvoices.reduce((total, invoice) => {
        return addMoney(total, subtractMoney(invoice.total, invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0)));
      }, 0),
      currentReceivables: current.reduce((sum, item) => addMoney(sum, item.amount), 0),
      pastDueReceivables: addMoney(
        addMoney(oneToThirty.reduce((sum, item) => addMoney(sum, item.amount), 0), thirtyOneToSixty.reduce((sum, item) => addMoney(sum, item.amount), 0)),
        addMoney(sixtyOneToNinety.reduce((sum, item) => addMoney(sum, item.amount), 0), ninetyPlus.reduce((sum, item) => addMoney(sum, item.amount), 0))
      )
    },
    aging: {
      current,
      oneToThirty,
      thirtyOneToSixty,
      sixtyOneToNinety,
      ninetyPlus
    }
  });
}

// Implement other report generation functions similarly
async function generateAccountsPayableReport(tw, scope) {
  // Return a placeholder
  return NextResponse.json({
    title: "Accounts Payable Aging",
    scope,
    reportDate: new Date().toISOString(),
    summary: {
      totalPayables: 1230000,
      currentPayables: 850000,
      pastDuePayables: 380000
    }
  });
}

async function generateExpenseReport(tw, startDate, endDate, detailed, scope) {
  // Get expenses in date range
  const expenses = await prisma.expense.findMany({
    where: {
      ...tw,
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });
  
  // Group expenses by category
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    expensesByCategory[expense.category] = addMoney(expensesByCategory[expense.category], expense.amount);
  });
  
  return NextResponse.json({
    title: "Expense Report",
    scope,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      totalExpenses: expenses.reduce((sum, expense) => addMoney(sum, expense.amount), 0),
      byCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
        category,
        amount
      }))
    },
    details: detailed ? expenses.map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      category: expense.category,
      merchant: expense.merchant
    })) : null
  });
}

async function generateSalesReport(tw, startDate, endDate, detailed, scope) {
  // Get sales data
  const sales = await prisma.sale.findMany({
    where: {
      ...tw,
      saleDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: {
        include: {
          product: true
        }
      },
      client: true
    }
  });
  
  // Get invoices as well
  const invoices = await prisma.invoice.findMany({
    where: {
      ...tw,
      issueDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: true,
      client: true
    }
  });
  
  // Combine sales and invoices for total revenue
  const totalRevenue = 
    addMoney(
      sales.reduce((sum, sale) => addMoney(sum, sale.total), 0),
      invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0)
    );
  
  // Group sales by product
  const salesByProduct = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const productId = item.productId;
      if (!salesByProduct[productId]) {
        salesByProduct[productId] = {
          productId,
          productName: item.product.name,
          quantity: 0,
          amount: 0
        };
      }
      salesByProduct[productId].quantity += item.quantity;
      salesByProduct[productId].amount = addMoney(salesByProduct[productId].amount, item.amount);
    });
  });
  
  // Group by client
  const salesByClient = {};
  [...sales, ...invoices].forEach(transaction => {
    if (!transaction.client) return;
    
    const clientId = transaction.client.id;
    if (!salesByClient[clientId]) {
      salesByClient[clientId] = {
        clientId,
        clientName: transaction.client.name,
        amount: 0
      };
    }
    salesByClient[clientId].amount = addMoney(salesByClient[clientId].amount, transaction.total);
  });
  
  return NextResponse.json({
    title: "Sales Report",
    scope,
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      totalRevenue,
      totalSales: sales.length,
      totalInvoices: invoices.length,
      averageTransactionValue: (parseMoney(totalRevenue) / (sales.length + invoices.length)) || 0
    },
    breakdown: {
      byProduct: Object.values(salesByProduct),
      byClient: Object.values(salesByClient)
    },
    details: detailed ? {
      sales: sales.map(sale => ({
        id: sale.id,
        number: sale.saleNumber,
        date: sale.saleDate,
        client: sale.client ? {
          id: sale.client.id,
          name: sale.client.name
        } : null,
        amount: sale.total,
        items: sale.items.map(item => ({
          product: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount
        }))
      })),
      invoices: invoices.map(invoice => ({
        id: invoice.id,
        number: invoice.invoiceNumber,
        date: invoice.issueDate,
        client: invoice.client ? {
          id: invoice.client.id,
          name: invoice.client.name
        } : null,
        amount: invoice.total,
        status: invoice.status
      }))
    } : null
  });
}

async function generateFinancialRatiosReport(tw, timeframe, scope) {
  // Get financial data from summarized reports
  
  // In a real implementation, you would get these values from the accounting system
  // For this example, we'll use placeholder values
  
  const currentAssets = 7850000;
  const currentLiabilities = 2535000;
  const totalAssets = 12450000;
  const totalLiabilities = 4320000;
  const totalEquity = 8130000;
  const totalRevenue = 5620000;
  const netProfit = 1775000;
  
  return NextResponse.json({
    title: "Financial Ratios",
    scope,
    reportDate: new Date().toISOString(),
    liquidityRatios: {
      currentRatio: currentAssets / currentLiabilities,
      quickRatio: (currentAssets - 1230000) / currentLiabilities // Subtracting inventory
    },
    solvencyRatios: {
      debtToEquity: totalLiabilities / totalEquity,
      debtToAssets: totalLiabilities / totalAssets
    },
    profitabilityRatios: {
      profitMargin: netProfit / totalRevenue,
      returnOnAssets: netProfit / totalAssets,
      returnOnEquity: netProfit / totalEquity
    },
    efficiencyRatios: {
      assetTurnover: totalRevenue / totalAssets,
      inventoryTurnover: 4.5 // Placeholder value
    }
  });
}