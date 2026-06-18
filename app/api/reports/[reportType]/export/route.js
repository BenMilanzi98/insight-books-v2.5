// app/api/reports/[reportType]/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { stripEmbeddedPeriodFromReportLabel, parseInclusiveApiYmdRange, formatYmdInTimeZone } from '@/lib/dateUtils';
import { getSalesRevenueForPeriod } from '@/lib/incomeStatementService';
import * as XLSX from 'xlsx';
import { RETIRED_REPORT_IDS, retiredReportResponse } from '@/lib/retiredReports';
import {
  appendReconciliationRowsForHeaders,
  appendReconciliationToExcelWorksheet,
  fetchExpenseExportReconciliation,
  fetchSalesExportReconciliation,
  mergeReconciliationColumnHeaders,
} from '@/lib/reportExportReconciliation';
import {
  normalizeReportYmdParam,
  validInvoiceReportWhereScoped,
  validSaleReportWhereScoped,
} from '@/lib/reportingSourceRules';
import {
  invoiceNetRevenueTotalExTax,
  saleNetRevenueTotalExTax,
} from '@/lib/reportLineNetRevenue';
import { addMoney, parseMoney, roundMoney, subtractMoney } from '@/lib/money';
<<<<<<< Updated upstream
=======
import { filterNonZeroOperatingExpenseLines } from '@/lib/incomeStatementOperatingAccountDisplay';
import { bootstrapReportRoute, auditReportAccess, tenantNameMap } from '@/lib/reportRouteBootstrap';
import { generateScopedIncomeStatement, generateScopedBalanceSheet } from '@/lib/reportingEngine/multiTenantReporting';
import { buildExportHeaderRows, prependHeaderRowsToCsv } from '@/lib/reportExportScope';

const BUSINESS_EXPORT_HEADER = { key: 'business', label: 'Business' };

function prependBusinessHeader(headers, multiTenant) {
  if (!multiTenant || headers.some((h) => h.key === 'business')) return headers;
  return [BUSINESS_EXPORT_HEADER, ...headers];
}

async function mergePerTenantExportReconciliation(fetchFn, {
  tenantIds,
  tenants,
  getOperationalAmount,
  ...rest
}) {
  if (tenantIds.length <= 1) {
    return fetchFn({
      tenantId: tenantIds[0],
      operationalTotal: getOperationalAmount?.(tenantIds[0]),
      operationalRevenue: getOperationalAmount?.(tenantIds[0]),
      ...rest,
    });
  }
  const tMap = tenantNameMap(tenants);
  const mergedItems = [];
  for (const tenantId of tenantIds) {
    try {
      const amount = getOperationalAmount?.(tenantId) ?? 0;
      const rec = await fetchFn({
        tenantId,
        operationalTotal: amount,
        operationalRevenue: amount,
        ...rest,
      });
      if (rec?.items?.length) {
        for (const item of rec.items) {
          mergedItems.push({
            ...item,
            label: `${tMap.get(tenantId) || tenantId}: ${item.label}`,
          });
        }
      }
    } catch (err) {
      console.warn(`Export reconciliation failed for tenant ${tenantId}:`, err?.message || err);
    }
  }
  if (!mergedItems.length) return null;
  return {
    items: mergedItems,
    reconciled: mergedItems.every((i) => i.reconciled),
  };
}
>>>>>>> Stashed changes

/**
 * GET handler for exporting various reports
 * Supports CSV, XLSX, and PDF formats
 */
