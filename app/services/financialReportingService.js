// /services/financialReportingService.js

/**
 * Service for fetching and processing financial reports data
 */

import { formatCurrency } from '@/lib/currencyUtils';
import { calculateDateRange, formatYmdInTimeZone } from '@/lib/dateUtils';

// Financial periods align to calendar year (1 January – 31 December). All annual report ranges use 1 Jan – 31 Dec.
const getDateRange = (timeframe = 'thisMonth', customDateRange = null) => {
  // Handle custom date range
  if (timeframe === 'custom' && customDateRange && customDateRange.startDate && customDateRange.endDate) {
    return {
      startDate: customDateRange.startDate,
      endDate: customDateRange.endDate
    };
  }

  const { startDate, endDate } = calculateDateRange(timeframe);
  return {
    startDate: formatYmdInTimeZone(startDate),
    endDate: formatYmdInTimeZone(endDate)
  };
};

/**
 * Fetch financial summary data
 */
export const fetchFinancialSummary = async (timeframe, customDateRange = null) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/summary?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching financial summary: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    throw error;
  }
};

/**
 * Fetch income statement (profit & loss) data
 */
export const fetchIncomeStatement = async ({ timeframe, compareWithPrevious = false, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/income-statement?startDate=${startDate}&endDate=${endDate}`;
    
    if (compareWithPrevious) {
      url += '&compare=true';
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching income statement: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching income statement:', error);
    throw error;
  }
};

/**
 * Fetch balance sheet data
 */
export const fetchBalanceSheet = async ({ timeframe, customDateRange = null }) => {
  try {
    const { endDate } = getDateRange(timeframe, customDateRange);
    
    // endDate is already in YYYY-MM-DD format from getDateRange, so use it directly
    // Only convert if it's not already in the correct format
    const asOfDate = endDate || formatYmdInTimeZone(new Date());
    
    console.log('Balance Sheet - Timeframe:', timeframe, 'AsOfDate:', asOfDate);
    
    const response = await fetch(`/api/reports/balance-sheet?asOfDate=${encodeURIComponent(asOfDate)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error fetching balance sheet: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching balance sheet:', error);
    throw error;
  }
};

/**
 * Fetch cash flow statement data
 */
export const fetchCashFlowStatement = async ({ timeframe, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching cash flow statement: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching cash flow statement:', error);
    throw error;
  }
};

/**
 * Fetch tax summary data
 */
export const fetchTaxSummary = async ({ timeframe, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/tax-summary?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching tax summary: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching tax summary:', error);
    throw error;
  }
};

/**
 * Fetch accounts receivable aging data
 */
export const fetchAccountsReceivableAging = async () => {
  try {
    const response = await fetch('/api/reports/accounts-receivable-aging');
    
    if (!response.ok) {
      throw new Error(`Error fetching accounts receivable aging: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching accounts receivable aging:', error);
    throw error;
  }
};

/**
 * Fetch accounts payable aging data
 */
export const fetchAccountsPayableAging = async () => {
  try {
    const response = await fetch('/api/reports/accounts-payable-aging');
    
    if (!response.ok) {
      throw new Error(`Error fetching accounts payable aging: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching accounts payable aging:', error);
    throw error;
  }
};

/**
 * Fetch expense report data
 */
export const fetchExpenseReport = async ({ timeframe, category, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/expenses?startDate=${startDate}&endDate=${endDate}`;
    
    if (category) {
      url += `&category=${category}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching expense report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching expense report:', error);
    throw error;
  }
};

/**
 * Fetch sales report data
 */
export const fetchSalesReport = async ({ timeframe, groupBy = 'day', customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sales report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sales report:', error);
    throw error;
  }
};

/**
 * Fetch inventory valuation data
 */
export const fetchInventoryValuation = async () => {
  try {
    const response = await fetch('/api/reports/inventory-valuation');
    
    if (!response.ok) {
      throw new Error(`Error fetching inventory valuation: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching inventory valuation:', error);
    throw error;
  }
};

/**
 * Fetch financial ratios data
 */
export const fetchFinancialRatios = async ({ timeframe, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/financial-ratios?startDate=${startDate}&endDate=${endDate}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching financial ratios: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching financial ratios:', error);
    throw error;
  }
};

/**
 * Fetch stock movement report data
 */
export const fetchStockMovement = async ({ timeframe, productId = null, customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/stock-movement?startDate=${startDate}&endDate=${endDate}`;
    if (productId) {
      url += `&productId=${productId}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error fetching stock movement report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stock movement report:', error);
    throw error;
  }
};

/**
 * Fetch Daily POS report for a single date (default: today).
 * @param {string} [date] - YYYY-MM-DD; defaults to today
 */
export const fetchPosDailyReport = async (date = null) => {
  try {
    const d = date ? new Date(date) : new Date();
    const dateStr = formatYmdInTimeZone(d);
    const response = await fetch(`/api/reports/pos-daily?date=${dateStr}`);
    if (!response.ok) {
      throw new Error(`Error fetching daily POS report: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching daily POS report:', error);
    throw error;
  }
};

/**
 * Fetch sales analysis report data
 */
export const fetchSalesAnalysis = async ({ timeframe, groupBy = 'time', customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/sales-analysis?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching sales analysis report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching sales analysis report:', error);
    throw error;
  }
};

/**
 * Fetch expense analysis report data
 */
export const fetchExpenseAnalysis = async ({ timeframe, groupBy = 'category', customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/expense-analysis?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching expense analysis report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching expense analysis report:', error);
    throw error;
  }
};

/**
 * Fetch profitability analysis report data
 */
export const fetchProfitabilityAnalysis = async ({ timeframe, groupBy = 'product', customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(`/api/reports/profitability-analysis?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching profitability analysis report: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching profitability analysis report:', error);
    throw error;
  }
};

/**
 * Fetch financial analytics (graphs + KPIs)
 */
export const fetchFinancialAnalytics = async ({ timeframe, groupBy = 'month', customDateRange = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const params = new URLSearchParams({
      startDate,
      endDate,
      groupBy
    });
    
    const response = await fetch(`/api/reports/financial-analytics?${params.toString()}`);
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error fetching financial analytics: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching financial analytics:', error);
    throw error;
  }
};

/**
 * Fetch available reports
 */
export const fetchAvailableReports = async () => {
  try {
    const response = await fetch('/api/reports/available');
    
    if (!response.ok) {
      throw new Error(`Error fetching available reports: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching available reports:', error);
    throw new Error('Failed to load available reports');
  }
};

/**
 * Export a report
 */
export const exportReport = async (reportType, format, params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    // Add timeframe params if provided
    if (params.timeframe) {
      const { startDate, endDate } = getDateRange(params.timeframe, params.customDateRange);
      queryParams.append('startDate', startDate);
      queryParams.append('endDate', endDate);
    }
    
    // Add any other params
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'timeframe') {
        queryParams.append(key, value);
      }
    });
    
    queryParams.append('format', format);
    
    const url = `/api/reports/${reportType}/export?${queryParams.toString()}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error exporting report: ${response.statusText}`);
    }
    
    // Handle the downloaded file
    const blob = await response.blob();
    let fileName = `${reportType}_${formatYmdInTimeZone(new Date())}.${format}`;
    if (reportType === 'pos-daily' && params.date) {
      fileName = `POS_DAILY_REPORT_${params.date}.${format === 'xlsx' ? 'xlsx' : format}`;
    }
    
    // Create a download link and trigger download
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error(`Error exporting ${reportType} report:`, error);
    throw error;
  }
};