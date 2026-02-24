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
  fetchAccountsReceivableAging,
  fetchAccountsPayableAging,
  fetchExpenseReport,
  fetchSalesReport,
  fetchInventoryValuation,
  fetchStockMovement,
  fetchPosDailyReport,
  fetchSalesAnalysis,
  fetchExpenseAnalysis,
  fetchProfitabilityAnalysis,
  fetchFinancialRatios,
  fetchAvailableReports,
  exportReport,
  fetchFinancialAnalytics
} from "../services/financialReportingService";

import {
  FinancialReport,
  ProfitLossReport,
  BalanceSheetReport,
  CashFlowReport,
  AgingReportTable,
  PercentageChange,
  TaxSummaryReport,
  StockMovementReport,
  PosDailyReport,
  SalesAnalysisReport,
  ExpenseAnalysisReport,
  ProfitabilityAnalysisReport
} from "@/components/FinancialReportComponents";

import {ExpenseReport} from "@/components/ExpenseReport";
import { SalesReport } from "@/components/SalesReport";
import { formatCurrency } from "@/lib/currencyUtils";
import {InventoryValuationReport} from "@/components/InventoryValuationReport";
import { FinancialRatiosReport } from "@/components/FinancialRatiosReport";
import { getTimeframeLabel, formatDate } from "@/lib/dateUtils";
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
  const [showBrowseReports, setShowBrowseReports] = useState(false);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    groupBy: 'month',
    metric: 'profit'
  });

  // Data state for different reports
  const [financialSummary, setFinancialSummary] = useState(null);
  const [financialAnalytics, setFinancialAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [cashFlowStatement, setCashFlowStatement] = useState(null);
  const [taxSummary, setTaxSummary] = useState(null);
  const [expenseReport, setExpenseReport] = useState(null);
  const [salesReport, setSalesReport] = useState(null);
  const [accountsReceivable, setAccountsReceivable] = useState(null);
  const [accountsPayable, setAccountsPayable] = useState(null);
  const [inventoryValuation, setInventoryValuation] = useState(null);
  const [stockMovement, setStockMovement] = useState(null);
  const [stockMovementProductId, setStockMovementProductId] = useState(null);
  const [posDailyReport, setPosDailyReport] = useState(null);
  const [posDailyDate, setPosDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [salesAnalysis, setSalesAnalysis] = useState(null);
  const [expenseAnalysis, setExpenseAnalysis] = useState(null);
  const [profitabilityAnalysis, setProfitabilityAnalysis] = useState(null);
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
      label: 'Total Revenue',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      value: financialAnalytics?.totals?.revenue || 0
    },
    {
      id: 'expenses',
      label: 'Total Expenses',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      value: financialAnalytics?.totals?.expenses || 0
    },
    {
      id: 'profit',
      label: 'Net Profit',
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      value: financialAnalytics?.totals?.profit || 0
    },
    {
      id: 'avgRevenue',
      label: 'Avg Revenue / Period',
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
        // Fetch summary data
        const summaryData = await fetchFinancialSummary(
          timeframe, 
          timeframe === 'custom' ? customDateRange : null
        );
        setFinancialSummary(summaryData);
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
  }, [timeframe, activeReport, customDateRange]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        setAnalyticsError(null);
        const analytics = await fetchFinancialAnalytics({
          timeframe,
          customDateRange: timeframe === 'custom' ? customDateRange : null,
          groupBy: analyticsFilters.groupBy
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
  }, [timeframe, customDateRange, analyticsFilters.groupBy]);

  // NEW: Handle custom date range change
  const handleCustomDateRangeChange = (field, value) => {
    setCustomDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // NEW: Handle timeframe change - show modal if custom is selected
  const handleTimeframeChange = (value) => {
    if (value === 'custom') {
      // Clear any existing custom date range so user can select fresh dates
      setCustomDateRange({
        startDate: '',
        endDate: ''
      });
      setShowCustomDateRange(true);
    } else {
      setTimeframe(value);
    }
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

  // Get effective date range for API calls
  const getEffectiveDateRange = () => {
    if (timeframe === 'custom') {
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate
      };
    }
    return { timeframe };
  };

  // Display date range for summary (from API or derived)
  const summaryDateRangeLabel = useMemo(() => {
    if (financialSummary?.timeframe?.startDate && financialSummary?.timeframe?.endDate) {
      const start = new Date(financialSummary.timeframe.startDate);
      const end = new Date(financialSummary.timeframe.endDate);
      return `${formatDate(start)} – ${formatDate(end)}`;
    }
    return getTimeframeLabel(timeframe);
  }, [financialSummary?.timeframe, timeframe]);

  // Timeframe options for the main dashboard selector
  const TIMEFRAME_OPTIONS = [
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'thisQuarter', label: 'This quarter' },
    { value: 'lastQuarter', label: 'Last quarter' },
    { value: 'thisYear', label: 'This year' },
    { value: 'lastYear', label: 'Last year' },
    { value: 'custom', label: 'Custom...' }
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
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setIncomeStatement(profitLossData);
            break;
            
          case 'balance-sheet':
            const balanceSheetData = await fetchBalanceSheet({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setBalanceSheet(balanceSheetData);
            break;
            
          case 'cash-flow':
            const cashFlowData = await fetchCashFlowStatement({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setCashFlowStatement(cashFlowData);
            break;
            
          case 'tax-summary':
            const taxSummaryData = await fetchTaxSummary({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setTaxSummary(taxSummaryData);
            break;
            
          case 'expense-report':
            const expenseData = await fetchExpenseReport({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setExpenseReport(expenseData);
            break;
            
          case 'sales-report':
            const salesData = await fetchSalesReport({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setSalesReport(salesData);
            break;
            
          case 'accounts-receivable':
            const arData = await fetchAccountsReceivableAging();
            setAccountsReceivable(arData);
            break;
            
          case 'accounts-payable':
            const apData = await fetchAccountsPayableAging();
            setAccountsPayable(apData);
            break;
            
          case 'inventory-valuation':
            const inventoryData = await fetchInventoryValuation();
            setInventoryValuation(inventoryData);
            break;
            
          case 'stock-movement':
            const stockMovementData = await fetchStockMovement({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null,
              productId: stockMovementProductId || undefined
            });
            setStockMovement(stockMovementData);
            break;
            
          case 'pos-daily':
            const posDailyData = await fetchPosDailyReport(posDailyDate);
            setPosDailyReport(posDailyData);
            break;
            
          case 'sales-analysis':
            const salesAnalysisData = await fetchSalesAnalysis({ 
              timeframe,
              groupBy: 'time',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setSalesAnalysis(salesAnalysisData);
            break;
            
          case 'expense-analysis':
            const expenseAnalysisData = await fetchExpenseAnalysis({ 
              timeframe,
              groupBy: 'category',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setExpenseAnalysis(expenseAnalysisData);
            break;
            
          case 'profitability-analysis':
            const profitabilityData = await fetchProfitabilityAnalysis({ 
              timeframe,
              groupBy: 'product',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setProfitabilityAnalysis(profitabilityData);
            break;
            
          case 'financial-ratios':
            const ratiosData = await fetchFinancialRatios({ timeframe });
            setFinancialRatios(ratiosData);
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
  }, [selectedReport, timeframe, customDateRange, stockMovementProductId, posDailyDate]);

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
        customDateRange: timeframe === 'custom' ? customDateRange : null
      };
      if (type === 'pos-daily') params.date = posDailyDate;
      await exportReport(type, format, params);
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report. Please try again.");
    }
  }, [selectedReport, timeframe, customDateRange, posDailyDate]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      if (activeReport === 'summary') {
        // Reload summary data
        const summaryData = await fetchFinancialSummary(
          timeframe,
          timeframe === 'custom' ? customDateRange : null
        );
        setFinancialSummary(summaryData);
        const analytics = await fetchFinancialAnalytics({
          timeframe,
          customDateRange: timeframe === 'custom' ? customDateRange : null,
          groupBy: analyticsFilters.groupBy
        });
        setFinancialAnalytics(analytics);
      } else if (selectedReport) {
        // Reload selected report
        switch (selectedReport) {
          case 'profit-loss':
            const incomeData = await fetchIncomeStatement({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setIncomeStatement(incomeData);
            break;
            
          case 'balance-sheet':
            const balanceData = await fetchBalanceSheet({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setBalanceSheet(balanceData);
            break;
            
          case 'cash-flow':
            const cashFlowData = await fetchCashFlowStatement({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setCashFlowStatement(cashFlowData);
            break;
            
          case 'tax-summary':
            const taxData = await fetchTaxSummary({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setTaxSummary(taxData);
            break;
            
          case 'expense-report':
            const expenseData = await fetchExpenseReport({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setExpenseReport(expenseData);
            break;
            
          case 'sales-report':
            const salesData = await fetchSalesReport({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setSalesReport(salesData);
            break;
            
          case 'accounts-receivable':
            const arData = await fetchAccountsReceivableAging();
            setAccountsReceivable(arData);
            break;
            
          case 'accounts-payable':
            const apData = await fetchAccountsPayableAging();
            setAccountsPayable(apData);
            break;
            
          case 'inventory-valuation':
            const inventoryData = await fetchInventoryValuation();
            setInventoryValuation(inventoryData);
            break;
            
          case 'stock-movement':
            const stockMovementData = await fetchStockMovement({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null,
              productId: stockMovementProductId || undefined
            });
            setStockMovement(stockMovementData);
            break;
            
          case 'pos-daily':
            const posDailyData = await fetchPosDailyReport(posDailyDate);
            setPosDailyReport(posDailyData);
            break;
            
          case 'sales-analysis':
            const salesAnalysisData = await fetchSalesAnalysis({ 
              timeframe,
              groupBy: 'time',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setSalesAnalysis(salesAnalysisData);
            break;
            
          case 'expense-analysis':
            const expenseAnalysisData = await fetchExpenseAnalysis({ 
              timeframe,
              groupBy: 'category',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setExpenseAnalysis(expenseAnalysisData);
            break;
            
          case 'profitability-analysis':
            const profitabilityData = await fetchProfitabilityAnalysis({ 
              timeframe,
              groupBy: 'product',
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setProfitabilityAnalysis(profitabilityData);
            break;
            
          case 'financial-ratios':
            const ratiosData = await fetchFinancialRatios({ 
              timeframe,
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setFinancialRatios(ratiosData);
            break;
        }
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [activeReport, selectedReport, timeframe, customDateRange]);

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
        
      case 'accounts-receivable':
        return (
          <AgingReportTable
            data={accountsReceivable}
            title="Accounts Receivable Aging"
            type="receivable"
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'accounts-receivable-aging')}
          />
        );
        
      case 'accounts-payable':
        return (
          <AgingReportTable
            data={accountsPayable}
            title="Accounts Payable Aging"
            type="payable"
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'accounts-payable-aging')}
          />
        );

      case 'inventory-valuation':
        return (
          <InventoryValuationReport
            data={inventoryValuation}
            loading={loading}
            error={error}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'inventory-valuation')}
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

      case 'sales-analysis':
        return (
          <SalesAnalysisReport
            data={salesAnalysis}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'sales-analysis')}
          />
        );

      case 'expense-analysis':
        return (
          <ExpenseAnalysisReport
            data={expenseAnalysis}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'expense-analysis')}
          />
        );

      case 'profitability-analysis':
        return (
          <ProfitabilityAnalysisReport
            data={profitabilityAnalysis}
            loading={loading}
            error={error}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onRefresh={handleRefresh}
            onExport={(format) => handleExportReport(format, 'profitability-analysis')}
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

  // Render the financial summary dashboard
  const renderAnalyticsPanel = () => {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-4 sm:mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Financial analytics</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {financialAnalytics?.period?.startDate && financialAnalytics?.period?.endDate
                ? `${financialAnalytics.period.startDate} – ${financialAnalytics.period.endDate}`
                : getTimeframeLabel(timeframe)}
            </p>
          </div>
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
              <option value="expenses">Focus: Expenses</option>
              <option value="avgRevenue">Focus: Average Revenue</option>
            </select>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-emerald-600 mr-3" />
            <span className="text-slate-500 text-sm">Loading analytics...</span>
          </div>
        ) : analyticsError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {analyticsError}
          </div>
        ) : financialAnalytics ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {analyticsMetricConfig.map((metric) => (
                <div
                  key={metric.id}
                  className={`rounded-xl border p-4 ${metric.border} ${analyticsFilters.metric === metric.id ? metric.bg : 'bg-slate-50/50'}`}
                >
                  <p className="text-xs uppercase font-medium text-slate-500 tracking-wide mb-1">
                    {metric.label}
                  </p>
                  <p className={`text-xl font-semibold ${metric.color}`}>
                    {formatCurrency(metric.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-xl border border-slate-200 p-4 min-h-[320px]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">Revenue vs Expenses vs Profit</h4>
                  <span className="text-xs text-slate-500">by {analyticsFilters.groupBy}</span>
                </div>
                {analyticsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={analyticsTrend}>
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
                      <XAxis dataKey="label" />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace('MWK ', '')} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke={analyticsLineColors.revenue} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area type="monotone" dataKey="expenses" stroke={analyticsLineColors.expenses} fillOpacity={1} fill="url(#colorExpenses)" />
                      <Line type="monotone" dataKey="profit" stroke={analyticsLineColors.profit} strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-slate-500 text-sm">Not enough data for this period.</div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 min-h-[320px]">
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
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">Expense breakdown</h4>
                  <span className="text-xs text-slate-500">{analyticsExpenseBreakdown.length} categories</span>
                </div>
                {analyticsExpenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analyticsExpenseBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace('MWK ', '')} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="value" fill="#059669" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-500 text-sm">No expense data.</div>
                )}
                <ul className="mt-4 space-y-2">
                  {analyticsExpenseBreakdown.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm text-slate-600">
                      <span>{item.name}</span>
                      <span className="font-medium text-slate-800">{formatCurrency(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
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
              <span className="text-sm font-medium text-slate-500">Total Expenses</span>
              <TrendingDown size={18} className="text-red-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(expenses)}</p>
            <p className="text-xs text-slate-400 mt-1">{summaryDateRangeLabel}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-500">Net Profit</span>
              <DollarSign size={18} className={profit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
            </div>
            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{profitMargin.toFixed(1)}% margin</p>
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

        {renderAnalyticsPanel()}

        {/* Quick reports */}
        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Quick reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  Generate balance sheet, cash flow, tax summary, aging, and more.
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
        <div className="mx-auto w-full max-w-[100rem] px-4 sm:px-6 lg:px-10 xl:px-12 2xl:px-16 py-6 sm:py-8">
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