export async function GET(request, context) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const {
      user,
      tenantIds,
      tenants,
      scope,
      primaryTenantId,
      reportBranchId,
      tw,
      reportingCurrency,
    } = boot;

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
    const exportFilters = { startDate, endDate };
    let exportScope = scope;
    let exportHeaderRows = buildExportHeaderRows(scope, exportFilters);
    const multiTenant = tenantIds.length > 1;
    const tMap = tenantNameMap(tenants);
    
    // Get report data based on type
    let reportData;
    let headers;
    let title;
    let exportReconciliation = null;
    
    switch (reportType) {
      case 'income-statement':
      case 'profit-loss': {
        const statement = await generateScopedIncomeStatement({
          tenantIds,
          tenants,
          startDate,
          endDate,
          branchId: reportBranchId,
          scope,
          reportingCurrency,
        });
        exportScope = { ...scope, consolidation: statement.consolidation || scope.consolidation };
        exportHeaderRows = buildExportHeaderRows(exportScope, exportFilters);

        await auditReportAccess({
          user,
          reportType: reportType === 'profit-loss' ? 'profit-loss' : 'income-statement',
          tenantIds,
          scope,
          filters: exportFilters,
          format,
        });

        if (format.toLowerCase() === 'pdf') {
          return await generateIncomeStatementPDF(
            primaryTenantId,
            startDate,
            endDate,
            request,
            { statement, scope, headerRows: exportHeaderRows }
          );
        }
        if (format.toLowerCase() === 'xlsx' || format.toLowerCase() === 'csv') {
          if (format.toLowerCase() === 'xlsx') {
            return await generateIncomeStatementExcelResponse(
              statement,
              startDate,
              endDate,
              'income-statement.xlsx',
              exportHeaderRows
            );
          }
          exportReconciliation = statement?.metadata?.reconciliation ?? null;
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
        reportData = await generateIncomeStatementData(primaryTenantId, startDate, endDate);
        headers = [
          { key: 'type', label: 'Type' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount' },
          { key: 'percentage', label: 'Percentage of Revenue' }
        ];
        title = 'Profit & Loss Statement';
        break;
      }
        
      case 'balance-sheet':
        if (format.toLowerCase() === 'pdf') {
          const scopedSheet =
            tenantIds.length > 1
              ? await generateScopedBalanceSheet({
                  tenantIds,
                  tenants,
                  asOfDate: endDate,
                  branchId: reportBranchId,
                  scope,
                  reportingCurrency,
                })
              : null;
          await auditReportAccess({
            user,
            reportType: 'balance-sheet',
            tenantIds,
            scope,
            filters: exportFilters,
            format,
          });
          return await generateBalanceSheetPDF(primaryTenantId, endDate, request, {
            statement: scopedSheet || undefined,
            scope,
            headerRows: exportHeaderRows,
            byTenant: scopedSheet?.byTenant || null,
          });
        }
        // For CSV/XLSX, use scoped generator when multiple businesses are selected
        if (tenantIds.length > 1) {
          const scopedSheet = await generateScopedBalanceSheet({
            tenantIds,
            tenants,
            asOfDate: endDate,
            branchId: reportBranchId,
            scope,
            reportingCurrency,
          });
          exportScope = { ...scope, consolidation: scopedSheet.consolidation || scope.consolidation };
          exportHeaderRows = buildExportHeaderRows(exportScope, exportFilters);
          reportData = balanceSheetToExportRows(scopedSheet);
          exportReconciliation = scopedSheet?.metadata?.reconciliation ?? null;
        } else {
          reportData = await generateBalanceSheetData(primaryTenantId, endDate, reportBranchId);
          try {
            const { generateBalanceSheetFromAccounts } = await import('@/lib/balanceSheetService');
            const tenantBs = await prisma.tenant.findUnique({
              where: { id: primaryTenantId },
              select: { name: true },
            });
            const bsFull = await generateBalanceSheetFromAccounts(
              primaryTenantId,
              endDate,
              tenantBs?.name || 'Company',
              null,
              reportBranchId
            );
            exportReconciliation = bsFull?.metadata?.reconciliation ?? null;
          } catch (_) {
            /* non-fatal */
          }
        }
        headers = [
          { key: 'section', label: 'Section' },
          { key: 'type', label: 'Type' },
          { key: 'name', label: 'Account/Item' },
          { key: 'balance', label: 'Balance' }
        ];
        title = 'Balance Sheet';
        break;
        
      case 'expenses': {
        reportData = await generateExpenseReportData({
          tw,
          startDate,
          endDate,
          branchId: reportBranchId,
          multiTenant,
          tMap,
        });
        headers = prependBusinessHeader(
          mergeReconciliationColumnHeaders([
            { key: 'date', label: 'Date' },
            { key: 'category', label: 'Category' },
            { key: 'description', label: 'Description' },
            { key: 'merchant', label: 'Merchant' },
            { key: 'submittedBy', label: 'Submitted By' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount' },
          ]),
          multiTenant
        );
        title = 'Expense Report';
        exportReconciliation = await mergePerTenantExportReconciliation(
          fetchExpenseExportReconciliation,
          {
            tenantIds,
            tenants,
            startDate,
            endDate,
            branchId: reportBranchId,
            prisma,
            getOperationalAmount: (tid) =>
              reportData
                .filter((row) => !multiTenant || row.tenantId === tid)
                .reduce((sum, row) => addMoney(sum, row.amount), 0),
          }
        );
        break;
      }

      case 'sales': {
        reportData = await generateSalesReportData({
          tw,
          startDate,
          endDate,
          branchId: reportBranchId,
          multiTenant,
          tMap,
        });
        headers = prependBusinessHeader(
          mergeReconciliationColumnHeaders([
            { key: 'date', label: 'Date' },
            { key: 'type', label: 'Type' },
            { key: 'number', label: 'Reference' },
            { key: 'customer', label: 'Customer' },
            { key: 'status', label: 'Status' },
            { key: 'total', label: 'Total' },
          ]),
          multiTenant
        );
        title = 'Sales Report';
        exportReconciliation = await mergePerTenantExportReconciliation(
          fetchSalesExportReconciliation,
          {
            tenantIds,
            tenants,
            startDate,
            endDate,
            branchId: reportBranchId,
            prisma,
            getOperationalAmount: (tid) =>
              reportData
                .filter((row) => !multiTenant || row.tenantId === tid)
                .reduce((sum, row) => addMoney(sum, row.total), 0),
          }
        );
        break;
      }
        
      case 'cash-flow':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Start date and end date are required for cash flow export' },
            { status: 400 }
          );
        }
        {
          const cashFlowExport = await generateCashFlowExportData({
            tenantIds,
            tenants,
            startDate,
            endDate,
            branchId: reportBranchId,
            multiTenant,
            tMap,
          });
          reportData = cashFlowExport.data;
          headers = prependBusinessHeader(cashFlowExport.headers, multiTenant);
          title = cashFlowExport.title;
          exportReconciliation = cashFlowExport.reconciliation;
        }
        break;

      case 'stock-movement': {
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Start date and end date are required for stock movement export' },
            { status: 400 }
          );
        }
        const stockMovementExport = await generateStockMovementExportData({
          tenantIds,
          tenants,
          startDate,
          endDate,
          productId: searchParams.get('productId') || null,
          branchId: reportBranchId,
          multiTenant,
          tMap,
        });
        reportData = stockMovementExport.data;
        headers = prependBusinessHeader(stockMovementExport.headers, multiTenant);
        title = stockMovementExport.title;
        exportReconciliation = stockMovementExport.reconciliation;
        break;
      }

      case 'inventory-losses':
        reportData = await generateInventoryLossReportData({
          tw,
          startDate,
          endDate,
          branchId: reportBranchId,
          multiTenant,
          tMap,
        });
        headers = prependBusinessHeader(
          [
            { key: 'date', label: 'Date' },
            { key: 'eventType', label: 'Event Type' },
            { key: 'description', label: 'Description' },
            { key: 'reference', label: 'Reference' },
            { key: 'branchName', label: 'Branch' },
            { key: 'submittedBy', label: 'Submitted By' },
            { key: 'amount', label: 'Amount' },
          ],
          multiTenant
        );
        title = 'Inventory Loss Report';
        break;

      case 'pos-daily': {
        const dateParam = normalizeReportYmdParam(searchParams.get('date'));
        const posExport = await generatePosDailyExportData({
          tenantIds,
          tenants,
          dateParam,
          branchId: reportBranchId,
          multiTenant,
          tMap,
        });
        reportData = posExport.data;
        headers = prependBusinessHeader(posExport.headers, multiTenant);
        title = posExport.title;
        break;
      }
        
      default:
        return NextResponse.json(
          { error: `Unsupported report type: ${reportType}` },
          { status: 400 }
        );
    }
    
    // Generate the export file based on format
    if (exportReconciliation?.items?.length && reportType !== 'income-statement' && reportType !== 'profit-loss') {
      reportData = appendReconciliationRowsForHeaders(reportData, headers, exportReconciliation);
    }

    if (reportType !== 'income-statement' && reportType !== 'profit-loss') {
      await auditReportAccess({
        user,
        reportType,
        tenantIds,
        scope,
        filters: exportFilters,
        format,
      });
    }

    switch (format.toLowerCase()) {
      case 'csv': {
        let csvResponse = generateCSVResponse(reportData, headers, `${reportType}.csv`);
        if (exportHeaderRows?.length) {
          const body = await csvResponse.text();
          csvResponse = new NextResponse(prependHeaderRowsToCsv(body, exportHeaderRows), {
            status: 200,
            headers: csvResponse.headers,
          });
        }
        return csvResponse;
      }
        
      case 'xlsx':
        return generateExcelResponse(reportData, headers, title, `${reportType}.xlsx`, exportHeaderRows);
        
      case 'pdf': {
        const tenant = tenants?.length === 1
          ? tenants[0]
          : await prisma.tenant.findUnique({
              where: { id: primaryTenantId },
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
          companyName: scope?.businessLabel || tenant?.name,
          periodLabel,
          headerRows: exportHeaderRows,
        });
      }
        
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
  const costOfGoodsSold = roundMoney(cogsStats?.totalAmount);
  const grossProfit = subtractMoney(totalRevenue, costOfGoodsSold);

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
    expensesByCategory[expense.category] = addMoney(expensesByCategory[expense.category], expense.amount);
  });
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, amount) => addMoney(sum, amount), 0);
  const netIncome = subtractMoney(grossProfit, totalExpenses);

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
async function generateBalanceSheetData(tenantId, asOfDate, branchId = null) {
  const { generateBalanceSheetFromAccounts } = await import('@/lib/balanceSheetService');
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const sheet = await generateBalanceSheetFromAccounts(
    tenantId,
    asOfDate,
    tenant?.name || 'Company',
    null,
    branchId
  );
  return balanceSheetToExportRows(sheet);
}

