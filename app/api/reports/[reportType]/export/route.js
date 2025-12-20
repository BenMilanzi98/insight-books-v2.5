// app/api/reports/[reportType]/export/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import * as XLSX from 'xlsx';

/**
 * GET handler for exporting various reports
 * Supports CSV, XLSX, and PDF formats
 */
export async function GET(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get the report type from the URL params
    const reportType = params.reportType;
    
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
        // For PDF, use the actual income statement API to get the same data structure
        if (format.toLowerCase() === 'pdf') {
          return await generateIncomeStatementPDF(user.tenantId, startDate, endDate, request);
        }
        // For CSV/XLSX, use the simplified format
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
        
      case 'inventory-valuation':
        reportData = await generateInventoryReportData(user.tenantId);
        headers = [
          { key: 'name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category' },
          { key: 'stockLevel', label: 'Stock Level' },
          { key: 'cost', label: 'Unit Cost' },
          { key: 'stockValue', label: 'Stock Value' },
          { key: 'reorderPoint', label: 'Reorder Point' },
          { key: 'status', label: 'Status' }
        ];
        title = 'Inventory Valuation Report';
        break;
        
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
    console.error(`Error exporting ${params.reportType} report:`, error);
    return NextResponse.json(
      { error: 'Failed to generate report export. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate Income Statement data for export
 */
async function generateIncomeStatementData(tenantId, startDate, endDate) {
  // Get revenue data (invoices and sales)
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    include: {
      items: true
    }
  });
  
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
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
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    },
    select: {
      id: true,
      amount: true,
      category: true,
      date: true,
      description: true
    }
  });
  
  // Process revenue data
  const revenueByCategory = {};
  
  // Process invoices
  invoices.forEach(invoice => {
    if (invoice.status === 'Paid' || invoice.status === 'Pending') {
      const category = 'Invoice Sales';
      if (!revenueByCategory[category]) {
        revenueByCategory[category] = 0;
      }
      revenueByCategory[category] += invoice.total;
    }
  });
  
  // Process sales
  sales.forEach(sale => {
    const category = 'Direct Sales';
    if (!revenueByCategory[category]) {
      revenueByCategory[category] = 0;
    }
    revenueByCategory[category] += sale.total;
  });
  
  // Process expense data
  const expensesByCategory = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    expensesByCategory[expense.category] += expense.amount;
  });
  
  // Calculate totals
  const totalRevenue = Object.values(revenueByCategory).reduce((sum, amount) => sum + amount, 0);
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, amount) => sum + amount, 0);
  const netIncome = totalRevenue - totalExpenses;
  
  // Format data for export
  const exportData = [];
  
  // Add revenue items
  Object.entries(revenueByCategory).forEach(([category, amount]) => {
    exportData.push({
      type: 'Revenue',
      category,
      amount,
      percentage: totalRevenue > 0 
        ? ((amount / totalRevenue) * 100).toFixed(2) 
        : '0.00'
    });
  });
  
  // Add revenue subtotal
  exportData.push({
    type: 'Subtotal',
    category: 'Total Revenue',
    amount: totalRevenue,
    percentage: '100.00'
  });
  
  // Add expenses items
  Object.entries(expensesByCategory).forEach(([category, amount]) => {
    exportData.push({
      type: 'Expense',
      category,
      amount,
      percentage: totalRevenue > 0 
        ? ((amount / totalRevenue) * 100).toFixed(2) 
        : '0.00'
    });
  });
  
  // Add expenses subtotal
  exportData.push({
    type: 'Subtotal',
    category: 'Total Expenses',
    amount: totalExpenses,
    percentage: totalRevenue > 0 
      ? ((totalExpenses / totalRevenue) * 100).toFixed(2) 
      : '0.00'
  });
  
  // Add net income
  exportData.push({
    type: 'Total',
    category: 'Net Income',
    amount: netIncome,
    percentage: totalRevenue > 0 
      ? ((netIncome / totalRevenue) * 100).toFixed(2) 
      : '0.00'
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
 * Generate an Excel response
 */
function generateExcelResponse(data, headers, sheetName, filename) {
  // Convert data for XLSX format
  const worksheetData = data.map(item => {
    const row = {};
    headers.forEach(header => {
      row[header.label] = item[header.key];
    });
    return row;
  });
  
  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  
  // Create workbook and add the worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');
  
  // Generate Excel buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  
  // Create response with Excel content
  const response = new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
  
  return response;
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
    // Import the generateIncomeStatement function
    const { generateIncomeStatement } = await import('@/app/api/reports/income-statement/route');
    
    // Get tenant settings for tax rate
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { 
        name: true,
        logoUrl: true
      }
    });
    
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });
    const taxRate = tenantSettings?.defaultTaxRate || 30;
    
    // Generate income statement data
    const data = await generateIncomeStatement(
      tenantId,
      startDate,
      endDate,
      taxRate,
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
    const totalRevenue = data.revenue?.total || 0;
    
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
    
    // REVENUE SECTION
    tableData.push(['REVENUE', '', '', '']);
    
    const salesRevenue = getValue(data.revenue?.salesRevenue) || 0;
    const salesRevenuePct = getPercentage(data.revenue?.salesRevenue, totalRevenue);
    tableData.push(['Sales Revenue', '', formatCurrency(salesRevenue), `${salesRevenuePct.toFixed(1)}%`]);
    
    const serviceRevenue = getValue(data.revenue?.serviceRevenue) || 0;
    const serviceRevenuePct = getPercentage(data.revenue?.serviceRevenue, totalRevenue);
    tableData.push(['Service Revenue', '', formatCurrency(serviceRevenue), `${serviceRevenuePct.toFixed(1)}%`]);
    
    const otherIncome = getValue(data.revenue?.otherIncome) || 0;
    const otherIncomePct = getPercentage(data.revenue?.otherIncome, totalRevenue);
    tableData.push(['Other Income', '', formatCurrency(otherIncome), `${otherIncomePct.toFixed(1)}%`]);
    
    tableData.push(['Total Revenue', '', formatCurrency(totalRevenue), '100.0%']);
    
    // COGS SECTION
    tableData.push(['COST OF GOODS SOLD', '', '', '']);
    
    const costOfProductsSold = getValue(data.cogs?.costOfProductsSold) || 0;
    const costOfProductsSoldPct = getPercentage(data.cogs?.costOfProductsSold, totalRevenue);
    tableData.push(['Cost of Products Sold', '', formatCurrency(costOfProductsSold), `${costOfProductsSoldPct.toFixed(1)}%`]);
    
    const freightShipping = getValue(data.cogs?.freightShippingCosts) || 0;
    const freightShippingPct = getPercentage(data.cogs?.freightShippingCosts, totalRevenue);
    tableData.push(['Freight/Shipping Costs', '', formatCurrency(freightShipping), `${freightShippingPct.toFixed(1)}%`]);
    
    const totalCOGS = getValue(data.cogs?.total) || 0;
    const totalCOGSPct = getPercentage(data.cogs?.total, totalRevenue);
    tableData.push(['Total Cost of Goods Sold', '', formatCurrency(totalCOGS), `${totalCOGSPct.toFixed(1)}%`]);
    
    const grossProfit = getValue(data.grossProfit) || 0;
    const grossProfitPct = getPercentage(data.grossProfit, totalRevenue);
    tableData.push(['GROSS PROFIT', '', formatCurrency(grossProfit), `${grossProfitPct.toFixed(1)}%`]);
    
    // OPERATING EXPENSES SECTION
    tableData.push(['OPERATING EXPENSES', '', '', '']);
    
    const salariesWages = getValue(data.operatingExpenses?.salariesWages) || 0;
    const salariesWagesPct = getPercentage(data.operatingExpenses?.salariesWages, totalRevenue);
    tableData.push(['Salaries & Wages', '', formatCurrency(salariesWages), `${salariesWagesPct.toFixed(1)}%`]);
    
    const rentExpense = getValue(data.operatingExpenses?.rentExpense) || 0;
    const rentExpensePct = getPercentage(data.operatingExpenses?.rentExpense, totalRevenue);
    tableData.push(['Rent Expense', '', formatCurrency(rentExpense), `${rentExpensePct.toFixed(1)}%`]);
    
    const utilitiesExpense = getValue(data.operatingExpenses?.utilitiesExpense) || 0;
    const utilitiesExpensePct = getPercentage(data.operatingExpenses?.utilitiesExpense, totalRevenue);
    tableData.push(['Utilities Expense', '', formatCurrency(utilitiesExpense), `${utilitiesExpensePct.toFixed(1)}%`]);
    
    const officeSupplies = getValue(data.operatingExpenses?.officeSupplies) || 0;
    const officeSuppliesPct = getPercentage(data.operatingExpenses?.officeSupplies, totalRevenue);
    tableData.push(['Office Supplies', '', formatCurrency(officeSupplies), `${officeSuppliesPct.toFixed(1)}%`]);
    
    const marketingAdvertising = getValue(data.operatingExpenses?.marketingAdvertising) || 0;
    const marketingAdvertisingPct = getPercentage(data.operatingExpenses?.marketingAdvertising, totalRevenue);
    tableData.push(['Marketing & Advertising', '', formatCurrency(marketingAdvertising), `${marketingAdvertisingPct.toFixed(1)}%`]);
    
    const insurance = getValue(data.operatingExpenses?.insurance) || 0;
    const insurancePct = getPercentage(data.operatingExpenses?.insurance, totalRevenue);
    tableData.push(['Insurance', '', formatCurrency(insurance), `${insurancePct.toFixed(1)}%`]);
    
    const depreciation = getValue(data.operatingExpenses?.depreciation) || 0;
    const depreciationPct = getPercentage(data.operatingExpenses?.depreciation, totalRevenue);
    tableData.push(['Depreciation', '', formatCurrency(depreciation), `${depreciationPct.toFixed(1)}%`]);
    
    const otherOperatingExpenses = getValue(data.operatingExpenses?.otherOperatingExpenses) || 0;
    const otherOperatingExpensesPct = getPercentage(data.operatingExpenses?.otherOperatingExpenses, totalRevenue);
    tableData.push(['Other Operating Expenses', '', formatCurrency(otherOperatingExpenses), `${otherOperatingExpensesPct.toFixed(1)}%`]);
    
    const totalOperatingExpenses = getValue(data.operatingExpenses?.total) || 0;
    const totalOperatingExpensesPct = getPercentage(data.operatingExpenses?.total, totalRevenue);
    tableData.push(['Total Operating Expenses', '', formatCurrency(totalOperatingExpenses), `${totalOperatingExpensesPct.toFixed(1)}%`]);
    
    const operatingIncome = getValue(data.operatingIncome) || 0;
    const operatingIncomePct = getPercentage(data.operatingIncome, totalRevenue);
    tableData.push(['OPERATING INCOME', '', formatCurrency(operatingIncome), `${operatingIncomePct.toFixed(1)}%`]);
    
    // OTHER INCOME/(EXPENSES) SECTION
    tableData.push(['OTHER INCOME/(EXPENSES)', '', '', '']);
    
    const interestIncome = getValue(data.otherIncomeExpenses?.interestIncome) || 0;
    const interestIncomePct = getPercentage(data.otherIncomeExpenses?.interestIncome, totalRevenue);
    tableData.push(['Interest Income', '', formatCurrency(interestIncome), `${interestIncomePct.toFixed(1)}%`]);
    
    const interestExpense = getValue(data.otherIncomeExpenses?.interestExpense) || 0;
    const interestExpensePct = getPercentage(data.otherIncomeExpenses?.interestExpense, totalRevenue);
    tableData.push(['Interest Expense', '', formatCurrency(interestExpense), `${interestExpensePct.toFixed(1)}%`]);
    
    const gainLossOnAssetSales = getValue(data.otherIncomeExpenses?.gainLossOnAssetSales) || 0;
    const gainLossOnAssetSalesPct = getPercentage(data.otherIncomeExpenses?.gainLossOnAssetSales, totalRevenue);
    tableData.push(['Gain/Loss on Asset Sales', '', formatCurrency(gainLossOnAssetSales), `${gainLossOnAssetSalesPct.toFixed(1)}%`]);
    
    const netIncomeBeforeTax = getValue(data.netIncomeBeforeTax) || 0;
    const netIncomeBeforeTaxPct = getPercentage(data.netIncomeBeforeTax, totalRevenue);
    tableData.push(['NET INCOME BEFORE TAX', '', formatCurrency(netIncomeBeforeTax), `${netIncomeBeforeTaxPct.toFixed(1)}%`]);
    
    const incomeTaxExpense = getValue(data.incomeTaxExpense) || 0;
    const incomeTaxExpensePct = getPercentage(data.incomeTaxExpense, totalRevenue);
    const incomeTaxRate = data.incomeTaxExpense?.rate || 0;
    tableData.push([`Income Tax Expense (${incomeTaxRate}%)`, '', formatCurrency(incomeTaxExpense), `${incomeTaxExpensePct.toFixed(1)}%`]);
    
    const netIncome = getValue(data.netIncome) || 0;
    const netIncomePct = getPercentage(netIncome, totalRevenue);
    tableData.push(['NET INCOME', '', formatCurrency(netIncome), `${netIncomePct.toFixed(1)}%`]);
    
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
            if (cellValue === 'NET INCOME') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 11;
              data.cell.styles.textColor = netIncome >= 0 ? [0, 128, 0] : [255, 0, 0];
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
