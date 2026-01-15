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
      // If it's an array of {label, value} objects
      summaryData.forEach(item => {
        summaryTableData.push([item.label || String(item), item.value || '']);
      });
    } else if (typeof summaryData === 'object' && summaryData !== null) {
      // If it's an object with key-value pairs
      Object.entries(summaryData).forEach(([key, value]) => {
        // Format the key for display
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
          .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
          
        // Format the value based on its type
        let formattedValue = value;
        if (typeof value === 'number') {
          if (key.toLowerCase().includes('total') || 
              key.toLowerCase().includes('amount') || 
              key.toLowerCase().includes('revenue') || 
              key.toLowerCase().includes('expense') ||
              key.toLowerCase().includes('profit')) {
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
      
    case 'inventory-valuation':
      return prepareInventoryExport(data);
      
    case 'financial-ratios':
      return prepareRatiosExport(data);
      
    case 'accounts-receivable-aging':
    case 'accounts-payable-aging':
      return prepareAgingExport(data);
      
    default:
      return { data: [], headers: [] };
  }
};

/**
 * Prepare income statement data for export
 */
const prepareIncomeStatementExport = (data) => {
  const exportData = [];
  
  // Add revenue items
  Object.entries(data.revenue.categories).forEach(([category, amount]) => {
    exportData.push({
      type: 'Revenue',
      category,
      amount,
      percentage: data.revenue.total > 0 
        ? ((amount / data.revenue.total) * 100).toFixed(2) 
        : '0.00'
    });
  });
  
  // Add revenue subtotal
  exportData.push({
    type: 'Subtotal',
    category: 'Total Revenue',
    amount: data.revenue.total,
    percentage: '100.00'
  });
  
  // Add expenses items
  Object.entries(data.expenses.categories).forEach(([category, amount]) => {
    exportData.push({
      type: 'Expense',
      category,
      amount,
      percentage: data.revenue.total > 0 
        ? ((amount / data.revenue.total) * 100).toFixed(2) 
        : '0.00'
    });
  });
  
  // Add expenses subtotal
  exportData.push({
    type: 'Subtotal',
    category: 'Total Expenses',
    amount: data.expenses.total,
    percentage: data.revenue.total > 0 
      ? ((data.expenses.total / data.revenue.total) * 100).toFixed(2) 
      : '0.00'
  });
  
  // Add net income
  exportData.push({
    type: 'Total',
    category: 'Net Income',
    amount: data.netIncome,
    percentage: data.revenue.total > 0 
      ? ((data.netIncome / data.revenue.total) * 100).toFixed(2) 
      : '0.00'
  });
  
  const headers = [
    { key: 'type', label: 'Type' },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'percentage', label: 'Percentage of Revenue', format: 'percent' }
  ];
  
  // Summary data
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Total Revenue': data.revenue.total,
    'Total Expenses': data.expenses.total,
    'Net Income': data.netIncome,
    'Profit Margin': data.revenue.total > 0 
      ? `${((data.netIncome / data.revenue.total) * 100).toFixed(2)}%` 
      : '0.00%'
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Profit & Loss Statement',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
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
 * Prepare cash flow data for export
 */
const prepareCashFlowExport = (data) => {
  const exportData = [];
  
  // Add operating activities
  data.operatingActivities.forEach(activity => {
    exportData.push({
      section: 'Operating Activities',
      description: activity.description,
      amount: activity.amount
    });
  });
  
  // Add operating subtotal
  exportData.push({
    section: 'Operating Activities',
    description: 'Net Cash from Operating Activities',
    amount: data.operatingCashFlow
  });
  
  // Add investing activities
  data.investingActivities.forEach(activity => {
    exportData.push({
      section: 'Investing Activities',
      description: activity.description,
      amount: activity.amount
    });
  });
  
  // Add investing subtotal
  exportData.push({
    section: 'Investing Activities',
    description: 'Net Cash from Investing Activities',
    amount: data.investingCashFlow
  });
  
  // Add financing activities
  data.financingActivities.forEach(activity => {
    exportData.push({
      section: 'Financing Activities',
      description: activity.description,
      amount: activity.amount
    });
  });
  
  // Add financing subtotal
  exportData.push({
    section: 'Financing Activities',
    description: 'Net Cash from Financing Activities',
    amount: data.financingCashFlow
  });
  
  // Add cash reconciliation
  exportData.push({
    section: 'Cash Reconciliation',
    description: 'Beginning Cash Balance',
    amount: data.beginningCashBalance
  });
  
  exportData.push({
    section: 'Cash Reconciliation',
    description: 'Net Change in Cash',
    amount: data.netCashFlow
  });
  
  exportData.push({
    section: 'Cash Reconciliation',
    description: 'Ending Cash Balance',
    amount: data.endingCashBalance
  });
  
  const headers = [
    { key: 'section', label: 'Section' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', format: 'currency' }
  ];
  
  // Summary data
  const summaryData = {
    'Period': `${data.period.startDate} to ${data.period.endDate}`,
    'Beginning Cash Balance': data.beginningCashBalance,
    'Net Cash from Operations': data.operatingCashFlow,
    'Net Cash from Investing': data.investingCashFlow,
    'Net Cash from Financing': data.financingCashFlow,
    'Net Change in Cash': data.netCashFlow,
    'Ending Cash Balance': data.endingCashBalance
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Cash Flow Statement',
    subtitle: `Period: ${data.period.startDate} to ${data.period.endDate}`,
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
 * Prepare inventory data for export
 */
const prepareInventoryExport = (data) => {
  const exportData = [];
  
  // Add all inventory items
  data.inventoryItems.forEach(item => {
    exportData.push({
      name: item.name,
      sku: item.sku || 'N/A',
      category: item.category || 'Uncategorized',
      stockLevel: item.stockLevel,
      cost: item.cost,
      stockValue: item.stockValue,
      reorderPoint: item.reorderPoint || 'Not set',
      status: item.stockStatus
    });
  });
  
  const headers = [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'stockLevel', label: 'Stock Level' },
    { key: 'cost', label: 'Unit Cost', format: 'currency' },
    { key: 'stockValue', label: 'Stock Value', format: 'currency' },
    { key: 'reorderPoint', label: 'Reorder Point' },
    { key: 'status', label: 'Status' }
  ];
  
  // Summary data
  const summaryData = {
    'Generated On': new Date(data.generatedAt).toLocaleDateString(),
    'Total Inventory Value': data.summary.totalInventoryValue,
    'Total Items in Stock': data.summary.totalInventoryCount,
    'Product Count': data.summary.productCount,
    'Low Stock Items': data.summary.lowStockCount
  };
  
  return { 
    data: exportData, 
    headers,
    title: 'Inventory Valuation Report',
    subtitle: `As of ${new Date(data.generatedAt).toLocaleDateString()}`,
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

/**
 * Prepare aging report data for export
 */
const prepareAgingExport = (data) => {
  const type = data.type || 'receivable';
  const isReceivable = type === 'receivable';
  
  const exportData = [];
  
  // Add all entries
  data.items.forEach(item => {
    const entity = isReceivable ? item.client : item.vendor;
    
    exportData.push({
      date: new Date(isReceivable ? item.issueDate : item.date).toLocaleDateString(),
      dueDate: new Date(item.dueDate).toLocaleDateString(),
      reference: isReceivable ? item.invoiceNumber : item.reference,
      entity: entity?.name || 'Unknown',
      amount: item.amount,
      daysPastDue: Math.max(0, Math.floor((new Date() - new Date(item.dueDate)) / (1000 * 60 * 60 * 24)))
    });
  });
  
  const headers = [
    { key: 'date', label: isReceivable ? 'Invoice Date' : 'Bill Date' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'reference', label: isReceivable ? 'Invoice Number' : 'Reference' },
    { key: 'entity', label: isReceivable ? 'Customer' : 'Vendor' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'daysPastDue', label: 'Days Past Due' }
  ];
  
  // Summary data
  const summaryData = {
    'As of Date': data.asOfDate,
    'Total Outstanding': data.total,
    'Number of Items': data.items.length
  };
  
  return { 
    data: exportData, 
    headers,
    title: isReceivable ? 'Accounts Receivable Aging' : 'Accounts Payable Aging',
    subtitle: `As of ${data.asOfDate}`,
    summaryData
  };
};