function balanceSheetToExportRows(sheet) {
  const rows = [];
  const pushLine = (section, type, line) => {
    rows.push({
      section,
      type,
      name: line.label,
      balance: Number(line.value || 0),
    });
  };
  (sheet.assets?.currentAssets?.lineItems || []).forEach((line) => pushLine('Assets', 'Current Asset', line));
  (sheet.assets?.nonCurrentAssets?.lineItems || []).forEach((line) => pushLine('Assets', 'Non-Current Asset', line));
  (sheet.liabilities?.currentLiabilities?.lineItems || []).forEach((line) => pushLine('Liabilities', 'Current Liability', line));
  (sheet.liabilities?.nonCurrentLiabilities?.lineItems || []).forEach((line) => pushLine('Liabilities', 'Non-Current Liability', line));
  (sheet.equity?.lineItems || []).forEach((line) => pushLine('Equity', 'Equity', line));
  rows.push(
    { section: 'Total', type: 'Assets', name: 'Total Assets', balance: sheet.totalAssets || 0 },
    { section: 'Total', type: 'Liabilities', name: 'Total Liabilities', balance: sheet.totalLiabilities || 0 },
    { section: 'Total', type: 'Equity', name: 'Total Equity', balance: sheet.totalEquity || 0 },
    {
      section: 'Total',
      type: 'Liabilities and Equity',
      name: 'Total Liabilities and Equity',
      balance: sheet.totalLiabilitiesAndEquity || 0,
    }
  );
  return rows;
}

