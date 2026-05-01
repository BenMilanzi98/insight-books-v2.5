// lib/exportUtils.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './currencyUtils';

/**
 * Generate a CSV string from data
 * @param {Array} data - Array of objects to convert to CSV
 * @param {Array} headers - Array of header objects with { key, label }
 * @returns {string} CSV string
 */
export const generateCSV = (data, headers) => {
  if (!data || !data.length) {
    return '';
  }

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
  
  return `${headerRow}\n${rows}`;
};

/**
 * Download data as a CSV file
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header objects with { key, label }
 * @param {string} filename - Name for the downloaded file
 */
export const downloadCSV = (data, headers, filename = 'export.csv') => {
  const csvContent = generateCSV(data, headers);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generate a PDF document from data
 * @param {Object} options - PDF generation options
 * @param {string} options.title - Report title
 * @param {string} options.subtitle - Report subtitle
 * @param {Array} options.data - Array of objects to include in the PDF
 * @param {Array} options.headers - Array of header objects with { key, label }
 * @param {Array} options.sections - Additional sections to include (optional)
 * @returns {jsPDF} PDF document object
 */
export const generatePDF = (options) => {
  const { 
    title, 
    subtitle, 
    data, 
    headers, 
    sections = [],
    orientation = 'portrait',
    summaryData = null,
    logo = null
  } = options;

  // Create new PDF document
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });
  
  // Set default font
  doc.setFont('helvetica');
  
  // Add logo if provided
  if (logo) {
    doc.addImage(logo, 'JPEG', 10, 10, 30, 15);
  }
  
  // Add title and subtitle
  const startY = logo ? 30 : 15;
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 10, startY);
  
  if (subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 10, startY + 7);
  }
  
  // Add generation timestamp
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 10, startY + 12);
  
  let yPos = startY + 20;
  
  // Add summary data if provided
  if (summaryData) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary', 10, yPos);
    
    yPos += 5;
    const summaryTableData = [];
    
    // Handle both array and object formats for summaryData
    if (Array.isArray(summaryData)) {
      // Array of { label, value } rows
      summaryData.forEach((item) => {
        if (item && typeof item === 'object' && 'label' in item && 'value' in item) {
          summaryTableData.push([item.label, item.value]);
        } else {
          summaryTableData.push([String(item), '']);
        }
      });
    } else if (typeof summaryData === 'object' && summaryData !== null) {
      // Object key/value summary
      Object.entries(summaryData).forEach(([key, value]) => {
        // Format the key for display
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
          .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter

        // Format the value based on its type
        let formattedValue = value;
        if (typeof value === 'number') {
          if (
            key.toLowerCase().includes('total') ||
            key.toLowerCase().includes('amount') ||
            key.toLowerCase().includes('revenue') ||
            key.toLowerCase().includes('expense') ||
            key.toLowerCase().includes('profit')
          ) {
            formattedValue = formatCurrency(value);
          }
        }

        summaryTableData.push([formattedKey, formattedValue]);
      });
    }
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 133, 244],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'auto'
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 'auto', halign: 'right' }
      },
      margin: { left: 10, right: 10 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
  }
  
  // Add main data table
  if (data && data.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('Data Table', 10, yPos);
    
    yPos += 5;
    
    // Convert data to format expected by autoTable
    const tableHeaders = headers.map(header => header.label);
    const tableData = data.map(item => {
      return headers.map(header => {
        const value = item[header.key];
        // Format values as needed
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'number') {
          if (header.format === 'currency') {
            return formatCurrency(value);
          } else if (header.format === 'percent') {
            return `${value.toFixed(2)}%`;
          }
          return value;
        } else if (value instanceof Date) {
          return value.toLocaleDateString();
        } else {
          return value;
        }
      });
    });
    
    autoTable(doc, {
      startY: yPos,
      head: [tableHeaders],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [66, 133, 244],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        overflow: 'linebreak'
      },
      margin: { left: 10, right: 10 }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
  }
  
  // Add additional sections
  for (const section of sections) {
    if (section.title) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(section.title, 10, yPos);
      yPos += 5;
    }
    
    if (section.text) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Split text into lines that fit the page width
      const textLines = doc.splitTextToSize(section.text, 190);
      doc.text(textLines, 10, yPos);
      
      yPos += (textLines.length * 5) + 5;
    }
    
    if (section.table) {
      autoTable(doc, {
        startY: yPos,
        head: [section.table.headers],
        body: section.table.data,
        theme: 'grid',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: [255, 255, 255]
        },
        margin: { left: 10, right: 10 }
      });
      
      yPos = doc.lastAutoTable.finalY + 10;
    }
    
    // Check if we need to add a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  }
  
  // Add footer
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 290, { align: 'center' });
  }
  
  return doc;
};

