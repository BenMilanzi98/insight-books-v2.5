"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CreditCard,
  FileText,
  ShoppingCart,
  BarChart3,
  Bell,
  ChevronRight,
  ChevronLeft,
  Clock,
  DollarSign,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowRight,
  Building,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Settings,
  RefreshCw,
  Wallet
} from "lucide-react";
import { getPermission } from "@/lib/permissions";
import TrialCountdown from "@/components/TrialCountdown";
import SubscriptionCountdownBanner from "@/components/SubscriptionCountdownBanner";
import UniversalDateRangeFilter from "@/components/UniversalDateRangeFilter";
import { formatCurrency, formatDate, getDateRange } from "@/lib/dateUtils";

// Animated Counter Component
const CountUp = ({ end, duration = 2000, format = (val) => val }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0 || !end) {
      setCount(end || 0);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (end - startValue) * easeOutQuart;

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{format(count)}</span>;
};

// Mini Sparkline component for daily metrics
const MiniSparkline = ({ data, type = "revenue" }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // Prevent division by zero
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div className="w-20 h-8">
      <svg width="80" height="30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={type === "revenue" ? "#4F46E5" : "#EF4444"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// Skeleton element
const SkeletonElement = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Dashboard Bar Chart component
const DashboardBarChart = ({ data }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;
  
  // Reset pagination when data changes (date range switch)
  useEffect(() => {
    setCurrentPage(0);
  }, [data?.months?.length]);
  
  if (!data || !data.income || !data.expenses || !data.months) return null;

  const maxValue = Math.max(...data.income, ...data.expenses) * 1.1 || 100;
  const totalItems = data.months.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const showNavigation = totalPages > 1;
  
  // Get current page data
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = {
    months: data.months.slice(startIndex, endIndex),
    income: data.income.slice(startIndex, endIndex),
    expenses: data.expenses.slice(startIndex, endIndex)
  };

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Chart Legend and Navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
          <span className="text-sm text-gray-600">Income</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
          <span className="text-sm text-gray-600">Expenses</span>
        </div>
        </div>
        
        {/* Simple Navigation */}
        {showNavigation && (
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 0}
              className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              title="Previous"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-600 px-3 py-1 bg-gray-50 rounded-md font-medium">
              {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages - 1}
              className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              title="Next"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>


      {/* Chart Area */}
      <div className="flex h-64 relative">
        {/* Y-Axis Labels */}
        <div className="flex flex-col justify-between pr-2 text-right flex-shrink-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="text-xs text-gray-500 h-[20%]">
              {formatCurrency((maxValue * (4 - i)) / 4)}
            </div>
          ))}
        </div>

        {/* Chart Container */}
        <div className="flex-1 relative">
          <div className="flex items-end border-l border-b border-gray-200 h-full">
            {currentData.months.map((period, index) => {
              // Determine bar width based on number of periods
              const barWidth = 'w-5';
              const containerWidth = 'w-12';
              
              return (
                <div key={period} className={`flex flex-col items-center space-y-1 ${containerWidth}`}>
              <div className="flex items-end space-x-1 h-full">
                {/* Income Bar */}
                    <div className={`${barWidth} flex justify-center group relative h-64`}>
  <div
                        className={`${barWidth} bg-indigo-500 rounded-t transition-all duration-300 group-hover:bg-indigo-600 self-end`}
                        style={{ height: `${(currentData.income[index] / maxValue) * 100}%` }}
  >
    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {formatCurrency(currentData.income[index])}
    </div>
  </div>
</div>

                {/* Expense Bar */}
                    <div className={`${barWidth} flex justify-center group relative h-64`}>
  <div
                        className={`${barWidth} bg-red-400 rounded-t transition-all duration-300 group-hover:bg-red-500 self-end`}
                        style={{ height: `${(currentData.expenses[index] / maxValue) * 100}%` }}
  >
    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {formatCurrency(currentData.expenses[index])}
    </div>
  </div>
</div>
              </div>

                  {/* Period Label */}
                  <div className="text-xs text-gray-500 mt-2 text-center leading-tight">{period}</div>
            </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
// Skeleton Bar Chart
const SkeletonBarChart = () => (
  <div className="flex flex-col h-full w-full">
    {/* Chart Legend */}
    <div className="flex items-center justify-end space-x-4 mb-4">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
        <span className="text-sm text-gray-600">Income</span>
      </div>
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
        <span className="text-sm text-gray-600">Expenses</span>
      </div>
    </div>
    
    {/* Chart Area */}
    <div className="flex h-64 relative">
      {/* Y-Axis Labels */}
      <div className="flex flex-col justify-between pr-2 text-right">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="text-xs text-gray-500">
            <SkeletonElement className="h-4 w-16" />
          </div>
        ))}
      </div>
      
      {/* Bars */}
      <div className="flex-1 flex items-end justify-around border-l border-b border-gray-200">
        {[...Array(6)].map((_, index) => (
          <div key={index} className="flex flex-col items-center space-y-1 w-12">
            <div className="flex items-end justify-center space-x-1 h-full">
            {/* Income Bar Skeleton */}
              <div className="w-5 flex justify-center group relative">
              <SkeletonElement className="w-5 rounded-t" style={{ height: `${Math.random() * 70 + 20}%` }} />
            </div>
            
            {/* Expense Bar Skeleton */}
              <div className="w-5 flex justify-center group relative">
              <SkeletonElement className="w-5 rounded-t" style={{ height: `${Math.random() * 70 + 15}%` }} />
      </div>
    </div>
    
            {/* Month Label Skeleton */}
            <div className="mt-2">
              <SkeletonElement className="h-3 w-8" />
            </div>
        </div>
      ))}
      </div>
    </div>
  </div>
);

// Dashboard Pie Chart component
const DashboardPieChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  // Generate colors for pie segments
  const colors = [
    'bg-gradient-to-r from-blue-400 to-blue-600', 'bg-gradient-to-r from-purple-400 to-purple-600', 'bg-gradient-to-r from-green-400 to-green-600',
    'bg-gradient-to-r from-yellow-400 to-yellow-600', 'bg-gradient-to-r from-red-400 to-red-600', 'bg-gradient-to-r from-indigo-400 to-indigo-600'
  ];
  
  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-full">
      {/* Create SVG-based pie chart */}
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#A78BFA', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#7C3AED', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#34D399', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FCD34D', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#D97706', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#F87171', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#DC2626', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="indigoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#818CF8', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#4F46E5', stopOpacity: 1 }} />
            </linearGradient>
          </defs>
          {data.map((segment, index) => {
            // Calculate the segment angles
            const cumulativePercentage = data
              .slice(0, index)
              .reduce((sum, curr) => sum + parseFloat(curr.percentage), 0);
            
            const startAngle = (cumulativePercentage / 100) * 360;
            const endAngle = ((cumulativePercentage + parseFloat(segment.percentage)) / 100) * 360;
            
            // Calculate SVG arc parameters
            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;
            
            const x1 = 50 + 50 * Math.cos(startRad);
            const y1 = 50 + 50 * Math.sin(startRad);
            const x2 = 50 + 50 * Math.cos(endRad);
            const y2 = 50 + 50 * Math.sin(endRad);
            
            // Determine if the arc should be drawn as a large arc
            const largeArcFlag = parseFloat(segment.percentage) > 50 ? 1 : 0;
            
            // Generate a path for the segment
            const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            
            // Get a unique color for this segment
            const colorIndex = index % colors.length;
            
            // Generate a fill color based on the colorIndex
            const fillColors = {
              0: 'url(#blueGradient)', // blue gradient
              1: 'url(#purpleGradient)', // purple gradient
              2: 'url(#greenGradient)', // green gradient
              3: 'url(#yellowGradient)', // yellow gradient
              4: 'url(#redGradient)', // red gradient
              5: 'url(#indigoGradient)'  // indigo gradient
            };
            
            return (
              <path
                key={index}
                d={pathData}
                fill={fillColors[colorIndex]}
                stroke="#fff"
                strokeWidth="1"
              />
            );
          })}
        </svg>
      </div>
      
      {/* Legend with scrollable container */}
      <div className="flex-1 min-w-0">
        <div className="max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
      <div className="flex flex-col space-y-2">
        {data.map((segment, index) => (
              <div key={index} className="flex items-center min-w-0">
                <div className={`w-4 h-4 rounded-sm ${colors[index % colors.length]} mr-3 flex-shrink-0`}></div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" title={segment.category}>
                    {segment.category}
                  </span>
              <span className="text-xs text-gray-500">
                {formatCurrency(segment.amount)} ({segment.percentage}%)
              </span>
            </div>
          </div>
        ))}
          </div>
        </div>
        
        {/* Show scroll indicator if there are many items */}
        {data.length > 6 && (
          <div className="text-xs text-gray-400 text-center mt-2">
            Scroll to see all {data.length} categories
          </div>
        )}
      </div>
    </div>
  );
};