/**
 * Generate Expense Report data for export
 */
async function generateExpenseReportData({ tw, startDate, endDate, branchId, multiTenant, tMap }) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
  const expenses = await prisma.expense.findMany({
    where: {
      ...tw,
      status: 'Approved',
      isDeleted: false,
      isReversal: false,
      date: { gte: start, lte: end },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      submittedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  return expenses.map((expense) => ({
    ...(multiTenant
      ? {
          business: tMap.get(expense.tenantId) || expense.tenantId,
          tenantId: expense.tenantId,
        }
      : {}),
    date: formatYmdInTimeZone(expense.date),
    category: expense.category,
    description: expense.description,
    merchant: expense.merchant || 'N/A',
    submittedBy: expense.submittedBy?.name || 'Unknown',
    status: expense.status,
    amount: expense.amount,
  }));
}

/**
 * Generate Inventory Loss report data for export.
 */
async function generateInventoryLossReportData({ tw, startDate, endDate, branchId, multiTenant, tMap }) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

  const normalizedBranchId =
    branchId && typeof branchId === 'object'
      ? (typeof branchId.id === 'string' ? branchId.id : null)
      : (typeof branchId === 'string' ? branchId : null);

  const where = {
    ...tw,
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
      ...(multiTenant
        ? {
            business: tMap.get(expense.tenantId) || expense.tenantId,
            tenantId: expense.tenantId,
          }
        : {}),
      date: formatYmdInTimeZone(expense.date),
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
async function generateSalesReportData({ tw, startDate, endDate, branchId, multiTenant, tMap }) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
  const sales = await prisma.sale.findMany({
    where: {
      ...validSaleReportWhereScoped(tw, 'saleDate', start, end),
      ...(branchId ? { branchId } : {}),
    },
    include: {
      client: {
        select: {
          name: true,
        },
      },
      items: true,
    },
    orderBy: {
      saleDate: 'desc',
    },
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      ...validInvoiceReportWhereScoped(tw, 'issueDate', start, end),
      ...(branchId ? { branchId } : {}),
    },
    include: {
      client: {
        select: {
          name: true,
        },
      },
      items: true,
    },
    orderBy: {
      issueDate: 'desc',
    },
  });

  const exportData = [];

  sales.forEach((sale) => {
    exportData.push({
      ...(multiTenant
        ? {
            business: tMap.get(sale.tenantId) || sale.tenantId,
            tenantId: sale.tenantId,
          }
        : {}),
      date: formatYmdInTimeZone(sale.saleDate),
      type: 'Direct Sale',
      number: sale.saleNumber,
      customer: sale.client?.name || 'Direct Customer',
      status: sale.status,
      total: saleNetRevenueTotalExTax(sale),
    });
  });

  invoices.forEach((invoice) => {
    exportData.push({
      ...(multiTenant
        ? {
            business: tMap.get(invoice.tenantId) || invoice.tenantId,
            tenantId: invoice.tenantId,
          }
        : {}),
      date: formatYmdInTimeZone(invoice.issueDate),
      type: 'Invoice',
      number: invoice.invoiceNumber,
      customer: invoice.client?.name || 'Unknown',
      status: invoice.status,
      total: invoiceNetRevenueTotalExTax(invoice),
    });
  });

  exportData.sort((a, b) => new Date(b.date) - new Date(a.date));
  return exportData;
}

async function generateCashFlowExportData({
  tenantIds,
  tenants,
  startDate,
  endDate,
  branchId,
  multiTenant,
  tMap,
}) {
  const { generateCashFlowFromAccounts } = await import('@/lib/cashFlowService');
  const { prepareExportData } = await import('@/lib/exportUtils');
  const allRows = [];
  let headers = [
    { key: 'section', label: 'Section' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', format: 'currency' },
  ];
  let title = 'Cash Flow Statement (Direct Method)';
  let reconciliation = null;

  for (const tenantId of tenantIds) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const cashFlowData = await generateCashFlowFromAccounts(
      tenantId,
      startDate,
      endDate,
      tenant?.name || 'Company',
      tenant?.logoUrl || null,
      branchId
    );
    const cashFlowExport = prepareExportData('cash-flow', cashFlowData);
    headers = cashFlowExport.headers || headers;
    title = cashFlowExport.title || title;
    if (cashFlowData?.metadata?.reconciliation?.items?.length) {
      reconciliation = reconciliation || { items: [] };
      for (const item of cashFlowData.metadata.reconciliation.items) {
        reconciliation.items.push({
          ...item,
          label: multiTenant
            ? `${tenant?.name || tenantId}: ${item.label}`
            : item.label,
        });
      }
    }
    for (const row of cashFlowExport.data || []) {
      allRows.push(
        multiTenant
          ? { business: tenant?.name || tenantId, tenantId, ...row }
          : row
      );
    }
  }

  return { data: allRows, headers, title, reconciliation };
}

async function generateStockMovementExportData({
  tenantIds,
  tenants,
  startDate,
  endDate,
  productId,
  branchId,
  multiTenant,
  tMap,
}) {
  const { generateStockMovementReport } = await import('@/lib/stockMovementService');
  const { prepareExportData } = await import('@/lib/exportUtils');
  const allRows = [];
  let headers = [
    { key: 'productName', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'date', label: 'Date' },
    { key: 'transactionType', label: 'Transaction Type' },
    { key: 'qtyIn', label: 'Qty In' },
    { key: 'qtyOut', label: 'Qty Out' },
    { key: 'balance', label: 'Balance' },
    { key: 'reference', label: 'Reference' },
  ];
  let title = 'Stock Movement Report';
  let reconciliation = null;

  for (const tenantId of tenantIds) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const stockMovementData = await generateStockMovementReport(
      tenantId,
      startDate,
      endDate,
      productId,
      branchId
    );
    const stockMovementExport = prepareExportData('stock-movement', stockMovementData);
    headers = stockMovementExport.headers || headers;
    title = stockMovementExport.title || title;
    if (stockMovementData?.metadata?.reconciliation?.items?.length) {
      reconciliation = reconciliation || { items: [] };
      for (const item of stockMovementData.metadata.reconciliation.items) {
        reconciliation.items.push({
          ...item,
          label: multiTenant
            ? `${tenant?.name || tenantId}: ${item.label}`
            : item.label,
        });
      }
    }
    for (const row of stockMovementExport.data || []) {
      allRows.push(
        multiTenant
          ? { business: tenant?.name || tenantId, tenantId, ...row }
          : row
      );
    }
  }

  return { data: allRows, headers, title, reconciliation };
}