/**
 * Download data as a PDF file
 * @param {Object} options - PDF generation options
 * @param {string} filename - Name for the downloaded file
 */
export const downloadPDF = (options, filename = 'report.pdf') => {
  const doc = generatePDF(options);
  doc.save(filename);
};

/**
 * Export data as an Excel file (XLSX)
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header objects with { key, label }
 * @param {string} sheetName - Name for the Excel sheet
 * @param {string} filename - Name for the downloaded file
 */
export const downloadExcel = async (data, headers, sheetName = 'Data', filename = 'export.xlsx') => {
  try {
    // Dynamically import the xlsx library (reduces initial bundle size)
    const XLSX = await import('xlsx');
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(
      data.map(item => {
        const row = {};
        headers.forEach(header => {
          row[header.label] = item[header.key];
        });
        return row;
      })
    );
    
    // Create workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generate and download the file
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw new Error('Failed to export to Excel. Please try again.');
  }
};

/**
 * Multi-sheet Excel workbook (sheet names truncated to 31 chars for Excel).
 * @param {{ name: string, data: Array<Record<string, unknown>>, headers: Array<{ key: string, label: string }> }[]} sheets
 * @param {string} filename
 */
export async function downloadExcelWorkbook(sheets, filename = 'export.xlsx') {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets || []) {
      const rawName = String(sheet.name || 'Sheet').trim() || 'Sheet';
      const name = rawName.length > 31 ? rawName.slice(0, 31) : rawName;
      const data = Array.isArray(sheet.data) ? sheet.data : [];
      const headers = Array.isArray(sheet.headers) ? sheet.headers : [];
      const worksheet = XLSX.utils.json_to_sheet(
        data.map((item) => {
          const row = {};
          headers.forEach((h) => {
            row[h.label] = item[h.key];
          });
          return row;
        })
      );
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    }
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Error generating Excel workbook:', error);
    throw new Error('Failed to export to Excel. Please try again.');
  }
}

/**
 * Prepare export data for different report types
 * @param {string} reportType - Type of report
 * @param {Object} data - Report data
 * @returns {Object} Prepared export data
 */
export const prepareExportData = (reportType, data) => {
  if (!data) return { data: [], headers: [] };
  
  switch (reportType) {
    case 'income-statement':
    case 'profit-loss':
      return prepareIncomeStatementExport(data);
      
    case 'balance-sheet':
      return prepareBalanceSheetExport(data);
      
    case 'cash-flow':
      return prepareCashFlowExport(data);
      
    case 'tax-summary':
      return prepareTaxSummaryExport(data);
      
    case 'expenses':
      return prepareExpensesExport(data);
      
    case 'sales':
      return prepareSalesExport(data);
      
    case 'financial-ratios':
      return prepareRatiosExport(data);

    case 'stock-movement':
      return prepareStockMovementExport(data);

    default:
      return { data: [], headers: [] };
  }
};

/**
 * Stock Movement Report export. Matches on-screen: Date, Transaction Type, Qty In, Qty Out, Balance, Reference.
 * One Opening row and Totals row per product; quantities numeric (0 not "-").
 */
