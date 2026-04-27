"use client";
import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import {
  BarChart as BarChartIcon,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileBarChart,
  ChevronDown,
  Search,
  Info,
  PieChart as PieChartIcon,
  Clock,
  AlertCircle,
  Loader2,
  Package,
  X,
  ArrowLeft,
  LayoutDashboard
} from "lucide-react";

import { 
  fetchFinancialSummary, 
  fetchIncomeStatement, 
  fetchBalanceSheet, 
  fetchCashFlowStatement,
  fetchTaxSummary,
  fetchExpenseReport,
  fetchSalesReport,
  fetchStockMovement,
  fetchPosDailyReport,
  fetchFinancialRatios,
  fetchAvailableReports,
  exportReport,
  fetchFinancialAnalytics,
  fetchProductProfitDetail
} from "../services/financialReportingService";

import {
  ProfitLossReport,
  BalanceSheetReport,
  CashFlowReport,
  TaxSummaryReport,
  StockMovementReport,
  PosDailyReport,
  FinancialReport,
} from "@/components/FinancialReportComponents";

import {ExpenseReport} from "@/components/ExpenseReport";
import { SalesReport } from "@/components/SalesReport";
import { formatCurrency } from "@/lib/currencyUtils";

import { FinancialRatiosReport } from "@/components/FinancialRatiosReport";
import { getTimeframeLabel, formatDate, formatPeriodRange, formatYmdInTimeZone } from "@/lib/dateUtils";
import PermissionGuard from "@/components/PermissionGuard";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

const formatCompactNumber = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