async function generatePosDailyExportData({
  tenantIds,
  tenants,
  dateParam,
  branchId,
  multiTenant,
  tMap,
}) {
  const { generatePosDailyReport } = await import('@/lib/posDailyReportService');
  const allRows = [];

  for (const tenantId of tenantIds) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const posData = await generatePosDailyReport(tenantId, dateParam, branchId);
    const posRows = [
      { metric: 'Date', value: posData.date },
      { metric: 'Total Sales', value: posData.totalSales },
      { metric: 'Transactions', value: posData.transactionCount },
      { metric: 'Items Sold', value: posData.itemsSold },
      { metric: 'Average Sale', value: posData.averageSaleValue },
      { metric: 'Total COGS', value: posData.totalCogs ?? '' },
      { metric: 'Gross Profit', value: posData.grossProfit ?? '' },
      { metric: 'Voided', value: posData.voidedCount ?? 0 },
      { metric: 'Refunds', value: posData.refundCount ?? 0 },
    ];
    (posData.paymentBreakdown || []).forEach((p) => {
      posRows.push({ metric: `Payment: ${p.label || p.method}`, value: p.total });
    });
    posRows.push({ metric: 'Grand Total (Payments)', value: posData.paymentGrandTotal ?? 0 });
    for (const row of posRows) {
      allRows.push(
        multiTenant
          ? { business: tenant?.name || tenantId, tenantId, ...row }
          : row
      );
    }
  }

  return {
    data: allRows,
    headers: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }],
    title: multiTenant
      ? `POS Daily Report ${dateParam} (Multiple Businesses)`
      : `POS Daily Report ${dateParam}`,
  };
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

  const reconciliation = statement?.metadata?.reconciliation;
  if (reconciliation?.items?.length) {
    rows.push({ type: 'Reconciliation', category: 'General Ledger vs Operational', amount: '', percentage: '' });
    reconciliation.items.forEach((item) => {
      rows.push({
        type: 'Reconciliation',
        category: item.label,
        amount: Number(item.variance) || 0,
        percentage: item.reconciled ? 'OK' : 'Variance',
      });
    });
  }

  return rows;
}