// Skeleton Pie Chart
const SkeletonPieChart = () => (
  <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-full">
    {/* Skeleton circle for chart */}
    <div className="relative w-48 h-48">
      <SkeletonElement className="w-48 h-48 rounded-full" />
    </div>
    
    {/* Legend */}
    <div className="flex flex-col space-y-2">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex items-center">
          <div className="w-4 h-4 rounded-sm bg-gray-300 mr-2"></div>
          <div className="flex flex-col">
            <SkeletonElement className="h-5 w-24 mb-1" />
            <SkeletonElement className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BusinessOwnerDashboard = () => {
  const [selectedDateRange, setSelectedDateRange] = useState("thisMonth");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTrialCountdown, setShowTrialCountdown] = useState(true);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [filteredData, setFilteredData] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(3);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [showBusinessSetupReminder, setShowBusinessSetupReminder] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [userTenants, setUserTenants] = useState([]);
  const [hasMultipleBusinesses, setHasMultipleBusinesses] = useState(false);
  
  // State for dashboard data
  const [metrics, setMetrics] = useState(null);
  const [dailyPerformance, setDailyPerformance] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [payables, setPayables] = useState(null);
  const [incomeExpenses, setIncomeExpenses] = useState(null);
  const [expensesBreakdown, setExpensesBreakdown] = useState(null);
  const [upcomingPayments, setUpcomingPayments] = useState(null);
  const [financialPosition, setFinancialPosition] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canViewDashboard: false,
    canViewInvoices: false
  });
  
  // State for user subscription data
  const [userSubscription, setUserSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  
  // State for stock alerts pagination
  const [stockAlertsPage, setStockAlertsPage] = useState(1);
  const stockAlertsPageSize = 3;
  
  useEffect(() => {
    const fetchPermissions = async () => {
      const canViewDashboard = await getPermission("dashboard.view");
      const canViewInvoices = await getPermission("invoices.view"); 
      setPagePermissions({
        canViewDashboard,
        canViewInvoices 
      });
    };
  
    fetchPermissions();
  }, []);

  // Fetch user subscription data
  useEffect(() => {
    const fetchUserSubscription = async () => {
      try {
        setSubscriptionLoading(true);
        const response = await fetch('/api/subscription/status');
        if (response.ok) {
          const data = await response.json();
          setUserSubscription(data);
        } else {
          // Provide fallback subscription data
          setUserSubscription({
            user: { id: 'user-1', tenantId: 'tenant-1' },
            subscription: {
              status: 'trial',
              trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              plan: 'trial'
            }
          });
        }
      } catch (error) {
        console.error('Error fetching user subscription:', error);
        // Provide fallback subscription data
        setUserSubscription({
          user: { id: 'user-1', tenantId: 'tenant-1' },
          subscription: {
            status: 'trial',
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            plan: 'trial'
          }
        });
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchUserSubscription();
  }, []);

  // Check business setup status and fetch user tenants
  useEffect(() => {
    const checkBusinessSetup = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setTenantInfo(data.tenant);
          
          // Show reminder if business name is generic (like "My Business")
          if (data.tenant && data.tenant.name && data.tenant.name.toLowerCase() === 'my business') {
            setShowBusinessSetupReminder(true);
          }
        } else {
          // Don't set fallback - let it remain null to show loading state
          console.log('Failed to fetch user info:', response.status);
        }
      } catch (error) {
        console.error('Error checking business setup:', error);
        // Don't set fallback - let it remain null to show loading state
      }
    };

    const fetchUserTenants = async () => {
      try {
        const response = await fetch('/api/tenant/list');
        if (response.ok) {
          const data = await response.json();
          setUserTenants(data.tenants || []);
          setHasMultipleBusinesses((data.tenants || []).length > 1);
        }
      } catch (error) {
        console.error('Error fetching user tenants:', error);
      }
    };

    checkBusinessSetup();
    fetchUserTenants();
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, [selectedDateRange]);

  // Enhanced data fetching with date range filtering
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get date range based on selection
      let startDate, endDate;
      if (selectedDateRange === 'custom' && dateRange.start && dateRange.end) {
        // Use the custom date range from state
        startDate = dateRange.start;
        endDate = dateRange.end;
      } else {
        // Use predefined date range
        const range = getDateRange(selectedDateRange);
        startDate = range.startDate;
        endDate = range.endDate;
        // Update dateRange state for display purposes only
      setDateRange({ start: startDate, end: endDate });
      }

      // Helper function to safely fetch data
      const safeFetch = async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return await response.json();
          } else {
            console.warn(`API endpoint ${url} returned ${response.status}`);
            throw new Error(`API returned ${response.status}`);
          }
        } catch (error) {
          console.warn(`Failed to fetch ${url}:`, error);
          throw error;
        }
      };

      // Build query parameters for custom date ranges
      const buildApiUrl = (endpoint) => {
        if (selectedDateRange === 'custom') {
          return `${endpoint}?dateRange=custom&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`;
        } else {
          return `${endpoint}?dateRange=${mapDateRangeToAPI(selectedDateRange)}`;
        }
      };

      // Fetch all dashboard data using actual API endpoints
      // Note: Daily Performance should ALWAYS show "Today" data regardless of selected date range
      const [metricsData, dailyPerformanceData, receivablesData, payablesData, incomeExpensesData, expensesBreakdownData, upcomingPaymentsData, stockAlertsData, financialPositionData] = await Promise.all([
        safeFetch(buildApiUrl('/api/dashboard/metrics')),
        safeFetch('/api/dashboard/daily-performance?dateRange=today'), // Always fetch today's data
        safeFetch(buildApiUrl('/api/dashboard/receivables')),
        safeFetch(buildApiUrl('/api/dashboard/payables')),
        safeFetch(buildApiUrl('/api/dashboard/income-expenses')),
        safeFetch(buildApiUrl('/api/dashboard/expenses-breakdown')),
        safeFetch(buildApiUrl('/api/dashboard/upcoming-payments')),
        safeFetch(buildApiUrl('/api/dashboard/stock-alerts')),
        safeFetch(buildApiUrl('/api/dashboard/financial-position'))
      ]);

      // Update state with actual data
      setMetrics(metricsData.financialSummary);
      setDailyPerformance(dailyPerformanceData.dailyMetrics);
      setReceivables(receivablesData.accountsReceivable);
      setPayables(payablesData.accountsPayable);
      setIncomeExpenses(incomeExpensesData.incomeExpenses);
      setExpensesBreakdown(expensesBreakdownData.expensesBreakdown);
      setUpcomingPayments(upcomingPaymentsData.upcomingPayments);
      setFinancialPosition(financialPositionData.financialPosition);

      // Debug data
      console.log('Stock Alerts API Response:', stockAlertsData);
       console.log('Receivables API Response:', receivablesData);
       console.log('Payables API Response:', payablesData);

      setStockAlerts(stockAlertsData.alerts || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle date range change
  const handleDateRangeChange = (newRange) => {
    setSelectedDateRange(newRange);
  };

  // Handle custom date range change
  const handleCustomDateChange = (customRange) => {
    setDateRange({ start: new Date(customRange.startDate), end: new Date(customRange.endDate) });
    setSelectedDateRange('custom');
  };

  const handleDataExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus(null);
      const response = await fetch('/api/data-export');
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `insight-data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setExportStatus('success');
      setTimeout(() => setExportStatus(null), 4000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  // Map dashboard date range to API date range
  const mapDateRangeToAPI = (range) => {
    switch (range) {
      case 'today': return 'today';
      case 'yesterday': return 'yesterday';
      case 'thisWeek': return 'thisWeek';
      case 'thisMonth': return 'thisMonth';
      case 'lastMonth': return 'lastMonth';
      case 'thisYear': return 'thisYear';
      case 'custom': return 'custom';
      default: return 'thisMonth';
    }
  };

  // Get human-readable label for date range
  const getDateRangeLabel = (range) => {
    switch (range) {
      case 'today': return 'day';
      case 'yesterday': return 'day';
      case 'thisWeek': return 'week';
      case 'thisMonth': return 'month';
      case 'lastMonth': return 'month';
      case 'thisYear': return 'year';
      case 'custom': return 'custom range';
      default: return 'month';
    }
  };

  // Refresh dashboard data
  const refreshDashboard = () => {
    fetchDashboardData();
  };
  
  // Calculate revenue change if data is available
  const revenueChange = dailyPerformance ? 
    ((dailyPerformance.today.revenue - dailyPerformance.yesterday.revenue) / 
    (dailyPerformance.yesterday.revenue || 1) * 100).toFixed(1) : 0;
  
  // Calculate expenses change if data is available
  const expensesChange = dailyPerformance ? 
    ((dailyPerformance.today.expenses - dailyPerformance.yesterday.expenses) / 
    (dailyPerformance.yesterday.expenses || 1) * 100).toFixed(1) : 0;
  
  // Error state
  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if(pagePermissions.canViewDashboard){
  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 via-purple-50 to-pink-50 min-h-screen">
      {/* Dashboard Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Welcome back!</h1>
        <p className="text-gray-600 mt-1">
          
        </p>
      </div>

      {/* Trial Countdown */}
      {!subscriptionLoading && userSubscription && (
        <TrialCountdown 
          subscriptionData={userSubscription} 
          className="mb-6"
          onUpgrade={() => {
            window.location.href = '/subscription';
          }}
        />
      )}

      {/* Subscription Countdown Banner */}
      {!subscriptionLoading && userSubscription && (userSubscription.isTrialActive || userSubscription.subscription) && (
        <SubscriptionCountdownBanner 
          subscription={{
            ...userSubscription.subscription,
            isTrial: userSubscription.subscription?.isTrial !== undefined ? userSubscription.subscription.isTrial : userSubscription.isTrialActive,
            trialEndDate: userSubscription.subscription?.trialEndDate || null,
            expiresAt: userSubscription.subscription?.expiresAt || null,
            plan: userSubscription.subscription?.plan || userSubscription.subscriptionStatus?.plan || null
          }}
          isTrialActive={userSubscription.isTrialActive}
          remainingTrialDays={userSubscription.remainingTrialDays || 0}
          thresholdDays={10}
          onUpgrade={async () => {
            window.location.href = '/subscription';
          }}
        />
      )}

      {/* Business Overview Card */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {tenantInfo?.name || 'Loading...'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {hasMultipleBusinesses ? 'Multi-business account' : 'Your business dashboard'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleDataExport}
                  disabled={isExporting}
                  className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 transform hover:scale-105 ${
                    isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <RefreshCw size={14} className="mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={14} className="mr-2" />
                      Data Backup
                    </>
                  )}
                </button>
                <div className="bg-white/70 rounded-lg p-1">
                  <UniversalDateRangeFilter
                    timeframe={selectedDateRange}
                    onTimeframeChange={handleDateRangeChange}
                    onCustomDateChange={handleCustomDateChange}
                    loading={isLoading}
                    className="bg-white border border-gray-200 rounded-md"
                  />
                </div>
                <button
                  onClick={refreshDashboard}
                  disabled={isLoading}
                  className="p-2 text-gray-600 hover:text-gray-700 hover:bg-white/70 rounded-lg transition-all duration-200 transform hover:scale-110 hover:shadow-md"
                  title="Refresh dashboard data"
                >
                  <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
                {hasMultipleBusinesses && (
                  <button
                    onClick={() => window.location.href = '/switch-tenant'}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Switch Business
                  </button>
                )}
                {!hasMultipleBusinesses && tenantInfo && (
                  <button
                    onClick={() => window.location.href = '/auth/business-setup'}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-lg hover:from-gray-200 hover:to-gray-300 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Business
                  </button>
                )}
              </div>
            </div>

            {hasMultipleBusinesses && (
              <div className="mt-4 p-3 bg-white/50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Here's an overview of {tenantInfo?.name}'s performance and financial status:</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business Setup Reminder - REMOVED */}
      {/* {showBusinessSetupReminder && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Complete Your Business Setup
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Your business is currently named "{tenantInfo?.name}". 
                    Complete your business profile to personalize your experience and make your account more professional.
                  </p>
                </div>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => window.location.href = `/auth/business-setup?userId=${userSubscription?.user?.id}&tenantId=${userSubscription?.user?.tenantId}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Complete Setup
                  </button>
                  <button
                    onClick={() => setShowBusinessSetupReminder(false)}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    Remind me later
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowBusinessSetupReminder(false)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )} */}

      {/* <div x-data="{ showWelcome: true }" x-show="showWelcome" className="hidden md:block bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-300 shadow overflow-hidden sm:rounded-lg mb-6 text-white relative">
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="absolute inset-0 opacity-30 bg-cover bg-center" style={{backgroundImage: "url('/images/clipartt.png')"}}>
        </div>
        <div className="absolute top-2 right-2 z-20">
            <button onClick={() => {
              const banner = document.querySelector('[x-data="{ showWelcome: true }"]');
              if (banner) banner.style.display = 'none';
            }} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center">
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" >
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
        <div className="relative flex items-center p-2 z-10">
            <img src="/images/clipartt.png" alt="Clipart Image" className="w-60" />
            <div className="ml-4">
                <h3 className="text-2xl font-semibold">
                    Welcome, Henry!
                </h3>
                <p className="mt-1 mr-2">
                    Here you can find an overview of your recent activities and key metrics. Use the cards below
                    to quickly access your sales, expenses, invoices, and more.
                </p>
            </div>
        </div>
      </div> */}

      {/* Daily Metrics Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Clock size={18} className="mr-2 text-indigo-500" />
            Today's Performance
          </h2>
          <div className="text-sm text-gray-500">
            {dailyPerformance ? 
              new Date(dailyPerformance.today.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 
              <SkeletonElement className="h-5 w-48" />
            }
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Today's Revenue Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg shadow hover:shadow-xl transition-all duration-300 p-5 transform hover:-translate-y-1">
            <div className="flex justify-between mb-2">
              <div className="flex items-center text-sm font-medium text-gray-600">
                <TrendingUp size={16} className="mr-1 text-green-500" />
                Today's Revenue
              </div>
              <div className="text-xs text-gray-500">vs Yesterday</div>
            </div>
            
            <div className="flex items-center mb-3">
              <div className="text-2xl font-bold mr-2">
                {dailyPerformance ? formatCurrency(dailyPerformance.today.revenue) : <SkeletonElement className="h-8 w-32" />}
              </div>
              {dailyPerformance ? (
                <div className={`flex items-center text-xs font-medium ${parseFloat(revenueChange) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {parseFloat(revenueChange) >= 0 ? <ArrowUp size={14} className="mr-0.5" /> : <ArrowDown size={14} className="mr-0.5" />}
                  <span>{Math.abs(parseFloat(revenueChange))}%</span>
                </div>
              ) : <SkeletonElement className="h-5 w-12" />}
            </div>
            
            <div className="flex items-end justify-between">
              {dailyPerformance ? 
                <MiniSparkline data={dailyPerformance.weeklyTrend.revenue} type="revenue" /> : 
                <SkeletonElement className="h-8 w-20" />
              }
              <div className="text-xs text-gray-500">Last 7 days</div>
            </div>
          </div>
          
          {/* Today's Expenses Card */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-lg shadow hover:shadow-xl transition-all duration-300 p-5 transform hover:-translate-y-1">
            <div className="flex justify-between mb-2">
              <div className="flex items-center text-sm font-medium text-gray-600">
                <TrendingDown size={16} className="mr-1 text-red-500" />
                Today's Expenses
              </div>
              <div className="text-xs text-gray-500">vs Yesterday</div>
            </div>
            
            <div className="flex items-center mb-3">
              <div className="text-2xl font-bold mr-2">
                {dailyPerformance ? formatCurrency(dailyPerformance.today.expenses) : <SkeletonElement className="h-8 w-32" />}
              </div>
              {dailyPerformance ? (
                <div className={`flex items-center text-xs font-medium ${parseFloat(expensesChange) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {parseFloat(expensesChange) < 0 ? <ArrowDown size={14} className="mr-0.5" /> : <ArrowUp size={14} className="mr-0.5" />}
                  <span>{Math.abs(parseFloat(expensesChange))}%</span>
                </div>
              ) : <SkeletonElement className="h-5 w-12" />}
            </div>
            
            <div className="flex items-end justify-between">
              {dailyPerformance ? 
                <MiniSparkline data={dailyPerformance.weeklyTrend.expenses} type="expenses" /> : 
                <SkeletonElement className="h-8 w-20" />
              }
              <div className="text-xs text-gray-500">Last 7 days</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Financial Summary Cards */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
          <BarChart3 size={18} className="mr-2 text-indigo-500" />
          Financial Summary
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Total Revenue Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg shadow hover:shadow-xl transition-all duration-300 p-5 transform hover:-translate-y-1">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Total Revenue</div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CreditCard size={16} className="text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {incomeExpenses ? formatCurrency(incomeExpenses.income.reduce((sum, val) => sum + val, 0)) : <SkeletonElement className="h-8 w-32" />}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
                <span>
                  {metrics ?
                    `${metrics.revenue.change}% from last ${getDateRangeLabel(selectedDateRange)}` :
                    <SkeletonElement className="h-5 w-40 ml-1" />
                  }
                </span>
            </div>
          </div>
          
          {/* Total Expenses Card */}
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 rounded-lg shadow hover:shadow-xl transition-all duration-300 p-5 transform hover:-translate-y-1">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Total Expenses</div>
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <ShoppingCart size={16} className="text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {incomeExpenses ? formatCurrency(incomeExpenses.expenses.reduce((sum, val) => sum + val, 0)) : <SkeletonElement className="h-8 w-32" />}
            </div>
            <div className="flex items-center text-sm text-red-600">
              <ArrowUpRight size={16} className="mr-1" />
                <span>
                  {metrics ?
                    `${metrics.expenses.change}% from last ${getDateRangeLabel(selectedDateRange)}` :
                    <SkeletonElement className="h-5 w-40 ml-1" />
                  }
                </span>
            </div>
          </div>
        </div>
      </div>
      

      {/* Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income & Expenses Bar Chart */}
        <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Income & Expense Overview</h2>
            <a href="/reports/" className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
              Detailed Report <ChevronRight size={16} className="ml-1" />
            </a>
          </div>
          <div className="p-5 h-80">
            {incomeExpenses ?
              <DashboardBarChart data={incomeExpenses} /> :
              <SkeletonBarChart />
            }
          </div>
        </div>

        {/* Expense Breakdown Pie Chart */}
        <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Expenses Breakdown</h2>
            <a href="/expenses" className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
              View Details <ChevronRight size={16} className="ml-1" />
            </a>
          </div>
          <div className="p-5 h-80">
            {expensesBreakdown ?
              <DashboardPieChart data={expensesBreakdown} /> :
              <SkeletonPieChart />
            }
          </div>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Accounts Receivable</h2>
            <a href="/accounting/receivables" className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
              View More <ChevronRight size={16} className="ml-1" />
            </a>
          </div>
          <div className="p-5">
            <div className="flex justify-between mb-5">
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Receivables</div>
                <div className="text-xl font-bold">
                  {receivables ? formatCurrency(receivables.current) : <SkeletonElement className="h-7 w-32" />}
                </div>
              </div>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-green-600 font-bold">
                    {receivables ? formatCurrency(receivables.notDue) : <SkeletonElement className="h-6 w-20" />}
                  </div>
                  <div className="text-xs text-gray-500">Not Due</div>
                </div>
                <div className="text-center">
                  <div className="text-red-600 font-bold">
                    {receivables ? formatCurrency(receivables.overdue) : <SkeletonElement className="h-6 w-20" />}
                  </div>
                  <div className="text-xs text-gray-500">Overdue</div>
                </div>
              </div>
            </div>

            <div>
               <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-medium text-gray-700">Aging Summary</h3>
                 <div className="flex items-center space-x-3 text-xs">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">Current</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">31-60 days</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">61-90 days</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">90+ days</span>
                   </div>
                 </div>
               </div>
              <div className="space-y-3">
                {receivables ? (
                   receivables.aging.map((period, index) => {
                     const percentage = receivables.current > 0 ? (period.amount / receivables.current) * 100 : 0;
                     const isOverdue = index > 0; // 0-30 days is current, others are overdue

                     return (
                    <div key={index} className="flex items-center">
                      <div className="w-28 text-xs text-gray-500">{period.range}</div>
                      <div className="flex-1 mx-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                               className={`h-2 rounded-full transition-all duration-300 ${
                                 index === 0 ? 'bg-green-500' :
                                 index === 1 ? 'bg-yellow-500' :
                                 index === 2 ? 'bg-orange-500' : 'bg-red-500'
                               }`}
                               style={{ width: `${Math.max(percentage, 2)}%` }} // Minimum 2% width for visibility
                          ></div>
                        </div>
                      </div>
                         <div className="w-24 text-right text-sm font-medium">
                           {formatCurrency(period.amount)}
                           {percentage > 0 && (
                             <div className="text-xs text-gray-400">
                               {percentage.toFixed(1)}%
                    </div>
                           )}
                         </div>
                       </div>
                     );
                   })
                ) : (
                  [...Array(4)].map((_, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-28"><SkeletonElement className="h-4 w-20" /></div>
                      <div className="flex-1 mx-2"><SkeletonElement className="h-2 w-full" /></div>
                      <div className="w-24 text-right"><SkeletonElement className="h-5 w-16 ml-auto" /></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Accounts Payable */}
        <div className="bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Accounts Payable</h2>
            <a href="/accounting/payables" className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
              View More <ChevronRight size={16} className="ml-1" />
            </a>
          </div>
          <div className="p-5">
            <div className="flex justify-between mb-5">
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Payables</div>
                <div className="text-xl font-bold">
                  {payables ? formatCurrency(payables.current) : <SkeletonElement className="h-7 w-32" />}
                </div>
              </div>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-green-600 font-bold">
                    {payables ? formatCurrency(payables.notDue) : <SkeletonElement className="h-6 w-20" />}
                  </div>
                  <div className="text-xs text-gray-500">Not Due</div>
                </div>
                <div className="text-center">
                  <div className="text-red-600 font-bold">
                    {payables ? formatCurrency(payables.overdue) : <SkeletonElement className="h-6 w-20" />}
                  </div>
                  <div className="text-xs text-gray-500">Overdue</div>
                </div>
              </div>
            </div>

            <div>
               <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-medium text-gray-700">Aging Summary</h3>
                 <div className="flex items-center space-x-3 text-xs">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">Current</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">31-60 days</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">61-90 days</span>
                   </div>
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                     <span className="text-gray-500">90+ days</span>
                   </div>
                 </div>
               </div>
              <div className="space-y-3">
                {payables ? (
                   payables.aging.map((period, index) => {
                     const percentage = payables.current > 0 ? (period.amount / payables.current) * 100 : 0;
                     const isOverdue = index > 0; // 0-30 days is current, others are overdue

                     return (
                    <div key={index} className="flex items-center">
                      <div className="w-28 text-xs text-gray-500">{period.range}</div>
                      <div className="flex-1 mx-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                               className={`h-2 rounded-full transition-all duration-300 ${
                                 index === 0 ? 'bg-green-500' :
                                 index === 1 ? 'bg-yellow-500' :
                                 index === 2 ? 'bg-orange-500' : 'bg-red-500'
                               }`}
                               style={{ width: `${Math.max(percentage, 2)}%` }} // Minimum 2% width for visibility
                          ></div>
                        </div>
                      </div>
                         <div className="w-24 text-right text-sm font-medium">
                           {formatCurrency(period.amount)}
                           {percentage > 0 && (
                             <div className="text-xs text-gray-400">
                               {percentage.toFixed(1)}%
                    </div>
                           )}
                         </div>
                       </div>
                     );
                   })
                ) : (
                  [...Array(4)].map((_, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-28"><SkeletonElement className="h-4 w-20" /></div>
                      <div className="flex-1 mx-2"><SkeletonElement className="h-2 w-full" /></div>
                      <div className="w-24 text-right"><SkeletonElement className="h-5 w-16 ml-auto" /></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
      </div>

      {/* Stock Alerts Section */}
      <div className="mt-6 bg-white rounded-lg shadow hover:shadow-xl transition-shadow duration-300">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Stock Alerts</h2>
          <button
            onClick={refreshDashboard}
            className="text-sm text-indigo-600 flex items-center hover:text-indigo-800 transition-all duration-200 transform hover:scale-105 hover:bg-indigo-50 px-3 py-1 rounded-md"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="p-5">
          {stockAlerts.length > 0 ? (
            <>
              <div className="space-y-4">
                {(() => {
                  const totalPages = Math.ceil(stockAlerts.length / stockAlertsPageSize);
                  const startIndex = (stockAlertsPage - 1) * stockAlertsPageSize;
                  const endIndex = startIndex + stockAlertsPageSize;
                  const paginatedAlerts = stockAlerts.slice(startIndex, endIndex);
                  
                  return paginatedAlerts.map((alert, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 ${
                      alert.type === 'low_stock' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-400 hover:border-red-500' :
                      alert.type === 'out_of_stock' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500 hover:border-red-600' :
                      'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 hover:border-yellow-500'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          {alert.type === 'low_stock' ? (
                            <AlertTriangle size={20} className="text-red-500 mr-3 mt-0.5" />
                          ) : alert.type === 'out_of_stock' ? (
                            <XCircle size={20} className="text-red-600 mr-3 mt-0.5" />
                          ) : (
                            <Bell size={20} className="text-yellow-500 mr-3 mt-0.5" />
                          )}
                          <div>
                            <h3 className="font-medium text-gray-900">{alert.product}</h3>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                            <div className="flex items-center mt-2 text-xs text-gray-500">
                              <Package size={14} className="mr-1" />
                              <span>Current Stock: {alert.currentStock}</span>
                              {alert.reorderPoint && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>Reorder Point: {alert.reorderPoint}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            // Navigate to suppliers page with product ID and open order form
                            window.location.href = `/purchases/suppliers?restock=true&productId=${alert.id}&tab=orders`;
                          }}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-indigo-50 px-3 py-1 rounded-md"
                        >
                          Restock
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              
              {stockAlerts.length > stockAlertsPageSize && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="text-sm text-gray-600">
                    Page {stockAlertsPage} of {Math.ceil(stockAlerts.length / stockAlertsPageSize)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStockAlertsPage(prev => Math.max(1, prev - 1))}
                      disabled={stockAlertsPage === 1}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setStockAlertsPage(prev => Math.min(Math.ceil(stockAlerts.length / stockAlertsPageSize), prev + 1))}
                      disabled={stockAlertsPage === Math.ceil(stockAlerts.length / stockAlertsPageSize)}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
              <p className="text-gray-600">No stock alerts at the moment</p>
              <p className="text-sm text-gray-500 mt-1">All inventory levels are healthy</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
return(
  <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="mb-6">
        <div className="inline-block">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Dashboard</h2>
      <p className="text-gray-600 mb-2">Please wait while we prepare your dashboard</p>
      <p className="text-sm text-gray-500">Verifying permissions and loading your data...</p>
    </div>
  </div>
)

};

export default BusinessOwnerDashboard;