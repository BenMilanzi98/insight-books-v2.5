"use client";
import { useState, useEffect, useRef } from "react";
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
  Wallet,
  Truck,
  Eye,
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
            <linearGradient id="blueGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="purpleGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#A78BFA', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#7C3AED', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="greenGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#34D399', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="yellowGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FCD34D', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#D97706', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="redGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#F87171', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#DC2626', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="indigoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
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
              0: 'url(#blueGradient2)',
              1: 'url(#purpleGradient2)',
              2: 'url(#greenGradient2)',
              3: 'url(#yellowGradient2)',
              4: 'url(#redGradient2)',
              5: 'url(#indigoGradient2)'
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
  const [stockReceiptNotices, setStockReceiptNotices] = useState([]);
  const [stockReceiptDetail, setStockReceiptDetail] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [filteredData, setFilteredData] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(3);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [showBusinessSetupReminder, setShowBusinessSetupReminder] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [userTenants, setUserTenants] = useState([]);
  const [hasMultipleBusinesses, setHasMultipleBusinesses] = useState(false);

  /** 'session' = active business only (API default); 'all' = aggregate=all; 'custom' = tenantIds= */
  const [dashboardBusinessScope, setDashboardBusinessScope] = useState("session");
  const [dashboardCustomTenantIds, setDashboardCustomTenantIds] = useState([]);
  const dashboardScopeHydrated = useRef(false);

  const DASH_SCOPE_KEY = "insightbooks:dashboard-business-scope";
  const DASH_SCOPE_IDS_KEY = "insightbooks:dashboard-custom-tenant-ids";

  // State for dashboard data
  const [metrics, setMetrics] = useState(null);
  const [dailyPerformance, setDailyPerformance] = useState(null);
  const [receivables, setReceivables] = useState(null);
  const [payables, setPayables] = useState(null);
  const [incomeExpenses, setIncomeExpenses] = useState(null);
  const [expensesBreakdown, setExpensesBreakdown] = useState(null);
  const [revenueByCategory, setRevenueByCategory] = useState(null);
  const [showRevenueByCategory, setShowRevenueByCategory] = useState(false);
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
  
  // State for current branch (to trigger refetch on branch change)
  const [currentBranchId, setCurrentBranchId] = useState(null);
  
  // Fetch current branch on mount and when it changes
  useEffect(() => {
    const fetchCurrentBranch = async () => {
      try {
        const branchRes = await fetch('/api/branches/switch', { cache: 'no-store' });
        if (branchRes.ok) {
          const branchData = await branchRes.json();
          setCurrentBranchId(branchData.branchId);
        }
      } catch (e) {
        console.error('Failed to get current branch:', e);
      }
    };
    fetchCurrentBranch();

    // Listen for branch changes triggered in another tab/window (no polling).
    const handleStorage = (event) => {
      if (event.key === 'insightbooks:branch-switch') {
        fetchCurrentBranch();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Refresh cross-tenant stock receipts when returning to the tab (e.g. after a transfer elsewhere).
  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const recRes = await fetch(
          `/api/dashboard/stock-transfer-receipts?_cb=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );
        if (recRes.ok) {
          const recData = await recRes.json();
          setStockReceiptNotices(recData.notices || []);
        }
      } catch {
        /* ignore */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') loadReceipts();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  
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

  useEffect(() => {
    if (dashboardScopeHydrated.current || userTenants.length < 2) return;
    dashboardScopeHydrated.current = true;
    try {
      const saved = localStorage.getItem(DASH_SCOPE_KEY);
      if (saved === "all" || saved === "session" || saved === "custom") {
        setDashboardBusinessScope(saved);
      }
      const rawIds = localStorage.getItem(DASH_SCOPE_IDS_KEY);
      if (rawIds) {
        const parsed = JSON.parse(rawIds);
        if (Array.isArray(parsed)) {
          const allowed = new Set(userTenants.map((t) => t.id));
          setDashboardCustomTenantIds(parsed.filter((id) => allowed.has(id)));
        }
      }
    } catch {
      /* ignore */
    }
  }, [userTenants]);

  useEffect(() => {
    if (userTenants.length < 2) return;
    try {
      localStorage.setItem(DASH_SCOPE_KEY, dashboardBusinessScope);
      localStorage.setItem(
        DASH_SCOPE_IDS_KEY,
        JSON.stringify(dashboardCustomTenantIds)
      );
    } catch {
      /* ignore */
    }
  }, [dashboardBusinessScope, dashboardCustomTenantIds, userTenants.length]);

  // Fetch dashboard data when date range, branch, or business scope changes
  useEffect(() => {
    fetchDashboardData();
  }, [
    selectedDateRange,
    currentBranchId,
    dashboardBusinessScope,
    dashboardCustomTenantIds,
  ]);

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

      // Helper function to safely fetch data with cache-busting
      const safeFetch = async (url) => {
        try {
          // Add cache-busting to ensure fresh data on branch switch
          const urlWithCache = url.includes('?') 
            ? `${url}&_cb=${Date.now()}` 
            : `${url}?_cb=${Date.now()}`;
          
          const response = await fetch(urlWithCache, {
            cache: 'no-store', // Prevent caching
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
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
      // Note: Branch filtering is handled server-side via session (user.currentBranchId)
      // Add cache-busting to ensure fresh data when branch changes
      const appendDashboardScopeParams = (params) => {
        if (dashboardBusinessScope === "all") {
          params.set("aggregate", "all");
        } else if (
          dashboardBusinessScope === "custom" &&
          dashboardCustomTenantIds.length > 0
        ) {
          params.set("tenantIds", dashboardCustomTenantIds.join(","));
        }
      };

      const buildApiUrl = (endpoint) => {
        const params = new URLSearchParams();

        if (selectedDateRange === "custom") {
          params.append("dateRange", "custom");
          params.append("startDate", startDate.toISOString().split("T")[0]);
          params.append("endDate", endDate.toISOString().split("T")[0]);
        } else {
          params.append("dateRange", mapDateRangeToAPI(selectedDateRange));
        }

        appendDashboardScopeParams(params);
        params.append("_t", Date.now());

        return `${endpoint}?${params.toString()}`;
      };

      const dailyPerfParams = new URLSearchParams({ dateRange: "today" });
      appendDashboardScopeParams(dailyPerfParams);
      const dailyPerformanceUrl = `/api/dashboard/daily-performance?${dailyPerfParams.toString()}`;

      // Fetch all dashboard data using actual API endpoints
      // Note: Daily Performance should ALWAYS show "Today" data regardless of selected date range
      const [metricsData, dailyPerformanceData, receivablesData, payablesData, incomeExpensesData, expensesBreakdownData, upcomingPaymentsData, stockAlertsData, financialPositionData] = await Promise.all([
        safeFetch(buildApiUrl('/api/dashboard/metrics')),
        safeFetch(dailyPerformanceUrl),
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

      setStockAlerts(stockAlertsData.alerts || []);

      const sd = startDate instanceof Date ? startDate : new Date(startDate);
      const ed = endDate instanceof Date ? endDate : new Date(endDate);
      try {
        const revParams = new URLSearchParams();
        revParams.set('startDate', sd.toISOString().split('T')[0]);
        revParams.set('endDate', ed.toISOString().split('T')[0]);
        if (dashboardBusinessScope === "all") {
          revParams.set("aggregate", "all");
        } else if (
          dashboardBusinessScope === "custom" &&
          dashboardCustomTenantIds.length > 0
        ) {
          revParams.set("tenantIds", dashboardCustomTenantIds.join(","));
        }
        const revRes = await fetch(
          `/api/dashboard/revenue-by-category?${revParams.toString()}&_cb=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );
        if (revRes.ok) {
          setRevenueByCategory(await revRes.json());
        } else {
          setRevenueByCategory(null);
        }
      } catch (revErr) {
        console.warn('revenue-by-category:', revErr);
        setRevenueByCategory(null);
      }

      try {
        const recRes = await fetch(
          `/api/dashboard/stock-transfer-receipts?_cb=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );
        if (recRes.ok) {
          const recData = await recRes.json();
          setStockReceiptNotices(recData.notices || []);
        } else {
          setStockReceiptNotices([]);
        }
      } catch {
        setStockReceiptNotices([]);
      }

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="text-center max-w-md w-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/80 p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (pagePermissions.canViewDashboard) {
    return renderDashboard();
  }

  // Loading state when user doesn't have permission yet
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="text-center max-w-sm">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Loading Dashboard</h2>
        <p className="text-gray-600 text-sm mb-1">Preparing your dashboard</p>
        <p className="text-xs text-gray-500">Verifying permissions and loading data...</p>
      </div>
    </div>
  );

  async function openStockReceiptDetail(notice) {
    try {
      await fetch(`/api/dashboard/stock-transfer-receipts/${notice.id}`, {
        method: 'PATCH',
      });
      setStockReceiptNotices((prev) =>
        prev.map((n) =>
          n.id === notice.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
    } catch (_) {
      /* non-fatal */
    }
    setStockReceiptDetail(notice);
  }

  function renderDashboard() {
    const scopedBusinessCount =
      dashboardBusinessScope === "all"
        ? userTenants.length
        : dashboardBusinessScope === "custom"
          ? Math.max(1, dashboardCustomTenantIds.length)
          : 1;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Dashboard Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-1 h-8 sm:h-9 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></span>
                  <span>Overview of performance, cash position, receivables, payables, and inventory.</span>
                </p>
              </div>
            </div>
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
          <div className="mb-6 sm:mb-8 relative">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible">
              <div className="p-6 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 rounded-t-2xl border-b border-gray-100">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 ring-4 ring-white/50">
                      <Building className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                        {tenantInfo?.name || 'Loading...'}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-gray-500">Your business dashboard</span>
                        <span className="text-gray-300">•</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hasMultipleBusinesses ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {hasMultipleBusinesses ? 'Multi-business account' : 'Single business account'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleDataExport}
                      disabled={isExporting}
                      className={`inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-green-200 transition-all duration-200 hover:shadow-xl hover:shadow-green-200 hover:-translate-y-0.5 ${isExporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'}`}
                    >
                      {isExporting ? (
                        <>
                          <RefreshCw size={16} className="mr-2 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2" />
                          Data Backup
                        </>
                      )}
                    </button>
                    <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-1 border border-gray-200/50 relative z-[1000]">
                      <UniversalDateRangeFilter
                        timeframe={selectedDateRange}
                        onTimeframeChange={handleDateRangeChange}
                        onCustomDateChange={handleCustomDateChange}
                        loading={isLoading}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm"
                      />
                    </div>
                    {hasMultipleBusinesses && (
                      <div className="flex flex-col gap-1 min-w-[11rem] max-w-[220px]">
                        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold px-0.5">
                          Data scope
                        </span>
                        <select
                          value={dashboardBusinessScope}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDashboardBusinessScope(next);
                            if (
                              next === "custom" &&
                              dashboardCustomTenantIds.length === 0 &&
                              userTenants.length
                            ) {
                              setDashboardCustomTenantIds(
                                userTenants.map((t) => t.id)
                              );
                            }
                          }}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          aria-label="Dashboard data scope across businesses"
                        >
                          <option value="session">Current business only</option>
                          <option value="all">All my businesses</option>
                          <option value="custom">Selected businesses…</option>
                        </select>
                        {dashboardBusinessScope === "custom" && (
                          <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-inner text-xs space-y-1">
                            {userTenants.map((t) => (
                              <label
                                key={t.id}
                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  checked={dashboardCustomTenantIds.includes(
                                    t.id
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDashboardCustomTenantIds((prev) =>
                                        prev.includes(t.id)
                                          ? prev
                                          : [...prev, t.id]
                                      );
                                    } else {
                                      setDashboardCustomTenantIds((prev) => {
                                        if (prev.length <= 1) return prev;
                                        return prev.filter((id) => id !== t.id);
                                      });
                                    }
                                  }}
                                />
                                <span className="truncate">{t.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={refreshDashboard}
                      disabled={isLoading}
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 rounded-xl transition-all duration-200 hover:shadow-md"
                      title="Refresh dashboard data"
                    >
                      <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    {hasMultipleBusinesses && (
                      <button
                        onClick={() => window.location.href = '/switch-tenant'}
                        className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Switch Business
                      </button>
                    )}
                    {!hasMultipleBusinesses && tenantInfo && (
                      <button
                        onClick={() => window.location.href = '/auth/business-setup'}
                        className="inline-flex items-center px-4 py-2.5 bg-white text-gray-700 rounded-xl font-semibold shadow-lg shadow-gray-200 border border-gray-200 hover:shadow-xl hover:shadow-gray-200 hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Business
                      </button>
                    )}
                  </div>
                </div>

                {hasMultipleBusinesses && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50">
                    <p className="text-sm text-blue-700 flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs">
                        <Building size={12} />
                      </span>
                      <span className="font-medium">
                        {"Here's an overview of "}
                        {tenantInfo?.name}
                        {"'s performance and financial status"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Daily Metrics Section */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200 ring-2 ring-white/50">
                  <Clock size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    {"Today's Performance"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {hasMultipleBusinesses &&
                    dashboardBusinessScope !== "session"
                      ? `Totals across ${scopedBusinessCount} business${
                          scopedBusinessCount === 1 ? "" : "es"
                        } (all branches per business)`
                      : "Real-time metrics comparison"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200 flex-shrink-0">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-gray-600 font-medium">
                  {dailyPerformance ? 
                    (() => {
                      const date = new Date(dailyPerformance.today.date);
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      return `${day}-${month}-${year}`;
                    })() : 
                    <SkeletonElement className="h-4 w-24" />
                  }
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Today's Revenue Card */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-green-200/50 border border-white/50 hover:shadow-xl hover:shadow-green-200/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 group-hover:shadow-xl group-hover:shadow-green-200 transition-all duration-300 ring-2 ring-green-100">
                      <TrendingUp size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {"Today's Revenue"}
                      </p>
                      <p className="text-xs text-gray-400">vs Yesterday</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${parseFloat(revenueChange) >= 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {parseFloat(revenueChange) >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    <span>{Math.abs(parseFloat(revenueChange))}%</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-gray-900">
                    {dailyPerformance ? formatCurrency(dailyPerformance.today.revenue) : <SkeletonElement className="h-10 w-36" />}
                  </div>
                  {dailyPerformance ? 
                    <MiniSparkline data={dailyPerformance.weeklyTrend.revenue} type="revenue" /> : 
                    <SkeletonElement className="h-8 w-24" />
                  }
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                  <Activity size={12} />
                  <span>Last 7 days trend</span>
                </div>
              </div>
              
              {/* Today's Expenses Card */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-red-200/50 border border-white/50 hover:shadow-xl hover:shadow-red-200/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-rose-500 to-pink-500"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200 group-hover:shadow-xl group-hover:shadow-red-200 transition-all duration-300 ring-2 ring-red-100">
                      <TrendingDown size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {"Today's Expenses"}
                      </p>
                      <p className="text-xs text-gray-400">vs Yesterday</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${parseFloat(expensesChange) < 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {parseFloat(expensesChange) < 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                    <span>{Math.abs(parseFloat(expensesChange))}%</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold text-gray-900">
                    {dailyPerformance ? formatCurrency(dailyPerformance.today.expenses) : <SkeletonElement className="h-10 w-36" />}
                  </div>
                  {dailyPerformance ? 
                    <MiniSparkline data={dailyPerformance.weeklyTrend.expenses} type="expenses" /> : 
                    <SkeletonElement className="h-8 w-24" />
                  }
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs text-gray-400">
                  <Activity size={12} />
                  <span>Last 7 days trend</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Financial Summary Cards */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <BarChart3 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Financial Summary</h2>
                <p className="text-xs text-gray-500">Revenue and expenses overview</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Total Revenue Card */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-indigo-200/50 border border-white/50 hover:shadow-xl hover:shadow-indigo-200/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200 group-hover:shadow-xl group-hover:shadow-green-200 transition-all duration-300 ring-2 ring-green-100">
                      <CreditCard size={24} className="text-white" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">Total Revenue</p>
                  </div>
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse ring-2 ring-green-200"></div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-3">
                  {incomeExpenses ? formatCurrency(incomeExpenses.income.reduce((sum, val) => sum + val, 0)) : <SkeletonElement className="h-10 w-40" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg font-semibold border border-green-200">
                    <ArrowUpRight size={16} />
                    {metrics ? `${metrics.revenue.change}%` : '--'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {metrics ? `from last ${getDateRangeLabel(selectedDateRange)}` : <SkeletonElement className="h-4 w-24" />}
                  </span>
                </div>
              </div>
              
              {/* Total Expenses Card */}
              <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-orange-200/50 border border-white/50 hover:shadow-xl hover:shadow-orange-200/60 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-red-500 to-rose-500"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200 group-hover:shadow-xl group-hover:shadow-orange-200 transition-all duration-300 ring-2 ring-orange-100">
                      <ShoppingCart size={24} className="text-white" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">Total Expenses</p>
                  </div>
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse ring-2 ring-orange-200"></div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-3">
                  {incomeExpenses ? formatCurrency(incomeExpenses.expenses.reduce((sum, val) => sum + val, 0)) : <SkeletonElement className="h-10 w-40" />}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg font-semibold border border-orange-200">
                    <ArrowUpRight size={16} />
                    {metrics ? `${metrics.expenses.change}%` : '--'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {metrics ? `from last ${getDateRangeLabel(selectedDateRange)}` : <SkeletonElement className="h-4 w-24" />}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {revenueByCategory?.categories?.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRevenueByCategory((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-violet-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
                      <Package size={20} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900">Revenue by inventory category</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Optional — completed sales by product category for the selected period
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={22}
                    className={`text-gray-400 flex-shrink-0 transition-transform ${showRevenueByCategory ? 'rotate-90' : ''}`}
                  />
                </button>
                {showRevenueByCategory && (
                  <div className="px-4 sm:px-5 pb-5 overflow-x-auto border-t border-gray-100/80">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-4 font-medium">Category</th>
                          <th className="py-2 text-right font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueByCategory.categories.map((row) => (
                          <tr key={row.category} className="border-b border-gray-50">
                            <td className="py-2.5 pr-4 text-gray-900">{row.category}</td>
                            <td className="py-2.5 text-right font-medium text-gray-900">
                              {formatCurrency(row.actualRevenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold text-gray-900">
                          <td className="pt-3">Total</td>
                          <td className="pt-3 text-right">
                            {formatCurrency(revenueByCategory.totalActual ?? 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Income & Expenses Bar Chart */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 via-purple-500 to-violet-500"></div>
              <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <BarChart3 size={20} className="text-white" />
                  </div>
                  <h2 className="font-bold text-gray-800 truncate">Income & Expense Overview</h2>
                </div>
                <a href="/reports/" className="group flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium transition-all duration-200">
                  Detailed Report 
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-red-500 to-rose-500"></div>
              <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gradient-to-r from-orange-500/5 via-transparent to-red-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
                    <Wallet size={20} className="text-white" />
                  </div>
                  <h2 className="font-bold text-gray-800 truncate">Expenses Breakdown</h2>
                </div>
                <a href="/expenses" className="group flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-orange-100 text-orange-600 rounded-lg text-sm font-medium transition-all duration-200">
                  View Details 
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
              <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                    <DollarSign size={20} className="text-white" />
                  </div>
                  <h2 className="font-bold text-gray-800 truncate">Accounts Receivable</h2>
                </div>
                <a href="/accounting/receivables" className="group flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-green-100 text-green-600 rounded-lg text-sm font-medium transition-all duration-200">
                  View More 
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
                </a>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Receivables</p>
                    <div className="text-xl font-bold text-gray-900">
                      {receivables ? formatCurrency(receivables.current) : <SkeletonElement className="h-6 w-24 mx-auto" />}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                    <p className="text-xs text-green-600 mb-1 font-medium">Not Due</p>
                    <div className="text-xl font-bold text-green-700">
                      {receivables ? formatCurrency(receivables.notDue) : <SkeletonElement className="h-6 w-20 mx-auto" />}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 text-center border border-red-100">
                    <p className="text-xs text-red-600 mb-1 font-medium">Overdue</p>
                    <div className="text-xl font-bold text-red-700">
                      {receivables ? formatCurrency(receivables.overdue) : <SkeletonElement className="h-6 w-20 mx-auto" />}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">Aging Summary</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full mr-1.5 shadow-sm shadow-green-300"></div>
                        <span className="text-gray-500">Current</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-1.5 shadow-sm shadow-yellow-300"></div>
                        <span className="text-gray-500">31-60</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-1.5 shadow-sm shadow-orange-300"></div>
                        <span className="text-gray-500">61-90</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full mr-1.5 shadow-sm shadow-red-300"></div>
                        <span className="text-gray-500">90+</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {receivables ? (
                      receivables.aging.map((period, index) => {
                        const percentage = receivables.current > 0 ? (period.amount / receivables.current) * 100 : 0;
                        const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
                        
                        return (
                          <div key={index} className="flex items-center">
                            <div className="w-24 text-xs text-gray-500 font-medium">{period.range}</div>
                            <div className="flex-1 mx-3">
                              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${colors[index]} ${index === 0 ? 'shadow-green-300' : index === 1 ? 'shadow-yellow-300' : index === 2 ? 'shadow-orange-300' : 'shadow-red-300'}`}
                                  style={{ width: `${Math.max(percentage, 2)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-28 text-right">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(period.amount)}</p>
                              {percentage > 0 && (
                                <p className="text-xs text-gray-400">{percentage.toFixed(1)}%</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      [...Array(4)].map((_, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-24"><SkeletonElement className="h-4 w-16" /></div>
                          <div className="flex-1 mx-3"><SkeletonElement className="h-3 w-full" /></div>
                          <div className="w-28 text-right"><SkeletonElement className="h-5 w-20 ml-auto" /></div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Accounts Payable */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-rose-500 to-pink-500"></div>
              <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-gradient-to-r from-red-500/5 via-transparent to-rose-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-red-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                    <CreditCard size={20} className="text-white" />
                  </div>
                  <h2 className="font-bold text-gray-800 truncate">Accounts Payable</h2>
                </div>
                <a href="/accounting/payables" className="group flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-all duration-200">
                  View More 
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
                </a>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Payables</p>
                    <div className="text-xl font-bold text-gray-900">
                      {payables ? formatCurrency(payables.current) : <SkeletonElement className="h-6 w-24 mx-auto" />}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                    <p className="text-xs text-green-600 mb-1 font-medium">Not Due</p>
                    <div className="text-xl font-bold text-green-700">
                      {payables ? formatCurrency(payables.notDue) : <SkeletonElement className="h-6 w-20 mx-auto" />}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 text-center border border-red-100">
                    <p className="text-xs text-red-600 mb-1 font-medium">Overdue</p>
                    <div className="text-xl font-bold text-red-700">
                      {payables ? formatCurrency(payables.overdue) : <SkeletonElement className="h-6 w-20 mx-auto" />}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-gray-700">Aging Summary</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full mr-1.5 shadow-sm shadow-green-300"></div>
                        <span className="text-gray-500">Current</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full mr-1.5 shadow-sm shadow-yellow-300"></div>
                        <span className="text-gray-500">31-60</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-orange-500 rounded-full mr-1.5 shadow-sm shadow-orange-300"></div>
                        <span className="text-gray-500">61-90</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full mr-1.5 shadow-sm shadow-red-300"></div>
                        <span className="text-gray-500">90+</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {payables ? (
                      payables.aging.map((period, index) => {
                        const percentage = payables.current > 0 ? (period.amount / payables.current) * 100 : 0;
                        const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
                        
                        return (
                          <div key={index} className="flex items-center">
                            <div className="w-24 text-xs text-gray-500 font-medium">{period.range}</div>
                            <div className="flex-1 mx-3">
                              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 shadow-sm ${colors[index]} ${index === 0 ? 'shadow-green-300' : index === 1 ? 'shadow-yellow-300' : index === 2 ? 'shadow-orange-300' : 'shadow-red-300'}`}
                                  style={{ width: `${Math.max(percentage, 2)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="w-28 text-right">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(period.amount)}</p>
                              {percentage > 0 && (
                                <p className="text-xs text-gray-400">{percentage.toFixed(1)}%</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      [...Array(4)].map((_, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-24"><SkeletonElement className="h-4 w-16" /></div>
                          <div className="flex-1 mx-3"><SkeletonElement className="h-3 w-full" /></div>
                          <div className="w-28 text-right"><SkeletonElement className="h-5 w-20 ml-auto" /></div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            
          </div>

          {/* Stock received from other businesses (cross-tenant transfers) */}
          {stockReceiptNotices.length > 0 && (
            <div className="mt-4 sm:mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 overflow-visible relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-500 to-cyan-500 rounded-t-2xl" />
              <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-teal-500/5 via-transparent to-emerald-500/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-200">
                    <Truck size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 truncate">Stock received</h2>
                    <p className="text-xs text-gray-500">Inventory transferred into this business</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {stockReceiptNotices.map((notice) => {
                  const srcName =
                    notice.sourceTenantName ||
                    notice.stockTransfer?.fromBranch?.tenant?.name ||
                    'Another business';
                  const unread = !notice.readAt;
                  return (
                    <div
                      key={notice.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border transition-colors ${
                        unread
                          ? 'border-teal-200 bg-emerald-50/90 border-l-4 border-l-teal-500'
                          : 'border-gray-100 bg-gray-50/80'
                      }`}
                    >
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">New stock received</span>
                        {' from '}
                        <span className="font-semibold text-teal-800">{srcName}</span>
                        <span className="text-gray-500">
                          {' '}
                          · {new Date(notice.createdAt).toLocaleString()}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => openStockReceiptDetail(notice)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm shrink-0"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Alerts Section */}
          <div className="mt-4 sm:mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 hover:shadow-xl hover:shadow-gray-200/60 transition-all duration-300 overflow-visible">
            <div className="p-4 sm:p-5 border-b border-gray-100/50 flex flex-wrap justify-between items-center gap-3 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200">
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <h2 className="font-bold text-gray-800 truncate">Stock Alerts</h2>
              </div>
              <button
                onClick={refreshDashboard}
                className="group flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-amber-100 text-amber-600 rounded-lg text-sm font-medium transition-all duration-200"
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
                        <div key={index} className={`p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-md ${alert.type === 'low_stock' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-400 hover:border-red-500' : alert.type === 'out_of_stock' ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-500 hover:border-red-600' : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 hover:border-yellow-500'}`}>
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
                                <h3 className="font-semibold text-gray-900">{alert.product}</h3>
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
                                window.location.href = `/purchases/suppliers?restock=true&productId=${alert.id}&tab=orders`;
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-all duration-200 transform hover:scale-105 hover:bg-indigo-50 px-3 py-1 rounded-lg"
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
                          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={() => setStockAlertsPage(prev => Math.min(Math.ceil(stockAlerts.length / stockAlertsPageSize), prev + 1))}
                          disabled={stockAlertsPage === Math.ceil(stockAlerts.length / stockAlertsPageSize)}
                          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No stock alerts at the moment</p>
                  <p className="text-sm text-gray-500 mt-1">All inventory levels are healthy</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {stockReceiptDetail && (() => {
          const t = stockReceiptDetail.stockTransfer;
          const p = stockReceiptDetail.receiptProduct || t?.product;
          const qty = t?.quantity != null ? Number(t.quantity) : 0;
          const unitPrice = p?.price != null ? Number(p.price) : 0;
          const lineTotal = unitPrice * qty;
          const dec = (v) => {
            if (v == null) return null;
            if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
            const n = Number(v);
            return Number.isNaN(n) ? null : n;
          };
          const costBasis =
            p?.cost != null
              ? dec(p.cost)
              : p?.lastPurchaseCost != null
                ? dec(p.lastPurchaseCost)
                : p?.averageCost != null
                  ? dec(p.averageCost)
                  : null;
          const fromBiz =
            stockReceiptDetail.sourceTenantName ||
            t?.fromBranch?.tenant?.name ||
            'Another business';
          return (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="stock-receipt-title"
              onClick={() => setStockReceiptDetail(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
                  <div>
                    <h2 id="stock-receipt-title" className="text-lg font-bold text-gray-900">
                      Received stock
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      From <span className="font-semibold text-teal-800">{fromBiz}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t?.createdAt
                        ? new Date(t.createdAt).toLocaleString()
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStockReceiptDetail(null)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                    aria-label="Close"
                  >
                    <span className="text-xl leading-none">&times;</span>
                  </button>
                </div>
                <div className="p-5">
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-gray-600 border-b border-gray-200">
                          <th className="py-2.5 px-3 font-medium">Product</th>
                          <th className="py-2.5 px-3 font-medium">SKU</th>
                          <th className="py-2.5 px-3 font-medium text-right">Qty</th>
                          <th className="py-2.5 px-3 font-medium text-right">Unit price</th>
                          <th className="py-2.5 px-3 font-medium text-right">Line total</th>
                          <th className="py-2.5 px-3 font-medium text-right">Cost basis</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-100">
                          <td className="py-3 px-3 text-gray-900 font-medium">{p?.name || '—'}</td>
                          <td className="py-3 px-3 text-gray-600">{p?.sku || '—'}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{qty}</td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {formatCurrency(unitPrice)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-medium text-gray-900">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-gray-600">
                            {costBasis != null && !Number.isNaN(costBasis)
                              ? formatCurrency(costBasis)
                              : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Unit price reflects the product record in this business after receipt. Cost basis is the
                    recorded product cost when available.
                  </p>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStockReceiptDetail(null)}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
};

export default BusinessOwnerDashboard;
