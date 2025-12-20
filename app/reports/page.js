"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  BarChart as BarChartIcon, 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileBarChart, 
  Filter,
  ChevronDown,
  RefreshCw,
  ArrowUpDown,
  Search,
  Info,
  PieChart as PieChartIcon,
  Share2,
  Clock,
  AlertCircle,
  Loader2, 
  Package,
  X,
  ArrowLeft
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
  // State management for reports and UI
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [activeReport, setActiveReport] = useState('summary');
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableReports, setAvailableReports] = useState([]);
  
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

  // NEW: Get effective date range for API calls
  const getEffectiveDateRange = () => {
    if (timeframe === 'custom') {
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate
      };
    }
    return { timeframe };
  };

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
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setStockMovement(stockMovementData);
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
  }, [selectedReport, timeframe, customDateRange]);

  // Handle report generation
  const handleGenerateReport = useCallback((reportId) => {
    setActiveReport('report');
    setSelectedReport(reportId);
  }, []);

  // Handle report export
  const handleExportReport = useCallback(async (format, reportType) => {
    try {
      await exportReport(
        reportType || selectedReport || 'summary', 
        format, 
        { 
          timeframe,
          customDateRange: timeframe === 'custom' ? customDateRange : null
        }
      );
    } catch (err) {
      console.error("Error exporting report:", err);
      setError("Failed to export report. Please try again.");
    }
  }, [selectedReport, timeframe, customDateRange]);

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
              customDateRange: timeframe === 'custom' ? customDateRange : null
            });
            setStockMovement(stockMovementData);
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-medium text-gray-700 mb-2">No Report Selected</h2>
            <p className="text-gray-500">Please select a report from the Available Reports section.</p>
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
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Financial Analytics</h3>
            <p className="text-sm text-gray-500">
              Trends for {getTimeframeLabel(timeframe)} ({financialAnalytics?.period?.startDate} – {financialAnalytics?.period?.endDate})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md shadow-sm border border-gray-200 overflow-hidden">
              {['day', 'week', 'month'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium ${
                    analyticsFilters.groupBy === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  } ${option === 'day' ? 'rounded-l-md' : option === 'month' ? 'rounded-r-md' : ''}`}
                  onClick={() => setAnalyticsFilters((prev) => ({ ...prev, groupBy: option }))}
                >
                  {option === 'day' ? 'Daily' : option === 'week' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            <select
              value={analyticsFilters.metric}
              onChange={(e) => setAnalyticsFilters((prev) => ({ ...prev, metric: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="profit">Focus: Profit</option>
              <option value="revenue">Focus: Revenue</option>
              <option value="expenses">Focus: Expenses</option>
              <option value="avgRevenue">Focus: Average Revenue</option>
            </select>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={32} className="animate-spin text-blue-600 mr-3" />
            <span className="text-gray-500">Loading analytics...</span>
          </div>
        ) : analyticsError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {analyticsError}
          </div>
        ) : financialAnalytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {analyticsMetricConfig.map((metric) => (
                <div
                  key={metric.id}
                  className={`rounded-lg border p-4 ${metric.border} ${analyticsFilters.metric === metric.id ? metric.bg : 'bg-gray-50'}`}
                >
                  <p className="text-xs uppercase font-medium text-gray-500 tracking-wide mb-1">
                    {metric.label}
                  </p>
                  <p className={`text-2xl font-semibold ${metric.color}`}>
                    {formatCurrency(metric.value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800">Revenue vs Expenses vs Profit</h4>
                  <span className="text-xs text-gray-500 uppercase">
                    grouped by {analyticsFilters.groupBy}
                  </span>
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
                  <div className="text-center text-gray-500 py-12">Not enough data for this period.</div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Revenue by Source</h4>
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
                  <div className="text-center text-gray-500 py-12">No revenue data available.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800">Expense Breakdown</h4>
                  <span className="text-xs text-gray-500">{analyticsExpenseBreakdown.length} categories</span>
                </div>
                {analyticsExpenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analyticsExpenseBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" hide />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace('MWK ', '')} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="value" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-gray-500 py-12">No expense data available.</div>
                )}
                <ul className="mt-4 space-y-2">
                  {analyticsExpenseBreakdown.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="flex justify-between text-sm text-gray-600">
                      <span>{item.name}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-12">No analytics data available.</div>
        )}
      </div>
    );
  };

  const renderFinancialSummary = () => {
    if (loading) {
      return (
        <div className="p-6 text-center">
          <Loader2 size={36} className="mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-gray-500">Loading financial summary...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 text-center">
          <AlertCircle size={36} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Error Loading Data</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
            onClick={handleRefresh}
          >
            Try Again
          </button>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          {/* Revenue Card */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Total Revenue</h3>
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {formatCurrency(financialSummary?.revenue || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {getTimeframeLabel(timeframe)}
            </p>
          </div>
          
          {/* Expenses Card */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Total Expenses</h3>
              <TrendingDown size={16} className="text-red-600" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {formatCurrency(financialSummary?.expenses || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {getTimeframeLabel(timeframe)}
            </p>
          </div>
          
          {/* Profit Card */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Net Profit</h3>
              <DollarSign size={16} className={financialSummary?.profit >= 0 ? "text-green-600" : "text-red-600"} />
            </div>
            <div className={`text-2xl font-bold ${financialSummary?.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(financialSummary?.profit || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {financialSummary?.profitMargin ? `${financialSummary.profitMargin}% margin` : "0% margin"}
            </p>
          </div>
          
          {/* Outstanding Invoices */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-sm font-semibold text-gray-600">Outstanding Invoices</h3>
              <Clock size={16} className="text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {formatCurrency(financialSummary?.outstandingInvoices?.total || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {financialSummary?.outstandingInvoices?.count || 0} unpaid invoice(s)
            </p>
          </div>
        </div>
        
        {renderAnalyticsPanel()}

        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Quick Reports</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all"
              onClick={() => handleGenerateReport('profit-loss')}
            >
              <div className="flex items-center mb-2">
                <FileBarChart size={20} className="mr-2 text-blue-600" />
                <h4 className="font-medium text-gray-800">Profit & Loss</h4>
              </div>
              <p className="text-sm text-gray-500">
                View your income statement for the current period
              </p>
            </div>
            
            <div 
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all"
              onClick={() => handleGenerateReport('sales-report')}
            >
              <div className="flex items-center mb-2">
                <TrendingUp size={20} className="mr-2 text-green-600" />
                <h4 className="font-medium text-gray-800">Sales Report</h4>
              </div>
              <p className="text-sm text-gray-500">
                Analyze your sales performance and trends
              </p>
            </div>
            
            <div 
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all"
              onClick={() => handleGenerateReport('expense-report')}
            >
              <div className="flex items-center mb-2">
                <TrendingDown size={20} className="mr-2 text-red-600" />
                <h4 className="font-medium text-gray-800">Expense Report</h4>
              </div>
              <p className="text-sm text-gray-500">
                Track and categorize your business expenses
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 rounded-lg border border-blue-100 p-6">
          <div className="flex items-start">
            <Info size={20} className="mr-3 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-medium text-blue-800 mb-2">Financial Health Overview</h3>
              <p className="text-sm text-blue-700 mb-4">
                View detailed financial reports to understand your business performance and make informed decisions.
              </p>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                onClick={() => setShowBrowseReports(true)}
              >
                Browse All Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PermissionGuard permission="reports.view">  
    <div className="p-6 bg-gray-50">
      {/* Error message */}
      {error && activeReport !== 'summary' && activeReport !== 'report' && (
        <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md text-red-700 flex items-center">
          <AlertCircle size={20} className="mr-2" />
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financial Reporting</h1>
          <p className="text-sm text-gray-500">Track, analyze, and export your financial reports</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
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
              className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-10 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[250px]"
            >
              <option value="">Select a Report...</option>
              {availableReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
            <ChevronDown size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading && !refreshing && !selectedReport ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Loading financial data...</p>
        </div>
      ) : (
        <>
          {/* Main Content */}
          {!selectedReport && renderFinancialSummary()}

          {selectedReport && (
            <div className="space-y-4">
              {/* Back Button */}
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setSelectedReport(null);
                    setActiveReport('summary');
                  }}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={18} className="mr-2" />
                  <span className="font-medium">Back to Summary</span>
                </button>
              </div>
              
              {/* Report Content */}
              <div className="bg-white rounded-lg border border-gray-200">
                {renderSelectedReport()}
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Browse All Reports Modal */}
      {showBrowseReports && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowBrowseReports(false)}>
          <div className="bg-white rounded-lg border border-gray-300 w-full max-w-5xl mx-4 max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 bg-gray-50/50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Available Reports</h2>
                  <p className="text-sm text-gray-600 mt-1">Select a report to generate detailed financial insights</p>
                </div>
                <button 
                  onClick={() => setShowBrowseReports(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              {/* Search */}
              <div className="mb-6">
                <div className="relative">
                  <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search reports..." 
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                  <div key={category} className="mb-8">
                    <div className="flex items-center mb-4">
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1"></div>
                      <h3 className="px-4 text-lg font-semibold text-gray-800 uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent flex-1"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categories[category].map((report) => {
                        const IconComponent = getReportIconComponent(report.icon);
                        return (
                          <div 
                            key={report.id} 
                            className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-all duration-200 cursor-pointer"
                            onClick={() => {
                              handleGenerateReport(report.id);
                              setShowBrowseReports(false);
                            }}
                          >
                            <div className="flex items-start mb-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 group-hover:bg-blue-100 transition-colors mr-3">
                                <IconComponent size={20} className="text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {report.name}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {report.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                              <span className="flex items-center">
                                {report.requiresTimeframe && (
                                  <Calendar size={12} className="mr-1" />
                                )}
                                {report.requiresTimeframe ? 'Time-based' : 'Snapshot'}
                              </span>
                              {report.lastGenerated && (
                                <span className="flex items-center">
                                  <Clock size={12} className="mr-1" />
                                  {new Date(report.lastGenerated).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
              
              {filteredReports.length === 0 && (
                <div className="text-center py-12">
                  <Search size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No reports found</h3>
                  <p className="text-gray-500">Try adjusting your search terms.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* NEW: Custom Date Range Modal */}
      {showCustomDateRange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md border border-gray-300">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Custom Date Range</h2>
              <button 
                onClick={() => setShowCustomDateRange(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date *</label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => handleCustomDateRangeChange('startDate', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">End Date *</label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => handleCustomDateRangeChange('endDate', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button 
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                onClick={() => setShowCustomDateRange(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                onClick={applyCustomDateRange}
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
};

export default FinancialReportingPage;