const prepareStockMovementExport = (data) => {
  const exportData = [];
  const period = data.period || {};
  const startEnd = period.startDate && period.endDate ? `${period.startDate} to ${period.endDate}` : '';

  (data.productMovements || []).forEach((pm) => {
    const productName = pm.product?.name || '';
    const sku = pm.product?.sku || '';
    exportData.push({
      productName,
      sku,
      date: period.startDate || '',
      transactionType: 'Opening Balance',
      qtyIn: 0,
      qtyOut: 0,
      balance: pm.openingBalance ?? 0,
      reference: '—'
    });
    (pm.movements || []).forEach((m) => {
      exportData.push({
        productName,
        sku,
        date: m.date ? new Date(m.date).toISOString().split('T')[0] : '',
        transactionType: m.transactionType || '',
        qtyIn: m.qtyIn ?? 0,
        qtyOut: m.qtyOut ?? 0,
        balance: m.balance ?? 0,
        reference: m.reference || '—'
      });
    });
    const totals = pm.totals || {};
    const netVal = (totals.qtyIn ?? 0) - (totals.qtyOut ?? 0);
    const netDisplay = Math.abs(netVal);
    const netDir = netVal >= 0 ? 'in' : 'out';
    exportData.push({
      productName,
      sku,
      date: '',
      transactionType: 'TOTALS',
      qtyIn: totals.qtyIn ?? 0,
      qtyOut: totals.qtyOut ?? 0,
      balance: pm.closingBalance ?? 0,
      reference: `NET: ${netDisplay} (${netDir})`
    });
  });

  const headers = [
    { key: 'productName', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'date', label: 'Date' },
    { key: 'transactionType', label: 'Transaction Type' },
    { key: 'qtyIn', label: 'Qty In' },
    { key: 'qtyOut', label: 'Qty Out' },
    { key: 'balance', label: 'Balance' },
    { key: 'reference', label: 'Reference' }
  ];

  return {
    data: exportData,
    headers,
    title: 'Stock Movement Report',
    subtitle: startEnd ? `Period: ${startEnd}` : '',
    summaryData: { 'Period': startEnd }
  };
};

/**
 * Prepare income statement data for export.
 * Revenue: one line "Sales Revenue" (from API revenue.lineItems or revenue.total).
 */
