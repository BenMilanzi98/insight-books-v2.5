// app/api/financial/reports/[id]/generate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';

// POST - Generate a specific report
export async function POST(request, { params }) {
  try {
    const reportId = params.id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
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
        tenantId: user.tenantId,
        details: JSON.stringify({
          reportId,
          timeframe,
          format,
          detailed
        })
      }
    });
    
    // Generate different reports based on the reportId
    switch (reportId) {
      case 'profit-loss':
        return generateProfitLossReport(user.tenantId, startDate, endDate, detailed);
        
      case 'balance-sheet':
        return generateBalanceSheetReport(user.tenantId, detailed);
        
      case 'cash-flow':
        return generateCashFlowReport(user.tenantId, startDate, endDate, detailed);
        
      case 'tax-summary':
        return generateTaxSummaryReport(user.tenantId, startDate, endDate);
        
      case 'accounts-receivable':
        return generateAccountsReceivableReport(user.tenantId);
        
      case 'accounts-payable':
        return generateAccountsPayableReport(user.tenantId);
        
      case 'expense-report':
        return generateExpenseReport(user.tenantId, startDate, endDate, detailed);
        
      case 'sales-report':
        return generateSalesReport(user.tenantId, startDate, endDate, detailed);
        
      case 'inventory-valuation':
        return generateInventoryValuationReport(user.tenantId);
        
      case 'financial-ratios':
        return generateFinancialRatiosReport(user.tenantId, timeframe);
        
      default:
        return NextResponse.json(
          { error: 'Report type not supported' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error generating report ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to generate report. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to generate the Profit & Loss report
async function generateProfitLossReport(tenantId, startDate, endDate, detailed) {
  // Get revenue data (invoices)
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: true
    }
  });
  
  // Get expense data
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate
      },
      status: 'Approved'
    }
  });
  
  // Group expenses by category
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    expensesByCategory[expense.category] += expense.amount;
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
        itemsByType[itemType] += item.quantity * item.unitPrice;
      });
    });
    
    revenueBreakdown = Object.entries(itemsByType).map(([type, amount]) => ({
      type,
      amount
    }));
  }
  
  // Calculate totals
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const costOfGoodsSold = totalRevenue * 0.4; // Simplified COGS calculation
  const grossProfit = totalRevenue - costOfGoodsSold;
  const operatingExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = grossProfit - operatingExpenses;
  
  // Return formatted report
  return NextResponse.json({
    title: "Profit & Loss Statement",
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
async function generateBalanceSheetReport(tenantId, detailed) {
  // For balance sheet, we use the current point in time
  
  // Get unpaid invoices for accounts receivable
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: { in: ['Pending', 'Partial'] }
    },
    include: {
      payments: true
    }
  });
  
  // Calculate accounts receivable
  const accountsReceivable = unpaidInvoices.reduce((total, invoice) => {
    const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total + (invoice.total - paidAmount);
  }, 0);
  
  // Get inventory value
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      isService: false
    }
  });
  
  const inventoryValue = products.reduce((total, product) => {
    if (product.stockLevel && product.cost) {
      return total + (product.stockLevel * product.cost);
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
        amount: invoice.total - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0),
        dueDate: invoice.dueDate
      })),
      inventoryBreakdown: products.map(product => ({
        productId: product.id,
        name: product.name,
        stockLevel: product.stockLevel || 0,
        unitCost: product.cost || 0,
        totalValue: (product.stockLevel || 0) * (product.cost || 0)
      }))
    } : null
  });
}

// Helper function to generate reports for other types
// This is a simplified implementation
async function generateCashFlowReport(tenantId, startDate, endDate, detailed) {
  // A simple implementation that returns a placeholder
  return NextResponse.json({
    title: "Cash Flow Statement",
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

async function generateTaxSummaryReport(tenantId, startDate, endDate) {
  // Calculate and return tax summary
  return NextResponse.json({
    title: "Tax Summary",
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

async function generateAccountsReceivableReport(tenantId) {
  // Get unpaid invoices
  const unpaidInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
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
    
    const remainingAmount = invoice.total - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    
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
    reportDate: today.toISOString(),
    summary: {
      totalReceivables: unpaidInvoices.reduce((total, invoice) => {
        return total + (invoice.total - invoice.payments.reduce((sum, payment) => sum + payment.amount, 0));
      }, 0),
      currentReceivables: current.reduce((sum, item) => sum + item.amount, 0),
      pastDueReceivables: oneToThirty.reduce((sum, item) => sum + item.amount, 0) +
                          thirtyOneToSixty.reduce((sum, item) => sum + item.amount, 0) +
                          sixtyOneToNinety.reduce((sum, item) => sum + item.amount, 0) +
                          ninetyPlus.reduce((sum, item) => sum + item.amount, 0)
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
async function generateAccountsPayableReport(tenantId) {
  // Return a placeholder
  return NextResponse.json({
    title: "Accounts Payable Aging",
    reportDate: new Date().toISOString(),
    summary: {
      totalPayables: 1230000,
      currentPayables: 850000,
      pastDuePayables: 380000
    }
  });
}

async function generateExpenseReport(tenantId, startDate, endDate, detailed) {
  // Get expenses in date range
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
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
    expensesByCategory[expense.category] += expense.amount;
  });
  
  return NextResponse.json({
    title: "Expense Report",
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
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

async function generateSalesReport(tenantId, startDate, endDate, detailed) {
  // Get sales data
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
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
      tenantId,
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
    sales.reduce((sum, sale) => sum + sale.total, 0) +
    invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  
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
      salesByProduct[productId].amount += item.amount;
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
    salesByClient[clientId].amount += transaction.total;
  });
  
  return NextResponse.json({
    title: "Sales Report",
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    summary: {
      totalRevenue,
      totalSales: sales.length,
      totalInvoices: invoices.length,
      averageTransactionValue: totalRevenue / (sales.length + invoices.length) || 0
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

async function generateInventoryValuationReport(tenantId) {
  // Get inventory products
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      isService: false
    }
  });
  
  // Calculate totals
  const totalValue = products.reduce((sum, product) => {
    return sum + ((product.stockLevel || 0) * (product.cost || 0));
  }, 0);
  
  return NextResponse.json({
    title: "Inventory Valuation",
    reportDate: new Date().toISOString(),
    summary: {
      totalItems: products.length,
      totalQuantity: products.reduce((sum, product) => sum + (product.stockLevel || 0), 0),
      totalValue
    },
    items: products.map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stockLevel: product.stockLevel || 0,
      unitCost: product.cost || 0,
      totalValue: (product.stockLevel || 0) * (product.cost || 0),
      reorderPoint: product.reorderPoint,
      needsReorder: (product.stockLevel || 0) <= (product.reorderPoint || 0)
    }))
  });
}

async function generateFinancialRatiosReport(tenantId, timeframe) {
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