const FinancialReportingPage = () => {
  const searchParams = useSearchParams();
  
  // State management for reports and UI
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [activeReport, setActiveReport] = useState('summary');
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableReports, setAvailableReports] = useState([]);
  
  // Check for report query parameter on mount
  useEffect(() => {
    const reportParam = searchParams?.get('report');
    if (reportParam) {
      setSelectedReport(reportParam);
      setActiveReport(reportParam);
      // Clean up URL parameter
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/reports');
      }
    }
  }, [searchParams]);
  
  // NEW: Custom date range state
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [showSingleDayPicker, setShowSingleDayPicker] = useState(false);
  const [singleDayPickerDate, setSingleDayPickerDate] = useState(() => formatYmdInTimeZone(new Date()));
  const [showBrowseReports, setShowBrowseReports] = useState(false);

  /** Date range payload for APIs: custom range, or one civil day (revenue + GL COGS for that day). */
  const customRangeForApi = useMemo(() => {
    if (timeframe === "singleDay") {
      const d = customDateRange?.startDate || customDateRange?.endDate;
      return d ? { startDate: d, endDate: d } : null;
    }
    if (timeframe === "custom" && customDateRange?.startDate && customDateRange?.endDate) {
      return customDateRange;
    }
    return null;
  }, [timeframe, customDateRange]);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    groupBy: 'month',
    metric: 'profit',
    categoryId: ''
  });

  // Data state for different reports
  const [financialSummary, setFinancialSummary] = useState(null);
  /** P&L snapshot for summary chart (separate from full profit-loss report state). */
  const [summaryPlStatement, setSummaryPlStatement] = useState(null);
  const [financialAnalytics, setFinancialAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [productProfitDetail, setProductProfitDetail] = useState(null);
  const [productProfitLoading, setProductProfitLoading] = useState(false);
  const [productProfitError, setProductProfitError] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [cashFlowStatement, setCashFlowStatement] = useState(null);
  const [taxSummary, setTaxSummary] = useState(null);
  const [expenseReport, setExpenseReport] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [stockMovement, setStockMovement] = useState(null);
  const [stockMovementProductId, setStockMovementProductId] = useState(null);
  const [posDailyReport, setPosDailyReport] = useState(null);
  const [posDailyDate, setPosDailyDate] = useState(() => formatYmdInTimeZone(new Date()));
  const [financialRatios, setFinancialRatios] = useState(null);
  const analyticsLineColors = {
    revenue: '#2563eb',
    expenses: '#dc2626',
    profit: '#15803d'
  };
  const pieColors = ['#2563eb', '#7c3aed', '#f97316', '#0ea5e9', '#ec4899', '#14b8a6', '#6366f1', '#65a30d'];
  const analyticsMetricConfig = useMemo(() => ([
    {
      id: 'revenue',
      label: 'Total revenue',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      value: financialAnalytics?.totals?.revenue || 0
    },
    {
      id: 'operatingExpenses',
      label: 'Operating expenses',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      value:
        financialAnalytics?.totals?.operatingExpenses ??
        Math.max(
          0,
          (Number(financialAnalytics?.totals?.expenses) || 0) -
            (Number(financialAnalytics?.totals?.cogs) || 0)
        )
    },
    {
      id: 'cogs',
      label: 'Cost of goods sold',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      value: financialAnalytics?.totals?.cogs || 0
    },
    {
      id: 'profit',
      label: 'Net profit',
      subtitle: 'Revenue − operating − COGS',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      value: financialAnalytics?.totals?.profit || 0
    },
    {
      id: 'avgRevenue',
      label: 'Avg revenue / period',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      value: financialAnalytics?.totals?.avgRevenue || 0
    }
  ]), [financialAnalytics]);
  const analyticsTrend = financialAnalytics?.trend || [];
  const analyticsExpenseBreakdown = financialAnalytics?.expenseBreakdown || [];
  const analyticsRevenueSources = financialAnalytics?.revenueBySource || [];
  const analyticsTopCustomers = financialAnalytics?.topCustomers || [];
  const analyticsRevenueCategoryForecast = financialAnalytics?.categoryForecasting?.revenue || [];
  const analyticsExpenseCategoryForecast = financialAnalytics?.categoryForecasting?.expenses || [];
  const analyticsInventoryCategories = financialAnalytics?.categoryForecasting?.categories || [];

  const plSnapshotChartData = useMemo(() => {
    const pl = summaryPlStatement;
    if (!pl) return [];
    const revenue = Number(pl.totalRevenue ?? 0);
    const cogs = Number(pl.cogs?.total ?? pl.cogs?.costOfProductsSold ?? 0);
    const opEx = Number(pl.totalOperatingExpenses ?? 0);
    const net = Number(pl.netIncome ?? 0);
    return [
      { name: 'Revenue', amount: revenue, fill: '#2563eb' },
      { name: 'COGS', amount: cogs, fill: '#dc2626' },
      { name: 'Operating expenses', amount: opEx, fill: '#ea580c' },
      {
        name: 'Net income',
        amount: net,
        fill: net >= 0 ? '#15803d' : '#b91c1c'
      }
    ];
  }, [summaryPlStatement]);

  // Load reports data on component mount
  useEffect(() => {
    const loadReportsData = async () => {
      try {
        const reports = await fetchAvailableReports();
        setAvailableReports(reports);
      } catch (err) {
        console.error("Error loading reports:", err);
        setError("Failed to load available reports. Please try again.");
        setAvailableReports([]);
      }
    };

    loadReportsData();
  }, []);

  // Load financial data when timeframe changes
  useEffect(() => {
    const loadFinancialData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [summaryData, plSnapshot] = await Promise.all([
          fetchFinancialSummary(timeframe, customRangeForApi),
          fetchIncomeStatement({
            timeframe,
            customDateRange: customRangeForApi
          }).catch((e) => {
            console.error('Summary P&L snapshot:', e);
            return null;
          })
        ]);
        setFinancialSummary(summaryData);
        setSummaryPlStatement(plSnapshot);
      } catch (err) {
        console.error("Error loading financial summary:", err);
        setError("Failed to load financial data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (activeReport === 'summary') {
      loadFinancialData();
    }
  }, [timeframe, activeReport, customRangeForApi]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        const analytics = await fetchFinancialAnalytics({
          timeframe,
          customDateRange: customRangeForApi,
          groupBy: analyticsFilters.groupBy,
          categoryId: analyticsFilters.categoryId
        });
        setFinancialAnalytics(analytics);
      } catch (err) {
        console.error('Error loading financial analytics:', err);
        setAnalyticsError(err.message || 'Failed to load analytics data.');
        setFinancialAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [timeframe, customRangeForApi, analyticsFilters.groupBy, analyticsFilters.categoryId]);

  useEffect(() => {
    if (selectedReport !== 'profit-analysis') return undefined;

    let cancelled = false;
    (async () => {
      setProductProfitLoading(true);
      setProductProfitError(null);
      try {
        const data = await fetchProductProfitDetail({
          timeframe,
          customDateRange: customRangeForApi,
          categoryId: analyticsFilters.categoryId,
        });
        if (!cancelled) {
          setProductProfitDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setProductProfitError(err?.message || 'Failed to load product-level profit.');
          setProductProfitDetail(null);
        }
      } finally {
        if (!cancelled) setProductProfitLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedReport, timeframe, customRangeForApi, analyticsFilters.categoryId]);

  // NEW: Handle custom date range change
  const handleCustomDateRangeChange = (field, value) => {
    setCustomDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // NEW: Handle timeframe change - show modal if custom is selected
  const handleTimeframeChange = (value) => {
    if (value === "custom") {
      setCustomDateRange({
        startDate: "",
        endDate: "",
      });
      setShowCustomDateRange(true);
      return;
    }
    if (value === "singleDay") {
      const d =
        customDateRange?.startDate &&
        customDateRange?.endDate &&
        customDateRange.startDate === customDateRange.endDate
          ? customDateRange.startDate
          : formatYmdInTimeZone(new Date());
      setSingleDayPickerDate(d);
      setCustomDateRange({ startDate: d, endDate: d });
      setTimeframe("singleDay");
      setShowSingleDayPicker(true);
      return;
    }
    setTimeframe(value);
  };

  // NEW: Apply custom date range
  const applyCustomDateRange = () => {
    if (!customDateRange.startDate || !customDateRange.endDate) {
      setError("Please select both start and end dates");
      return;
    }
    
    if (new Date(customDateRange.startDate) > new Date(customDateRange.endDate)) {
      setError("Start date cannot be after end date");
      return;
    }
    
    setTimeframe('custom');
    setShowCustomDateRange(false);
    setError(null);
  };

  const applySingleDayPicker = () => {
    if (!singleDayPickerDate?.trim()) {
      setError("Please select a date");
      return;
    }
    const d = singleDayPickerDate.trim();
    setCustomDateRange({ startDate: d, endDate: d });
    setTimeframe("singleDay");
    setShowSingleDayPicker(false);
    setError(null);
  };

  // Get effective date range for API calls
  const getEffectiveDateRange = () => {
    if (timeframe === "custom" && customDateRange?.startDate && customDateRange?.endDate) {
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
      };
    }
    if (timeframe === "singleDay" && (customDateRange?.startDate || customDateRange?.endDate)) {
      const d = customDateRange.startDate || customDateRange.endDate;
      return { startDate: d, endDate: d };
    }
    return { timeframe };
  };

  // Display date range for summary (from API or derived)
  const summaryDateRangeLabel = useMemo(() => {
    if (financialSummary?.timeframe?.startDate && financialSummary?.timeframe?.endDate) {
      const label = formatPeriodRange(
        financialSummary.timeframe.startDate,
        financialSummary.timeframe.endDate,
        ' – '
      );
      if (label) return label;
    }
    if (timeframe === "today") return getTimeframeLabel("today");
    if (timeframe === "singleDay" && (customDateRange?.startDate || customDateRange?.endDate)) {
      const d = customDateRange.startDate || customDateRange.endDate;
      const oneDay = formatPeriodRange(d, d, " – ");
      if (oneDay) return oneDay;
    }
    return getTimeframeLabel(timeframe);
  }, [financialSummary?.timeframe, timeframe, customDateRange]);

  const analyticsDateRangeLabel = useMemo(() => {
    const pStart = financialAnalytics?.period?.startDate;
    const pEnd = financialAnalytics?.period?.endDate;
    if (pStart && pEnd) {
      const label = formatPeriodRange(pStart, pEnd, ' – ');
      if (label) return label;
    }

    if (timeframe === 'custom' && customDateRange?.startDate && customDateRange?.endDate) {
      const label = formatPeriodRange(customDateRange.startDate, customDateRange.endDate, ' – ');
      if (label) return label;
    }
    if (timeframe === "singleDay" && (customDateRange?.startDate || customDateRange?.endDate)) {
      const d = customDateRange.startDate || customDateRange.endDate;
      const label = formatPeriodRange(d, d, ' – ');
      if (label) return label;
    }

    return summaryDateRangeLabel;
  }, [financialAnalytics?.period, timeframe, customDateRange, summaryDateRangeLabel]);

  // Timeframe options for the main dashboard selector
  const TIMEFRAME_OPTIONS = [
    { value: "today", label: "Today" },
    { value: "singleDay", label: "Pick a day…" },
    { value: "thisMonth", label: "This month" },
    { value: "lastMonth", label: "Last month" },
    { value: "thisQuarter", label: "This quarter" },
    { value: "lastQuarter", label: "Last quarter" },
    { value: "thisYear", label: "This year" },
    { value: "lastYear", label: "Last year" },
    { value: "custom", label: "Custom…" },
  ];

  // Load selected report data
  useEffect(() => {
    const loadSelectedReportData = async () => {
      if (!selectedReport) return;

      setLoading(true);
      setError(null);

      try {
        switch (selectedReport) {
          case 'profit-loss':
            const profitLossData = await fetchIncomeStatement({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setIncomeStatement(profitLossData);
            break;
            
          case 'balance-sheet':
            const balanceSheetData = await fetchBalanceSheet({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setBalanceSheet(balanceSheetData);
            break;
            
          case 'cash-flow':
            const cashFlowData = await fetchCashFlowStatement({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setCashFlowStatement(cashFlowData);
            break;
            
          case 'tax-summary':
            const taxSummaryData = await fetchTaxSummary({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setTaxSummary(taxSummaryData);
            break;
            
          case 'expense-report':
            const expenseData = await fetchExpenseReport({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setExpenseReport(expenseData);
            break;
            
          case 'sales-report':
            const salesData = await fetchSalesReport({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setSalesReport(salesData);
            break;
            
          case 'stock-movement':
            const stockMovementData = await fetchStockMovement({ 
              timeframe,
              customDateRange: customRangeForApi,
              productId: stockMovementProductId || undefined
            });
            setStockMovement(stockMovementData);
            break;
            
          case 'pos-daily':
            const posDailyData = await fetchPosDailyReport(posDailyDate);
            setPosDailyReport(posDailyData);
            break;
            
          case 'financial-ratios':
            const ratiosData = await fetchFinancialRatios({
              timeframe,
              customDateRange: customRangeForApi
            });
            setFinancialRatios(ratiosData);
            break;

          case 'profit-analysis':
            break;
        }

        // Update the lastGenerated date for this report
        setAvailableReports(prev => 
          prev.map(report => 
            report.id === selectedReport 
              ? { ...report, lastGenerated: new Date().toISOString().split('T')[0] }
              : report
          )
        );
      } catch (err) {
        console.error(`Error loading report ${selectedReport}:`, err);
        setError(`Failed to load ${selectedReport} report. Please try again.`);
      } finally {
        setLoading(false);
      }
    };

    loadSelectedReportData();
  }, [selectedReport, timeframe, customRangeForApi, analyticsFilters.categoryId, stockMovementProductId, posDailyDate]);

  // Handle report generation
  const handleGenerateReport = useCallback((reportId) => {
    setActiveReport('report');
    setSelectedReport(reportId);
  }, []);

  // Handle report export
  const handleExportReport = useCallback(async (format, reportType) => {
    try {
      const type = reportType || selectedReport || 'summary';
      const params = {
        timeframe,
        customDateRange: customRangeForApi
      };
      if (type === 'pos-daily') params.date = posDailyDate;
      await exportReport(type, format, params);
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report. Please try again.");
    }
  }, [selectedReport, timeframe, customRangeForApi, posDailyDate]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      if (activeReport === 'summary') {
        const [summaryData, plSnapshot, analytics] = await Promise.all([
          fetchFinancialSummary(timeframe, customRangeForApi),
          fetchIncomeStatement({
            timeframe,
            customDateRange: customRangeForApi
          }).catch(() => null),
          fetchFinancialAnalytics({
            timeframe,
            customDateRange: customRangeForApi,
            groupBy: analyticsFilters.groupBy,
            categoryId: analyticsFilters.categoryId
          })
        ]);
        setFinancialSummary(summaryData);
        setSummaryPlStatement(plSnapshot);
        setFinancialAnalytics(analytics);
      } else if (selectedReport) {
        // Reload selected report
        switch (selectedReport) {
          case 'profit-loss':
            const incomeData = await fetchIncomeStatement({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setIncomeStatement(incomeData);
            break;
            
          case 'balance-sheet':
            const balanceData = await fetchBalanceSheet({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setBalanceSheet(balanceData);
            break;
            
          case 'cash-flow':
            const cashFlowData = await fetchCashFlowStatement({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setCashFlowStatement(cashFlowData);
            break;
            
          case 'tax-summary':
            const taxData = await fetchTaxSummary({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setTaxSummary(taxData);
            break;
            
          case 'expense-report':
            const expenseData = await fetchExpenseReport({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setExpenseReport(expenseData);
            break;
            
          case 'sales-report':
            const salesData = await fetchSalesReport({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setSalesReport(salesData);
            break;
            
          case 'stock-movement':
            const stockMovementData = await fetchStockMovement({ 
              timeframe,
              customDateRange: customRangeForApi,
              productId: stockMovementProductId || undefined
            });
            setStockMovement(stockMovementData);
            break;
            
          case 'pos-daily':
            const posDailyData = await fetchPosDailyReport(posDailyDate);
            setPosDailyReport(posDailyData);
            break;
            
          case 'financial-ratios':
            const ratiosData = await fetchFinancialRatios({ 
              timeframe,
              customDateRange: customRangeForApi
            });
            setFinancialRatios(ratiosData);
            break;

          case 'profit-analysis': {
            const [analyticsReload, productProfitReload] = await Promise.all([
              fetchFinancialAnalytics({
                timeframe,
                customDateRange: customRangeForApi,
                groupBy: analyticsFilters.groupBy,
                categoryId: analyticsFilters.categoryId
              }),
              fetchProductProfitDetail({
                timeframe,
                customDateRange: customRangeForApi,
                categoryId: analyticsFilters.categoryId
              })
            ]);
            setFinancialAnalytics(analyticsReload);
            setProductProfitDetail(productProfitReload);
            setProductProfitError(null);
            break;
          }
        }
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [
    activeReport,
    selectedReport,
    timeframe,
    customRangeForApi,
    analyticsFilters.groupBy,
    analyticsFilters.categoryId,
    stockMovementProductId,
    posDailyDate
  ]);

  // Render selected report component
  const renderSelectedReport = () => {
    switch (selectedReport) {
      case 'profit-loss':
        return (
          <ProfitLossReport
            data={incomeStatement}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'income-statement')}
          />
        );

      case 'profit-analysis':
        return (
          <FinancialReport
            title="Profit Analysis"
            subtitle={analyticsDateRangeLabel}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            loading={analyticsLoading}
            error={analyticsError}
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 max-w-xl">
                  Chart grouping, focus metric, and inventory category filter apply to the analysis below.
                </p>
                {renderProfitAnalysisControlRow()}
              </div>
              {financialAnalytics ? (
                renderProfitAnalysisChartsInner()
              ) : (
                <div className="text-center text-slate-500 py-12 text-sm">No analytics data.</div>
              )}
            </div>
          </FinancialReport>
        );

      case 'balance-sheet':
        return (
          <BalanceSheetReport
            data={balanceSheet}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'balance-sheet')}
          />
        );
        
      case 'cash-flow':
        return (
          <CashFlowReport
            data={cashFlowStatement}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'cash-flow')}
          />
        );

      case 'tax-summary':
        return (
          <TaxSummaryReport
            data={taxSummary}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'tax-summary')}
          />
        );

      case 'expense-report':
        return (
          <ExpenseReport
            data={expenseReport}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'expenses')}
          />
        );

      case 'sales-report':
        return (
          <SalesReport
            data={salesReport}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'sales')}
          />
        );
        
      case 'stock-movement':
        return (
          <StockMovementReport
            data={stockMovement}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'stock-movement')}
            productId={stockMovementProductId}
            onProductFilterChange={setStockMovementProductId}
          />
        );

      case 'pos-daily':
        return (
          <PosDailyReport
            data={posDailyReport}
            loading={loading}
            error={error}
            date={posDailyDate}
            onDateChange={setPosDailyDate}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'pos-daily')}
          />
        );

      case 'financial-ratios':
        return (
          <FinancialRatiosReport
            data={financialRatios}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'financial-ratios')}
          />
        );

      default:
        return (
          <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center">
            <FileText size={48} className="mx-auto text-emerald-400 mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">No report selected</h2>
            <p className="text-slate-500 text-sm">Choose a report from the dashboard or the dropdown above.</p>
          </div>
        );
    }
  };

  // Helper function to get icon component for report
  const getReportIconComponent = (iconName) => {
    const iconMap = {
      FileBarChart: FileBarChart,
      FileText: FileText,
      DollarSign: DollarSign,
      TrendingDown: TrendingDown,
      TrendingUp: TrendingUp,
      Package: Package,
      BarChart: BarChartIcon,
      PieChart: PieChartIcon
    };
    return iconMap[iconName] || FileText;
  };
  
  // Helper function to render icon for report (legacy support)
  const getReportIcon = (iconName) => {
    const IconComponent = getReportIconComponent(iconName);
    return <IconComponent size={24} />;
  };

  // Filter reports based on search query
  const filteredReports = availableReports.filter(report => 
    report?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (report?.description && report.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderProfitAnalysisControlRow = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
        {['day', 'week', 'month'].map((option) => (
          <button
            key={option}
            type="button"
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              analyticsFilters.groupBy === option
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            } ${option === 'day' ? 'rounded-l-xl' : option === 'month' ? 'rounded-r-xl' : ''}`}
            onClick={() => setAnalyticsFilters((prev) => ({ ...prev, groupBy: option }))}
          >
            {option === 'day' ? 'Daily' : option === 'week' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>
      <select
        value={analyticsFilters.metric}
        onChange={(e) => setAnalyticsFilters((prev) => ({ ...prev, metric: e.target.value }))}
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
      >
        <option value="profit">Focus: Profit</option>
        <option value="revenue">Focus: Revenue</option>
        <option value="operatingExpenses">Focus: Operating expenses</option>
        <option value="cogs">Focus: COGS</option>
        <option value="avgRevenue">Focus: Average revenue</option>
      </select>
      <select
        value={analyticsFilters.categoryId}
        onChange={(e) => setAnalyticsFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-[170px]"
      >
        <option value="">All inventory categories</option>
        {analyticsInventoryCategories.map((cat, idx) => (
          <option key={`${cat.id || cat.name}-${idx}`} value={cat.id || ''}>
            {cat.name || 'Uncategorized'}
          </option>
        ))}
      </select>
    </div>
  );

  const renderProfitAnalysisChartsInner = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 mb-6">
        {analyticsMetricConfig.map((metric) => (
          <div
            key={metric.id}
            className={`rounded-xl border p-4 ${metric.border} ${analyticsFilters.metric === metric.id ? metric.bg : 'bg-slate-50/50'}`}
          >
            <p className="text-xs uppercase font-medium text-slate-500 tracking-wide mb-1">
              {metric.label}
            </p>
            {metric.subtitle ? (
              <p className="text-[11px] text-slate-400 mb-1">{metric.subtitle}</p>
            ) : null}
            <p className={`text-xl font-semibold ${metric.color}`}>
              {formatCurrency(metric.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Product and line sales in this period</h4>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              Every invoice line and completed POS line in the date range. Revenue uses line amounts; cost uses product cost, then average cost when cost is unset.
              Respects the inventory category filter above when set.
            </p>
          </div>
        </div>

        {productProfitLoading ? (
          <div className="flex items-center gap-2 py-8 text-slate-500 text-sm">
            <Loader2 size={20} className="animate-spin text-emerald-600" />
            Loading product-level sales…
          </div>
        ) : productProfitError ? (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{productProfitError}</div>
        ) : productProfitDetail?.summary ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Line sales (revenue)</p>
                <p className="text-lg font-semibold text-blue-700 tabular-nums">
                  {formatCurrency(productProfitDetail.summary.productSalesRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Product COGS</p>
                <p className="text-lg font-semibold text-red-700 tabular-nums">
                  {formatCurrency(productProfitDetail.summary.productCostTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Gross profit (lines)</p>
                <p className="text-lg font-semibold text-emerald-700 tabular-nums">
                  {formatCurrency(productProfitDetail.summary.productGrossProfit)}
                </p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Operating expenses</p>
                <p className="text-lg font-semibold text-orange-700 tabular-nums">
                  {formatCurrency(productProfitDetail.summary.operatingExpensesApproved)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Approved expense register, same period</p>
              </div>
              <div className="rounded-lg border border-green-300 bg-white p-3 col-span-2 lg:col-span-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Profit after operating</p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    (productProfitDetail.summary.profitAfterOperatingExpenses || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatCurrency(productProfitDetail.summary.profitAfterOperatingExpenses)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Line gross profit − operating expenses</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white max-h-[min(70vh,520px)] overflow-y-auto">
              <table className="w-full min-w-[920px] text-sm text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr className="text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2.5 px-3 font-medium">Product / line</th>
                    <th className="py-2.5 px-2 font-medium">SKU</th>
                    <th className="py-2.5 px-2 font-medium">Category</th>
                    <th className="py-2.5 px-2 font-medium text-right">Qty</th>
                    <th className="py-2.5 px-2 font-medium text-right">Avg sell</th>
                    <th className="py-2.5 px-2 font-medium text-right">Avg cost</th>
                    <th className="py-2.5 px-2 font-medium text-right">Revenue</th>
                    <th className="py-2.5 px-2 font-medium text-right">COGS</th>
                    <th className="py-2.5 px-2 font-medium text-right">Profit</th>
                    <th className="py-2.5 pl-2 pr-3 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(productProfitDetail.rows || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500">
                        No invoice or POS lines in this period for the current filters.
                      </td>
                    </tr>
                  ) : (
                    (productProfitDetail.rows || []).map((row, idx) => (
                      <tr key={`${row.productId || row.name}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-slate-800 font-medium max-w-[220px] truncate" title={row.name}>
                          {row.name}
                        </td>
                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.sku || '—'}</td>
                        <td className="py-2 px-2 text-slate-600 max-w-[140px] truncate" title={row.categoryName}>
                          {row.categoryName || '—'}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">
                          {Number(row.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatCurrency(row.avgSellingPrice)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatCurrency(row.avgCostPrice)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800">{formatCurrency(row.revenue)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-800">{formatCurrency(row.cost)}</td>
                        <td
                          className={`py-2 px-2 text-right tabular-nums font-medium ${
                            (row.profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(row.profit)}
                        </td>
                        <td className="py-2 pl-2 pr-3 text-right tabular-nums text-slate-700">
                          {row.marginPercent != null && Number.isFinite(row.marginPercent)
                            ? `${Number(row.marginPercent).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(productProfitDetail.rows || []).length > 0 ? (
                  <tfoot className="sticky bottom-0 bg-slate-100 border-t border-slate-200 font-semibold text-slate-800">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-right text-xs uppercase tracking-wide text-slate-500">
                        Totals
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(productProfitDetail.summary.productSalesRevenue)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(productProfitDetail.summary.productCostTotal)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-emerald-800">
                        {formatCurrency(productProfitDetail.summary.productGrossProfit)}
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-right text-slate-600 text-xs font-medium">
                        {productProfitDetail.summary.productSalesRevenue > 0
                          ? `${(
                              (productProfitDetail.summary.productGrossProfit /
                                productProfitDetail.summary.productSalesRevenue) *
                              100
                            ).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <p className="text-[11px] text-slate-400">
              {productProfitDetail.summary.lineCountInvoices} invoice lines · {productProfitDetail.summary.lineCountPos} POS
              lines · {productProfitDetail.summary.skuCount} grouped rows
            </p>
          </>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="w-full min-w-0 rounded-xl border border-slate-200 p-4 min-h-[380px]">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-semibold text-slate-800">Revenue, expenses (operating + COGS), and profit</h4>
            <span className="text-xs text-slate-500">by {analyticsFilters.groupBy}</span>
          </div>
          {analyticsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart
                data={analyticsTrend}
                margin={{ top: 12, right: 24, left: 16, bottom: 12 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={analyticsLineColors.revenue} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={analyticsLineColors.revenue} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={analyticsLineColors.expenses} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={analyticsLineColors.expenses} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={24} />
                <YAxis tickFormatter={(value) => formatCompactNumber(value)} width={56} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="revenue" stroke={analyticsLineColors.revenue} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke={analyticsLineColors.expenses} fillOpacity={1} fill="url(#colorExpenses)" />
                <Line type="monotone" dataKey="profit" stroke={analyticsLineColors.profit} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[380px] text-slate-500 text-sm">Not enough data for this period.</div>
          )}
        </div>

        <div className="w-full min-w-0 rounded-xl border border-slate-200 p-4 min-h-[340px]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800">Expense breakdown</h4>
            <span className="text-xs text-slate-500">{analyticsExpenseBreakdown.length} accounts</span>
          </div>
          {analyticsExpenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart
                data={analyticsExpenseBreakdown}
                margin={{ top: 12, right: 24, left: 16, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis tickFormatter={(value) => formatCompactNumber(value)} width={64} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="value" fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[340px] text-slate-500 text-sm">No expense data.</div>
          )}
        </div>

        <div className="w-full min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-semibold text-slate-800">Revenue forecast vs budget by inventory category</h4>
            <span className="text-xs text-slate-500">Optional category filter, variance against budget lines</span>
          </div>
          {analyticsRevenueCategoryForecast.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-medium">Category</th>
                    <th className="py-2 px-2 font-medium text-right">Actual</th>
                    <th className="py-2 px-2 font-medium text-right">Forecast</th>
                    <th className="py-2 px-2 font-medium text-right">Budget</th>
                    <th className="py-2 px-2 font-medium text-right">Actual Variance</th>
                    <th className="py-2 pl-2 font-medium text-right">Forecast Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsRevenueCategoryForecast.map((row, idx) => (
                    <tr key={`${row.categoryId || row.categoryName}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-2 text-slate-700">{row.categoryName || 'Uncategorized'}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.actualAmount || 0)}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.forecastAmount || 0)}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.budgetAmount || 0)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${(row.varianceToBudget || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(row.varianceToBudget || 0)}
                      </td>
                      <td className={`py-2 pl-2 text-right font-medium ${(row.forecastVarianceToBudget || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(row.forecastVarianceToBudget || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-slate-500 text-sm">
              No revenue category forecast data for this period.
            </div>
          )}
        </div>

        <div className="w-full min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-semibold text-slate-800">Expenditure forecast vs budget by inventory category</h4>
            <span className="text-xs text-slate-500">Supports variance analysis against expense budget lines</span>
          </div>
          {analyticsExpenseCategoryForecast.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2 font-medium">Category</th>
                    <th className="py-2 px-2 font-medium text-right">Actual</th>
                    <th className="py-2 px-2 font-medium text-right">Forecast</th>
                    <th className="py-2 px-2 font-medium text-right">Budget</th>
                    <th className="py-2 px-2 font-medium text-right">Actual Variance</th>
                    <th className="py-2 pl-2 font-medium text-right">Forecast Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsExpenseCategoryForecast.map((row, idx) => (
                    <tr key={`${row.categoryId || row.categoryName}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-2 pr-2 text-slate-700">{row.categoryName || 'Uncategorized'}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.actualAmount || 0)}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.forecastAmount || 0)}</td>
                      <td className="py-2 px-2 text-right text-slate-700">{formatCurrency(row.budgetAmount || 0)}</td>
                      <td className={`py-2 px-2 text-right font-medium ${(row.varianceToBudget || 0) <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(row.varianceToBudget || 0)}
                      </td>
                      <td className={`py-2 pl-2 text-right font-medium ${(row.forecastVarianceToBudget || 0) <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(row.forecastVarianceToBudget || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[120px] text-slate-500 text-sm">
              No expenditure category forecast data for this period.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="min-w-0 rounded-xl border border-slate-200 p-4 min-h-[320px]">
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Revenue by source</h4>
            {analyticsRevenueSources.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={analyticsRevenueSources}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    labelLine={false}
                    label={({ name, percent }) =>
                      analyticsRevenueSources.length <= 5
                        ? `${name} ${(percent * 100).toFixed(0)}%`
                        : `${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {analyticsRevenueSources.map((entry, index) => (
                      <Cell key={`source-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-slate-500 text-sm">No revenue data.</div>
            )}
          </div>
          <div className="min-w-0 xl:col-span-2 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">Top customers</h4>
              <span className="text-xs text-slate-500">{analyticsTopCustomers.length} customers</span>
            </div>
            {analyticsTopCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-2 font-medium">Customer</th>
                      <th className="py-2 px-2 font-medium text-right">Sales</th>
                      <th className="py-2 pl-2 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsTopCustomers.slice(0, 8).map((customer, idx) => (
                      <tr key={`${customer.name || "customer"}-${idx}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="py-2 pr-2 text-slate-700">{customer.name || "Walk-in Customer"}</td>
                        <td className="py-2 px-2 text-right text-slate-600">{Number(customer.orders || customer.count || 0)}</td>
                        <td className="py-2 pl-2 text-right font-medium text-slate-800">
                          {formatCurrency(Number(customer.revenue || customer.total || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">
                No customer data.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // Render the financial summary dashboard
  const renderAnalyticsPanel = () => {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Profit analysis</h3>
            <p className="text-sm text-slate-500 mt-0.5 break-words">
              {analyticsDateRangeLabel}
            </p>
          </div>
          {renderProfitAnalysisControlRow()}
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-emerald-600 mr-3" />
            <span className="text-slate-500 text-sm">Loading profit analysis...</span>
          </div>
        ) : analyticsError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {analyticsError}
          </div>
        ) : financialAnalytics ? (
          renderProfitAnalysisChartsInner()
        ) : (
          <div className="text-center text-slate-500 py-12 text-sm">No analytics data.</div>
        )}
      </div>
    );
  };

  const renderFinancialSummary = () => {
    const revenue = Number(financialSummary?.revenue ?? 0);
    const expenses = Number(financialSummary?.expenses ?? 0);
    const profit = Number(financialSummary?.profit ?? 0);
    const profitMargin = financialSummary?.profitMargin != null ? Number(financialSummary.profitMargin) : (revenue > 0 ? (profit / revenue) * 100 : 0);
    const outstandingTotal = Number(financialSummary?.outstandingInvoices?.total ?? 0);
    const outstandingCount = Number(financialSummary?.outstandingInvoices?.count ?? 0);

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24">
          <Loader2 size={40} className="animate-spin text-emerald-600 mb-4" />
          <p className="text-slate-500 text-sm">Loading summary...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl bg-white border border-slate-200 p-8 sm:p-10 text-center shadow-sm">
          <AlertCircle size={40} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Could not load data</h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">{error}</p>
          <button
            type="button"
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
            onClick={handleRefresh}
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6 sm:space-y-8">
        {/* Period selector + date range label */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard size={20} className="text-slate-500 hidden sm:block" />
            <span className="text-sm font-medium text-slate-600 shrink-0">Period</span>
            <div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <div className="flex gap-0.5 w-max">
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleTimeframeChange(opt.value)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeframe === opt.value
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 shrink-0">
            {summaryDateRangeLabel}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-500">Total Revenue</span>
              <TrendingUp size={18} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(revenue)}</p>
            <p className="text-xs text-slate-400 mt-1">{summaryDateRangeLabel}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-500">Total costs (COGS + operating)</span>
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(expenses)}</p>
            <p className="text-xs text-slate-400 mt-1">{summaryDateRangeLabel}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-500">Net profit</span>
              <DollarSign size={18} className={profit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
            </div>
            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {profitMargin.toFixed(1)}% net margin (same as P&L)
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-500">Outstanding Invoices</span>
              <Clock size={18} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(outstandingTotal)}</p>
            <p className="text-xs text-slate-400 mt-1">{outstandingCount} unpaid</p>
          </div>
        </div>

        {/* Profit & loss snapshot — same period and engine as full P&L */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Profit &amp; loss snapshot</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {summaryDateRangeLabel} · revenue, COGS, operating expenses, and net income
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 shrink-0"
              onClick={() => handleGenerateReport('profit-loss')}
            >
              Open full P&amp;L →
            </button>
          </div>
          {plSnapshotChartData.length > 0 ? (
            <div className="w-full min-w-0 min-h-[280px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={plSnapshotChartData}
                  margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    interval={0}
                    height={56}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCompactNumber(v)}
                    width={52}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={72}>
                    {plSnapshotChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm rounded-xl bg-slate-50 border border-dashed border-slate-200">
              No profit &amp; loss data for this period.
            </div>
          )}
        </div>

        {renderAnalyticsPanel()}

        {/* Quick reports */}
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Quick reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <button
              type="button"
              className="text-left rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-emerald-200 hover:shadow transition-all"
              onClick={() => handleGenerateReport('profit-loss')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-emerald-50 p-2">
                  <FileBarChart size={20} className="text-emerald-600" />
                </div>
                <h4 className="font-semibold text-slate-800">Profit & Loss</h4>
              </div>
              <p className="text-sm text-slate-500">Income statement for the selected period</p>
            </button>
            <button
              type="button"
              className="text-left rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-emerald-200 hover:shadow transition-all"
              onClick={() => handleGenerateReport('profit-analysis')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-violet-50 p-2">
                  <PieChartIcon size={20} className="text-violet-600" />
                </div>
                <h4 className="font-semibold text-slate-800">Profit Analysis</h4>
              </div>
              <p className="text-sm text-slate-500">Trends, expense mix, forecasts, and revenue sources</p>
            </button>
            <button
              type="button"
              className="text-left rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-emerald-200 hover:shadow transition-all"
              onClick={() => handleGenerateReport('sales-report')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-blue-50 p-2">
                  <TrendingUp size={20} className="text-blue-600" />
                </div>
                <h4 className="font-semibold text-slate-800">Sales Report</h4>
              </div>
              <p className="text-sm text-slate-500">Sales performance and trends</p>
            </button>
            <button
              type="button"
              className="text-left rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-all"
              onClick={() => handleGenerateReport('expense-report')}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-red-50 p-2">
                  <TrendingDown size={20} className="text-red-600" />
                </div>
                <h4 className="font-semibold text-slate-800">Expense Report</h4>
              </div>
              <p className="text-sm text-slate-500">Expenses by category and period</p>
            </button>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-slate-800 text-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/10 p-3">
                <Info size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1">All reports</h3>
                <p className="text-slate-300 text-sm">
                  Generate balance sheet, cash flow, tax summary, and more.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 px-5 py-2.5 bg-white text-slate-800 rounded-xl font-medium text-sm hover:bg-slate-100 transition-colors"
              onClick={() => setShowBrowseReports(true)}
            >
              Browse reports
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PermissionGuard permission="reports.view">
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/50">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16 py-6 sm:py-8">
          {/* Error message */}
          {error && activeReport !== 'summary' && activeReport !== 'report' && (
            <div className="mb-4 sm:mb-6 p-4 border border-red-200 bg-red-50 rounded-xl text-red-700 flex items-center shadow-sm">
              <AlertCircle size={20} className="mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Header: title + report jumper (when viewing summary or report) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Reports</h1>
              <p className="mt-1 text-sm text-slate-500">Financial overview and detailed reports</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-auto sm:min-w-[220px]">
                <select
                  value={selectedReport || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleGenerateReport(e.target.value);
                    } else {
                      setSelectedReport(null);
                      setActiveReport('summary');
                    }
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm"
                >
                  <option value="">Dashboard / Jump to report...</option>
                  {availableReports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {loading && !refreshing && !selectedReport ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24">
              <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
              <p className="text-slate-600 text-sm">Loading...</p>
            </div>
          ) : (
            <>
              {!selectedReport && renderFinancialSummary()}

              {selectedReport && (
                <div className="space-y-4 sm:space-y-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(null);
                      setActiveReport('summary');
                    }}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
                  >
                    <ArrowLeft size={18} />
                    Back to dashboard
                  </button>
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    {renderSelectedReport()}
                  </div>
                </div>
              )}
            </>
          )}
      
          {/* Browse All Reports Modal */}
          {showBrowseReports && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowBrowseReports(false)}>
              <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/50 shrink-0">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Available reports</h2>
                      <p className="text-sm text-slate-500 mt-1">Select a report to view details</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBrowseReports(false)}
                      className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      aria-label="Close"
                    >
                      <X size={22} />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
                  <div className="mb-4 sm:mb-6">
                    <div className="relative">
                      <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search reports..."
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Group reports by category */}
              {(() => {
                const categories = {};
                filteredReports.forEach(report => {
                  const category = report.category || 'Other';
                  if (!categories[category]) {
                    categories[category] = [];
                  }
                  categories[category].push(report);
                });

                  return Object.keys(categories).map(category => (
                    <div key={category} className="mb-6 sm:mb-8">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {categories[category].map((report) => {
                          const IconComponent = getReportIconComponent(report.icon);
                          return (
                            <button
                              type="button"
                              key={report.id}
                              className="group text-left rounded-xl bg-white border border-slate-200 p-4 hover:border-emerald-200 hover:shadow-md transition-all duration-200"
                              onClick={() => {
                                handleGenerateReport(report.id);
                                setShowBrowseReports(false);
                              }}
                            >
                              <div className="flex items-start gap-3 mb-2">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors shrink-0">
                                  <IconComponent size={20} className="text-emerald-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                                    {report.name}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {report.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                                <span className="flex items-center gap-1">
                                  {report.requiresTimeframe && <Calendar size={12} />}
                                  {report.requiresTimeframe ? 'Time-based' : 'Snapshot'}
                                </span>
                                {report.lastGenerated && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatDate(report.lastGenerated)}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}

                  {filteredReports.length === 0 && (
                    <div className="text-center py-12">
                      <Search size={40} className="mx-auto text-slate-300 mb-3" />
                      <h3 className="text-base font-medium text-slate-700 mb-1">No reports found</h3>
                      <p className="text-sm text-slate-500">Try a different search.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      
          {/* Custom Date Range Modal */}
          {showSingleDayPicker && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-semibold text-slate-800">Single day (P&amp;L &amp; COGS)</h2>
                  <button
                    type="button"
                    onClick={() => setShowSingleDayPicker(false)}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Revenue and cost of goods sold use this calendar day only (same rules as monthly reports).
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={singleDayPickerDate}
                    onChange={(e) => setSingleDayPickerDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  />
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
                    onClick={() => setShowSingleDayPicker(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium"
                    onClick={applySingleDayPicker}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCustomDateRange && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-slate-200 shadow-xl">
                <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Custom date range</h2>
              <button
                type="button"
                onClick={() => setShowCustomDateRange(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
                    <input
                      type="date"
                      value={customDateRange.startDate}
                      onChange={(e) => handleCustomDateRangeChange('startDate', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                    <input
                      type="date"
                      value={customDateRange.endDate}
                      onChange={(e) => handleCustomDateRangeChange('endDate', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
                    onClick={() => setShowCustomDateRange(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium"
                    onClick={applyCustomDateRange}
                  >
                    Apply range
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
};

// Wrap component in Suspense for useSearchParams
function FinancialReportingPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>}>
      <FinancialReportingPage />
    </Suspense>
  );
}

export default FinancialReportingPageWrapper;