const prepareIncomeStatementExport = (data) => {
  const exportData = [];
  const revenueTotal = data.revenue?.total ?? data.totalRevenue ?? 0;
  const revenueCategories = data.revenue?.categories ?? (
    (data.revenue?.lineItems || []).reduce((acc, item) => {
      const label = item.label || 'Sales Revenue';
      acc[label] = (acc[label] || 0) + (item.amount || 0);
      return acc;
    }, {})
  );
  if (Object.keys(revenueCategories).length === 0 && revenueTotal > 0) {
    revenueCategories['Sales Revenue'] = revenueTotal;
  }

  Object.entries(revenueCategories).forEach(([category, amount]) => {
    exportData.push({
      type: 'Revenue',
      category,
      amount,
      percentage: revenueTotal > 0 ? ((amount / revenueTotal) * 100).toFixed(2) : '0.00'
    });
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Total Revenue',
    amount: revenueTotal,
    percentage: '100.00'
  });

  const cogsTotal = data.cogs?.total ?? data.cogs?.costOfProductsSold ?? 0;
  const grossProfit = revenueTotal - cogsTotal;
  exportData.push({
    type: 'COGS',
    category: 'Cost of Goods Sold',
    amount: cogsTotal,
    percentage: revenueTotal > 0 ? ((cogsTotal / revenueTotal) * 100).toFixed(2) : '0.00'
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Gross Profit',
    amount: grossProfit,
    percentage: revenueTotal > 0 ? ((grossProfit / revenueTotal) * 100).toFixed(2) : '0.00'
  });

  const expensesTotal = data.expenses?.total ?? data.totalOperatingExpenses ?? 0;
  const expensesCategories = data.expenses?.categories ?? (
    Array.isArray(data.operatingExpenses?.categories)
      ? data.operatingExpenses.categories.reduce((acc, cat) => {
          const name = cat.category || cat.accountName || 'Other';
          acc[name] = (acc[name] || 0) + (cat.amount || 0);
          return acc;
        }, {})
      : {}
  );

  Object.entries(expensesCategories).forEach(([category, amount]) => {
    exportData.push({
      type: 'Expense',
      category,
      amount,
      percentage: revenueTotal > 0 ? ((amount / revenueTotal) * 100).toFixed(2) : '0.00'
    });
  });
  exportData.push({
    type: 'Subtotal',
    category: 'Total Expenses',
    amount: expensesTotal,
    percentage: revenueTotal > 0 ? ((expensesTotal / revenueTotal) * 100).toFixed(2) : '0.00'
  });

  // Net Profit / Loss = Gross Profit – Total Operating Expenses
  const netProfitLoss = typeof data.operatingIncome === 'object' && data.operatingIncome != null && 'amount' in data.operatingIncome
    ? data.operatingIncome.amount
    : (data.operatingIncome ?? (grossProfit - expensesTotal));
  exportData.push({
    type: 'Total',
    category: 'Net Profit / Loss',
    amount: netProfitLoss,
    percentage: revenueTotal > 0 ? ((netProfitLoss / revenueTotal) * 100).toFixed(2) : '0.00'
  });

  const headers = [
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'percentage', label: 'Percentage of Revenue', format: 'percent' }
  ];

  const period = data.period || {};
  const periodLabel = [period.startDate, period.endDate].filter(Boolean).join(' to ') || 'Period';
  const summaryData = {
    'Period': periodLabel,
    'Total Revenue': revenueTotal,
    'Total Expenses': expensesTotal,
    'Net Profit / Loss': netProfitLoss,
    'Profit Margin': revenueTotal > 0 ? `${((netProfitLoss / revenueTotal) * 100).toFixed(2)}%` : '0.00%'
  };

  return {
    data: exportData,
    headers,
    title: 'Profit & Loss Statement',
    subtitle: `Period: ${periodLabel}`,
    summaryData
  };
};

/**
 * Prepare balance sheet data for export
 */
const prepareBalanceSheetExport = (data) => {
  const exportData = [];
  
  // Add asset accounts
  data.assets.accounts.forEach(account => {
    exportData.push({
      section: 'Assets',
      type: 'Account',
      name: account.name,
      balance: account.balance
    });
  });
  
  // Add accounts receivable
  data.assets.accountsReceivable.items.forEach(item => {
    exportData.push({
      section: 'Assets',
      type: 'Accounts Receivable',
      name: `${item.client.name} (${item.invoiceNumber})`,
      balance: item.total
    });
  });
  
  // Add inventory items
  data.assets.inventory.items.forEach(item => {
    exportData.push({
      section: 'Assets',
      type: 'Inventory',
      name: item.name,
      balance: item.stockLevel * item.cost
    });
  });
  
  // Add asset subtotal
  exportData.push({
    section: 'Assets',
    type: 'Subtotal',
    name: 'Total Assets',
    balance: data.assets.total
  });
  
  // Add liability accounts
  data.liabilities.accounts.forEach(account => {
    exportData.push({
      section: 'Liabilities',
      type: 'Account',
      name: account.name,
      balance: account.balance
    });
  });
  
  // Add liability subtotal
  exportData.push({
    section: 'Liabilities',
    type: 'Subtotal',
    name: 'Total Liabilities',
    balance: data.liabilities.total
  });
  
  // Add equity accounts
  data.equity.accounts.forEach(account => {
    exportData.push({
      section: 'Equity',
      type: 'Account',
      name: account.name,
      balance: account.balance
    });
  });
  
  // Add equity subtotal
  exportData.push({
    section: 'Equity',
    type: 'Subtotal',
    name: 'Total Equity',
    balance: data.equity.total
  });
  
  // Add total liabilities and equity
  exportData.push({
    section: 'Total',
    type: 'Total',
    name: 'Total Liabilities & Equity',
    balance: data.totalLiabilitiesAndEquity
  });
  
  const headers = [
    { key: 'section', label: 'Section' },
    { key: 'type', label: 'Type' },
    { key: 'name', label: 'Account/Item' },
    { key: 'balance', label: 'Balance', format: 'currency' }
  ];
  
  // Summary data
  const summaryData = {
    'As of Date': data.asOfDate,
    'Total Assets': data.assets.total,
    'Total Liabilities': data.liabilities.total,
    'Total Equity': data.equity.total,
    'Balanced': Math.abs(data.assets.total - data.totalLiabilitiesAndEquity) < 0.01 
      ? 'Yes' 
      : 'No (Difference: ' + formatCurrency(Math.abs(data.assets.total - data.totalLiabilitiesAndEquity)) + ')'
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Balance Sheet',
    subtitle: `As of ${data.asOfDate}`,
    summaryData
  };
};

