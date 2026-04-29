// app/api/reports/[reportType]/export/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { stripEmbeddedPeriodFromReportLabel, parseInclusiveApiYmdRange } from '@/lib/dateUtils';
import { getSalesRevenueForPeriod } from '@/lib/incomeStatementService';
import * as XLSX from 'xlsx';
import { RETIRED_REPORT_IDS, retiredReportResponse } from '@/lib/retiredReports';

/**
 * GET handler for exporting various reports
 * Supports CSV, XLSX, and PDF formats
 */
export async function GET(request, context) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const reportType = params?.reportType;
    if (reportType && RETIRED_REPORT_IDS.has(reportType)) {
      return retiredReportResponse(reportType);
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Get report data based on type
    let reportData;
    let headers;
    let title;
    
    switch (reportType) {
      case 'income-statement':
      case 'profit-loss':
        if (format.toLowerCase() === 'pdf') {
          return await generateIncomeStatementPDF(user.tenantId, startDate, endDate, request);
        }
        // Same logic for Excel and CSV (system rule): use full income statement service
        if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'csv') {
          const { generateIncomeStatementFromAccounts } = await import('@/lib/incomeStatementService');
          const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { name: true }
          });
          const statement = await generateIncomeStatementFromAccounts(
            user.tenantId,
            startDate,
            endDate,
            tenant?.name || 'Company',
            null,
            user.currentBranchId || null
          );
          if (format.toLowerCase() === 'xlsx') {
            return await generateIncomeStatementExcelResponse(statement, startDate, endDate, 'income-statement.xlsx');
          }
          reportData = flattenIncomeStatementForCSV(statement);
          headers = [
            { key: 'type', label: 'Type' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount' },
            { key: 'percentage', label: 'Percentage of Revenue' }
          ];
          title = 'Profit & Loss Statement';
          break;
        }
        reportData = await generateIncomeStatementData(user.tenantId, startDate, endDate);
        headers = [
          { key: 'type', label: 'Type' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount' },
          { key: 'percentage', label: 'Percentage of Revenue' }
        ];
        title = 'Profit & Loss Statement';
        break;
        
      case 'balance-sheet':
        // For PDF, use the actual balance sheet API to get the same data structure
        if (format.toLowerCase() === 'pdf') {
          return await generateBalanceSheetPDF(user.tenantId, endDate, request);
        }
        // For CSV/XLSX, use the simplified format
        reportData = await generateBalanceSheetData(user.tenantId, endDate);
        headers = [
          { key: 'section', label: 'Section' },
          { key: 'type', label: 'Type' },
          { key: 'name', label: 'Account/Item' },
          { key: 'balance', label: 'Balance' }
        ];
        title = 'Balance Sheet';
        break;
        
      case 'expenses':
        reportData = await generateExpenseReportData(user.tenantId, startDate, endDate);
        headers = [
          { key: 'date', label: 'Date' },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description' },
          { key: 'merchant', label: 'Merchant' },
          { key: 'submittedBy', label: 'Submitted By' },
          { key: 'status', label: 'Status' },
          { key: 'amount', label: 'Amount' }
        ];
        title = 'Expense Report';
        break;
        
      case 'sales':
        reportData = await generateSalesReportData(user.tenantId, startDate, endDate);
        headers = [
          { key: 'date', label: 'Date' },
          { key: 'type', label: 'Type' },
          { key: 'number', label: 'Reference' },
          { key: 'customer', label: 'Customer' },
          { key: 'status', label: 'Status' },
          { key: 'total', label: 'Total' }
        ];
        title = 'Sales Report';
        break;
        
      case 'cash-flow':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Start date and end date are required for cash flow export' },
            { status: 400 }
          );
        }
        const { generateCashFlowFromAccounts } = await import('@/lib/cashFlowService');
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { name: true, logoUrl: true }
        });
        const cashFlowData = await generateCashFlowFromAccounts(
          user.tenantId,
          startDate,
          endDate,
          tenant?.name || 'Company',
          tenant?.logoUrl || null,
          user.currentBranchId || null
        );
        const { prepareExportData } = await import('@/lib/exportUtils');
        const cashFlowExport = prepareExportData('cash-flow', cashFlowData);
        reportData = cashFlowExport.data;
        headers = cashFlowExport.headers || [
          { key: 'section', label: 'Section' },
          { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount', format: 'currency' }
        ];
        title = cashFlowExport.title || 'Cash Flow Statement (Direct Method)';
        break;

      case 'stock-movement': {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Start date and end date are required for stock movement export' },
            { status: 400 }
          );
        }
        const { generateStockMovementReport } = await import('@/lib/stockMovementService');
        const stockMovementData = await generateStockMovementReport(
          user.tenantId,
          startDate,
          endDate,
          searchParams.get('productId') || null,
          user.currentBranchId || null
        );
        const { prepareExportData: prepareExportDataStock } = await import('@/lib/exportUtils');
        const stockMovementExport = prepareExportDataStock('stock-movement', stockMovementData);
        reportData = stockMovementExport.data;
        headers = stockMovementExport.headers || [
          { key: 'productName', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'date', label: 'Date' },
          { key: 'transactionType', label: 'Transaction Type' },
          { key: 'qtyIn', label: 'Qty In' },
          { key: 'qtyOut', label: 'Qty Out' },
          { key: 'balance', label: 'Balance' },
          { key: 'reference', label: 'Reference' }
        ];
        title = stockMovementExport.title || 'Stock Movement Report';
        break;
      }

      case 'inventory-losses':
        reportData = await generateInventoryLossReportData(
          user.tenantId,
          startDate,
          endDate,
          user.currentBranchId || null
        );
        headers = [
          { key: 'date', label: 'Date' },
          { key: 'eventType', label: 'Event Type' },
          { key: 'description', label: 'Description' },
          { key: 'reference', label: 'Reference' },
          { key: 'branchName', label: 'Branch' },
          { key: 'submittedBy', label: 'Submitted By' },
          { key: 'amount', label: 'Amount' }
        ];
        title = 'Inventory Loss Report';
        break;

      case 'pos-daily': {
        const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const { generatePosDailyReport } = await import('@/lib/posDailyReportService');
        const posData = await generatePosDailyReport(
          user.tenantId,
          dateParam,
          user.currentBranchId || null
        );
        const posRows = [
          { metric: 'Date', value: posData.date },
          { metric: 'Total Sales', value: posData.totalSales },
          { metric: 'Transactions', value: posData.transactionCount },
          { metric: 'Items Sold', value: posData.itemsSold },
          { metric: 'Average Sale', value: posData.averageSaleValue },
          { metric: 'Total COGS', value: posData.totalCogs ?? '' },
          { metric: 'Gross Profit', value: posData.grossProfit ?? '' },
          { metric: 'Voided', value: posData.voidedCount ?? 0 },
          { metric: 'Refunds', value: posData.refundCount ?? 0 }
        ];
        (posData.paymentBreakdown || []).forEach(p => {
          posRows.push({ metric: `Payment: ${p.label || p.method}`, value: p.total });
        });
        posRows.push({ metric: 'Grand Total (Payments)', value: posData.paymentGrandTotal ?? 0 });
        reportData = posRows;
        headers = [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }];
        title = `POS Daily Report ${dateParam}`;
        break;
      }
        
      default:
        return NextResponse.json(
          { error: `Unsupported report type: ${reportType}` },
          { status: 400 }
        );
    }
    
    // Generate the export file based on format
    switch (format.toLowerCase()) {
      case 'csv':
        return generateCSVResponse(reportData, headers, `${reportType}.csv`);
        
      case 'xlsx':
        return generateExcelResponse(reportData, headers, title, `${reportType}.xlsx`);
        
      case 'pdf':
        // Get tenant info for header
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { name: true, logoUrl: true }
        });
        
        // Build period label
        let periodLabel = '';
        if (startDate && endDate) {
          periodLabel = `For the Period: ${startDate} to ${endDate}`;
        } else if (endDate) {
          periodLabel = `As of ${endDate}`;
        }
        
        return await generatePDFResponse(reportData, headers, title, `${reportType}.pdf`, {
          tenant,
          periodLabel
        });
        
      default:
        return NextResponse.json(
          { error: `Unsupported export format: ${format}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report export. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate Income Statement data for export.
 * Revenue: ONE line — Sales Revenue. COGS: ONE line — Cost of Goods Sold (FIFO).
 */
async function generateIncomeStatementData(tenantId, startDate, endDate) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

  // Same total as dashboard + full income statement service (invoice payments + POS sales)
  const totalRevenue = await getSalesRevenueForPeriod(tenantId, startDate, endDate, null);
  const revenueByCategory = { 'Sales Revenue': totalRevenue };

  // COGS: One line — Cost of Goods Sold from stock/COGS integration (same source as /stock)
  const { getCOGSTransactionStats } = await import('@/lib/cogsIntegration');
  const cogsStats = await getCOGSTransactionStats(tenantId, start, end, null);
  const costOfGoodsSold = Math.round(Number(cogsStats?.totalAmount ?? 0) * 100) / 100;
  const grossProfit = totalRevenue - costOfGoodsSold;

  // Get expense data (operating expenses only)
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: { gte: start, lte: end }
    },
    select: {
      id: true,
      amount: true,
      category: true,
      date: true,
      description: true
    }
  });
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    expensesByCategory[expense.category] += expense.amount;
  });
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, amount) => sum + amount, 0);
  const netIncome = grossProfit - totalExpenses;

  const exportData = [];

  // Revenue
  Object.entries(revenueByCategory).forEach(([category, amount]) => {
    exportData.push({
      type: 'Revenue',
      category,
      amount,
      percentage: totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(2) : '0.00'
    });
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Total Revenue',
    amount: totalRevenue,
    percentage: '100.00'
  });

  // COGS — one line only
  exportData.push({
    type: 'COGS',
    category: 'Cost of Goods Sold',
    amount: costOfGoodsSold,
    percentage: totalRevenue > 0 ? ((costOfGoodsSold / totalRevenue) * 100).toFixed(2) : '0.00'
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Gross Profit',
    amount: grossProfit,
    percentage: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : '0.00'
  });

  // Operating expenses
  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    exportData.push({
      type: 'Expense',
      category,
      amount,
      percentage: totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(2) : '0.00'
    });
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Total Expenses',
    amount: totalExpenses,
    percentage: totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(2) : '0.00'
  });
  exportData.push({
    type: 'Total',
    category: 'Net Income',
    amount: netIncome,
    percentage: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(2) : '0.00'
  });

  return exportData;
}

/**
 * Generate Balance Sheet data for export
 */
async function generateBalanceSheetData(tenantId, asOfDate) {
  // Get accounts with their balances
  const accounts = await prisma.account.findMany({
    where: {
      tenantId
    },
    include: {
      journalEntries: {
        where: {
          transaction: {
            date: {
              lte: new Date(asOfDate)
            }
          }
        },
        include: {
          transaction: {
            select: {
              date: true
            }
          }
        }
      }
    }
  });
  
  // Get outstanding invoices (accounts receivable)
  const accountsReceivable = await prisma.invoice.findMany({
    where: {
      tenantId,
      status: 'Pending',
      issueDate: {
        lte: new Date(asOfDate)
      }
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientId: true,
      total: true,
      dueDate: true,
      client: {
        select: {
          name: true
        }
      }
    }
  });
  
  // Get current inventory value
  const inventory = await prisma.product.findMany({
    where: {
      tenantId,
      isService: false
    },
    select: {
      id: true,
      name: true,
      stockLevel: true,
      cost: true
    }
  });
  
  // Categorize accounts
  const assets = accounts.filter(account => account.type === 'Asset');
  const liabilities = accounts.filter(account => account.type === 'Liability');
  const equity = accounts.filter(account => account.type === 'Equity');
  
  // Calculate account balances
  const calculateBalance = (account) => {
    return account.journalEntries.reduce((balance, entry) => {
      if (account.type === 'Asset' || account.type === 'Expense') {
        // Debits increase assets and expenses
        return balance + entry.debit - entry.credit;
      } else {
        // Credits increase liabilities, equity, and revenue
        return balance + entry.credit - entry.debit;
      }
    }, 0);
  };
  
  // Format data for export
  const exportData = [];
  
  // Add asset accounts
  assets.forEach(account => {
    exportData.push({
      section: 'Assets',
      type: 'Account',
      name: account.name,
      balance: calculateBalance(account)
    });
  });
  
  // Add accounts receivable
  accountsReceivable.forEach(item => {
    exportData.push({
      section: 'Assets',
      type: 'Accounts Receivable',
      name: `${item.client.name} (${item.invoiceNumber})`,
      balance: item.total
    });
  });
  
  // Add inventory items
  inventory.forEach(item => {
    exportData.push({
      section: 'Assets',
      type: 'Inventory',
      name: item.name,
      balance: item.stockLevel * item.cost
    });
  });
  
  // Add liability accounts
  liabilities.forEach(account => {
    exportData.push({
      section: 'Liabilities',
      type: 'Account',
      name: account.name,
      balance: calculateBalance(account)
    });
  });
  
  // Add equity accounts
  equity.forEach(account => {
    exportData.push({
      section: 'Equity',
      type: 'Account',
      name: account.name,
      balance: calculateBalance(account)
    });
  });
  
  return exportData;
}

/**
 * Generate Expense Report data for export
 */
async function generateExpenseReportData(tenantId, startDate, endDate) {
  // Get expenses
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      submittedBy: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });
  
  // Format data for export
  const exportData = expenses.map(expense => ({
    date: expense.date.toISOString().split('T')[0],
    category: expense.category,
    description: expense.description,
    merchant: expense.merchant || 'N/A',
    submittedBy: expense.submittedBy?.name || 'Unknown',
    status: expense.status,
    amount: expense.amount
  }));
  
  return exportData;
}

/**
 * Generate Inventory Loss report data for export.
 * Includes inventory write-off + stock-out expenses mirrored from inventory journals.
 */
async function generateInventoryLossReportData(tenantId, startDate, endDate, branchId = null) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const normalizedBranchId =
    branchId && typeof branchId === 'object'
      ? (typeof branchId.id === 'string' ? branchId.id : null)
      : (typeof branchId === 'string' ? branchId : null);

  const where = {
    tenantId,
    status: 'Approved',
    isDeleted: false,
    isReversal: false,
    date: { gte: start, lte: end },
    OR: [
      { originalReference: { startsWith: 'inventory-writeoff:' } },
      { originalReference: { startsWith: 'inventory-stockout:' } },
    ],
  };

  if (normalizedBranchId) {
    where.AND = [{ OR: [{ branchId: normalizedBranchId }, { branchId: null }] }];
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      branch: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });

  return expenses.map((expense) => {
    const reference = expense.originalReference || '';
    const eventType = reference.startsWith('inventory-writeoff:')
      ? 'Write-off'
      : reference.startsWith('inventory-stockout:')
      ? 'Stock-out'
      : 'Unknown';
    return {
      date: expense.date.toISOString().split('T')[0],
      eventType,
      description: expense.description || 'Inventory adjustment loss',
      reference: reference || 'N/A',
      branchName: expense.branch?.name || 'Unassigned',
      submittedBy: expense.submittedBy?.name || 'Unknown',
      amount: Number(expense.amount || 0),
    };
  });
}

/**
 * Generate Sales Report data for export
 */
async function generateSalesReportData(tenantId, startDate, endDate) {
  // Get sales
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      client: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      saleDate: 'desc'
    }
  });
  
  // Get invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      client: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      issueDate: 'desc'
    }
  });
  
  // Format data for export
  const exportData = [];
  
  // Add sales data
  sales.forEach(sale => {
    exportData.push({
      date: sale.saleDate.toISOString().split('T')[0],
      type: 'Direct Sale',
      number: sale.saleNumber,
      customer: sale.client?.name || 'Direct Customer',
      status: sale.status,
      total: sale.total
    });
  });
  
  // Add invoice data
  invoices.forEach(invoice => {
    exportData.push({
      date: invoice.issueDate.toISOString().split('T')[0],
      type: 'Invoice',
      number: invoice.invoiceNumber,
      customer: invoice.client?.name || 'Unknown',
      status: invoice.status,
      total: invoice.total
    });
  });
  
  // Sort by date (newest first)
  exportData.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  return exportData;
}

/**
 * Generate Inventory Report data for export
 */
async function generateInventoryReportData(tenantId) {
  // Get products with inventory
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      isService: false
    },
    orderBy: {
      name: 'asc'
    }
  });
  
  // Format data for export
  const exportData = products.map(product => {
    const stockValue = (product.stockLevel || 0) * (product.cost || 0);
    
    // Determine stock status
    let stockStatus = 'In Stock';
    if (product.stockLevel <= 0) {
      stockStatus = 'Out of Stock';
    } else if (product.reorderPoint && product.stockLevel <= product.reorderPoint) {
      stockStatus = 'Low Stock';
    }
    
    return {
      name: product.name,
      sku: product.sku || 'N/A',
      category: product.category || 'Uncategorized',
      stockLevel: product.stockLevel || 0,
      cost: product.cost || 0,
      stockValue,
      reorderPoint: product.reorderPoint || 'Not set',
      status: stockStatus
    };
  });
  
  return exportData;
}

/**
 * Generate a CSV response
 */
function generateCSVResponse(data, headers, filename) {
  // Create CSV header row
  const headerRow = headers.map(header => `"${header.label}"`).join(',');
  
  // Create CSV data rows
  const rows = data.map(item => {
    return headers.map(header => {
      const value = item[header.key];
      // Handle different value types
      if (value === null || value === undefined) {
        return '""';
      } else if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      } else if (typeof value === 'number') {
        return value;
      } else if (value instanceof Date) {
        return `"${value.toLocaleDateString()}"`;
      } else {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
    }).join(',');
  }).join('\n');
  
  const csvContent = `${headerRow}\n${rows}`;
  
  // Create response with CSV content
  const response = new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
  
  return response;
}

/**
 * Flatten income statement (same source as Excel/PDF) to CSV rows. Same logic for all exports.
 */
function flattenIncomeStatementForCSV(statement) {
  const totalRevenue = Number(statement?.totalRevenue ?? 0);
  const cogsTotal = Number(statement?.cogs?.costOfProductsSold ?? statement?.cogs?.total ?? 0);
  const grossProfit = Number(statement?.grossProfit ?? totalRevenue - cogsTotal);
  const totalOpEx = Number(statement?.totalOperatingExpenses ?? statement?.operatingExpenses?.total ?? 0);
  const netProfit = Number(statement?.operatingIncome ?? statement?.netIncome ?? grossProfit - totalOpEx);
  const pct = (amt) => totalRevenue > 0 ? ((amt / totalRevenue) * 100).toFixed(2) : '0.00';

  const rows = [
    { type: 'Revenue', category: 'Sales Revenue', amount: totalRevenue, percentage: pct(totalRevenue) },
    { type: 'Subtotal', category: 'Total Revenue', amount: totalRevenue, percentage: '100.00' },
    { type: 'COGS', category: 'Cost of Goods Sold', amount: cogsTotal, percentage: pct(cogsTotal) },
    { type: 'Subtotal', category: 'Gross Profit', amount: grossProfit, percentage: pct(grossProfit) }
  ];
  (statement?.operatingExpenses?.categories ?? []).forEach((cat) => {
    const label = stripEmbeddedPeriodFromReportLabel(cat.accountName || cat.category || '');
    rows.push({
      type: 'Expense',
      category: label,
      amount: Number(cat.amount ?? 0),
      percentage: pct(cat.amount ?? 0)
    });
  });
  rows.push(
    { type: 'Subtotal', category: 'Total Operating Expenses', amount: totalOpEx, percentage: pct(totalOpEx) },
    { type: 'Total', category: 'Net Profit', amount: netProfit, percentage: pct(netProfit) }
  );
  return rows;
}

/**
 * Generate an Excel response (generic)
 */
function generateExcelResponse(data, headers, sheetName, filename) {
  const worksheetData = data.map(item => {
    const row = {};
    headers.forEach(header => {
      row[header.label] = item[header.key];
    });
    return row;
  });
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

/**
 * Income Statement Excel export: one worksheet, clean layout, values only.
 * Styling: headings bold, totals bold with top border, currency format, negative in brackets.
 */
async function generateIncomeStatementExcelResponse(statement, startDate, endDate, filename = 'income-statement.xlsx') {
  const ExcelJS = (await import('exceljs')).default;
  const periodLabel = startDate && endDate ? `${startDate} to ${endDate}` : (statement?.period ? `${statement.period.startDate} to ${statement.period.endDate}` : '');
  const totalRevenue = Number(statement?.totalRevenue ?? 0);
  const cogsTotal = Number(statement?.cogs?.costOfProductsSold ?? statement?.cogs?.total ?? 0);
  const grossProfit = Number(statement?.grossProfit ?? totalRevenue - cogsTotal);
  const operatingExpenses = statement?.operatingExpenses?.categories ?? [];
  const totalOperatingExpenses = Number(statement?.totalOperatingExpenses ?? statement?.operatingExpenses?.total ?? 0);
  const netProfit = Number(statement?.operatingIncome ?? statement?.netIncome ?? grossProfit - totalOperatingExpenses);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Income Statement', { views: [{ state: 'normal' }] });

  const currencyNumFmt = '#,##0.00;(#,##0.00)';
  const setAmount = (row, col, value) => {
    const cell = row.getCell(col);
    cell.value = value;
    cell.numFmt = currencyNumFmt;
    cell.alignment = { horizontal: 'right' };
  };

  let rowNum = 1;
  const r1 = ws.getRow(rowNum++);
  r1.getCell(1).value = 'Profit & Loss Statement';
  r1.getCell(1).font = { bold: true };
  r1.height = 22;

  const r2 = ws.getRow(rowNum++);
  r2.getCell(1).value = 'Period';
  r2.getCell(1).font = { bold: true };
  r2.getCell(2).value = periodLabel;

  rowNum++;
  const rRev = ws.getRow(rowNum++);
  rRev.getCell(1).value = 'Sales Revenue';
  rRev.getCell(1).font = { bold: true };
  setAmount(rRev, 2, totalRevenue);

  const rCogs = ws.getRow(rowNum++);
  rCogs.getCell(1).value = 'Cost of Goods Sold';
  rCogs.getCell(1).font = { bold: true };
  setAmount(rCogs, 2, cogsTotal);

  const rGp = ws.getRow(rowNum++);
  rGp.getCell(1).value = 'Gross Profit';
  rGp.getCell(1).font = { bold: true };
  setAmount(rGp, 2, grossProfit);

  rowNum++;
  const rOpHeader = ws.getRow(rowNum++);
  rOpHeader.getCell(1).value = 'Operating Expenses';
  rOpHeader.getCell(1).font = { bold: true };

  operatingExpenses.forEach((cat) => {
    const r = ws.getRow(rowNum++);
    r.getCell(1).value = stripEmbeddedPeriodFromReportLabel(cat.accountName || cat.category || '');
    setAmount(r, 2, Number(cat.amount ?? 0));
  });

  const rTotalOp = ws.getRow(rowNum++);
  rTotalOp.getCell(1).value = 'Total Operating Expenses';
  rTotalOp.getCell(1).font = { bold: true };
  rTotalOp.getCell(1).border = { top: { style: 'thin' } };
  setAmount(rTotalOp, 2, totalOperatingExpenses);
  rTotalOp.getCell(2).border = { top: { style: 'thin' } };

  rowNum++;
  const rNet = ws.getRow(rowNum++);
  rNet.getCell(1).value = 'Net Profit';
  rNet.getCell(1).font = { bold: true };
  rNet.getCell(1).border = { top: { style: 'thin' } };
  setAmount(rNet, 2, netProfit);
  rNet.getCell(2).border = { top: { style: 'thin' } };

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

/**
 * Generate a PDF response with standardized design matching Income Statement/Balance Sheet
 */
async function generatePDFResponse(data, headers, title, filename, options = {}) {
  // Use dynamic imports for server-side compatibility
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  
  // Get tenant info for header
  const tenant = options.tenant || null;
  const companyName = tenant?.name || options.companyName || 'Company';
  const periodLabel = options.periodLabel || '';
  
  // Create new PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = margin;
  
  // Helper function to format currency
  const formatCurrency = (amount) => {
    return 'MWK ' + new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };
  
  // Company Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  // Report Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  
  // Period/Date Label
  if (periodLabel) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(periodLabel, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
  } else {
    yPos += 4;
  }
  
  // Convert headers for autoTable
  const tableHeaders = headers.map(header => header.label);
  
  // Convert data for autoTable with proper formatting
  const tableData = data.map(item => {
    return headers.map(header => {
      const value = item[header.key];
      // Format values as needed
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'number') {
        if (header.key.includes('amount') || header.key === 'total' || header.key === 'balance' || 
            header.key.includes('value') || header.key.includes('cost') || header.key.includes('price')) {
          return formatCurrency(value);
        } else if (header.key === 'percentage' || header.key.includes('percent')) {
          return `${value.toFixed(1)}%`;
        }
        return value.toString();
      } else {
        return String(value);
      }
    });
  });
  
  // Add table using autoTable with standardized styling
  autoTable(doc, {
    startY: yPos,
    head: [tableHeaders],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
      cellWidth: 'auto'
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      textColor: [0, 0, 0]
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255]
    },
    columnStyles: options.columnStyles || {},
    didParseCell: function (data) {
      // Style section headers if they exist
      if (data.row.index < tableData.length) {
        const cellValue = tableData[data.row.index][0];
        if (cellValue && cellValue === cellValue.toUpperCase() && cellValue.length > 5) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
          data.cell.styles.textColor = [0, 0, 0];
        }
        // Style totals
        if (cellValue && (cellValue.includes('Total') || cellValue.includes('TOTAL'))) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: margin, right: margin, top: yPos }
  });
  
  // Convert PDF to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  
  // Create response with PDF content
  const response = new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
  
  return response;
}
/**
 * Generate Income Statement PDF matching the exact display format
 */
async function generateIncomeStatementPDF(tenantId, startDate, endDate, request) {
  try {
    const { generateIncomeStatementFromAccounts } = await import('@/lib/incomeStatementService');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true }
    });
    const url = request?.url ? new URL(request.url) : null;
    const branchId = url?.searchParams?.get('branchId') || null;
    const data = await generateIncomeStatementFromAccounts(
      tenantId,
      startDate,
      endDate,
      tenant?.name || 'Company',
      tenant?.logoUrl || null,
      branchId
    );
    
    // Use dynamic imports for server-side compatibility
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;
    
    // Helper function to get value from object
    const getValue = (item) => {
      if (typeof item === 'object' && item !== null && 'amount' in item) {
        return item.amount;
      }
      return item || 0;
    };
    
    // Helper function to format currency
    const formatCurrency = (amount) => {
      return 'MWK ' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount || 0);
    };
    
    // Helper function to calculate percentage
    const getPercentage = (item, totalRevenue) => {
      if (typeof item === 'object' && item !== null && 'percentage' in item) {
        return item.percentage;
      }
      const amount = getValue(item);
      return totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
    };
    
    const companyName = data.companyName || 'Company';
    const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
    const totalRevenue = data.totalRevenue ?? data.revenue?.total ?? 0;
    
    // Company Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Income Statement', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`For the Period: ${periodLabel}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Build table data matching the component structure
    const tableData = [];
    
    // REVENUE SECTION — one line: Sales Revenue
    tableData.push(['REVENUE', '', '', '']);
    (data.revenue?.lineItems || []).forEach((li) => {
      const amt = li.amount ?? 0;
      const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
      tableData.push([li.label || 'Sales Revenue', '', formatCurrency(amt), `${pct.toFixed(1)}%`]);
    });
    if (!(data.revenue?.lineItems?.length)) {
      tableData.push(['Sales Revenue', '', formatCurrency(totalRevenue), '100.0%']);
    }
    tableData.push(['Total Revenue', '', formatCurrency(totalRevenue), '100.0%']);

    // COGS SECTION — one line only: Cost of Goods Sold (FIFO)
    tableData.push(['COST OF GOODS SOLD', '', '', '']);
    const totalCOGS = getValue(data.cogs?.total) ?? data.cogs?.costOfProductsSold ?? 0;
    const totalCOGSPct = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
    (data.cogs?.lineItems || []).forEach((li) => {
      const amt = li.amount ?? 0;
      const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
      tableData.push([li.label || 'Cost of Goods Sold', '', formatCurrency(amt), `${pct.toFixed(1)}%`]);
    });
    if (!(data.cogs?.lineItems?.length) && totalCOGS !== 0) {
      tableData.push(['Cost of Goods Sold', '', formatCurrency(totalCOGS), `${totalCOGSPct.toFixed(1)}%`]);
    }
    tableData.push(['Total Cost of Goods Sold', '', formatCurrency(totalCOGS), `${totalCOGSPct.toFixed(1)}%`]);

    const grossProfit = getValue(data.grossProfit) || 0;
    const grossProfitPct = getPercentage(data.grossProfit, totalRevenue);
    tableData.push(['GROSS PROFIT', '', formatCurrency(grossProfit), `${grossProfitPct.toFixed(1)}%`]);
    
    // OPERATING EXPENSES SECTION — dynamic categories
    tableData.push(['OPERATING EXPENSES', '', '', '']);
    const categories = data.operatingExpenses?.categories || [];
    categories.forEach((cat) => {
      const amt = cat.amount ?? 0;
      const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
      const name = stripEmbeddedPeriodFromReportLabel(cat.accountName || cat.category || 'Expense');
      tableData.push([name, '', formatCurrency(amt), `${pct.toFixed(1)}%`]);
    });
    const totalOperatingExpenses = data.totalOperatingExpenses ?? getValue(data.operatingExpenses?.total) ?? 0;
    const totalOperatingExpensesPct = totalRevenue > 0 ? (totalOperatingExpenses / totalRevenue) * 100 : 0;
    tableData.push(['Total Operating Expenses', '', formatCurrency(totalOperatingExpenses), `${totalOperatingExpensesPct.toFixed(1)}%`]);
    
    // Net Profit / Loss = Gross Profit – Total Operating Expenses (one final line)
    const netProfitLoss = getValue(data.operatingIncome) ?? getValue(data.netIncome) ?? 0;
    const netProfitLossPct = getPercentage(netProfitLoss, totalRevenue);
    tableData.push(['NET PROFIT / LOSS', '', formatCurrency(netProfitLoss), `${netProfitLossPct.toFixed(1)}%`]);
    
    // Add table with custom styling
    autoTable(doc, {
      startY: yPos,
      head: [['', '', 'Current Period', '% of Revenue']],
      body: tableData,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        cellWidth: 'auto'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'right'
      },
      bodyStyles: {
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'normal' },
        1: { cellWidth: 20 },
        2: { halign: 'right', cellWidth: 50 },
        3: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: function (data) {
        // Style section headers (REVENUE, COGS, etc.)
        if (data.row.index < tableData.length) {
          const cellValue = tableData[data.row.index][0];
          if (cellValue && cellValue === cellValue.toUpperCase() && cellValue.length > 5) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.textColor = [0, 0, 0];
          }
          // Style totals
          if (cellValue && (cellValue.includes('Total') || cellValue.includes('PROFIT') || cellValue.includes('INCOME'))) {
            if (cellValue === 'NET PROFIT / LOSS') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 11;
              data.cell.styles.textColor = netProfitLoss >= 0 ? [0, 0, 0] : [255, 0, 0];
            } else {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      margin: { left: margin, right: margin, top: yPos }
    });
    
    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    // Create response with PDF content
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="income-statement.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating income statement PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate income statement PDF. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate Balance Sheet PDF matching the exact display format
 */
async function generateBalanceSheetPDF(tenantId, asOfDate, request) {
  try {
    // Import the generateBalanceSheet function
    const { generateBalanceSheet } = await import('@/app/api/reports/balance-sheet/route');
    
    // Get tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        name: true,
        logoUrl: true
      }
    });
    
    // Generate balance sheet data
    const data = await generateBalanceSheet(
      tenantId,
      asOfDate,
      tenant?.name || 'Company',
      tenant?.logoUrl || null
    );
    
    // Use dynamic imports for server-side compatibility
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    
    // Create new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;
    
    // Helper function to format currency
    const formatCurrency = (amount) => {
      return 'MWK ' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount || 0);
    };
    
    // Helper function to calculate percentage
    const getPercentage = (value, totalAssets) => {
      return totalAssets > 0 ? ((value || 0) / totalAssets * 100) : 0;
    };
    
    const companyName = data.companyName || 'Company';
    const asOfDateStr = data.asOfDate || '';
    const totalAssets = data.assets?.total || 0;
    
    // Company Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Balance Sheet', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`As of ${asOfDateStr}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Build table data matching the component structure
    const tableData = [];
    
    // ASSETS SECTION
    tableData.push(['ASSETS', '', '', '']);
    
    // Current Assets
    tableData.push(['Current Assets', '', '', '']);
    
    const cashAndCashEquivalents = data.assets?.currentAssets?.cashAndCashEquivalents || 0;
    const cashPct = getPercentage(cashAndCashEquivalents, totalAssets);
    tableData.push(['Cash and Cash Equivalents', '', formatCurrency(cashAndCashEquivalents), `${cashPct.toFixed(1)}%`]);
    
    const accountsReceivable = data.assets?.currentAssets?.accountsReceivable?.total || 0;
    const arPct = getPercentage(accountsReceivable, totalAssets);
    tableData.push(['Accounts Receivable', '', formatCurrency(accountsReceivable), `${arPct.toFixed(1)}%`]);
    
    const inventory = data.assets?.currentAssets?.inventory?.total || 0;
    const inventoryPct = getPercentage(inventory, totalAssets);
    tableData.push(['Inventory', '', formatCurrency(inventory), `${inventoryPct.toFixed(1)}%`]);
    
    const prepaidExpenses = data.assets?.currentAssets?.prepaidExpenses || 0;
    const prepaidPct = getPercentage(prepaidExpenses, totalAssets);
    tableData.push(['Prepaid Expenses', '', formatCurrency(prepaidExpenses), `${prepaidPct.toFixed(1)}%`]);
    
    const totalCurrentAssets = data.assets?.currentAssets?.total || 0;
    const totalCurrentAssetsPct = getPercentage(totalCurrentAssets, totalAssets);
    tableData.push(['Total Current Assets', '', formatCurrency(totalCurrentAssets), `${totalCurrentAssetsPct.toFixed(1)}%`]);
    
    // Non-Current Assets
    tableData.push(['Non-Current Assets', '', '', '']);
    
    const ppeNet = data.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0;
    const ppeNetPct = getPercentage(ppeNet, totalAssets);
    tableData.push(['Property, Plant & Equipment', '', formatCurrency(ppeNet), `${ppeNetPct.toFixed(1)}%`]);
    
    const accumulatedDepreciation = data.assets?.nonCurrentAssets?.propertyPlantEquipment?.accumulatedDepreciation || 0;
    tableData.push(['Less: Accumulated Depreciation', '', `(${formatCurrency(accumulatedDepreciation)})`, '-']);
    
    const intangibleAssets = data.assets?.nonCurrentAssets?.intangibleAssets || 0;
    const intangiblePct = getPercentage(intangibleAssets, totalAssets);
    tableData.push(['Intangible Assets', '', formatCurrency(intangibleAssets), `${intangiblePct.toFixed(1)}%`]);
    
    const otherNonCurrentAssets = data.assets?.nonCurrentAssets?.otherNonCurrentAssets || 0;
    const otherNonCurrentPct = getPercentage(otherNonCurrentAssets, totalAssets);
    tableData.push(['Other Non-Current Assets', '', formatCurrency(otherNonCurrentAssets), `${otherNonCurrentPct.toFixed(1)}%`]);
    
    const totalNonCurrentAssets = data.assets?.nonCurrentAssets?.total || 0;
    const totalNonCurrentAssetsPct = getPercentage(totalNonCurrentAssets, totalAssets);
    tableData.push(['Total Non-Current Assets', '', formatCurrency(totalNonCurrentAssets), `${totalNonCurrentAssetsPct.toFixed(1)}%`]);
    
    tableData.push(['TOTAL ASSETS', '', formatCurrency(totalAssets), '100.0%']);
    
    // LIABILITIES SECTION
    tableData.push(['LIABILITIES', '', '', '']);
    
    // Current Liabilities
    tableData.push(['Current Liabilities', '', '', '']);
    
    const accountsPayable = data.liabilities?.currentLiabilities?.accountsPayable?.total || 0;
    const apPct = getPercentage(accountsPayable, totalAssets);
    tableData.push(['Accounts Payable', '', formatCurrency(accountsPayable), `${apPct.toFixed(1)}%`]);
    
    const shortTermLoans = data.liabilities?.currentLiabilities?.shortTermLoans || 0;
    const shortTermLoansPct = getPercentage(shortTermLoans, totalAssets);
    tableData.push(['Short-term Loans', '', formatCurrency(shortTermLoans), `${shortTermLoansPct.toFixed(1)}%`]);
    
    const accruedExpenses = data.liabilities?.currentLiabilities?.accruedExpenses || 0;
    const accruedPct = getPercentage(accruedExpenses, totalAssets);
    tableData.push(['Accrued Expenses', '', formatCurrency(accruedExpenses), `${accruedPct.toFixed(1)}%`]);
    
    const totalCurrentLiabilities = data.liabilities?.currentLiabilities?.total || 0;
    const totalCurrentLiabilitiesPct = getPercentage(totalCurrentLiabilities, totalAssets);
    tableData.push(['Total Current Liabilities', '', formatCurrency(totalCurrentLiabilities), `${totalCurrentLiabilitiesPct.toFixed(1)}%`]);
    
    // Non-Current Liabilities
    tableData.push(['Non-Current Liabilities', '', '', '']);
    
    const longTermLoans = data.liabilities?.nonCurrentLiabilities?.longTermLoans || 0;
    const longTermLoansPct = getPercentage(longTermLoans, totalAssets);
    tableData.push(['Long-term Loans', '', formatCurrency(longTermLoans), `${longTermLoansPct.toFixed(1)}%`]);
    
    const bondsPayable = data.liabilities?.nonCurrentLiabilities?.bondsPayable || 0;
    const bondsPct = getPercentage(bondsPayable, totalAssets);
    tableData.push(['Bonds Payable', '', formatCurrency(bondsPayable), `${bondsPct.toFixed(1)}%`]);
    
    const otherNonCurrentLiabilities = data.liabilities?.nonCurrentLiabilities?.otherNonCurrentLiabilities || 0;
    const otherNonCurrentLiabilitiesPct = getPercentage(otherNonCurrentLiabilities, totalAssets);
    tableData.push(['Other Non-Current Liabilities', '', formatCurrency(otherNonCurrentLiabilities), `${otherNonCurrentLiabilitiesPct.toFixed(1)}%`]);
    
    const totalNonCurrentLiabilities = data.liabilities?.nonCurrentLiabilities?.total || 0;
    const totalNonCurrentLiabilitiesPct = getPercentage(totalNonCurrentLiabilities, totalAssets);
    tableData.push(['Total Non-Current Liabilities', '', formatCurrency(totalNonCurrentLiabilities), `${totalNonCurrentLiabilitiesPct.toFixed(1)}%`]);
    
    const totalLiabilities = data.liabilities?.total || 0;
    const totalLiabilitiesPct = getPercentage(totalLiabilities, totalAssets);
    tableData.push(['TOTAL LIABILITIES', '', formatCurrency(totalLiabilities), `${totalLiabilitiesPct.toFixed(1)}%`]);
    
    // EQUITY SECTION
    tableData.push(['EQUITY', '', '', '']);
    
    const ownersCapital = data.equity?.ownersCapital || 0;
    const ownersCapitalPct = getPercentage(ownersCapital, totalAssets);
    tableData.push(["Owner's Capital/Share Capital", '', formatCurrency(ownersCapital), `${ownersCapitalPct.toFixed(1)}%`]);
    
    const retainedEarnings = data.equity?.retainedEarnings || 0;
    const retainedEarningsPct = getPercentage(retainedEarnings, totalAssets);
    tableData.push(['Retained Earnings', '', formatCurrency(retainedEarnings), `${retainedEarningsPct.toFixed(1)}%`]);
    
    const currentYearProfitLoss = data.equity?.currentYearProfitLoss || 0;
    const currentYearProfitLossPct = getPercentage(currentYearProfitLoss, totalAssets);
    tableData.push(['Current Year Profit/Loss', '', formatCurrency(currentYearProfitLoss), `${currentYearProfitLossPct.toFixed(1)}%`]);
    
    const totalEquity = data.equity?.total || 0;
    const totalEquityPct = getPercentage(totalEquity, totalAssets);
    tableData.push(['TOTAL EQUITY', '', formatCurrency(totalEquity), `${totalEquityPct.toFixed(1)}%`]);
    
    const totalLiabilitiesAndEquity = data.totalLiabilitiesAndEquity || 0;
    tableData.push(['TOTAL LIABILITIES & EQUITY', '', formatCurrency(totalLiabilitiesAndEquity), '100.0%']);
    
    // Add table with custom styling
    autoTable(doc, {
      startY: yPos,
      head: [['', '', 'Current', '% of Total Assets']],
      body: tableData,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        cellWidth: 'auto'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'right'
      },
      bodyStyles: {
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'normal' },
        1: { cellWidth: 20 },
        2: { halign: 'right', cellWidth: 50 },
        3: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: function (data) {
        // Style section headers (ASSETS, LIABILITIES, etc.)
        if (data.row.index < tableData.length) {
          const cellValue = tableData[data.row.index][0];
          if (cellValue && cellValue === cellValue.toUpperCase() && cellValue.length > 5 && !cellValue.includes('Current') && !cellValue.includes('Non-Current')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.textColor = [0, 0, 0];
          }
          // Style subsection headers (Current Assets, etc.)
          if (cellValue && (cellValue === 'Current Assets' || cellValue === 'Non-Current Assets' || 
              cellValue === 'Current Liabilities' || cellValue === 'Non-Current Liabilities')) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [245, 245, 245];
            data.cell.styles.textColor = [0, 0, 0];
          }
          // Style totals
          if (cellValue && (cellValue.includes('Total') || cellValue.includes('TOTAL'))) {
            if (cellValue === 'TOTAL ASSETS' || cellValue === 'TOTAL LIABILITIES' || 
                cellValue === 'TOTAL EQUITY' || cellValue === 'TOTAL LIABILITIES & EQUITY') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 11;
            } else {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      },
      margin: { left: margin, right: margin, top: yPos }
    });
    
    // Add balance verification
    yPos = doc.lastAutoTable.finalY + 10;
    const isBalanced = data.isBalanced;
    const balanceDifference = Math.abs(data.balanceDifference || 0);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isBalanced ? 0 : 255, isBalanced ? 128 : 0, 0);
    doc.text(
      isBalanced 
        ? 'Balance Verification: BALANCED ✓' 
        : `Balance Verification: NOT BALANCED ✗ (Difference: ${formatCurrency(balanceDifference)})`,
      margin,
      yPos
    );
    
    // Add financial ratios if available
    if (data.ratios) {
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Financial Ratios', margin, yPos);
      yPos += 5;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      const currentRatio = data.ratios.currentRatio ? data.ratios.currentRatio.toFixed(2) : 'N/A';
      doc.text(`Current Ratio: ${currentRatio}`, margin, yPos);
      yPos += 4;
      
      const quickRatio = data.ratios.quickRatio ? data.ratios.quickRatio.toFixed(2) : 'N/A';
      doc.text(`Quick Ratio: ${quickRatio}`, margin, yPos);
      yPos += 4;
      
      const debtToEquity = data.ratios.debtToEquity ? data.ratios.debtToEquity.toFixed(2) : 'N/A';
      doc.text(`Debt-to-Equity: ${debtToEquity}`, margin, yPos);
    }
    
    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    // Create response with PDF content
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="balance-sheet.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating balance sheet PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate balance sheet PDF. Please try again.' },
      { status: 500 }
    );
  }
}
