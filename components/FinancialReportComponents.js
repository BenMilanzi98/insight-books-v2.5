// components/FinancialReportComponents.jsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  DollarSign,
  Info,
  ChevronDown,
  Loader2,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { formatPeriodRange, stripEmbeddedPeriodFromReportLabel } from '@/lib/dateUtils';
import { getPermission } from '@/lib/permissions';
import { buildCoaAccountSourceHref } from '@/lib/coaReportAccountLinks';
import { ReportReconciliationBadge, extractReportReconciliationMeta } from '@/components/ReportReconciliationBadge';
import ReportAccountTable from '@/components/reports/ReportAccountTable';
/**
 * Generic FinancialReport component that displays a report with a header and content
 */
export const FinancialReport = ({ 
  title, 
  subtitle, 
  timeframe, 
  onTimeframeChange, 
  onRefresh, 
  onExport, 
  loading,
  error,
  reconciliationMeta,
  children 
}) => {
  const [canExportReports, setCanExportReports] = useState();
      
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canExportReports = await getPermission("reports.export"); 
  
      setCanExportReports(canExportReports);
    };
  
    fetchPermissions();
  }, []);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50/80 via-slate-50/80 to-blue-50/60">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="min-w-0 border-l-4 border-emerald-500 pl-4">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {timeframe && onTimeframeChange && (
              <div className="relative">
                <select
                  className="appearance-none px-3 py-2 border border-slate-200 rounded-xl bg-white pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                  value={timeframe}
                  onChange={(e) => onTimeframeChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="today">Today</option>
                  <option value="singleDay">Pick a day…</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="thisYear">This Year</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Range...</option>
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none">
                  <ChevronDown size={15} className="text-slate-400" />
                </div>
              </div>
            )}
            {onRefresh && (
              <button
                className="px-3 py-2 border border-slate-200 bg-white rounded-xl flex items-center text-sm hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 shadow-sm"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={15} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={15} className="mr-1" />
                )}
                Refresh
              </button>
            )}
            {onExport && canExportReports && (
              <div className="relative group">
                <button
                  className="px-3 py-2 border border-slate-200 bg-white rounded-xl flex items-center text-sm hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 shadow-sm"
                  disabled={loading}
                >
                  <Download size={15} className="mr-1" />
                  Export
                  <ChevronDown size={15} className="ml-1" />
                </button>
                <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg hidden group-hover:block z-10 py-1">
                  <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => onExport('pdf')}>Export as PDF</button>
                  <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => onExport('csv')}>Export as CSV</button>
                  <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => onExport('xlsx')}>Export as Excel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {reconciliationMeta?.reconciliation && (
        <div className="px-4 sm:px-6 pt-4 border-b border-slate-100 bg-slate-50/50">
          <ReportReconciliationBadge reconciliationMeta={reconciliationMeta} />
        </div>
      )}
      {error ? (
        <div className="p-6 sm:p-8 text-center">
          <div className="p-4 mb-4 text-red-700 bg-red-50 border border-red-200 rounded-xl">
            <p>{error}</p>
          </div>
          <button className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors" onClick={onRefresh}>
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="p-8 sm:p-12 text-center">
          <Loader2 size={36} className="mx-auto animate-spin text-emerald-600 mb-4" />
          <p className="text-slate-500 text-sm">Loading report data...</p>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Component to display percentage change with up/down indicators
 */
export const PercentageChange = ({ value, decimals = 2, showIcon = true }) => {
  const formattedValue = parseFloat(value).toFixed(decimals);
  const isPositive = value > 0;
  const isZero = value === 0;
  
  return (
    <div className={`inline-flex items-center ${isPositive ? 'text-green-600' : isZero ? 'text-slate-500' : 'text-red-600'}`}>
      {showIcon && (
        isPositive ? (
          <TrendingUp size={16} className="mr-1" />
        ) : isZero ? (
          <span className="mr-1">—</span>
        ) : (
          <TrendingDown size={16} className="mr-1" />
        )
      )}
      <span>{isPositive ? '+' : ''}{formattedValue}%</span>
    </div>
  );
};

/**
 * Component for Profit & Loss Report - Professional Format
 * Matches the exact specification format with drill-down capability
 */
export const ProfitLossReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [drillDownData, setDrillDownData] = useState(null);

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleDrillDown = (item) => {
    setDrillDownData(item);
  };

  const closeDrillDown = () => {
    setDrillDownData(null);
  };

  const getValue = (item) => {
    if (typeof item === 'object' && item !== null && 'amount' in item) {
      return item.amount;
    }
    return item || 0;
  };

  const getPercentage = (item, totalRevenue) => {
    if (typeof item === 'object' && item !== null && 'percentage' in item) {
      return item.percentage;
    }
    if (totalRevenue > 0 && typeof item === 'number') {
      return (item / totalRevenue) * 100;
    }
    return 0;
  };

  const getDetails = (item) => {
    if (typeof item === 'object' && item !== null && 'details' in item) {
      return item.details || [];
    }
    return [];
  };

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-2xl border border-slate-200">
        <FileText size={48} className="mx-auto text-emerald-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Please select a time period and generate the report.</p>
      </div>
    );
  }

  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const periodLabel = data.period ? formatPeriodRange(data.period.startDate, data.period.endDate) : '';
  const totalRevenue = data.revenue?.total || 0;
  const netIncome = getValue(data.netIncome);
  const netProfit = getValue(data.operatingIncome) ?? getValue(data.netIncome) ?? 0;
  const hasComparison = data.previous && data.comparisonType;
  const operatingExpensesCategories = data.operatingExpenses?.categories ?? [];
  const operatingExpenseAccountLines = data.operatingExpenses?.accountLines ?? [];
  const useAccountLineBreakdown = operatingExpenseAccountLines.length > 0;
  const operatingExpenseRows = useAccountLineBreakdown
    ? operatingExpenseAccountLines
    : operatingExpensesCategories;
  const hasOperatingExpenses = operatingExpenseRows.length > 0;

  const formatOperatingExpenseRowLabel = (row) => {
    if (useAccountLineBreakdown) {
      const code = row.accountCode != null ? String(row.accountCode) : '';
      const name = stripEmbeddedPeriodFromReportLabel(row.accountName || '');
      if (code.startsWith('cat:')) return name || code.replace(/^cat:/i, '').trim() || 'Expense';
      if (code && name) return `${code} – ${name}`;
      return name || code || 'Expense';
    }
    return stripEmbeddedPeriodFromReportLabel(row.accountName || row.category || '');
  };

  return (
    <FinancialReport
      title="Income Statement"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="text-center mb-6 sm:mb-8">
            {data.logoUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={
                    typeof data.logoUrl === 'string' && data.logoUrl.startsWith('/uploads/')
                      ? `/api/uploads/${data.logoUrl.replace(/^\/+uploads\//, '')}`
                      : typeof data.logoUrl === 'string' && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))
                      ? data.logoUrl
                      : typeof data.logoUrl === 'string'
                      ? data.logoUrl
                      : ''
                  }
                  alt="Company Logo"
                  className="h-16 sm:h-20 object-contain max-w-xs"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{companyName || 'Company'}</h1>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-600 mt-2">Income Statement</h2>
            <p className="text-sm text-slate-500 mt-1">For the period: {periodLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Revenue and COGS are system-generated. Operating expenses list each expense account (or category) with activity in this period.
            </p>
          </div>

          {/* Comparison Toggle */}
          {hasComparison && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-emerald-800">
                  {data.comparisonType === 'previousPeriod' ? 'Comparing with previous period' : 'Comparing with previous year'}
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedSections(prev => ({ ...prev, comparison: !prev.comparison }))}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  {expandedSections.comparison ? 'Hide' : 'Show'} comparison
                </button>
              </div>
            </div>
          )}

          {/* Income Statement Table */}
          <div className="overflow-x-auto -mx-1 rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-3.5 px-4 sm:px-5 font-semibold text-slate-700 border-b border-slate-200 text-xs sm:text-sm uppercase tracking-wide"></th>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <th className="text-right py-3.5 px-4 sm:px-5 font-semibold text-slate-700 border-b border-slate-200 text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap">Previous</th>
                      <th className="text-right py-3.5 px-4 sm:px-5 font-semibold text-slate-700 border-b border-slate-200 text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap">Change</th>
                    </>
                  )}
                  <th className="text-right py-3.5 px-4 sm:px-5 font-semibold text-slate-700 border-b border-slate-200 text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap">Current period</th>
                  <th className="text-right py-3.5 px-4 sm:px-5 font-semibold text-slate-700 border-b border-slate-200 text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap">% of revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {/* REVENUE SECTION */}
                <tr className="bg-slate-50/80">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-4 sm:px-5 font-bold text-slate-700 uppercase text-xs sm:text-sm tracking-wide">
                    Revenue
                  </td>
                </tr>
                
                {Array.isArray(data.revenue?.lineItems) && data.revenue.lineItems.length > 0 ? (
                  data.revenue.lineItems.map((item) => {
                    const prevItem = data.previous?.revenue?.lineItems?.find(
                      p => (p.key && p.key === item.key) || p.label === item.label
                    );
                    return (
                      <IncomeStatementRow
                        key={item.key || item.label}
                        label={item.label}
                        value={{
                          amount: item.amount || 0,
                          percentage: item.percentage || 0,
                          details: item.details || []
                        }}
                        totalRevenue={totalRevenue}
                        hasDetails={(item.details || []).length > 0}
                        onDrillDown={() => handleDrillDown({ type: item.label, details: item.details || [] })}
                        previousValue={prevItem ? {
                          amount: prevItem.amount || 0,
                          percentage: prevItem.percentage || 0,
                          details: prevItem.details || []
                        } : undefined}
                        showComparison={hasComparison && expandedSections.comparison}
                      />
                    );
                  })
                ) : (
                  <>
                    <IncomeStatementRow
                      label="Sales Revenue"
                      value={data.revenue?.salesRevenue}
                      totalRevenue={totalRevenue}
                      hasDetails={getDetails(data.revenue?.salesRevenue).length > 0}
                      onDrillDown={() => handleDrillDown({ type: 'Sales Revenue', details: getDetails(data.revenue?.salesRevenue) })}
                      previousValue={data.previous?.revenue?.salesRevenue}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                    
                    <IncomeStatementRow
                      label="Service Revenue"
                      value={data.revenue?.serviceRevenue}
                      totalRevenue={totalRevenue}
                      hasDetails={getDetails(data.revenue?.serviceRevenue).length > 0}
                      onDrillDown={() => handleDrillDown({ type: 'Service Revenue', details: getDetails(data.revenue?.serviceRevenue) })}
                      previousValue={data.previous?.revenue?.serviceRevenue}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                  </>
                )}
                
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="py-3 px-4 sm:px-5 font-semibold text-slate-800">Total Revenue</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(data.previous?.revenue?.total || 0)}</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold">
                        {data.previous?.revenue?.total ? <PercentageChange value={((totalRevenue - data.previous.revenue.total) / data.previous.revenue.total) * 100} /> : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(totalRevenue)}</td>
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">100.0%</td>
                </tr>

                {/* COGS SECTION */}
                <tr className="bg-slate-50/80">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-4 sm:px-5 font-bold text-slate-700 uppercase text-xs sm:text-sm tracking-wide">
                    Cost of goods sold
                  </td>
                </tr>
                
                {Array.isArray(data.cogs?.lineItems) && data.cogs.lineItems.length > 0 ? (
                  data.cogs.lineItems.map((item) => {
                    const prevItem = data.previous?.cogs?.lineItems?.find(
                      p => (p.key && p.key === item.key) || p.label === item.label
                    );
                    return (
                      <IncomeStatementRow
                        key={item.key || item.label}
                        label={item.label}
                        value={{
                          amount: item.amount || 0,
                          percentage: item.percentage || 0,
                          details: item.details || []
                        }}
                        totalRevenue={totalRevenue}
                        hasDetails={(item.details || []).length > 0}
                        onDrillDown={() => handleDrillDown({ type: item.label, details: item.details || [] })}
                        previousValue={prevItem ? {
                          amount: prevItem.amount || 0,
                          percentage: prevItem.percentage || 0,
                          details: prevItem.details || []
                        } : undefined}
                        showComparison={hasComparison && expandedSections.comparison}
                      />
                    );
                  })
                ) : (
                  <>
                    <IncomeStatementRow
                      label="Cost of Products Sold"
                      value={data.cogs?.costOfProductsSold}
                      totalRevenue={totalRevenue}
                      hasDetails={getDetails(data.cogs?.costOfProductsSold).length > 0}
                      onDrillDown={() => handleDrillDown({ type: 'Cost of Products Sold', details: getDetails(data.cogs?.costOfProductsSold) })}
                      previousValue={data.previous?.cogs?.costOfProductsSold}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                    
                    <IncomeStatementRow
                      label="Freight/Shipping Costs"
                      value={data.cogs?.freightShippingCosts}
                      totalRevenue={totalRevenue}
                      hasDetails={getDetails(data.cogs?.freightShippingCosts).length > 0}
                      onDrillDown={() => handleDrillDown({ type: 'Freight/Shipping', details: getDetails(data.cogs?.freightShippingCosts) })}
                      previousValue={data.previous?.cogs?.freightShippingCosts}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                  </>
                )}
                
                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 sm:px-5 font-semibold text-slate-800">Total Cost of Goods Sold</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.previous?.cogs?.total) || 0)}</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold">
                        {data.previous?.cogs?.total ? <PercentageChange value={((getValue(data.cogs?.total) - getValue(data.previous.cogs.total)) / getValue(data.previous.cogs.total)) * 100} /> : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.cogs?.total) || 0)}</td>
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{getPercentage(getValue(data.cogs?.total), totalRevenue).toFixed(1)}%</td>
                </tr>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="py-3 px-4 sm:px-5 font-semibold text-slate-800">
                    <span className="block">Gross profit</span>
                    <span className="block text-xs font-normal text-slate-500 mt-0.5">Sales revenue − Cost of goods sold</span>
                  </td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.previous?.grossProfit) || 0)}</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold">
                        {data.previous?.grossProfit ? <PercentageChange value={((getValue(data.grossProfit) - getValue(data.previous.grossProfit)) / getValue(data.previous.grossProfit)) * 100} /> : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.grossProfit) || 0)}</td>
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{getPercentage(getValue(data.grossProfit), totalRevenue).toFixed(1)}%</td>
                </tr>

                {/* OPERATING EXPENSES */}
                <tr className="bg-slate-50/80">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-4 sm:px-5 font-bold text-slate-700 uppercase text-xs sm:text-sm tracking-wide">
                    <span className="block">Operating expenses</span>
                    <span className="block text-xs font-normal text-slate-500 mt-0.5 normal-case">
                      All expense accounts with a balance this period (tracked expenses, payroll, depreciation)
                    </span>
                  </td>
                </tr>
                {hasOperatingExpenses ? (
                  operatingExpenseRows.map((category, index) => {
                    const rowLabel = formatOperatingExpenseRowLabel(category);
                    const previousCategory = useAccountLineBreakdown
                      ? data.previous?.operatingExpenses?.accountLines?.find(
                          (cat) => cat.accountCode === category.accountCode
                        )
                      : data.previous?.operatingExpenses?.categories?.find(
                          (cat) =>
                            (cat.accountCode && cat.accountCode === category.accountCode) ||
                            stripEmbeddedPeriodFromReportLabel(cat.accountName || cat.category || '') === rowLabel
                        );
                    return (
                      <IncomeStatementRow
                        key={`expense-row-${index}-${category.accountCode ?? rowLabel}`}
                        label={rowLabel}
                        value={{
                          amount: category.amount || 0,
                          percentage:
                            category.percentage ??
                            (totalRevenue > 0 ? ((category.amount || 0) / totalRevenue) * 100 : 0),
                          details: category.details || []
                        }}
                        totalRevenue={totalRevenue}
                        hasDetails={(category.details || []).length > 0}
                        onDrillDown={() => handleDrillDown({ type: rowLabel, details: category.details || [] })}
                        previousValue={previousCategory ? {
                          amount: previousCategory.amount || 0,
                          percentage:
                            previousCategory.percentage ??
                            (totalRevenue > 0 && data.previous?.totalRevenue
                              ? ((previousCategory.amount || 0) / data.previous.totalRevenue) * 100
                              : 0),
                          details: previousCategory.details || []
                        } : undefined}
                        showComparison={hasComparison && expandedSections.comparison}
                      />
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-4 px-4 sm:px-5 text-center text-sm text-slate-500 italic">
                      No operating expenses in this period. Expense accounts with activity will appear here.
                    </td>
                  </tr>
                )}
                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 sm:px-5 font-semibold text-slate-800">Total Operating Expenses</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.previous?.operatingExpenses?.total) || 0)}</td>
                      <td className="py-2 px-4 sm:px-5 text-right font-semibold">
                        {data.previous?.operatingExpenses?.total ? <PercentageChange value={((getValue(data.operatingExpenses?.total) - getValue(data.previous.operatingExpenses.total)) / getValue(data.previous.operatingExpenses.total)) * 100} /> : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{formatCurrency(getValue(data.operatingExpenses?.total) || 0)}</td>
                  <td className="py-2 px-4 sm:px-5 text-right font-semibold text-slate-800">{getPercentage(getValue(data.operatingExpenses?.total), totalRevenue).toFixed(1)}%</td>
                </tr>
                <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                  <td className="py-3 px-4 sm:px-5 font-bold text-slate-800">
                    <span className="block text-base sm:text-lg">Net profit / loss</span>
                    <span className="block text-xs font-normal text-slate-500 mt-0.5 normal-case">Gross profit − Total operating expenses</span>
                  </td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-3 px-4 sm:px-5 text-right font-bold text-slate-800">{formatCurrency(getValue(data.previous?.operatingIncome) ?? getValue(data.previous?.netIncome) ?? 0)}</td>
                      <td className="py-3 px-4 sm:px-5 text-right font-bold">
                        {getValue(data.previous?.operatingIncome) != null || getValue(data.previous?.netIncome) != null ? (
                          <PercentageChange value={((netProfit - (getValue(data.previous?.operatingIncome) ?? getValue(data.previous?.netIncome) ?? 0)) / Math.abs(getValue(data.previous?.operatingIncome) ?? getValue(data.previous?.netIncome) ?? 1)) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className={`py-3 px-4 sm:px-5 text-right font-bold text-base sm:text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(netProfit)}
                  </td>
                  <td className={`py-3 px-4 sm:px-5 text-right font-bold text-base sm:text-lg ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {getPercentage(netProfit, totalRevenue).toFixed(1)}%
                  </td>
                </tr>
                  </tbody>
                </table>
              </div>

          {data.accountLines?.length > 0 && (
            <ReportAccountTable
              lines={data.accountLines}
              title="P&L Accounts — General Ledger Detail"
              showOpeningClosing
            />
          )}

          {/* Drill-down Modal */}
          {drillDownData && (
            <DrillDownModal
              data={drillDownData}
              onClose={closeDrillDown}
            />
          )}
            </div>
      )}
    </FinancialReport>
  );
};

/**
 * Helper component for income statement rows
 */
const IncomeStatementRow = ({ label, value, totalRevenue, hasDetails, onDrillDown, previousValue, showComparison, isNegative = false }) => {
  const amount = typeof value === 'object' && value !== null && 'amount' in value ? value.amount : (value || 0);
  const percentage = typeof value === 'object' && value !== null && 'percentage' in value ? value.percentage : (totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0);
  const prevAmount = typeof previousValue === 'object' && previousValue !== null && 'amount' in previousValue ? previousValue.amount : (previousValue || 0);

  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="py-2.5 px-4 sm:px-5 text-slate-800 text-sm">
        <div className="flex items-center gap-2">
          {hasDetails && (
            <button
              type="button"
              onClick={onDrillDown}
              className="text-emerald-600 hover:text-emerald-700 transition-colors p-0.5 rounded"
              title="View details"
            >
              <Eye size={14} />
            </button>
          )}
          <span>{label}</span>
        </div>
      </td>
      {showComparison && (
        <>
          <td className="py-2.5 px-4 sm:px-5 text-right text-slate-700 text-sm">
            {isNegative ? `(${formatCurrency(Math.abs(prevAmount))})` : formatCurrency(prevAmount)}
          </td>
          <td className="py-2.5 px-4 sm:px-5 text-right text-sm">
            {prevAmount !== 0 ? <PercentageChange value={((amount - prevAmount) / Math.abs(prevAmount)) * 100} /> : '-'}
          </td>
        </>
      )}
      <td className="py-2.5 px-4 sm:px-5 text-right text-slate-800 text-sm font-medium">
        {isNegative ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
      </td>
      <td className="py-2.5 px-4 sm:px-5 text-right text-slate-600 text-sm">
        {percentage.toFixed(1)}%
      </td>
    </tr>
  );
};

/**
 * Drill-down modal component
 */
const DrillDownModal = ({ data, onClose }) => {
  if (!data || !data.details || data.details.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-800">{data.type} — Transaction details</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[65vh]">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Reference</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Description</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.details.map((detail, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm text-slate-800">
                    {detail.date ? (() => {
                      const date = new Date(detail.date);
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      return `${day}-${month}-${year}`;
                    })() : 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-800">
                    {detail.number || detail.invoiceNumber || detail.saleNumber || detail.reference || 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-800">
                    {detail.description || detail.productName || detail.client || 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 text-right font-medium">
                    {formatCurrency(detail.amount || detail.cogsAmount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                <td colSpan={3} className="px-4 py-2.5 text-sm text-slate-800">Total</td>
                <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.details.reduce((sum, d) => sum + (d.amount || d.cogsAmount || 0), 0))}</td>
              </tr>
            </tfoot>
                </table>
              </div>
            </div>
          </div>
  );
};

/**
 * Component for Balance Sheet Report - Professional Format
 * Matches the exact specification format with drill-down capability
 */
export const BalanceSheetReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [drillDownData, setDrillDownData] = useState(null);

  const handleDrillDown = (item) => {
    setDrillDownData(item);
  };

  const closeDrillDown = () => {
    setDrillDownData(null);
  };

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200">
        <FileText size={48} className="mx-auto text-blue-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const asOfDate = data.asOfDate || '';
  const hasComparison = data.previousYear && data.comparisonType;
  const isBalanced = data.isBalanced !== undefined ? data.isBalanced : Math.abs(data.difference || 0) < 0.01;
  const balanceDifference = Math.abs(data.balanceDifference || data.difference || 0);
  
  return (
    <FinancialReport
      title="Balance Sheet"
      subtitle={asOfDate ? `As of ${asOfDate}` : "Statement of Financial Position"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="text-center mb-8">
            {data.logoUrl && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={
                    typeof data.logoUrl === 'string' && data.logoUrl.startsWith('/uploads/')
                      ? `/api/uploads/${data.logoUrl.replace(/^\/+uploads\//, '')}`
                      : typeof data.logoUrl === 'string' && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))
                      ? data.logoUrl
                      : typeof data.logoUrl === 'string'
                      ? data.logoUrl
                      : ''
                  }
                  alt="Company Logo" 
                  className="h-16 sm:h-20 object-contain max-w-xs"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">{companyName}</h1>
            <h2 className="text-xl font-semibold text-slate-700 mt-2">Balance Sheet</h2>
            <p className="text-sm text-slate-600 mt-1">As of {asOfDate}</p>
            </div>

          {hasComparison && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Comparing with previous year</span>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, comparison: !prev.comparison }))}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {expandedSections.comparison ? 'Hide' : 'Show'} comparison
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200"></th>
                  {hasComparison && expandedSections.comparison && (
                    <th className="text-right py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200">Previous year</th>
                  )}
                  <th className="text-right py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200">Current</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200">% of total assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {React.Children.toArray(
                  <>
                <tr className="bg-slate-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-slate-800 uppercase">
                    ASSETS
                  </td>
                </tr>
                <tr className="bg-slate-100/80">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-slate-700">
                    Current assets
                  </td>
                </tr>

                {Array.isArray(data.assets?.currentAssets?.lineItems) && data.assets.currentAssets.lineItems.length > 0 ? (
                  data.assets.currentAssets.lineItems.map((li) => (
                    <BalanceSheetRow
                      key={li.key || li.label}
                      label={li.label}
                      value={li.value || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.currentAssets?.lineItems?.find(p => (p.key && p.key === li.key) || p.label === li.label)?.value}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={!!(li.drillDown?.items?.length)}
                      onDrillDown={li.drillDown ? () => handleDrillDown({ type: li.drillDown.type, items: li.drillDown.items }) : undefined}
                    />
                  ))
                ) : (
                  <>
                    <BalanceSheetRow
                      label="Cash and Cash Equivalents"
                      value={data.assets?.currentAssets?.cashAndCashEquivalents || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.currentAssets?.cashAndCashEquivalents}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                    <BalanceSheetRow
                      label="Accounts Receivable"
                      value={data.assets?.currentAssets?.accountsReceivable?.total || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.currentAssets?.accountsReceivable?.total}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={data.assets?.currentAssets?.accountsReceivable?.items?.length > 0}
                      onDrillDown={() => handleDrillDown({ 
                        type: 'Accounts Receivable', 
                        items: data.assets?.currentAssets?.accountsReceivable?.items || [] 
                      })}
                    />

                    <BalanceSheetRow
                      label="Inventory"
                      value={data.assets?.currentAssets?.inventory?.total || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.currentAssets?.inventory?.total}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={data.assets?.currentAssets?.inventory?.items?.length > 0}
                      onDrillDown={() => handleDrillDown({ 
                        type: 'Inventory', 
                        items: data.assets?.currentAssets?.inventory?.items || [] 
                      })}
                    />

                  </>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Current Assets</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.assets?.currentAssets?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.assets?.currentAssets?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.assets?.currentAssets?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                {/* Non-Current Assets */}
                <tr className="bg-slate-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-slate-700">
                    Non-Current Assets
                  </td>
                </tr>

                {Array.isArray(data.assets?.nonCurrentAssets?.lineItems) && data.assets.nonCurrentAssets.lineItems.length > 0 ? (
                  data.assets.nonCurrentAssets.lineItems.map((li) => (
                    <BalanceSheetRow
                      key={li.key || li.label}
                      label={li.label}
                      value={li.value || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.nonCurrentAssets?.lineItems?.find(p => (p.key && p.key === li.key) || p.label === li.label)?.value}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={!!(li.drillDown?.items?.length)}
                      onDrillDown={li.drillDown ? () => handleDrillDown({ type: li.drillDown.type, items: li.drillDown.items }) : undefined}
                    />
                  ))
                ) : (
                  <>
                    <tr>
                      <td className="py-2 px-4 pl-8 text-slate-600">
                        <div className="flex items-center">
                          {(data.assets?.nonCurrentAssets?.propertyPlantEquipment?.items?.length > 0) && (
                            <button
                              onClick={() => handleDrillDown({ 
                                type: 'Property, Plant & Equipment', 
                                items: data.assets?.nonCurrentAssets?.propertyPlantEquipment?.items || [] 
                              })}
                              className="mr-2 text-blue-600 hover:text-blue-800"
                              title="Click to view details"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          Property, Plant & Equipment
                        </div>
                      </td>
                      {hasComparison && expandedSections.comparison && (
                        <td className="py-2 px-4 text-right text-slate-600">
                          {formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0)}
                        </td>
                      )}
                      <td className="py-2 px-4 text-right text-slate-800">
                        {formatCurrency(data.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0)}
                      </td>
                      <td className="py-2 px-4 text-right text-slate-600">
                        {data.assets?.total > 0 ? ((data.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0) / data.assets.total * 100).toFixed(1) : 0}%
                      </td>
                            </tr>

                    <tr>
                      <td className="py-2 px-4 pl-12 text-slate-600 text-sm">Less: Accumulated Depreciation</td>
                      {hasComparison && expandedSections.comparison && (
                        <td className="py-2 px-4 text-right text-slate-600 text-sm">
                          ({formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.propertyPlantEquipment?.accumulatedDepreciation || 0)})
                        </td>
                      )}
                      <td className="py-2 px-4 text-right text-slate-600 text-sm">
                        ({formatCurrency(data.assets?.nonCurrentAssets?.propertyPlantEquipment?.accumulatedDepreciation || 0)})
                      </td>
                      <td className="py-2 px-4 text-right text-slate-600 text-sm">-</td>
                          </tr>

                    <BalanceSheetRow
                      label="Intangible Assets"
                      value={data.assets?.nonCurrentAssets?.intangibleAssets || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.assets?.nonCurrentAssets?.intangibleAssets}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                  </>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Non-Current Assets</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.assets?.nonCurrentAssets?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.assets?.nonCurrentAssets?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                <tr className="border-t-2 border-slate-300">
                  <td className="py-3 px-4 font-bold text-lg text-slate-800">TOTAL ASSETS</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">
                      {formatCurrency(data.previousYear?.assets?.total || 0)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">
                    {formatCurrency(data.assets?.total || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">100.0%</td>
                        </tr>

                {/* LIABILITIES SECTION */}
                <tr className="bg-slate-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-slate-800 uppercase">
                    LIABILITIES
                  </td>
                        </tr>

                {/* Current Liabilities */}
                <tr className="bg-slate-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-slate-700">
                    Current Liabilities
                  </td>
                      </tr>

                {Array.isArray(data.liabilities?.currentLiabilities?.lineItems) && data.liabilities.currentLiabilities.lineItems.length > 0 ? (
                  data.liabilities.currentLiabilities.lineItems
                    .filter(li => (li.value || 0) > 0) // hide 0-value reference lines
                    .map((li) => (
                      <BalanceSheetRow
                        key={li.key || li.label}
                        label={li.label}
                        value={li.value || 0}
                        totalAssets={data.assets?.total || 0}
                        previousValue={data.previousYear?.liabilities?.currentLiabilities?.lineItems?.find(p => (p.key && p.key === li.key) || p.label === li.label)?.value}
                        showComparison={hasComparison && expandedSections.comparison}
                        hasDetails={!!(li.drillDown?.items?.length)}
                        onDrillDown={li.drillDown ? () => handleDrillDown({ type: li.drillDown.type, items: li.drillDown.items }) : undefined}
                      />
                    ))
                ) : (
                  <>
                    <BalanceSheetRow
                      label="Accounts Payable"
                      value={data.liabilities?.currentLiabilities?.accountsPayable?.total || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.liabilities?.currentLiabilities?.accountsPayable?.total}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={data.liabilities?.currentLiabilities?.accountsPayable?.items?.length > 0}
                      onDrillDown={() => handleDrillDown({ 
                        type: 'Accounts Payable', 
                        items: data.liabilities?.currentLiabilities?.accountsPayable?.items || [] 
                      })}
                    />

                    <BalanceSheetRow
                      label="Short-term Loans"
                      value={data.liabilities?.currentLiabilities?.shortTermLoans || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.liabilities?.currentLiabilities?.shortTermLoans}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                    <BalanceSheetRow
                      label="Tax Payable"
                      value={data.liabilities?.currentLiabilities?.taxPayable || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.liabilities?.currentLiabilities?.taxPayable}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                  </>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Current Liabilities</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.liabilities?.currentLiabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.liabilities?.currentLiabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.liabilities?.currentLiabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                {/* Non-Current Liabilities */}
                <tr className="bg-slate-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-slate-700">
                    Non-Current Liabilities
                  </td>
                        </tr>

                {Array.isArray(data.liabilities?.nonCurrentLiabilities?.lineItems) && data.liabilities.nonCurrentLiabilities.lineItems.length > 0 ? (
                  data.liabilities.nonCurrentLiabilities.lineItems.map((li) => (
                    <BalanceSheetRow
                      key={li.key || li.label}
                      label={li.label}
                      value={li.value || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.liabilities?.nonCurrentLiabilities?.lineItems?.find(p => (p.key && p.key === li.key) || p.label === li.label)?.value}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={!!(li.drillDown?.items?.length)}
                      onDrillDown={li.drillDown ? () => handleDrillDown({ type: li.drillDown.type, items: li.drillDown.items }) : undefined}
                    />
                  ))
                ) : (
                  <>
                    <BalanceSheetRow
                      label="Long-term Loans"
                      value={data.liabilities?.nonCurrentLiabilities?.longTermLoans || data.liabilities?.longTermLiabilities?.longTermLoans || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.liabilities?.nonCurrentLiabilities?.longTermLoans || data.previousYear?.liabilities?.longTermLiabilities?.longTermLoans}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                  </>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Non-Current Liabilities</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.liabilities?.nonCurrentLiabilities?.total || data.previousYear?.liabilities?.longTermLiabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.liabilities?.nonCurrentLiabilities?.total || data.liabilities?.longTermLiabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.liabilities?.nonCurrentLiabilities?.total || data.liabilities?.longTermLiabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">TOTAL LIABILITIES</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.liabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.liabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.liabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                {/* Total Liabilities with Interest - Informational Note
                {data.totalLiabilitiesWithInterest && data.totalLiabilitiesWithInterest > data.liabilities?.total && (
                  <tr className="bg-blue-50">
                    <td className="py-2 px-4 text-sm text-slate-600 italic pl-8">
                      Total Liabilities (including future interest payments)
                    </td>
                    {hasComparison && expandedSections.comparison && (
                      <td className="py-2 px-4 text-right text-sm text-slate-600 italic">
                        -
                      </td>
                    )}
                    <td className="py-2 px-4 text-right text-sm text-slate-600 font-medium">
                      {formatCurrency(data.totalLiabilitiesWithInterest || 0)}
                    </td>
                    <td className="py-2 px-4 text-right text-sm text-slate-600 italic">
                      {data.assets?.total > 0 ? ((data.totalLiabilitiesWithInterest || 0) / data.assets.total * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                )} */}

                {/* EQUITY SECTION */}
                      <tr className="bg-slate-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-slate-800 uppercase">
                    EQUITY
                  </td>
                      </tr>

                {Array.isArray(data.equity?.lineItems) && data.equity.lineItems.length > 0 ? (
                  data.equity.lineItems.map((li) => (
                    <BalanceSheetRow
                      key={li.key || li.label}
                      label={li.label}
                      value={li.value || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.equity?.lineItems?.find(p => (p.key && p.key === li.key) || p.label === li.label)?.value}
                      showComparison={hasComparison && expandedSections.comparison}
                      hasDetails={!!(li.drillDown?.items?.length)}
                      onDrillDown={li.drillDown ? () => handleDrillDown({ type: li.drillDown.type, items: li.drillDown.items }) : undefined}
                    />
                  ))
                ) : (
                  <>
                    <BalanceSheetRow
                      label="Owner's Capital/Share Capital"
                      value={data.equity?.ownersCapital || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.equity?.ownersCapital}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                    <BalanceSheetRow
                      label="Retained Earnings"
                      value={data.equity?.retainedEarnings || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.equity?.retainedEarnings}
                      showComparison={hasComparison && expandedSections.comparison}
                    />

                    <BalanceSheetRow
                      label="Current Year Profit/Loss"
                      value={data.equity?.currentYearProfitLoss || 0}
                      totalAssets={data.assets?.total || 0}
                      previousValue={data.previousYear?.equity?.currentYearProfitLoss}
                      showComparison={hasComparison && expandedSections.comparison}
                    />
                  </>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">TOTAL EQUITY</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-slate-800">
                      {formatCurrency(data.previousYear?.equity?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(data.equity?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {data.assets?.total > 0 ? ((data.equity?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                <tr className="border-t-2 border-slate-300">
                  <td className="py-3 px-4 font-bold text-lg text-slate-800">TOTAL LIABILITIES & EQUITY</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">
                      {formatCurrency(data.previousYear?.totalLiabilitiesAndEquity || 0)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">
                    {formatCurrency(data.totalLiabilitiesAndEquity || 0)}
                  </td>
                      <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">100.0%</td>
                        </tr>
                        </>
                      ).filter((child) => typeof child !== 'string')}
                    </tbody>
                  </table>
              </div>
              
          {/* Verification Check */}
          <div className={`p-4 rounded-lg border-2 ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {isBalanced ? (
                  <span className="text-2xl mr-3">✓</span>
                ) : (
                  <span className="text-2xl mr-3">✗</span>
                )}
                <div>
                  <h3 className={`font-semibold ${isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                    Balance Verification
                  </h3>
                  <p className={`text-sm ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                    {isBalanced 
                      ? 'Total Assets equals Total Liabilities + Equity' 
                      : `Difference: ${formatCurrency(balanceDifference)}`
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${isBalanced ? 'text-green-800' : 'text-red-800'}`}>
                  {isBalanced ? 'BALANCED' : 'NOT BALANCED'}
                </p>
              </div>
            </div>
              </div>
              
          {/* Financial Ratios */}
          {data.ratios && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/60 via-slate-50 to-blue-50/60 rounded-2xl border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 border-l-4 border-emerald-500 pl-3">Financial ratios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-white/80 border border-emerald-100">
                  <p className="text-sm text-emerald-700 mb-1">Current ratio</p>
                  <p className="text-xl font-semibold text-slate-800">
                    {data.ratios.currentRatio ? data.ratios.currentRatio.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Current Assets ÷ Current Liabilities</p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 border border-blue-100">
                  <p className="text-sm text-blue-700 mb-1">Quick ratio</p>
                  <p className="text-xl font-semibold text-slate-800">
                    {data.ratios.quickRatio ? data.ratios.quickRatio.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">(Cash + AR) ÷ Current Liabilities</p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 border border-sky-100">
                  <p className="text-sm text-sky-700 mb-1">Debt-to-equity</p>
                  <p className="text-xl font-semibold text-slate-800">
                    {data.ratios.debtToEquity ? (data.ratios.debtToEquity < 0.01 ? data.ratios.debtToEquity.toFixed(4) : data.ratios.debtToEquity.toFixed(2)) : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Total Liabilities ÷ Total Equity</p>
                </div>
              </div>
            </div>
          )}

          {data.accountLines?.length > 0 && (
            <ReportAccountTable
              lines={data.accountLines}
              title="Balance Sheet Accounts — General Ledger Detail"
              showOpeningClosing
            />
          )}

          {/* Drill-down Modal */}
          {drillDownData && (
            <BalanceSheetDrillDownModal
              data={drillDownData}
              onClose={closeDrillDown}
            />
          )}
        </div>
      )}
    </FinancialReport>
  );
};

/**
 * Helper component for balance sheet rows
 */
const BalanceSheetRow = ({ label, value, totalAssets, previousValue, showComparison, hasDetails, onDrillDown }) => {
  const percentage = totalAssets > 0 ? (value / totalAssets) * 100 : 0;
  return (
    <tr className="hover:bg-slate-50/70">
      <td className="py-2 px-4 text-slate-800">
        <div className="flex items-center">
          {hasDetails && (
            <button
              onClick={onDrillDown}
              className="mr-2 text-emerald-600 hover:text-emerald-700"
              title="View details"
            >
              <Eye size={14} />
            </button>
          )}
          {label}
        </div>
      </td>
      {showComparison && (
        <td className="py-2 px-4 text-right text-slate-600">
          {formatCurrency(previousValue || 0)}
        </td>
      )}
      <td className="py-2 px-4 text-right text-slate-800">
        {formatCurrency(value)}
      </td>
      <td className="py-2 px-4 text-right text-slate-600">
        {percentage.toFixed(1)}%
      </td>
    </tr>
  );
};

/**
 * Balance Sheet Drill-down modal component
 */
const BalanceSheetDrillDownModal = ({ data, onClose }) => {
  if (!data || !data.items || data.items.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg border border-slate-200 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-slate-800">{data.type} - Details</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50">
                {data.type === 'Accounts Receivable' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Due Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Balance Due</th>
                  </>
                )}
                {data.type === 'Accounts Payable' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Merchant</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Balance Due</th>
                  </>
                )}
                {data.type === 'Property, Plant & Equipment' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Asset Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Purchase Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Original Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Accum. Depreciation</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Net Book Value</th>
                  </>
                )}
                {data.type === 'Inventory' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Product Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cost per Unit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total Value</th>
                  </>
                )}
                {data.type === 'Property, Plant & Equipment' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Asset Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Purchase Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Original Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Accum. Depreciation</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Net Book Value</th>
                  </>
                )}
                {data.type === 'Inventory' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Value</th>
                  </>
                )}
                {!['Accounts Receivable', 'Accounts Payable', 'Property, Plant & Equipment', 'Inventory'].includes(data.type) && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Account Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Account Name</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Balance</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  {data.type === 'Accounts Receivable' && (
                    <>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.invoiceNumber || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.clientName || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {item.dueDate ? (() => {
                          const date = new Date(item.dueDate);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })() : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.paid || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.balanceDue || 0)}</td>
                    </>
                  )}
                  {data.type === 'Accounts Payable' && (
                    <>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {item.date ? (() => {
                          const date = new Date(item.date);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })() : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.description || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.merchant || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.paid || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.balanceDue || 0)}</td>
                    </>
                  )}
                  {data.type === 'Property, Plant & Equipment' && (
                    <>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.name || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.category || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">
                        {item.purchaseDate ? (() => {
                          const date = new Date(item.purchaseDate);
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${day}-${month}-${year}`;
                        })() : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.originalCost || item.gross || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.accumulatedDepreciation || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.netBookValue || item.net || 0)}</td>
                    </>
                  )}
                  {data.type === 'Inventory' && (
                    <>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.name || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{item.quantity || 0}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.cost || 0)}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.value || 0)}</td>
                    </>
                  )}
                  {!['Accounts Receivable', 'Accounts Payable', 'Property, Plant & Equipment', 'Inventory'].includes(data.type) && (
                    <>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.accountCode || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800">{item.accountName || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-slate-800 text-right">{formatCurrency(item.balance || 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={
                  data.type === 'Inventory' ? 3 : 
                  data.type === 'Property, Plant & Equipment' ? 5 :
                  data.type === 'Accounts Receivable' || data.type === 'Accounts Payable' ? 5 : 2
                } className="px-4 py-2 text-sm text-slate-800">Total</td>
                <td className="px-4 py-2 text-sm text-slate-800 text-right">
                  {formatCurrency(data.items.reduce((sum, item) => {
                    if (data.type === 'Accounts Receivable' || data.type === 'Accounts Payable') {
                      return sum + (item.balanceDue || 0);
                    } else if (data.type === 'Property, Plant & Equipment') {
                      return sum + (item.netBookValue || item.net || 0);
                    } else if (data.type === 'Inventory') {
                      return sum + (item.value || 0);
                    } else {
                      return sum + (item.balance || 0);
                    }
                  }, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

/**
 * Component for Tax Summary Report
 */
export const TaxSummaryReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-slate-50 rounded-2xl border border-slate-200">
        <FileText size={48} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  return (
    <FinancialReport
      title="Tax Summary"
      subtitle={data?.period ? formatPeriodRange(data.period.startDate, data.period.endDate) : "Tax Report"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm border-l-4 border-l-emerald-500">
              <h3 className="text-sm font-medium text-emerald-700 mb-1">Total collected tax</h3>
              <p className="min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(data.collectedTaxes.totalCollectedTax)}</p>
              <p className="text-xs text-slate-500 mt-1">From taxable amount of {formatCurrency(data.collectedTaxes.totalTaxableAmount)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-sm border-l-4 border-l-blue-500">
              <h3 className="text-sm font-medium text-blue-700 mb-1">Total tax paid</h3>
              <p className="min-w-0 break-words text-xl font-semibold leading-tight tabular-nums text-slate-800 sm:text-2xl">{formatCurrency(data.paidTaxes.totalTaxPaid)}</p>
              <p className="text-xs text-slate-500 mt-1">From {data.paidTaxes.expenses.length} tax-related expenses</p>
            </div>
            <div className="bg-gradient-to-br from-sky-50 to-white p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-sm border-l-4 border-l-sky-500">
              <h3 className="text-sm font-medium text-sky-700 mb-1">Net tax liability</h3>
              <p className={`min-w-0 break-words text-xl font-semibold leading-tight tabular-nums sm:text-2xl ${data.netTaxLiability >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(data.netTaxLiability)}</p>
              <p className="text-xs text-slate-500 mt-1">{data.netTaxLiability >= 0 ? 'Tax to be paid' : 'Tax credit'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Collected taxes by rate</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Tax rate</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Taxable amount</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Tax amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {data.collectedTaxes.byRate.map((taxRate) => (
                      <tr key={taxRate.rate} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{taxRate.rate}%</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(taxRate.taxableAmount)}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(taxRate.taxAmount)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-slate-50 border-t border-slate-200">
                      <td className="px-4 py-2.5 text-sm text-slate-800">Total</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.collectedTaxes.totalTaxableAmount)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.collectedTaxes.totalCollectedTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Tax expenses</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {data.paidTaxes.expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{expense.description}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">{expense.category}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(expense.amount)}</td>
                      </tr>
                    ))}
                    {data.paidTaxes.expenses.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-4 py-6 text-sm text-slate-500 text-center">No tax expenses recorded</td>
                      </tr>
                    )}
                    <tr className="font-semibold bg-slate-50 border-t border-slate-200">
                      <td colSpan="2" className="px-4 py-2.5 text-sm text-slate-800">Total tax paid</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(data.paidTaxes.totalTaxPaid)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-50 via-emerald-50/40 to-blue-50/40 border border-slate-200">
            <h3 className="text-base font-semibold text-slate-800 mb-3 border-l-4 border-emerald-500 pl-3">Tax summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-white/70">
                <p className="text-sm text-slate-600 mb-1">Total sales tax collected</p>
                <p className="text-lg font-semibold text-slate-800">{formatCurrency(data.collectedTaxes.totalCollectedTax)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/70">
                <p className="text-sm text-slate-600 mb-1">Total tax paid out</p>
                <p className="text-lg font-semibold text-slate-800">{formatCurrency(data.paidTaxes.totalTaxPaid)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/70">
                <p className="text-sm text-slate-600 mb-1">Net tax position</p>
                <p className={`text-lg font-semibold ${data.netTaxLiability >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(data.netTaxLiability)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {data.netTaxLiability >= 0 ? 'You need to remit this amount to the tax authority' : 'You may be due a tax refund of this amount'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};

/**
 * Component for displaying aging reports (AR/AP)
 */

export const AgingReportTable = ({ 
  data, 
  title, 
  type = 'receivable', // or 'payable'
  loading, 
  error,
  onRefresh,
  onExport
}) => {
  // Define the aging buckets and their labels
  const agingBuckets = [
    { label: 'Current', days: [0, 0] },
    { label: '1-30 Days', days: [1, 30] },
    { label: '31-60 Days', days: [31, 60] },
    { label: '61-90 Days', days: [61, 90] },
    { label: 'Over 90 Days', days: [91, Infinity] }
  ];
  
  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-slate-50 rounded-2xl border border-slate-200">
        <FileText size={48} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Generate the report to view aging summary.</p>
      </div>
    );
  }

  // Helper function to get the age of an invoice/bill in days
  const getDaysPastDue = (dueDate) => {
    if (!dueDate) return 0; // Handle missing due date
    
    const today = new Date();
    const due = new Date(dueDate);
    
    // Check if the date is valid
    if (isNaN(due.getTime())) return 0;
    
    const diffTime = Math.abs(today - due);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  // Helper function to determine which bucket an invoice/bill falls into
  const getBucket = (dueDate) => {
    const daysPastDue = getDaysPastDue(dueDate);
    
    // Find the matching bucket
    const bucket = agingBuckets.find(bucket => 
      daysPastDue >= bucket.days[0] && daysPastDue <= bucket.days[1]
    );
    
    // If no bucket found, default to "Current"
    return bucket ? bucket.label : "Current";
  };
  
  // Helper to safely get entity information
  const getEntityInfo = (item) => {
    if (type === 'receivable') {
      return {
        id: item.clientId || item.client?.id || 'unknown',
        name: item.client?.name || 'Unknown Client',
        documentNumber: item.invoiceNumber || 'N/A',
        issueDate: item.issueDate || item.date || new Date()
      };
    } else {
      return {
        id: item.vendorId || item.vendor?.id || 'unknown',
        name: item.vendor?.name || 'Unknown Vendor',
        documentNumber: item.billNumber || item.paymentReference || 'N/A',
        issueDate: item.date || item.issueDate || new Date()
      };
    }
  };
  
  // Group invoices/bills by customer/vendor and by aging bucket
  const groupByEntityAndAge = (items) => {
    const grouped = {};
    
    items.forEach(item => {
      const entityInfo = getEntityInfo(item);
      const bucket = getBucket(item.dueDate);
      
      if (!grouped[entityInfo.id]) {
        grouped[entityInfo.id] = {
          id: entityInfo.id,
          name: entityInfo.name,
          buckets: {},
          total: 0
        };
        
        // Initialize all buckets to 0
        agingBuckets.forEach(b => {
          grouped[entityInfo.id].buckets[b.label] = 0;
        });
      }
      
      grouped[entityInfo.id].buckets[bucket] += item.amount;
      grouped[entityInfo.id].total += item.amount;
    });
    
    return Object.values(grouped);
  };
  
  // Calculate totals for each bucket across all entities
  const calculateTotals = (groupedData) => {
    const totals = {};
    let grandTotal = 0;
    
    // Initialize all buckets to 0
    agingBuckets.forEach(b => {
      totals[b.label] = 0;
    });
    
    groupedData.forEach(entity => {
      Object.entries(entity.buckets).forEach(([bucket, amount]) => {
        totals[bucket] += amount;
        grandTotal += amount;
      });
    });
    
    return { bucketTotals: totals, grandTotal };
  };
  
  // Process the data if available
  // If data has invoices array, use that for grouping, otherwise use pre-grouped items
  let processedItems = [];
  if (data?.invoices && Array.isArray(data.invoices)) {
    // Use individual invoices for grouping
    processedItems = data.invoices;
  } else if (data?.items && Array.isArray(data.items)) {
    // Check if items are already grouped (have buckets) or are individual invoices
    if (data.items.length > 0 && data.items[0].buckets) {
      // Already grouped - convert to format expected by component
      processedItems = data.items.map(item => ({
        clientId: item.id,
        client: { name: item.name },
        amount: item.total,
        dueDate: null // Grouped data doesn't have individual due dates
      }));
    } else {
      // Individual invoices - use as is
      processedItems = data.items;
    }
  }
  
  const groupedData = data ? groupByEntityAndAge(processedItems) : [];
  
  // Use totals from API if available, otherwise calculate
  let bucketTotals = {};
  let grandTotal = 0;
  
  if (data?.totals) {
    // Map API totals to component bucket labels
    bucketTotals = {
      'Current': data.totals.current || 0,
      '31-60 Days': data.totals.days31to60 || 0,
      '61-90 Days': data.totals.days61to90 || 0,
      'Over 90 Days': data.totals.daysOver90 || 0
    };
    // Add 1-30 days if present
    if (data.totals.days1to30 !== undefined) {
      bucketTotals['1-30 Days'] = data.totals.days1to30 || 0;
    }
    grandTotal = data.totals.total || 0;
  } else {
    const calculated = calculateTotals(groupedData);
    bucketTotals = calculated.bucketTotals;
    grandTotal = calculated.grandTotal;
  }
  
  return (
    <FinancialReport
      title={title || `${type === 'receivable' ? 'Accounts Receivable' : 'Accounts Payable'} Aging`}
      subtitle={data?.asOfDate ? `As of ${data.asOfDate}` : "Aging Report"}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <>
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-slate-50 to-sky-50/60 border border-slate-200">
            <div className="flex flex-wrap justify-between items-center gap-2 border-l-4 border-blue-500 pl-3">
              <h3 className="font-semibold text-slate-800">
                {type === 'receivable' ? 'Outstanding invoices' : 'Outstanding bills'}
              </h3>
              <span className="text-xs text-slate-600">As of {data.asOfDate}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="p-3 rounded-xl bg-white/80 border border-blue-100">
                <p className="text-sm text-blue-700 mb-1">Total {type === 'receivable' ? 'receivables' : 'payables'}</p>
                <p className="text-xl font-semibold text-slate-800">{formatCurrency(grandTotal)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/80 border border-sky-100">
                <p className="text-sm text-sky-700 mb-1">{type === 'receivable' ? 'Customers' : 'Vendors'} with outstanding balances</p>
                <p className="text-xl font-semibold text-slate-800">{groupedData.length}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{type === 'receivable' ? 'Customer' : 'Vendor'}</th>
                  {agingBuckets.map(bucket => (
                    <th key={bucket.label} className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">{bucket.label}</th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {groupedData.map(entity => (
                  <tr key={entity.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-sm text-slate-800">{entity.name}</td>
                    {agingBuckets.map(bucket => (
                      <td key={bucket.label} className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(entity.buckets[bucket.label])}</td>
                    ))}
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">{formatCurrency(entity.total)}</td>
                  </tr>
                ))}
                {groupedData.length === 0 && (
                  <tr>
                    <td colSpan={agingBuckets.length + 2} className="px-4 py-6 text-sm text-slate-500 text-center">No outstanding {type === 'receivable' ? 'invoices' : 'bills'}</td>
                  </tr>
                )}
                <tr className="font-semibold bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-2.5 text-sm text-slate-800">Total</td>
                  {agingBuckets.map(bucket => (
                    <td key={bucket.label} className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(bucketTotals[bucket.label])}</td>
                  ))}
                  <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              {type === 'receivable' ? 'Outstanding Invoices Detail' : 'Outstanding Bills Detail'}
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{type === 'receivable' ? 'Invoice #' : 'Bill #'}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{type === 'receivable' ? 'Customer' : 'Vendor'}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Due date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Days past due</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {(data?.invoices || processedItems).map((item, index) => {
                    const entityInfo = getEntityInfo(item);
                    const daysPastDue = item.daysPastDue !== undefined ? item.daysPastDue : getDaysPastDue(item.dueDate);
                    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                    const issueDate = item.issueDate ? new Date(item.issueDate) : null;
                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 text-sm text-slate-800">{item.invoiceNumber || entityInfo.documentNumber || 'N/A'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">{entityInfo.name}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">
                          {issueDate && !isNaN(issueDate.getTime()) ? (() => {
                            const d = issueDate;
                            return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                          })() : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-800">
                          {dueDate && !isNaN(dueDate.getTime()) ? (() => {
                            const day = String(dueDate.getDate()).padStart(2, '0');
                            const month = String(dueDate.getMonth() + 1).padStart(2, '0');
                            const year = dueDate.getFullYear();
                            return `${day}-${month}-${year}`;
                          })() : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{daysPastDue}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-800 text-right">{formatCurrency(Number(item.amount) || 0)}</td>
                      </tr>
                    );
                  })}
                  {(!data?.invoices || data.invoices.length === 0) && processedItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-slate-500 text-center">No outstanding {type === 'receivable' ? 'invoices' : 'bills'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </FinancialReport>
  );
};

/**
 * Component for Cash Flow Statement - Professional Format
 * Matches the exact specification format (Simplified for Phase 1)
 */
export const CashFlowReport = ({ 
  data, 
  loading, 
  error,
  timeframe,
  onTimeframeChange,
  onRefresh,
  onExport
}) => {
  const [drillDownData, setDrillDownData] = useState(null);

  const handleDrillDown = (item) => {
    setDrillDownData(item);
  };

  const closeDrillDown = () => {
    setDrillDownData(null);
  };

  if (!data && !loading && !error) {
    return (
      <div className="text-center p-8 sm:p-10 bg-slate-50 rounded-2xl border border-slate-200">
        <FileText size={48} className="mx-auto text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-800">No data available</h3>
        <p className="text-slate-500 mt-2 text-sm">Select a time period and generate the report.</p>
      </div>
    );
  }

  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const periodLabel = data.period ? formatPeriodRange(data.period.startDate, data.period.endDate) : '';
  const netCashFlow = data.netCashFlow || data.summary?.netIncreaseDecrease || 0;
  const openingBalance = data.openingCashBalance || data.summary?.openingCashBalance || data.cashBalances?.openingBalance || 0;
  const closingBalance = data.closingCashBalance || data.summary?.closingCashBalance || data.cashBalances?.closingBalance || 0;
  
  // Use dynamic line items if available, otherwise fall back to legacy structure
  const cashInflows = data.cashInflows || {};
  const cashOutflows = data.cashOutflows || {};
  const inflowsLineItems = cashInflows.lineItems || [];
  const outflowsLineItems = cashOutflows.lineItems || [];
  
  // Legacy fallback: create line items from old structure (support both customerPayments and cashFromCustomerPayments)
  const legacyInflows = [];
  const customerPaymentsVal = data.cashInflows?.cashFromCustomerPayments ?? data.cashInflows?.customerPayments ?? 0;
  const otherReceiptsVal = data.cashInflows?.otherCashReceipts ?? 0;
  if (customerPaymentsVal > 0) {
    legacyInflows.push({
      key: 'inflow-customer-payments',
      label: 'Cash from Customer Payments',
      value: customerPaymentsVal,
      details: data.cashInflows?.details?.filter(d => d.type === 'customer_payment' || d.type === 'sale_payment') || []
    });
  }
  if (otherReceiptsVal > 0) {
    legacyInflows.push({
      key: 'inflow-other-receipts',
      label: 'Other Cash Receipts',
      value: otherReceiptsVal,
      details: data.cashInflows?.details?.filter(d => d.type === 'other_receipt') || []
    });
  }

  const legacyOutflows = [];
  const supplierPaymentsVal = data.cashOutflows?.paymentsToSuppliers ?? data.cashOutflows?.supplierPayments ?? 0;
  if (supplierPaymentsVal > 0) {
    legacyOutflows.push({
      key: 'outflow-supplier-payments',
      label: 'Payments to Suppliers',
      value: supplierPaymentsVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'supplier_payment' || d.type === 'expense_supplier') || []
    });
  }
  const salaryVal = data.cashOutflows?.salaryPayments ?? 0;
  if (salaryVal > 0) {
    legacyOutflows.push({
      key: 'outflow-salary-payments',
      label: 'Salary Payments',
      value: salaryVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'payroll' || d.type === 'expense_salary') || []
    });
  }
  const rentVal = data.cashOutflows?.rentPayments ?? 0;
  if (rentVal > 0) {
    legacyOutflows.push({
      key: 'outflow-rent-payments',
      label: 'Rent Payments',
      value: rentVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'rent') || []
    });
  }
  const otherExpVal = data.cashOutflows?.otherExpensePayments ?? 0;
  if (otherExpVal > 0) {
    legacyOutflows.push({
      key: 'outflow-other-expenses',
      label: 'Other Expense Payments',
      value: otherExpVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'other_expense') || []
    });
  }
  const assetVal = data.cashOutflows?.assetPurchases ?? 0;
  if (assetVal > 0) {
    legacyOutflows.push({
      key: 'outflow-asset-purchases',
      label: 'Asset Purchases',
      value: assetVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'asset_payment' || d.type === 'asset_module') || []
    });
  }
  const loanVal = data.cashOutflows?.loanPayments ?? 0;
  if (loanVal > 0) {
    legacyOutflows.push({
      key: 'outflow-loan-payments',
      label: 'Loan Payments',
      value: loanVal,
      details: data.cashOutflows?.details?.filter(d => d.type === 'loan_payment') || []
    });
  }
  
  const finalInflows = inflowsLineItems.length > 0 ? inflowsLineItems : legacyInflows;
  const finalOutflows = outflowsLineItems.length > 0 ? outflowsLineItems : legacyOutflows;
  const totalInflows = cashInflows.total || data.cashInflows?.total || finalInflows.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalOutflows = cashOutflows.total || data.cashOutflows?.total || finalOutflows.reduce((sum, item) => sum + (item.value || 0), 0);
  
  return (
    <FinancialReport
      title="Cash Flow Statement (Direct Method)"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
      reconciliationMeta={extractReportReconciliationMeta(data)}
    >
      {data && (
        <div className="space-y-6">
          {/* Company Header with Logo */}
          <div className="text-center mb-8">
            {data.logoUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={
                    typeof data.logoUrl === 'string' && data.logoUrl.startsWith('/uploads/')
                      ? `/api/uploads/${data.logoUrl.replace(/^\/+uploads\//, '')}`
                      : typeof data.logoUrl === 'string' && (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://'))
                      ? data.logoUrl
                      : typeof data.logoUrl === 'string'
                      ? data.logoUrl
                      : data.logoUrl
                  }
                  alt={`${companyName} Logo`}
                  className="h-16 w-auto object-contain"
                />
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">{companyName}</h1>
            <h2 className="text-xl font-semibold text-slate-600 mt-2">Cash Flow Statement (Direct Method)</h2>
            <p className="text-sm text-slate-600 mt-1">For the Period: {periodLabel}</p>
            {data.reconciliationWarning ? (
              <div
                className="mt-4 mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900"
                role="status"
              >
                {data.reconciliationWarning}
              </div>
            ) : null}
          </div>
            
          {/* Cash Flow Statement Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200"></th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-800 border-b-2 border-slate-200">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* CASH INFLOWS SECTION */}
                <tr className="bg-slate-50">
                  <td colSpan="2" className="py-2 px-4 font-bold text-slate-800 uppercase">
                    CASH INFLOWS
                  </td>
                </tr>

                {finalInflows.length > 0 ? (
                  finalInflows.map((item) => (
                    <CashFlowRow
                      key={item.key}
                      label={item.label}
                      value={item.value || 0}
                      isNegative={false}
                      hasDetails={item.details && item.details.length > 0}
                      onDrillDown={() => handleDrillDown({ 
                        type: item.label, 
                        items: item.details || [] 
                      })}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="py-2 px-4 text-slate-500 text-center italic">No cash inflows recorded</td>
                  </tr>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Cash Inflows</td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(totalInflows)}
                  </td>
                </tr>

                {/* CASH OUTFLOWS SECTION */}
                <tr className="bg-slate-50">
                  <td colSpan="2" className="py-2 px-4 font-bold text-slate-800 uppercase">
                    CASH OUTFLOWS
                  </td>
                </tr>

                {finalOutflows.length > 0 ? (
                  finalOutflows.map((item) => (
                    <CashFlowRow
                      key={item.key}
                      label={item.label}
                      value={item.value || 0}
                      isNegative={true}
                      hasDetails={item.details && item.details.length > 0}
                      onDrillDown={() => handleDrillDown({ 
                        type: item.label, 
                        items: item.details || [] 
                      })}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="py-2 px-4 text-slate-500 text-center italic">No cash outflows recorded</td>
                  </tr>
                )}

                <tr className="border-t border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">Total Cash Outflows</td>
                  <td className="py-2 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(totalOutflows)}
                  </td>
                </tr>

                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 px-4 font-semibold text-slate-800">NET CASH FLOW</td>
                  <td className={`py-2 px-4 text-right font-semibold text-slate-800 ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCashFlow)}
                  </td>
                </tr>

                <tr className="border-t-2 border-slate-300">
                  <td className="py-3 px-4 font-semibold text-slate-800">Opening Cash Balance</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-800">
                    {formatCurrency(openingBalance)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 text-slate-600">Add: Net Cash Flow</td>
                  <td className={`py-2 px-4 text-right text-slate-600 ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCashFlow)}
                  </td>
                </tr>

                <tr className="border-t-2 border-slate-300">
                  <td className="py-3 px-4 font-bold text-lg text-slate-800">Closing Cash Balance</td>
                  <td className="py-3 px-4 text-right font-bold text-lg text-slate-800">
                    {formatCurrency(closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Drill-down Modal */}
          {drillDownData && (
            <CashFlowDrillDownModal
              data={drillDownData}
              onClose={closeDrillDown}
            />
          )}
            </div>
      )}
    </FinancialReport>
  );
};

/**
 * Helper component for cash flow rows
 */
const CashFlowRow = ({ label, value, isNegative = false, hasDetails, onDrillDown }) => {
  return (
    <tr className="hover:bg-slate-50">
      <td className="py-2 px-4 text-slate-800">
        <div className="flex items-center">
          {hasDetails && (
            <button
              onClick={onDrillDown}
              className="mr-2 text-blue-600 hover:text-blue-800"
              title="Click to view details"
            >
              <Eye size={14} />
            </button>
          )}
          {label}
          </div>
      </td>
      <td className="py-2 px-4 text-right text-slate-800">
        {isNegative ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
      </td>
    </tr>
  );
};

/**
 * Cash Flow Drill-down modal component
 */
const CashFlowDrillDownModal = ({ data, onClose }) => {
  if (!data || !data.items || data.items.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg border border-slate-200 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-slate-800">{data.type} - Transaction Details</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Reference</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                  </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm text-slate-800">
                    {item.date ? (() => {
                      const date = new Date(item.date);
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      return `${day}-${month}-${year}`;
                    })() : 'N/A'}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-800">
                    {item.reference || 'N/A'}
                    </td>
                  <td className="px-4 py-2 text-sm text-slate-800">
                    {item.description || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">
                    {formatCurrency(item.amount || 0)}
                    </td>
                  </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan="3" className="px-4 py-2 text-sm text-slate-800">Total</td>
                    <td className="px-4 py-2 text-sm text-slate-800 text-right">
                  {formatCurrency(data.items.reduce((sum, item) => sum + (item.amount || 0), 0))}
                    </td>
                  </tr>
            </tfoot>
              </table>
            </div>
          </div>
    </div>
  );
};

// Import and re-export new report components
import { 
  StockMovementReport, 
  PosDailyReport,
  SalesAnalysisReport, 
  ExpenseAnalysisReport, 
  ProfitabilityAnalysisReport 
} from './NewReportComponents';

// Re-export for use in other files
export { 
  StockMovementReport, 
  PosDailyReport,
  SalesAnalysisReport, 
  ExpenseAnalysisReport, 
  ProfitabilityAnalysisReport 
};