/**
 * Prepare cash flow data for export (Direct Method).
 * Supports: cashInflows.lineItems/total, cashOutflows.lineItems/total, openingCashBalance, closingCashBalance, netCashFlow.
 */
const prepareCashFlowExport = (data) => {
  const exportData = [];
  const period = data.period || {};
  const startEnd = period.startDate && period.endDate ? `${period.startDate} to ${period.endDate}` : '';

  // Direct Method: Cash Inflows
  const inflows = data.cashInflows || {};
  const inflowLineItems = inflows.lineItems?.length > 0
    ? inflows.lineItems
    : [
        ...(inflows.cashFromCustomerPayments > 0 || inflows.customerPayments > 0
          ? [{ label: 'Cash from Customer Payments', value: inflows.cashFromCustomerPayments ?? inflows.customerPayments ?? 0 }] : []),
        ...(inflows.otherCashReceipts > 0 ? [{ label: 'Other Cash Receipts', value: inflows.otherCashReceipts }] : [])
      ].filter(i => (i.value || 0) > 0);

  exportData.push({ section: 'CASH INFLOWS', description: '', amount: '' });
  inflowLineItems.forEach(item => {
    exportData.push({
      section: 'CASH INFLOWS',
      description: item.label || '',
      amount: item.value ?? 0
    });
  });
  exportData.push({
    section: 'CASH INFLOWS',
    description: 'Total Cash Inflows',
    amount: inflows.total ?? inflowLineItems.reduce((s, i) => s + (i.value || 0), 0)
  });

  // Direct Method: Cash Outflows
  const outflows = data.cashOutflows || {};
  const outflowLineItems = outflows.lineItems?.length > 0 ? outflows.lineItems : [
    ...(outflows.paymentsToSuppliers > 0 || outflows.supplierPayments > 0
      ? [{ label: 'Payments to Suppliers', value: outflows.paymentsToSuppliers ?? outflows.supplierPayments ?? 0 }] : []),
    ...(outflows.salaryPayments > 0 ? [{ label: 'Salary Payments', value: outflows.salaryPayments }] : []),
    ...(outflows.rentPayments > 0 ? [{ label: 'Rent Payments', value: outflows.rentPayments }] : []),
    ...(outflows.otherExpensePayments > 0 ? [{ label: 'Other Expense Payments', value: outflows.otherExpensePayments }] : []),
    ...(outflows.assetPurchases > 0 ? [{ label: 'Asset Purchases', value: outflows.assetPurchases }] : []),
    ...(outflows.loanPayments > 0 ? [{ label: 'Loan Payments', value: outflows.loanPayments }] : [])
  ].filter(i => (i.value || 0) > 0);

  exportData.push({ section: 'CASH OUTFLOWS', description: '', amount: '' });
  outflowLineItems.forEach(item => {
    exportData.push({
      section: 'CASH OUTFLOWS',
      description: item.label || '',
      amount: -(item.value ?? 0)
    });
  });
  exportData.push({
    section: 'CASH OUTFLOWS',
    description: 'Total Cash Outflows',
    amount: -(outflows.total ?? outflowLineItems.reduce((s, i) => s + (i.value || 0), 0))
  });

  const netCashFlow = data.netCashFlow ?? (inflows.total - (outflows.total ?? 0));
  const openingBalance = data.openingCashBalance ?? data.cashBalances?.openingBalance ?? data.summary?.openingCashBalance ?? data.beginningCashBalance ?? 0;
  const closingBalance = data.closingCashBalance ?? data.cashBalances?.closingBalance ?? data.summary?.closingCashBalance ?? data.endingCashBalance ?? 0;

  exportData.push({ section: 'NET CASH FLOW', description: 'Net Cash Flow', amount: netCashFlow });
  exportData.push({ section: 'CASH BALANCES', description: 'Opening Cash Balance', amount: openingBalance });
  exportData.push({ section: 'CASH BALANCES', description: 'Add: Net Cash Flow', amount: netCashFlow });
  exportData.push({ section: 'CASH BALANCES', description: 'Closing Cash Balance', amount: closingBalance });

  const headers = [
    { key: 'section', label: 'Section' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', format: 'currency' }
  ];

  const summaryData = {
    'Period': startEnd,
    'Total Cash Inflows': inflows.total ?? 0,
    'Total Cash Outflows': outflows.total ?? 0,
    'Net Cash Flow': netCashFlow,
    'Opening Cash Balance': openingBalance,
    'Closing Cash Balance': closingBalance
  };

  return {
    data: exportData,
    headers,
    title: 'Cash Flow Statement (Direct Method)',
    subtitle: startEnd ? `Period: ${startEnd}` : '',
    summaryData
  };
};

/**
 * Prepare tax summary data for export
 */
const prepareTaxSummaryExport = (data) => {
  const exportData = [];
  
  // Add collected taxes by rate
  data.collectedTaxes.byRate.forEach(taxRate => {
    // Add tax rate header
    exportData.push({
      section: 'Collected Taxes',
      type: 'Tax Rate',
      description: `Tax Rate: ${taxRate.rate}%`,
      taxableAmount: taxRate.taxableAmount,
      taxAmount: taxRate.taxAmount
    });
    
    // Add individual items for this tax rate
    taxRate.items.forEach(item => {
      exportData.push({
        section: 'Collected Taxes',
        type: 'Item',
        description: `${item.type === 'invoice' ? 'Invoice' : 'Sale'}: ${item.description}`,
        taxableAmount: item.taxableAmount,
        taxAmount: item.taxAmount
      });
    });
  });
  
  // Add collected taxes total
  exportData.push({
    section: 'Collected Taxes',
    type: 'Total',
    description: 'Total Collected Taxes',
    taxableAmount: data.collectedTaxes.totalTaxableAmount,
    taxAmount: data.collectedTaxes.totalCollectedTax
  });
  
  // Add paid taxes
  data.paidTaxes.expenses.forEach(expense => {
    exportData.push({
      section: 'Paid Taxes',
      type: 'Expense',
      description: expense.description,
      taxableAmount: null,
      taxAmount: expense.amount
    });
  });
  
  // Add paid taxes total
  exportData.push({
    section: 'Paid Taxes',
    type: 'Total',
    description: 'Total Paid Taxes',
    taxableAmount: null,
    taxAmount: data.paidTaxes.totalTaxPaid
  });
  
  // Add net tax liability
  exportData.push({
    section: 'Summary',
    type: 'Net',
    description: 'Net Tax Liability',
    taxableAmount: null,
    taxAmount: data.netTaxLiability
  });
  
  const headers = [
    { key: 'section', label: 'Section' },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'taxableAmount', label: 'Taxable Amount', format: 'currency' },
    { key: 'taxAmount', label: 'Tax Amount', format: 'currency' }
  ];
  
  // Summary data
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Total Collected Tax': data.collectedTaxes.totalCollectedTax,
    'Total Taxable Amount': data.collectedTaxes.totalTaxableAmount,
    'Total Tax Paid': data.paidTaxes.totalTaxPaid,
    'Net Tax Liability': data.netTaxLiability
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Tax Summary Report',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
    summaryData
  };
};

