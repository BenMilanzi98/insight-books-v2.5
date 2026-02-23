"use client";
import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  CreditCard, 
  Users, 
  FileText, 
  ShoppingCart, 
  BarChart3, 
  ChevronRight,
  MoreHorizontal,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Filter,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Activity,
  X,
  Building,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  Download,
  BarChart,
  PieChart,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Upload,
  Lock,
  Shield,
  Globe,
  Link,
  UserPlus,
  Zap,
  UserX,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Skeleton element (same as main system)
const SkeletonElement = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [growthData, setGrowthData] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [growthGroupBy, setGrowthGroupBy] = useState('month'); // month | year | all
  const [growthStatusFilter, setGrowthStatusFilter] = useState('all'); // all | active | inactive
  const router = useRouter();

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  useEffect(() => {
    const fetchGrowth = async () => {
      setGrowthLoading(true);
      try {
        const res = await fetch(
          `/api/admin/dashboard/tenant-growth?groupBy=${growthGroupBy}&statusFilter=${growthStatusFilter}`
        );
        const data = await res.json();
        if (data.success) setGrowthData(data);
        else setGrowthData(null);
      } catch {
        setGrowthData(null);
      } finally {
        setGrowthLoading(false);
      }
    };
    fetchGrowth();
  }, [growthGroupBy, growthStatusFilter]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/dashboard/stats?range=${timeRange}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      setError('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency (same as main system)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount || 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="mb-8">
          <SkeletonElement className="h-8 w-64 mb-2" />
          <SkeletonElement className="h-5 w-96" />
        </div>
        
        {/* Time Filter Skeleton */}
        <div className="mb-6">
          <SkeletonElement className="h-10 w-48" />
        </div>
        
        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between mb-4">
                <SkeletonElement className="h-4 w-24" />
                <SkeletonElement className="h-8 w-8 rounded-full" />
              </div>
              <SkeletonElement className="h-8 w-32 mb-1" />
              <SkeletonElement className="h-4 w-40" />
            </div>
          ))}
        </div>
        
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <SkeletonElement className="h-6 w-32 mb-4" />
            <SkeletonElement className="h-80 w-full" />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <SkeletonElement className="h-6 w-40 mb-4" />
            <SkeletonElement className="h-80 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="text-red-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header - Same as main system */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Master Admin Dashboard</h1>
        <p className="text-gray-600">Platform overview and key metrics</p>
          </div>
        </div>
      </div>

      {/* Tenant Growth - Full-width responsive graph (before all other sections) */}
      <div className="w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30 shadow-sm">
        <div className="p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Title + filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Tenant Growth</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Signups and cumulative tenants over time</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:inline">Status</span>
                <div className="flex rounded-lg bg-white/80 border border-gray-200 p-0.5 shadow-sm">
                  {['all', 'active', 'inactive'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setGrowthStatusFilter(f)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md capitalize transition-all ${
                        growthStatusFilter === f
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:inline">Period</span>
                <div className="flex rounded-lg bg-white/80 border border-gray-200 p-0.5 shadow-sm">
                  {['all', 'month', 'year'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrowthGroupBy(g)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md capitalize transition-all ${
                        growthGroupBy === g ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {g === 'all' ? 'All' : g === 'month' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary pills */}
            {growthData?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white/90 border border-gray-200/80 p-3 sm:p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Building className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">All Tenants</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{growthData.summary.total}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 border border-emerald-200/80 p-3 sm:p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Paid</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700">{growthData.summary.paid}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 border border-green-200/80 p-3 sm:p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Active</p>
                    <p className="text-lg sm:text-xl font-bold text-green-700">{growthData.summary.active}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 border border-amber-200/80 p-3 sm:p-4 shadow-sm flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Trial</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-700">{growthData.summary.trial}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-white/90 border border-rose-200/80 p-3 sm:p-4 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
                  <div className="p-2 rounded-lg bg-rose-100">
                    <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Inactive</p>
                    <p className="text-lg sm:text-xl font-bold text-rose-700">{growthData.summary.inactive}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="rounded-xl bg-white/60 border border-gray-200/80 p-3 sm:p-4 min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">
              {growthLoading ? (
                <div className="h-[280px] sm:h-[320px] lg:h-[360px] flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              ) : growthData?.timeSeries?.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={growthData.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradInactive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCumulative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                      labelStyle={{ fontWeight: 600 }}
                      formatter={(value, name) => [value, { all: 'Signups', active: 'Active', inactive: 'Inactive', cumulativeTotal: 'Cumulative total' }[name] || name]}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {(growthStatusFilter === 'all' || growthStatusFilter === 'active') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="active"
                        name="Active"
                        stroke="#22c55e"
                        fill="url(#gradActive)"
                        strokeWidth={2}
                      />
                    )}
                    {(growthStatusFilter === 'all' || growthStatusFilter === 'inactive') && (
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="inactive"
                        name="Inactive"
                        stroke="#f43f5e"
                        fill="url(#gradInactive)"
                        strokeWidth={2}
                      />
                    )}
                    {growthStatusFilter === 'all' && (
                      <Bar yAxisId="left" dataKey="all" name="Signups" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    )}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeTotal"
                      name="Cumulative total"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] sm:h-[320px] lg:h-[360px] flex flex-col items-center justify-center text-gray-500">
                  <UserPlus className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm font-medium">No tenant growth data yet</p>
                  <p className="text-xs">Data will appear as tenants sign up</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Time Filter - Same as main system */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button 
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              timeRange === '7d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setTimeRange('7d')}
          >
            7D
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              timeRange === '30d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setTimeRange('30d')}
          >
            30D
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              timeRange === '90d' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setTimeRange('90d')}
          >
            90D
          </button>
          <button 
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              timeRange === '1y' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setTimeRange('1y')}
          >
            1Y
          </button>
        </div>
      </div>
        
      {/* Stats Overview - Same structure as main system */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
          <BarChart3 size={18} className="mr-2 text-indigo-500" />
          Platform Overview
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Daily Revenue Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Daily Revenue</div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <CreditCard size={16} className="text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatCurrency(stats.dailyRevenue || 0)}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>
                {typeof stats.revenueGrowth === 'string' ? stats.revenueGrowth : `+${stats.revenueGrowth || 0}%`} from yesterday
              </span>
            </div>
          </div>
          
          {/* Monthly Revenue Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Monthly Revenue</div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatCurrency(stats.monthlyRevenue || 0)}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>
                {typeof stats.revenueGrowth === 'string' ? stats.revenueGrowth : `+${stats.revenueGrowth || 0}%`} from last month
              </span>
            </div>
          </div>
          
          {/* Total Revenue Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Total Revenue</div>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <DollarSign size={16} className="text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {formatCurrency(stats.totalRevenue || 0)}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>
                {typeof stats.revenueGrowth === 'string' ? stats.revenueGrowth : `+${stats.revenueGrowth || 0}%`} from last year
              </span>
            </div>
          </div>
          
          {/* Total Business Owners Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Tenant Management</div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <Building size={16} className="text-indigo-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {stats.totalTenants || 0}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>
                {typeof stats.tenantGrowth === 'string' ? stats.tenantGrowth : `+${stats.tenantGrowth || 0}%`} this month
              </span>
            </div>
          </div>
          
          {/* Active Users Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Active Subscriptions</div>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Users size={16} className="text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {stats.activeUsers || 0}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>Active paid subscriptions</span>
            </div>
          </div>

          {/* Trial Users Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Active Trial Users</div>
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock size={16} className="text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {stats.trialUsers || 0}
            </div>
            <div className="flex items-center text-sm text-yellow-600">
              <Clock size={16} className="mr-1" />
              <span>Trial period active</span>
            </div>
          </div>

          {/* Total Users Card */}
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">Total Users</div>
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Activity size={16} className="text-gray-600" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-1">
              {stats.totalUsers || 0}
            </div>
            <div className="flex items-center text-sm text-green-600">
              <ArrowUpRight size={16} className="mr-1" />
              <span>
                {typeof stats.userGrowth === 'string' ? stats.userGrowth : `+${stats.userGrowth || 0}%`} this month
              </span>
            </div>
          </div>
        </div>
      </div>
        
      {/* Main Dashboard Content - Same structure as main system */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Overview */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Revenue Overview</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/revenue-overview')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="flex justify-between mb-5">
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
                <div className="text-xl font-bold">
                  {formatCurrency(stats.totalRevenue || 0)}
                </div>
              </div>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-green-600 font-bold">
                    {formatCurrency(stats.dailyRevenue || 0)}
                  </div>
                  <div className="text-xs text-gray-500">Today</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-600 font-bold">
                    {formatCurrency(stats.monthlyRevenue || 0)}
                  </div>
                  <div className="text-xs text-gray-500">This Month</div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Revenue Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-28 text-xs text-gray-500">Daily</div>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-green-500"
                        style={{ width: `${((stats.dailyRevenue || 0) / (stats.totalRevenue || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium">{formatCurrency(stats.dailyRevenue || 0)}</div>
                </div>
                <div className="flex items-center">
                  <div className="w-28 text-xs text-gray-500">Monthly</div>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${((stats.monthlyRevenue || 0) / (stats.totalRevenue || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium">{formatCurrency(stats.monthlyRevenue || 0)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Business Owner Growth */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Tenant Management Growth</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/subscription-growth')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="flex justify-between mb-5">
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Active Tenants</div>
                <div className="text-xl font-bold">
                  {stats.activeTenants || 0}
                </div>
              </div>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-green-600 font-bold">
                    {stats.activeUsers || 0}
                  </div>
                  <div className="text-xs text-gray-500">Paid Plans</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-600 font-bold">
                    {stats.trialUsers || 0}
                  </div>
                  <div className="text-xs text-gray-500">Active Trials</div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Subscription Breakdown</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-28 text-xs text-gray-500">Pro Plan</div>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-indigo-500"
                        style={{ width: `${((stats.activeUsers || 0) / (stats.activeUsers || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium">{stats.activeUsers || 0}</div>
                </div>
                <div className="flex items-center">
                  <div className="w-28 text-xs text-gray-500">Trial Users</div>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-yellow-500"
                        style={{ width: `${((stats.trialUsers || 0) / (stats.activeUsers || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium">{stats.trialUsers || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics - Same structure as main system */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Analytics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Subscription Analytics</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/subscription-analytics')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.activeUsers || 0}</div>
                <div className="text-sm text-gray-600">Active Subscriptions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.conversionRate || 0}%</div>
                <div className="text-sm text-gray-600">Trial to Paid Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.monthlyRecurringRevenue || 0)}</div>
                <div className="text-sm text-gray-600">MRR</div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Plan Distribution (Active)</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pro Plan</span>
                  <span className="text-sm font-medium">{stats.activeUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Trial Users</span>
                  <span className="text-sm font-medium">{stats.trialUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Active</span>
                  <span className="text-sm font-medium">{stats.activeUsers || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Performance */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">System Performance</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/system-performance')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">API Response Time</span>
                <span className="text-sm font-medium text-gray-900">{stats.apiResponseTime || 0}ms</span>
              </div>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${Math.min((stats.apiResponseTime || 0) / 100, 1) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Database Queries</span>
                <span className="text-sm font-medium text-gray-900">{stats.databaseQueries || 0}/min</span>
              </div>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.min((stats.databaseQueries || 0) / 1000, 1) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-medium text-gray-900">{stats.uptime || '99.9%'}</span>
              </div>
              <div className="flex items-center">
                <div className="flex-1 mr-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: '99.9%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Enhanced Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time System Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">System Status</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/system-performance')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            {stats.systemHealth ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.systemHealth.database === 'online' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.systemHealth.database || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Services</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.systemHealth.apiServices === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.systemHealth.apiServices || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">File Storage</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.systemHealth.fileStorage === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.systemHealth.fileStorage || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Service</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.systemHealth.emailService === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.systemHealth.emailService || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Backup System</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.systemHealth.backupSystem === 'running' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stats.systemHealth.backupSystem || 'Unknown'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">No system status data available</p>
                <p className="text-xs text-gray-400 mt-1">System status will appear here as monitored</p>
              </div>
            )}
          </div>
        </div>

        {/* User Engagement Analytics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">User Engagement</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/user-analytics')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.dailyActiveUsers || 0}</div>
                <div className="text-sm text-gray-600">Daily Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.weeklyActiveUsers || 0}</div>
                <div className="text-sm text-gray-600">Weekly Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.monthlyActiveUsers || 0}</div>
                <div className="text-sm text-gray-600">Monthly Active Users</div>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{stats.avgSessionDuration || 0} min</div>
                  <div className="text-sm text-gray-600">Avg Session Duration</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Compliance */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Security Status</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/system-performance')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            {stats.securityStatus ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">SSL Certificate</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.securityStatus.sslCertificate === 'valid' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.securityStatus.sslCertificate || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Data Encryption</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.securityStatus.dataEncryption === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.securityStatus.dataEncryption || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Firewall</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.securityStatus.firewall === 'protected' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.securityStatus.firewall || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Backup Encryption</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    stats.securityStatus.backupEncryption === 'enabled' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {stats.securityStatus.backupEncryption || 'Unknown'}
                  </span>
                </div>
                {stats.securityStatus.lastSecurityScan && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-sm text-gray-600">Last Security Scan</div>
                      <div className="text-xs text-gray-500">
                        {new Date(stats.securityStatus.lastSecurityScan).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">No security status data available</p>
                <p className="text-xs text-gray-400 mt-1">Security status will appear here as monitored</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Performance & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Performance */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">MWK {stats.totalRevenue?.toLocaleString() || 0}</div>
              <div className="text-sm text-blue-600">Total Revenue</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">MWK {stats.monthlyRevenue?.toLocaleString() || 0}</div>
              <div className="text-sm text-green-600">Monthly Revenue</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">MWK {stats.affiliateCommissions?.toLocaleString() || 0}</div>
              <div className="text-sm text-purple-600">Affiliate Commissions</div>
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/insightbooks/tenant-management')}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users className="h-8 w-8 text-indigo-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Tenant Management</span>
            </button>
            <button
              onClick={() => router.push('/insightbooks/affiliate')}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Link className="h-8 w-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Affiliate Management</span>
            </button>
            <button
              onClick={() => router.push('/insightbooks/audit')}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Shield className="h-8 w-8 text-purple-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Audit & Security</span>
            </button>
            <button
              onClick={() => router.push('/insightbooks/dashboard/revenue-overview')}
              className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <DollarSign className="h-8 w-8 text-yellow-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Revenue Overview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trends & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Trends */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Growth Trends</h2>
            <button 
              onClick={() => router.push('/insightbooks/dashboard/subscription-growth')}
              className="text-sm text-indigo-600 flex items-center hover:text-indigo-800"
            >
              View Details <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">User Growth</span>
                <div className="flex items-center">
                  {typeof stats.userGrowth === 'string' ? (
                    <span className="text-sm font-medium text-green-600">{stats.userGrowth}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600">+{stats.userGrowth || 0}%</span>
                      <ArrowUpRight size={16} className="text-green-500 ml-1" />
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Revenue Growth</span>
                <div className="flex items-center">
                  {typeof stats.revenueGrowth === 'string' ? (
                    <span className="text-sm font-medium text-green-600">{stats.revenueGrowth}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600">+{stats.revenueGrowth || 0}%</span>
                      <ArrowUpRight size={16} className="text-green-500 ml-1" />
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tenant Growth</span>
                <div className="flex items-center">
                  {typeof stats.tenantGrowth === 'string' ? (
                    <span className="text-sm font-medium text-green-600">{stats.tenantGrowth}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600">+{stats.tenantGrowth || 0}%</span>
                      <ArrowUpRight size={16} className="text-green-500 ml-1" />
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sales Growth</span>
                <div className="flex items-center">
                  {typeof stats.salesGrowth === 'string' ? (
                    <span className="text-sm font-medium text-green-600">{stats.salesGrowth}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600">+{stats.salesGrowth || 0}%</span>
                      <ArrowUpRight size={16} className="text-green-500 ml-1" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Export & Reports Center */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800">Data Export & Reports Center</h2>
            <button className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
              View All <ChevronRight size={16} className="ml-1" />
            </button>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-indigo-600 mr-3" />
                  <span className="text-sm font-medium text-gray-700">Monthly Report</span>
                </div>
                <Download className="h-4 w-4 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                <div className="flex items-center">
                  <BarChart className="h-5 w-5 text-indigo-600 mr-3" />
                  <span className="text-sm font-medium text-gray-700">Financial Summary</span>
                </div>
                <Download className="h-4 w-4 text-gray-400" />
              </button>
              <button 
                onClick={() => router.push('/insightbooks/dashboard/user-analytics')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-indigo-600 mr-3" />
                  <span className="text-sm font-medium text-gray-700">User Analytics</span>
                </div>
                <Download className="h-4 w-4 text-gray-400" />
              </button>
              <button 
                onClick={() => router.push('/insightbooks/dashboard/system-logs')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-indigo-600 mr-3" />
                  <span className="text-sm font-medium text-gray-700">System Logs</span>
                </div>
                <Download className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity - Enhanced with user information */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Recent Activity</h2>
          <button className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
            View All <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  {/* User Avatar/Icon */}
                  <div className="flex-shrink-0">
                    {item.status === 'admin' ? (
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-red-600">A</span>
                      </div>
                    ) : item.status === 'system' ? (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Settings size={16} className="text-gray-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-indigo-600">
                          {item.user.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm text-gray-900 font-medium">{item.user}</p>
                      {item.status === 'admin' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Admin
                        </span>
                      )}
                      {item.status === 'system' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.timestamp}</p>
                  </div>
                  
                  {/* Action Icon */}
                  <div className="flex-shrink-0">
                    {item.action === 'create' && (
                      <Plus size={16} className="text-green-500" />
                    )}
                    {item.action === 'update' && (
                      <Settings size={16} className="text-blue-500" />
                    )}
                    {item.action === 'delete' && (
                      <XCircle size={16} className="text-red-500" />
                    )}
                    {item.action === 'login' && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                    {item.action === 'logout' && (
                      <X size={16} className="text-gray-500" />
                    )}
                    {item.action === 'approve' && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                    {item.action === 'reject' && (
                      <XCircle size={16} className="text-red-500" />
                    )}
                    {item.action === 'export' && (
                      <Download size={16} className="text-blue-500" />
                    )}
                    {item.action === 'import' && (
                      <Upload size={16} className="text-purple-500" />
                    )}
                    {item.action === 'view' && (
                      <Eye size={16} className="text-gray-500" />
                    )}
                    {item.action === 'submit' && (
                      <FileText size={16} className="text-orange-500" />
                    )}
                    {item.action === 'process' && (
                      <RefreshCw size={16} className="text-indigo-500" />
                    )}
                    {item.action === 'invoice' && (
                      <FileText size={16} className="text-blue-500" />
                    )}
                    {item.action === 'payment' && (
                      <CreditCard size={16} className="text-green-500" />
                    )}
                    {item.action === 'sale' && (
                      <ShoppingCart size={16} className="text-green-500" />
                    )}
                    {item.action === 'expense' && (
                      <DollarSign size={16} className="text-red-500" />
                    )}
                    {item.action === 'inventory' && (
                      <Package size={16} className="text-orange-500" />
                    )}
                    {item.action === 'report' && (
                      <BarChart size={16} className="text-purple-500" />
                    )}
                    {item.action === 'backup' && (
                      <Download size={16} className="text-blue-500" />
                    )}
                    {item.action === 'restore' && (
                      <Upload size={16} className="text-purple-500" />
                    )}
                    {item.action === 'block' && (
                      <XCircle size={16} className="text-red-500" />
                    )}
                    {item.action === 'unblock' && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                    {item.action === 'reset_password' && (
                      <Lock size={16} className="text-orange-500" />
                    )}
                    {item.action === 'change_role' && (
                      <Users size={16} className="text-indigo-500" />
                    )}
                    {item.action === 'audit' && (
                      <Eye size={16} className="text-gray-500" />
                    )}
                    {item.action === 'maintenance' && (
                      <Settings size={16} className="text-blue-500" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Activity will appear here as users interact with the system</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Distribution - Web Only */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Platform Distribution</h2>
        </div>
        <div className="p-5">
          <div className="text-center p-6 rounded-lg bg-blue-50 border border-blue-200">
            <Globe size={32} className="text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-blue-800 mb-2">Web Users</h3>
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.totalUsers || 0}
            </div>
            <div className="text-sm text-blue-700 mb-3">Active Users</div>
            <div className="text-xs text-blue-600">
              100% of total users
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}