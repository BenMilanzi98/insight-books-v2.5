// /services/financialReportingService.js

/**
 * Service for fetching and processing financial reports data
 */

import { formatCurrency } from '@/lib/currencyUtils';
import { calculateDateRange, formatYmdInTimeZone } from '@/lib/dateUtils';
import { normalizeReportYmdParam } from '@/lib/reportingSourceRules';
import { appendBusinessScopeParams } from '@/lib/businessScopeStorage';

/** Append authorized business scope to a report API URL. */
export function withBusinessScope(url, businessScope) {
  if (!businessScope || businessScope.mode === 'session') return url;
  const sep = url.includes('?') ? '&' : '?';
  const params = new URLSearchParams();
  appendBusinessScopeParams(params, businessScope);
  const qs = params.toString();
  return qs ? `${url}${sep}${qs}` : url;
}

// Financial periods align to calendar year (1 January – 31 December). All annual report ranges use 1 Jan – 31 Dec.
const getDateRange = (timeframe = 'thisMonth', customDateRange = null) => {
  if (customDateRange?.startDate && customDateRange?.endDate) {
    const { startDate, endDate } = calculateDateRange('custom', false, customDateRange);
    return {
      startDate: formatYmdInTimeZone(startDate),
      endDate: formatYmdInTimeZone(endDate),
    };
  }
  if (timeframe === 'custom' && customDateRange?.startDate && customDateRange?.endDate) {
    const { startDate, endDate } = calculateDateRange('custom', false, customDateRange);
    return {
      startDate: formatYmdInTimeZone(startDate),
      endDate: formatYmdInTimeZone(endDate),
    };
  }
  if (timeframe === 'singleDay') {
    const day =
      customDateRange?.startDate ||
      customDateRange?.endDate ||
      null;
    if (day) {
      const { startDate, endDate } = calculateDateRange('custom', false, {
        startDate: String(day).trim(),
        endDate: String(day).trim(),
      });
      return {
        startDate: formatYmdInTimeZone(startDate),
        endDate: formatYmdInTimeZone(endDate),
      };
    }
    const { startDate, endDate } = calculateDateRange('today', false, null);
    return {
      startDate: formatYmdInTimeZone(startDate),
      endDate: formatYmdInTimeZone(endDate),
    };
  }
  const { startDate, endDate } = calculateDateRange(timeframe, false, null);
  return {
    startDate: formatYmdInTimeZone(startDate),
    endDate: formatYmdInTimeZone(endDate),
  };
};

/**
 * Fetch financial summary data
 */