/**
 * Prepare expenses data for export
 */
const prepareExpensesExport = (data) => {
  const exportData = [];
  
  // Add all expense entries
  data.expenses.forEach(expense => {
    exportData.push({
      date: new Date(expense.date).toLocaleDateString(),
      category: expense.category,
      description: expense.description,
      merchant: expense.merchant || 'N/A',
      submittedBy: expense.submittedBy?.name || 'Unknown',
      status: expense.status,
      amount: expense.amount
    });
  });
  
  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'merchant', label: 'Merchant' },
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount', format: 'currency' }
  ];
  
  // Summary data
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Total Expenses': data.summary.totalExpenses,
    'Number of Expenses': data.summary.expenseCount,
    'Categories Count': data.summary.availableCategories.length
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Expense Report',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
    summaryData
  };
};

/**
 * Prepare sales data for export
 */
const prepareSalesExport = (data) => {
  const exportData = [];
  
  // Process sales by date
  data.salesByDate.forEach(day => {
    exportData.push({
      type: 'Daily Summary',
      date: day.date,
      sales: day.sales,
      invoices: day.invoices,
      revenue: day.totalRevenue,
      tax: day.totalTax
    });
  });
  
  const headers = [
    { key: 'type', label: 'Type' },
    { key: 'date', label: 'Date' },
    { key: 'sales', label: 'Sales Count' },
    { key: 'invoices', label: 'Invoice Count' },
    { key: 'revenue', label: 'Revenue', format: 'currency' },
    { key: 'tax', label: 'Tax', format: 'currency' }
  ];
  
  // Summary data
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Total Revenue': data.summary.totalRevenue,
    'Total Sales': data.summary.totalSalesCount,
    'Total Invoices': data.summary.totalInvoiceCount,
    'Average Sale Value': data.summary.averageSaleValue,
    'Total Tax Collected': data.summary.totalTax
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Sales Report',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
    summaryData
  };
};

