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
import { getPermission } from '@/lib/permissions';
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50/50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div className="mb-4 sm:mb-0">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {timeframe && onTimeframeChange && (
              <div className="relative">
                <select 
                  className="appearance-none px-3 py-2 border border-gray-300 rounded-md bg-white pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={timeframe}
                  onChange={(e) => onTimeframeChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="thisYear">This Year</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Range...</option>
                </select>
                <div className="absolute right-2 top-2.5 pointer-events-none">
                  <ChevronDown size={15} className="text-gray-500" />
                </div>
              </div>
            )}
            
            {onRefresh && (
              <button 
                className="px-3 py-2 border border-gray-300 bg-white rounded-md flex items-center text-sm hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-50"
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
                  className="px-3 py-2 border border-gray-300 bg-white rounded-md flex items-center text-sm hover:bg-gray-50 text-gray-700 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  <Download size={15} className="mr-1" />
                  Export
                  <ChevronDown size={15} className="ml-1" />
                </button>
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md hidden group-hover:block z-10">
                  <ul className="py-1">
                    <li>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => onExport('pdf')}
                      >
                        Export as PDF
                      </button>
                    </li>
                    <li>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => onExport('csv')}
                      >
                        Export as CSV
                      </button>
                    </li>
                    <li>
                      <button 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => onExport('xlsx')}
                      >
                        Export as Excel
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {error ? (
        <div className="p-6 text-center">
          <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-md">
            <p>{error}</p>
          </div>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={onRefresh}
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="p-8 text-center">
          <Loader2 size={36} className="mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">Loading report data...</p>
        </div>
      ) : (
        <div className="p-6">
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
    <div className={`inline-flex items-center ${isPositive ? 'text-green-600' : isZero ? 'text-gray-500' : 'text-red-600'}`}>
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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
  const totalRevenue = data.revenue?.total || 0;
  const netIncome = getValue(data.netIncome);
  const hasComparison = data.previous && data.comparisonType;
  
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
            <h1 className="text-2xl font-bold text-gray-900">{companyName || 'Company'}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2">Income Statement</h2>
            <p className="text-sm text-gray-600 mt-1">For the Period: {periodLabel}</p>
          </div>

          {/* Comparison Toggle */}
          {hasComparison && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  {data.comparisonType === 'previousPeriod' ? 'Comparing with Previous Period' : 'Comparing with Previous Year'}
                </span>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, comparison: !prev.comparison }))}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.comparison ? 'Hide' : 'Show'} Comparison
                </button>
              </div>
            </div>
          )}

          {/* Income Statement Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-3.5 px-5 font-semibold text-gray-900 border-b-2 border-gray-300 text-sm uppercase tracking-wide"></th>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <th className="text-right py-3.5 px-5 font-semibold text-gray-900 border-b-2 border-gray-300 text-sm uppercase tracking-wide">Previous</th>
                      <th className="text-right py-3.5 px-5 font-semibold text-gray-900 border-b-2 border-gray-300 text-sm uppercase tracking-wide">Change</th>
                    </>
                  )}
                  <th className="text-right py-3.5 px-5 font-semibold text-gray-900 border-b-2 border-gray-300 text-sm uppercase tracking-wide">Current Period</th>
                  <th className="text-right py-3.5 px-5 font-semibold text-gray-900 border-b-2 border-gray-300 text-sm uppercase tracking-wide">% of Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* REVENUE SECTION */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-5 font-bold text-gray-900 uppercase text-sm tracking-wide">
                    REVENUE
                  </td>
                </tr>
                
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
                
                <IncomeStatementRow
                  label="Other Income"
                  value={data.revenue?.otherIncome}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.revenue?.otherIncome).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Other Income', details: getDetails(data.revenue?.otherIncome) })}
                  previousValue={data.previous?.revenue?.otherIncome}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-3 px-5 font-semibold text-gray-900">Total Revenue</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(data.previous?.revenue?.total || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.revenue?.total ? (
                          <PercentageChange value={((totalRevenue - data.previous.revenue.total) / data.previous.revenue.total) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(totalRevenue)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">100.0%</td>
                </tr>

                {/* COGS SECTION */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-5 font-bold text-gray-900 uppercase text-sm tracking-wide">
                    COST OF GOODS SOLD
                  </td>
                </tr>
                
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
                
                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Cost of Goods Sold</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(getValue(data.previous?.cogs?.total) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.cogs?.total ? (
                          <PercentageChange value={((getValue(data.cogs?.total) - getValue(data.previous.cogs.total)) / getValue(data.previous.cogs.total)) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(getValue(data.cogs?.total) || 0)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {getPercentage(getValue(data.cogs?.total), totalRevenue).toFixed(1)}%
                  </td>
                </tr>
                
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="py-3 px-5 font-semibold text-gray-900">GROSS PROFIT</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(getValue(data.previous?.grossProfit) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.grossProfit ? (
                          <PercentageChange value={((getValue(data.grossProfit) - getValue(data.previous.grossProfit)) / getValue(data.previous.grossProfit)) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(getValue(data.grossProfit) || 0)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {getPercentage(getValue(data.grossProfit), totalRevenue).toFixed(1)}%
                  </td>
                </tr>

                {/* OPERATING EXPENSES SECTION */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-3 px-5 font-bold text-gray-900 uppercase text-sm tracking-wide">
                    OPERATING EXPENSES
                  </td>
                </tr>
                
                <IncomeStatementRow
                  label="Salaries & Wages"
                  value={data.operatingExpenses?.salariesWages}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.salariesWages).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Salaries & Wages', details: getDetails(data.operatingExpenses?.salariesWages) })}
                  previousValue={data.previous?.operatingExpenses?.salariesWages}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Rent Expense"
                  value={data.operatingExpenses?.rentExpense}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.rentExpense).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Rent Expense', details: getDetails(data.operatingExpenses?.rentExpense) })}
                  previousValue={data.previous?.operatingExpenses?.rentExpense}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Utilities Expense"
                  value={data.operatingExpenses?.utilitiesExpense}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.utilitiesExpense).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Utilities Expense', details: getDetails(data.operatingExpenses?.utilitiesExpense) })}
                  previousValue={data.previous?.operatingExpenses?.utilitiesExpense}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Office Supplies"
                  value={data.operatingExpenses?.officeSupplies}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.officeSupplies).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Office Supplies', details: getDetails(data.operatingExpenses?.officeSupplies) })}
                  previousValue={data.previous?.operatingExpenses?.officeSupplies}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Marketing & Advertising"
                  value={data.operatingExpenses?.marketingAdvertising}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.marketingAdvertising).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Marketing & Advertising', details: getDetails(data.operatingExpenses?.marketingAdvertising) })}
                  previousValue={data.previous?.operatingExpenses?.marketingAdvertising}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Insurance"
                  value={data.operatingExpenses?.insurance}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.insurance).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Insurance', details: getDetails(data.operatingExpenses?.insurance) })}
                  previousValue={data.previous?.operatingExpenses?.insurance}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Depreciation"
                  value={data.operatingExpenses?.depreciation}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.depreciation).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Depreciation', details: getDetails(data.operatingExpenses?.depreciation) })}
                  previousValue={data.previous?.operatingExpenses?.depreciation}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Loan Payments"
                  value={data.operatingExpenses?.loanPayments}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.loanPayments).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Loan Payments', details: getDetails(data.operatingExpenses?.loanPayments) })}
                  previousValue={data.previous?.operatingExpenses?.loanPayments}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Other Operating Expenses"
                  value={data.operatingExpenses?.otherOperatingExpenses}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.operatingExpenses?.otherOperatingExpenses).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Other Operating Expenses', details: getDetails(data.operatingExpenses?.otherOperatingExpenses) })}
                  previousValue={data.previous?.operatingExpenses?.otherOperatingExpenses}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Operating Expenses</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(getValue(data.previous?.operatingExpenses?.total) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.operatingExpenses?.total ? (
                          <PercentageChange value={((getValue(data.operatingExpenses?.total) - getValue(data.previous.operatingExpenses.total)) / getValue(data.previous.operatingExpenses.total)) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(getValue(data.operatingExpenses?.total) || 0)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {getPercentage(getValue(data.operatingExpenses?.total), totalRevenue).toFixed(1)}%
                  </td>
                </tr>
                
                <tr className="border-t-2 border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">OPERATING INCOME</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(getValue(data.previous?.operatingIncome) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.operatingIncome ? (
                          <PercentageChange value={((getValue(data.operatingIncome) - getValue(data.previous.operatingIncome)) / Math.abs(getValue(data.previous.operatingIncome))) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(getValue(data.operatingIncome) || 0)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {getPercentage(getValue(data.operatingIncome), totalRevenue).toFixed(1)}%
                  </td>
                </tr>

                {/* OTHER INCOME/(EXPENSES) SECTION */}
                    <tr className="bg-gray-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 2} className="py-2 px-4 font-bold text-gray-900 uppercase">
                    OTHER INCOME/(EXPENSES)
                  </td>
                    </tr>
                
                <IncomeStatementRow
                  label="Interest Income"
                  value={data.otherIncomeExpenses?.interestIncome}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.otherIncomeExpenses?.interestIncome).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Interest Income', details: getDetails(data.otherIncomeExpenses?.interestIncome) })}
                  previousValue={data.previous?.otherIncomeExpenses?.interestIncome}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Interest Expense"
                  value={data.otherIncomeExpenses?.interestExpense}
                  totalRevenue={totalRevenue}
                  isNegative={true}
                  hasDetails={getDetails(data.otherIncomeExpenses?.interestExpense).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Interest Expense', details: getDetails(data.otherIncomeExpenses?.interestExpense) })}
                  previousValue={data.previous?.otherIncomeExpenses?.interestExpense}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <IncomeStatementRow
                  label="Gain/Loss on Asset Sales"
                  value={data.otherIncomeExpenses?.gainLossOnAssetSales}
                  totalRevenue={totalRevenue}
                  hasDetails={getDetails(data.otherIncomeExpenses?.gainLossOnAssetSales).length > 0}
                  onDrillDown={() => handleDrillDown({ type: 'Gain/Loss on Asset Sales', details: getDetails(data.otherIncomeExpenses?.gainLossOnAssetSales) })}
                  previousValue={data.previous?.otherIncomeExpenses?.gainLossOnAssetSales}
                  showComparison={hasComparison && expandedSections.comparison}
                />
                
                <tr className="border-t-2 border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">NET INCOME BEFORE TAX</td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right font-semibold text-gray-900">
                        {formatCurrency(getValue(data.previous?.netIncomeBeforeTax) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold">
                        {data.previous?.netIncomeBeforeTax ? (
                          <PercentageChange value={((getValue(data.netIncomeBeforeTax) - getValue(data.previous.netIncomeBeforeTax)) / Math.abs(getValue(data.previous.netIncomeBeforeTax))) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">{formatCurrency(getValue(data.netIncomeBeforeTax) || 0)}</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {getPercentage(getValue(data.netIncomeBeforeTax), totalRevenue).toFixed(1)}%
                        </td>
                      </tr>
                
                <tr>
                  <td className="py-2 px-4 text-gray-700">
                    Income Tax Expense ({data.incomeTaxExpense?.rate || 0}%)
                  </td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-2 px-4 text-right text-gray-700">
                        {formatCurrency(getValue(data.previous?.incomeTaxExpense) || 0)}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-700">
                        {data.previous?.incomeTaxExpense ? (
                          <PercentageChange value={((getValue(data.incomeTaxExpense) - getValue(data.previous.incomeTaxExpense)) / getValue(data.previous.incomeTaxExpense)) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className="py-2 px-4 text-right text-gray-700">{formatCurrency(getValue(data.incomeTaxExpense) || 0)}</td>
                  <td className="py-2 px-4 text-right text-gray-700">
                    {getPercentage(getValue(data.incomeTaxExpense), totalRevenue).toFixed(1)}%
                  </td>
                </tr>
                
                <tr className="border-t-2 border-gray-400">
                  <td className="py-3 px-4 font-bold text-lg text-gray-900">
                    NET INCOME
                  </td>
                  {hasComparison && expandedSections.comparison && (
                    <>
                      <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                        {formatCurrency(getValue(data.previous?.netIncome) || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-lg">
                        {data.previous?.netIncome !== undefined ? (
                          <PercentageChange value={((netIncome - getValue(data.previous.netIncome)) / Math.abs(getValue(data.previous.netIncome))) * 100} />
                        ) : '-'}
                      </td>
                    </>
                  )}
                  <td className={`py-3 px-4 text-right font-bold text-lg ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netIncome)}
                  </td>
                  <td className={`py-3 px-4 text-right font-bold text-lg ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getPercentage(netIncome, totalRevenue).toFixed(1)}%
                  </td>
                    </tr>
                  </tbody>
                </table>
              </div>

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
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="py-2.5 px-5 text-gray-900 text-sm">
        <div className="flex items-center">
          {hasDetails && (
            <button
              onClick={onDrillDown}
              className="mr-2 text-blue-600 hover:text-blue-800 transition-colors"
              title="Click to view details"
            >
              <Eye size={14} />
            </button>
          )}
          {label}
        </div>
      </td>
      {showComparison && (
        <>
          <td className="py-2.5 px-5 text-right text-gray-700 text-sm">
            {isNegative ? `(${formatCurrency(Math.abs(prevAmount))})` : formatCurrency(prevAmount)}
          </td>
          <td className="py-2.5 px-5 text-right text-sm">
            {prevAmount !== 0 ? (
              <PercentageChange value={((amount - prevAmount) / Math.abs(prevAmount)) * 100} />
            ) : '-'}
          </td>
        </>
      )}
      <td className="py-2.5 px-5 text-right text-gray-900 text-sm font-medium">
        {isNegative ? `(${formatCurrency(Math.abs(amount))})` : formatCurrency(amount)}
      </td>
      <td className="py-2.5 px-5 text-right text-gray-700 text-sm">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg border border-gray-300 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">{data.type} - Transaction Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
              {data.details.map((detail, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {detail.date ? new Date(detail.date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {detail.number || detail.invoiceNumber || detail.saleNumber || detail.reference || 'N/A'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {detail.description || detail.productName || detail.client || 'N/A'}
                  </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                    {formatCurrency(detail.amount || detail.cogsAmount || 0)}
                        </td>
                      </tr>
                    ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan="3" className="px-4 py-2 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                  {formatCurrency(data.details.reduce((sum, d) => sum + (d.amount || d.cogsAmount || 0), 0))}
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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const asOfDate = data.asOfDate || '';
  const hasComparison = data.previousYear && data.comparisonType;
  const isBalanced = data.isBalanced;
  const balanceDifference = Math.abs(data.balanceDifference || 0);
  
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
    >
      {data && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2">Balance Sheet</h2>
            <p className="text-sm text-gray-600 mt-1">As of {asOfDate}</p>
            </div>

          {/* Comparison Toggle */}
          {hasComparison && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  Comparing with Previous Year
                </span>
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, comparison: !prev.comparison }))}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {expandedSections.comparison ? 'Hide' : 'Show'} Comparison
                </button>
              </div>
              </div>
          )}

          {/* Balance Sheet Table */}
                <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
                    <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300"></th>
                  {hasComparison && expandedSections.comparison && (
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300">Previous Year</th>
                  )}
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300">Current</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300">% of Total Assets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {React.Children.toArray(
                        <>
                {/* ASSETS SECTION */}
                <tr className="bg-gray-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-gray-900 uppercase">
                    ASSETS
                  </td>
                        </tr>

                {/* Current Assets */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-gray-800">
                    Current Assets
                  </td>
                      </tr>

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

                <BalanceSheetRow
                  label="Prepaid Expenses"
                  value={data.assets?.currentAssets?.prepaidExpenses || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.assets?.currentAssets?.prepaidExpenses}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Current Assets</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.assets?.currentAssets?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.assets?.currentAssets?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.assets?.currentAssets?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                {/* Non-Current Assets */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-gray-800">
                    Non-Current Assets
                  </td>
                </tr>

                <tr>
                  <td className="py-2 px-4 pl-8 text-gray-700">Property, Plant & Equipment</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right text-gray-700">
                      {formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right text-gray-900">
                    {formatCurrency(data.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0)}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-700">
                    {data.assets?.total > 0 ? ((data.assets?.nonCurrentAssets?.propertyPlantEquipment?.net || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                <tr>
                  <td className="py-2 px-4 pl-12 text-gray-600 text-sm">Less: Accumulated Depreciation</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right text-gray-600 text-sm">
                      ({formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.propertyPlantEquipment?.accumulatedDepreciation || 0)})
                    </td>
                  )}
                  <td className="py-2 px-4 text-right text-gray-600 text-sm">
                    ({formatCurrency(data.assets?.nonCurrentAssets?.propertyPlantEquipment?.accumulatedDepreciation || 0)})
                  </td>
                  <td className="py-2 px-4 text-right text-gray-600 text-sm">-</td>
                      </tr>

                <BalanceSheetRow
                  label="Intangible Assets"
                  value={data.assets?.nonCurrentAssets?.intangibleAssets || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.assets?.nonCurrentAssets?.intangibleAssets}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <BalanceSheetRow
                  label="Other Non-Current Assets"
                  value={data.assets?.nonCurrentAssets?.otherNonCurrentAssets || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.assets?.nonCurrentAssets?.otherNonCurrentAssets}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Non-Current Assets</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.assets?.nonCurrentAssets?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.assets?.nonCurrentAssets?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.assets?.nonCurrentAssets?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                <tr className="border-t-2 border-gray-400">
                  <td className="py-3 px-4 font-bold text-lg text-gray-900">TOTAL ASSETS</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(data.previousYear?.assets?.total || 0)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                    {formatCurrency(data.assets?.total || 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">100.0%</td>
                        </tr>

                {/* LIABILITIES SECTION */}
                <tr className="bg-gray-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-gray-900 uppercase">
                    LIABILITIES
                  </td>
                        </tr>

                {/* Current Liabilities */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-gray-800">
                    Current Liabilities
                  </td>
                      </tr>

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
                  label="Accrued Expenses"
                  value={data.liabilities?.currentLiabilities?.accruedExpenses || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.liabilities?.currentLiabilities?.accruedExpenses}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Current Liabilities</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.liabilities?.currentLiabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.liabilities?.currentLiabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.liabilities?.currentLiabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                {/* Non-Current Liabilities */}
                <tr className="bg-gray-100">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-semibold text-gray-800">
                    Non-Current Liabilities
                  </td>
                        </tr>

                <BalanceSheetRow
                  label="Long-term Loans"
                  value={data.liabilities?.nonCurrentLiabilities?.longTermLoans || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.liabilities?.nonCurrentLiabilities?.longTermLoans}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <BalanceSheetRow
                  label="Bonds Payable"
                  value={data.liabilities?.nonCurrentLiabilities?.bondsPayable || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.liabilities?.nonCurrentLiabilities?.bondsPayable}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <BalanceSheetRow
                  label="Other Non-Current Liabilities"
                  value={data.liabilities?.nonCurrentLiabilities?.otherNonCurrentLiabilities || 0}
                  totalAssets={data.assets?.total || 0}
                  previousValue={data.previousYear?.liabilities?.nonCurrentLiabilities?.otherNonCurrentLiabilities}
                  showComparison={hasComparison && expandedSections.comparison}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Non-Current Liabilities</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.liabilities?.nonCurrentLiabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.liabilities?.nonCurrentLiabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.liabilities?.nonCurrentLiabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                <tr className="border-t-2 border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">TOTAL LIABILITIES</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.liabilities?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.liabilities?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.liabilities?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                      </tr>

                {/* Total Liabilities with Interest - Informational Note
                {data.totalLiabilitiesWithInterest && data.totalLiabilitiesWithInterest > data.liabilities?.total && (
                  <tr className="bg-blue-50">
                    <td className="py-2 px-4 text-sm text-gray-600 italic pl-8">
                      Total Liabilities (including future interest payments)
                    </td>
                    {hasComparison && expandedSections.comparison && (
                      <td className="py-2 px-4 text-right text-sm text-gray-600 italic">
                        -
                      </td>
                    )}
                    <td className="py-2 px-4 text-right text-sm text-gray-700 font-medium">
                      {formatCurrency(data.totalLiabilitiesWithInterest || 0)}
                    </td>
                    <td className="py-2 px-4 text-right text-sm text-gray-600 italic">
                      {data.assets?.total > 0 ? ((data.totalLiabilitiesWithInterest || 0) / data.assets.total * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                )} */}

                {/* EQUITY SECTION */}
                      <tr className="bg-gray-50">
                  <td colSpan={hasComparison && expandedSections.comparison ? 4 : 3} className="py-2 px-4 font-bold text-gray-900 uppercase">
                    EQUITY
                  </td>
                      </tr>

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

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">TOTAL EQUITY</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-2 px-4 text-right font-semibold text-gray-900">
                      {formatCurrency(data.previousYear?.equity?.total || 0)}
                    </td>
                  )}
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.equity?.total || 0)}
                  </td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {data.assets?.total > 0 ? ((data.equity?.total || 0) / data.assets.total * 100).toFixed(1) : 0}%
                  </td>
                        </tr>

                <tr className="border-t-2 border-gray-400">
                  <td className="py-3 px-4 font-bold text-lg text-gray-900">TOTAL LIABILITIES & EQUITY</td>
                  {hasComparison && expandedSections.comparison && (
                    <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                      {formatCurrency(data.previousYear?.totalLiabilitiesAndEquity || 0)}
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
                    {formatCurrency(data.totalLiabilitiesAndEquity || 0)}
                  </td>
                      <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">100.0%</td>
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
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Ratios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Ratio</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {data.ratios.currentRatio ? data.ratios.currentRatio.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Current Assets ÷ Current Liabilities
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Quick Ratio</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {data.ratios.quickRatio ? data.ratios.quickRatio.toFixed(2) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    (Cash + Accounts Receivable) ÷ Current Liabilities
                  </p>
              </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Debt-to-Equity</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {data.ratios.debtToEquity ? (data.ratios.debtToEquity < 0.01 ? data.ratios.debtToEquity.toFixed(4) : data.ratios.debtToEquity.toFixed(2)) : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Total Liabilities ÷ Total Equity
                  </p>
            </div>
          </div>
            </div>
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
    <tr className="hover:bg-gray-50">
      <td className="py-2 px-4 text-gray-900">
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
      {showComparison && (
        <td className="py-2 px-4 text-right text-gray-700">
          {formatCurrency(previousValue || 0)}
        </td>
      )}
      <td className="py-2 px-4 text-right text-gray-900">
        {formatCurrency(value)}
      </td>
      <td className="py-2 px-4 text-right text-gray-700">
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
      <div className="bg-white rounded-lg border border-gray-300 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">{data.type} - Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                {data.type === 'Accounts Receivable' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                  </>
                )}
                {data.type === 'Accounts Payable' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                  </>
                )}
                {data.type === 'Inventory' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {data.type === 'Accounts Receivable' && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.invoiceNumber || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.clientName || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.paid || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.balanceDue || 0)}</td>
                    </>
                  )}
                  {data.type === 'Accounts Payable' && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.description || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.merchant || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.paid || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.balanceDue || 0)}</td>
                    </>
                  )}
                  {data.type === 'Inventory' && (
                    <>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.name || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantity || 0}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.cost || 0)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.value || 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={data.type === 'Inventory' ? 3 : 5} className="px-4 py-2 text-sm text-gray-900">Total</td>
                <td className="px-4 py-2 text-sm text-gray-900 text-right">
                  {formatCurrency(data.items.reduce((sum, item) => {
                    if (data.type === 'Accounts Receivable' || data.type === 'Accounts Payable') {
                      return sum + (item.balanceDue || 0);
                    } else {
                      return sum + (item.value || 0);
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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  return (
    <FinancialReport
      title="Tax Summary"
      subtitle={data?.period ? `${data.period.startDate} to ${data.period.endDate}` : "Tax Report"}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Collected Tax</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.collectedTaxes.totalCollectedTax)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                From taxable amount of {formatCurrency(data.collectedTaxes.totalTaxableAmount)}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Tax Paid</h3>
              <p className="text-2xl font-semibold text-gray-800">
                {formatCurrency(data.paidTaxes.totalTaxPaid)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                From {data.paidTaxes.expenses.length} tax-related expenses
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Net Tax Liability</h3>
              <p className={`text-2xl font-semibold ${data.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(data.netTaxLiability)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.netTaxLiability >= 0 ? 'Tax to be paid' : 'Tax credit'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Collected Taxes by Rate</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Rate</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable Amount</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.collectedTaxes.byRate.map((taxRate) => (
                      <tr key={taxRate.rate} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{taxRate.rate}%</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(taxRate.taxableAmount)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(taxRate.taxAmount)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.collectedTaxes.totalTaxableAmount)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.collectedTaxes.totalCollectedTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">Tax Expenses</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.paidTaxes.expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{expense.description}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{expense.category}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(expense.amount)}</td>
                      </tr>
                    ))}
                    {data.paidTaxes.expenses.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-4 py-2 text-sm text-gray-500 text-center">No tax expenses recorded</td>
                      </tr>
                    )}
                    <tr className="font-semibold bg-gray-50">
                      <td colSpan="2" className="px-4 py-2 text-sm text-gray-900">Total Tax Paid</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(data.paidTaxes.totalTaxPaid)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <h3 className="text-md font-medium text-gray-800 mb-3">Tax Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-700 mb-1">Total Sales Tax Collected</p>
                <p className="text-lg font-semibold">{formatCurrency(data.collectedTaxes.totalCollectedTax)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1">Total Tax Paid Out</p>
                <p className="text-lg font-semibold">{formatCurrency(data.paidTaxes.totalTaxPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-1">Net Tax Position</p>
                <p className={`text-lg font-semibold ${data.netTaxLiability >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(data.netTaxLiability)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please generate the report.</p>
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
    >
      {data && (
        <>
          <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-blue-800">
                {type === 'receivable' ? 'Outstanding Invoices' : 'Outstanding Bills'}
              </h3>
              <span className="text-xs text-blue-700">As of {data.asOfDate}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <p className="text-sm text-blue-700 mb-1">
                  Total {type === 'receivable' ? 'Receivables' : 'Payables'}
                </p>
                <p className="text-xl font-semibold text-blue-900">{formatCurrency(grandTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700 mb-1">
                  {type === 'receivable' ? 'Customers' : 'Vendors'} with Outstanding Balances
                </p>
                <p className="text-xl font-semibold text-blue-900">{groupedData.length}</p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {type === 'receivable' ? 'Customer' : 'Vendor'}
                  </th>
                  {agingBuckets.map(bucket => (
                    <th key={bucket.label} className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {bucket.label}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {groupedData.map(entity => (
                  <tr key={entity.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{entity.name}</td>
                    {agingBuckets.map(bucket => (
                      <td key={bucket.label} className="px-4 py-2 text-sm text-gray-900 text-right">
                        {formatCurrency(entity.buckets[bucket.label])}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(entity.total)}
                    </td>
                  </tr>
                ))}
                {groupedData.length === 0 && (
                  <tr>
                    <td colSpan={agingBuckets.length + 2} className="px-4 py-2 text-sm text-gray-500 text-center">
                      No outstanding {type === 'receivable' ? 'invoices' : 'bills'}
                    </td>
                  </tr>
                )}
                <tr className="font-semibold bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">Total</td>
                  {agingBuckets.map(bucket => (
                    <td key={bucket.label} className="px-4 py-2 text-sm text-gray-900 text-right">
                      {formatCurrency(bucketTotals[bucket.label])}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-800 mb-4">
              {type === 'receivable' ? 'Outstanding Invoices Detail' : 'Outstanding Bills Detail'}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {type === 'receivable' ? 'Invoice #' : 'Bill #'}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {type === 'receivable' ? 'Customer' : 'Vendor'}
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Past Due
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(data?.invoices || processedItems).map((item, index) => {
                    const entityInfo = getEntityInfo(item);
                    const daysPastDue = item.daysPastDue !== undefined ? item.daysPastDue : getDaysPastDue(item.dueDate);
                    const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                    const issueDate = item.issueDate ? new Date(item.issueDate) : null;
                    
                    return (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.invoiceNumber || entityInfo.documentNumber || 'N/A'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{entityInfo.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {issueDate && !isNaN(issueDate.getTime()) ? issueDate.toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {dueDate && !isNaN(dueDate.getTime()) ? dueDate.toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{daysPastDue}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(Number(item.amount) || 0)}</td>
                      </tr>
                    );
                  })}
                  {(!data?.invoices || data.invoices.length === 0) && processedItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-2 text-sm text-gray-500 text-center">
                        No outstanding {type === 'receivable' ? 'invoices' : 'bills'}
                      </td>
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
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No Data Available</h3>
        <p className="text-gray-500 mt-2">Please select a time period and generate the report.</p>
      </div>
    );
  }
  
  if (!data) return null;

  const companyName = data.companyName || 'Company';
  const periodLabel = data.period ? `${data.period.startDate} to ${data.period.endDate}` : '';
  const netCashFlow = data.netCashFlow || 0;
  const openingBalance = data.openingCashBalance || 0;
  const closingBalance = data.closingCashBalance || 0;
  
  return (
    <FinancialReport
      title="Cash Flow Summary"
      subtitle={periodLabel}
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onRefresh={onRefresh}
      onExport={onExport}
      loading={loading}
      error={error}
    >
      {data && (
        <div className="space-y-6">
          {/* Company Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
            <h2 className="text-xl font-semibold text-gray-700 mt-2">Cash Flow Summary</h2>
            <p className="text-sm text-gray-600 mt-1">For the Period: {periodLabel}</p>
            </div>
            
          {/* Cash Flow Statement Table */}
              <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
                  <thead>
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300"></th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900 border-b-2 border-gray-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                {/* CASH INFLOWS SECTION */}
                <tr className="bg-gray-50">
                  <td colSpan="2" className="py-2 px-4 font-bold text-gray-900 uppercase">
                    CASH INFLOWS
                        </td>
                      </tr>

                <CashFlowRow
                  label="Cash from Customer Payments"
                  value={data.cashInflows?.customerPayments || 0}
                  hasDetails={data.cashInflows?.details?.filter(d => d.type === 'customer_payment' || d.type === 'sale_payment').length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Cash from Customer Payments', 
                    items: data.cashInflows?.details?.filter(d => d.type === 'customer_payment' || d.type === 'sale_payment') || [] 
                  })}
                />

                <CashFlowRow
                  label="Other Cash Receipts"
                  value={data.cashInflows?.otherCashReceipts || 0}
                  hasDetails={data.cashInflows?.details?.filter(d => d.type === 'other_receipt').length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Other Cash Receipts', 
                    items: data.cashInflows?.details?.filter(d => d.type === 'other_receipt') || [] 
                  })}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Cash Inflows</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.cashInflows?.total || 0)}
                      </td>
                    </tr>

                {/* CASH OUTFLOWS SECTION */}
                    <tr className="bg-gray-50">
                  <td colSpan="2" className="py-2 px-4 font-bold text-gray-900 uppercase">
                    CASH OUTFLOWS
                  </td>
                    </tr>

                <CashFlowRow
                  label="Payments to Suppliers"
                  value={data.cashOutflows?.supplierPayments || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && (d.category?.toLowerCase().includes('supplier') || d.category?.toLowerCase().includes('vendor'))).length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Payments to Suppliers', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && (d.category?.toLowerCase().includes('supplier') || d.category?.toLowerCase().includes('vendor'))) || [] 
                  })}
                />

                <CashFlowRow
                  label="Salary Payments"
                  value={data.cashOutflows?.salaryPayments || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && (d.category?.toLowerCase().includes('salary') || d.category?.toLowerCase().includes('wage') || d.category?.toLowerCase().includes('payroll'))).length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Salary Payments', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && (d.category?.toLowerCase().includes('salary') || d.category?.toLowerCase().includes('wage') || d.category?.toLowerCase().includes('payroll'))) || [] 
                  })}
                />

                <CashFlowRow
                  label="Rent Payments"
                  value={data.cashOutflows?.rentPayments || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && d.category?.toLowerCase().includes('rent')).length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Rent Payments', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && d.category?.toLowerCase().includes('rent')) || [] 
                  })}
                />

                <CashFlowRow
                  label="Other Expense Payments"
                  value={data.cashOutflows?.otherExpensePayments || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && !d.category?.toLowerCase().includes('supplier') && !d.category?.toLowerCase().includes('vendor') && !d.category?.toLowerCase().includes('salary') && !d.category?.toLowerCase().includes('wage') && !d.category?.toLowerCase().includes('payroll') && !d.category?.toLowerCase().includes('rent')).length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Other Expense Payments', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'expense_payment' && !d.category?.toLowerCase().includes('supplier') && !d.category?.toLowerCase().includes('vendor') && !d.category?.toLowerCase().includes('salary') && !d.category?.toLowerCase().includes('wage') && !d.category?.toLowerCase().includes('payroll') && !d.category?.toLowerCase().includes('rent')) || [] 
                  })}
                />

                <CashFlowRow
                  label="Asset Purchases"
                  value={data.cashOutflows?.assetPurchases || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'asset_purchase').length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Asset Purchases', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'asset_purchase') || [] 
                  })}
                />

                <CashFlowRow
                  label="Loan Payments"
                  value={data.cashOutflows?.loanPayments || 0}
                  isNegative={true}
                  hasDetails={data.cashOutflows?.details?.filter(d => d.type === 'loan_payment').length > 0}
                  onDrillDown={() => handleDrillDown({ 
                    type: 'Loan Payments', 
                    items: data.cashOutflows?.details?.filter(d => d.type === 'loan_payment') || [] 
                  })}
                />

                <tr className="border-t border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">Total Cash Outflows</td>
                  <td className="py-2 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.cashOutflows?.total || 0)}
                        </td>
                      </tr>

                <tr className="border-t-2 border-gray-300">
                  <td className="py-2 px-4 font-semibold text-gray-900">NET CASH FLOW</td>
                  <td className={`py-2 px-4 text-right font-semibold text-gray-900 ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCashFlow)}
                      </td>
                    </tr>

                <tr className="border-t-2 border-gray-400">
                  <td className="py-3 px-4 font-semibold text-gray-900">Opening Cash Balance</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {formatCurrency(openingBalance)}
                        </td>
                      </tr>

                <tr>
                  <td className="py-2 px-4 text-gray-700">Add: Net Cash Flow</td>
                  <td className={`py-2 px-4 text-right text-gray-700 ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netCashFlow)}
                  </td>
                </tr>

                <tr className="border-t-2 border-gray-400">
                  <td className="py-3 px-4 font-bold text-lg text-gray-900">Closing Cash Balance</td>
                  <td className="py-3 px-4 text-right font-bold text-lg text-gray-900">
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
    <tr className="hover:bg-gray-50">
      <td className="py-2 px-4 text-gray-900">
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
      <td className="py-2 px-4 text-right text-gray-900">
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
      <div className="bg-white rounded-lg border border-gray-300 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">{data.type} - Transaction Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                    </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {item.reference || 'N/A'}
                    </td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {item.description || 'N/A'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                    {formatCurrency(item.amount || 0)}
                    </td>
                  </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan="3" className="px-4 py-2 text-sm text-gray-900">Total</td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
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
  SalesAnalysisReport, 
  ExpenseAnalysisReport, 
  ProfitabilityAnalysisReport 
} from './NewReportComponents';

// Re-export for use in other files
export { 
  StockMovementReport, 
  SalesAnalysisReport, 
  ExpenseAnalysisReport, 
  ProfitabilityAnalysisReport 
};