/**
 * Generate an Excel response (generic)
 */
function generateExcelResponse(data, headers, sheetName, filename, headerRows = []) {
  const worksheetData = [];

  if (headerRows?.length) {
    for (const row of headerRows) {
      worksheetData.push({ [headers[0]?.label || 'Field']: row.label, '': row.value });
    }
    worksheetData.push({});
  }

  for (const item of data) {
    const row = {};
    headers.forEach((header) => {
      row[header.label] = item[header.key];
    });
    worksheetData.push(row);
  }

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Income Statement Excel export: one worksheet, clean layout, values only.
 * Styling: headings bold, totals bold with top border, currency format, negative in brackets.
 */
async function generateIncomeStatementExcelResponse(statement, startDate, endDate, filename = 'income-statement.xlsx', headerRows = []) {
  const ExcelJS = (await import('exceljs')).default;
  const periodLabel = startDate && endDate ? `${startDate} to ${endDate}` : (statement?.period ? `${statement.period.startDate} to ${statement.period.endDate}` : '');
  const totalRevenue = Number(statement?.totalRevenue ?? 0);
  const cogsTotal = Number(statement?.cogs?.costOfProductsSold ?? statement?.cogs?.total ?? 0);
  const grossProfit = Number(statement?.grossProfit ?? totalRevenue - cogsTotal);
  const operatingExpenses = filterNonZeroOperatingExpenseLines(statement?.operatingExpenses?.categories ?? []);
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
  for (const hdr of headerRows) {
    const r = ws.getRow(rowNum++);
    r.getCell(1).value = hdr.label;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = hdr.value;
  }
  if (headerRows.length) rowNum++;

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

  appendReconciliationToExcelWorksheet(ws, rowNum, statement?.metadata?.reconciliation);

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
  const headerRows = options.headerRows || [];
  
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

  if (headerRows.length) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    for (const hdr of headerRows) {
      doc.text(`${hdr.label}: ${hdr.value}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
    }
    yPos += 2;
  }
  
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
async function generateIncomeStatementPDF(tenantId, startDate, endDate, request, options = {}) {
  try {
    let data = options.statement;
    if (!data) {
      const { generateIncomeStatementFromAccounts } = await import('@/lib/incomeStatementService');
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, logoUrl: true }
      });
      const url = request?.url ? new URL(request.url) : null;
      const branchId = url?.searchParams?.get('branchId') || null;
      data = await generateIncomeStatementFromAccounts(
        tenantId,
        startDate,
        endDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null,
        branchId
      );
    }
    
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
    
    const companyName = options.scope?.businessLabel || data.companyName || data.company || 'Company';
    const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
    const totalRevenue = data.totalRevenue ?? data.revenue?.total ?? 0;
    const headerRows = options.headerRows || [];
    
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

    if (headerRows.length) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      for (const hdr of headerRows) {
        doc.text(`${hdr.label}: ${hdr.value}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      yPos += 2;
    }
    
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
async function generateBalanceSheetPDF(tenantId, asOfDate, request, options = {}) {
  try {
    let data = options.statement;
    if (!data) {
      const { generateBalanceSheet } = await import('@/app/api/reports/balance-sheet/route');
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          logoUrl: true,
        },
      });
      data = await generateBalanceSheet(
        tenantId,
        asOfDate,
        tenant?.name || 'Company',
        tenant?.logoUrl || null
      );
    }
    
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
    
    const companyName = options.scope?.businessLabel || data.company || data.companyName || 'Company';
    const asOfDateStr = data.asOfDate || asOfDate || '';
    const totalAssets = data.assets?.total || data.totalAssets || 0;
    const headerRows = options.headerRows || [];
    const byTenant = options.byTenant;
    
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

    if (headerRows.length) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      for (const hdr of headerRows) {
        doc.text(`${hdr.label}: ${hdr.value}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }
      yPos += 2;
    }
    
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

    if (Array.isArray(byTenant) && byTenant.length > 1) {
      yPos = (doc.lastAutoTable?.finalY ?? yPos) + 12;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Business comparison', margin, yPos);
      yPos += 4;

      autoTable(doc, {
        startY: yPos,
        head: [['Business', 'Total assets', 'Total liabilities', 'Total equity']],
        body: byTenant.map((row) => [
          row.tenantName || row.businessName || row.tenantId || '',
          formatCurrency(row.totalAssets ?? 0),
          formatCurrency(row.totalLiabilities ?? 0),
          formatCurrency(row.totalEquity ?? 0),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: margin, right: margin },
      });
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