/**
 * Prepare financial ratios data for export
 */
const prepareRatiosExport = (data) => {
  const exportData = [];
  
  // Add profitability ratios
  Object.entries(data.profitabilityRatios).forEach(([key, ratio]) => {
    exportData.push({
      category: 'Profitability',
      ratio: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: ratio.value,
      interpretation: ratio.interpretation,
      description: ratio.description
    });
  });
  
  // Add liquidity ratios
  Object.entries(data.liquidityRatios).forEach(([key, ratio]) => {
    exportData.push({
      category: 'Liquidity',
      ratio: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: ratio.value,
      interpretation: ratio.interpretation,
      description: ratio.description
    });
  });
  
  // Add solvency ratios
  Object.entries(data.solvencyRatios).forEach(([key, ratio]) => {
    exportData.push({
      category: 'Solvency',
      ratio: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: ratio.value,
      interpretation: ratio.interpretation,
      description: ratio.description
    });
  });
  
  // Add efficiency ratios
  Object.entries(data.efficiencyRatios).forEach(([key, ratio]) => {
    exportData.push({
      category: 'Efficiency',
      ratio: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: ratio.value,
      interpretation: ratio.interpretation,
      description: ratio.description
    });
  });
  
  const headers = [
    { key: 'category', label: 'Category' },
    { key: 'ratio', label: 'Ratio' },
    { key: 'value', label: 'Value' },
    { key: 'interpretation', label: 'Interpretation' },
    { key: 'description', label: 'Description' }
  ];
  
  // Summary data for the raw financial data used to calculate ratios
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Revenue': data.rawData.revenue,
    'Expenses': data.rawData.expenses,
    'Gross Profit': data.rawData.grossProfit,
    'Current Assets': data.rawData.currentAssets,
    'Current Liabilities': data.rawData.currentLiabilities,
    'Accounts Receivable': data.rawData.accountsReceivable,
    'Inventory': data.rawData.inventory
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Financial Ratios Report',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
    summaryData
  };
};