export const fetchFinancialSummary = async (timeframe, customDateRange = null, businessScope = null) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(withBusinessScope(
      `/api/reports/summary?startDate=${startDate}&endDate=${endDate}`,
      businessScope
    ));
    
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
export const fetchIncomeStatement = async ({ timeframe, compareWithPrevious = false, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/income-statement?startDate=${startDate}&endDate=${endDate}`;
    
    if (compareWithPrevious) {
      url += '&compare=true';
    }

    url = withBusinessScope(url, businessScope);
    
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
export const fetchBalanceSheet = async ({ timeframe, customDateRange = null, businessScope = null }) => {
  try {
    const { endDate } = getDateRange(timeframe, customDateRange);
    
    const asOfDate = endDate || formatYmdInTimeZone(new Date());

    const response = await fetch(withBusinessScope(
      `/api/reports/balance-sheet?asOfDate=${encodeURIComponent(asOfDate)}`,
      businessScope
    ));
    
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
export const fetchCashFlowStatement = async ({ timeframe, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(withBusinessScope(
      `/api/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`,
      businessScope
    ));
    
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
export const fetchTaxSummary = async ({ timeframe, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(withBusinessScope(
      `/api/reports/tax-summary?startDate=${startDate}&endDate=${endDate}`,
      businessScope
    ));
    
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
 * Fetch expense report data
 */
export const fetchExpenseReport = async ({ timeframe, category, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/expenses?startDate=${startDate}&endDate=${endDate}`;
    
    if (category) {
      url += `&category=${encodeURIComponent(category)}`;
    }

    url = withBusinessScope(url, businessScope);
    
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
export const fetchSalesReport = async ({ timeframe, groupBy = 'day', customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(withBusinessScope(
      `/api/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`,
      businessScope
    ));
    
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
 * Fetch financial ratios data
 */
export const fetchFinancialRatios = async ({ timeframe, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const response = await fetch(withBusinessScope(
      `/api/reports/financial-ratios?startDate=${startDate}&endDate=${endDate}`,
      businessScope
    ));
    
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
export const fetchStockMovement = async ({ timeframe, productId = null, customDateRange = null, businessScope = null }) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    let url = `/api/reports/stock-movement?startDate=${startDate}&endDate=${endDate}`;
    if (productId) {
      url += `&productId=${productId}`;
    }

    url = withBusinessScope(url, businessScope);
    
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
 * Fetch inventory loss report data (write-off + stock-out)
 */
export const fetchInventoryLossReport = async ({
  timeframe,
  customDateRange = null,
  eventType = 'all',
  businessScope = null,
}) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    const params = new URLSearchParams({
      startDate,
      endDate,
      eventType,
    });
    appendBusinessScopeParams(params, businessScope);
    const response = await fetch(`/api/reports/inventory-losses?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Error fetching inventory loss report: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching inventory loss report:', error);
    throw error;
  }
};

/**
 * Fetch Daily POS report for a single date (default: today).
 * @param {string} [date] - YYYY-MM-DD; defaults to today
 */
export const fetchPosDailyReport = async (date = null, businessScope = null) => {
  try {
    const dateStr = normalizeReportYmdParam(date);
    const params = new URLSearchParams({ date: dateStr });
    appendBusinessScopeParams(params, businessScope);
    const response = await fetch(`/api/reports/pos-daily?${params.toString()}`);
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
 * Fetch financial analytics (graphs + KPIs)
 */
export const fetchFinancialAnalytics = async ({
  timeframe,
  groupBy = 'month',
  customDateRange = null,
  categoryId = '',
  businessScope = null,
}) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    
    const params = new URLSearchParams({
      startDate,
      endDate,
      groupBy
    });
    if (categoryId) {
      params.append('categoryId', categoryId);
    }
    appendBusinessScopeParams(params, businessScope);
    
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
 * Product-level profit (invoice + POS lines) for the period: revenue, cost, margin per SKU/line.
 */
export const fetchProductProfitDetail = async ({
  timeframe,
  customDateRange = null,
  categoryId = '',
  businessScope = null,
}) => {
  try {
    const { startDate, endDate } = getDateRange(timeframe, customDateRange);
    const params = new URLSearchParams({ startDate, endDate });
    if (categoryId) params.append('categoryId', categoryId);
    appendBusinessScopeParams(params, businessScope);

    const response = await fetch(`/api/reports/product-profit-detail?${params.toString()}`);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error fetching product profit detail: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching product profit detail:', error);
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
    return Array.isArray(data) ? data : data.reports || [];
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
    
    // Calendar-aligned range (default: full current month, 1st–last day; this year = 1 Jan–31 Dec)
    const tf = params.timeframe || 'thisMonth';
    const { startDate, endDate } = getDateRange(tf, params.customDateRange || null);
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
    // Add any other params (skip timeframe + customDateRange — range is already startDate/endDate)
    Object.entries(params).forEach(([key, value]) => {
      if (key === 'timeframe' || key === 'customDateRange' || key === 'businessScope' || value == null) return;
      if (typeof value === 'object') return;
      queryParams.append(key, String(value));
    });

    if (params.businessScope) {
      appendBusinessScopeParams(queryParams, params.businessScope);
    }

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

/**
 * Fetch accounting periods for report date filtering.
 */
export const fetchAccountingPeriodsForReports = async () => {
  const response = await fetch('/api/reports/accounting-periods');
  if (!response.ok) {
    throw new Error('Failed to load accounting periods');
  }
  const data = await response.json();
  return data.periods || [];
};
