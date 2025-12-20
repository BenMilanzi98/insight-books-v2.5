"use client";
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  Building, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  ChevronLeft,
  Eye,
  FileText,
  CreditCard,
  Package,
  Star,
  Zap,
  Crown,
  Activity,
  Target,
  DollarSign,
  Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscriptionAnalytics() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState('30d');
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount || 0);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value}%`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-64 mb-2 bg-gray-200 rounded"></div>
          <div className="h-5 w-96 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 w-32 bg-gray-200 rounded mb-1"></div>
              <div className="h-4 w-40 bg-gray-200 rounded"></div>
            </div>
          ))}
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
            <h3 className="text-sm font-medium text-red-800">Error loading analytics data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription Analytics</h1>
        <p className="text-gray-600">Deep dive into subscription metrics, plan performance, and conversion analytics</p>
      </div>

      {/* Time Filter */}
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

      {/* Key Analytics Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Subscriptions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Active Subscriptions</div>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Users size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.activeSubscriptions || 0}
          </div>
          <div className="flex items-center text-sm text-green-600">
            <ArrowUpRight size={16} className="mr-1" />
            <span>Currently active</span>
          </div>
        </div>

        {/* Trial Subscriptions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Trial Subscriptions</div>
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock size={16} className="text-yellow-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.trialSubscriptions || 0}
          </div>
          <div className="flex items-center text-sm text-yellow-600">
            <Clock size={16} className="mr-1" />
            <span>Active trials</span>
          </div>
        </div>

        {/* Pending Subscriptions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Pending Subscriptions</div>
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle size={16} className="text-orange-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.pendingSubscriptions || 0}
          </div>
          <div className="flex items-center text-sm text-orange-600">
            <AlertCircle size={16} className="mr-1" />
            <span>Awaiting completion</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Conversion Rate</div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Target size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.conversionRate || 0}%
          </div>
          <div className="flex items-center text-sm text-blue-600">
            <CheckCircle size={16} className="mr-1" />
            <span>Trial to paid</span>
          </div>
        </div>

      </div>

      {/* Plan Distribution Analysis */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Pro Plan Analysis</h2>
        </div>
        <div className="p-5">
          <div className="text-center p-8 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="text-5xl font-bold text-indigo-600 mb-4">
              Pro Plan
            </div>
            <div className="text-2xl font-bold text-indigo-800 mb-2">
              {stats.activeSubscriptions || 0}
            </div>
            <div className="text-lg text-indigo-700 mb-4">Active Subscriptions</div>
            <div className="text-sm text-indigo-600 mb-2">
              {stats.totalUsers > 0 ? ((stats.activeSubscriptions || 0) / stats.totalUsers * 100).toFixed(1) : 0}% of total users
            </div>
            <div className="text-xs text-indigo-500 mb-4">Professional features for business owners</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-600">
                  {stats.subscriptionAmounts && stats.subscriptionAmounts.length > 0 
                    ? formatCurrency(stats.subscriptionAmounts[0].amount)
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-indigo-700">
                  {stats.subscriptionAmounts && stats.subscriptionAmounts.length > 0 
                    ? (() => {
                        const plan = stats.subscriptionAmounts[0].plan;
                        if (plan === '1year') return '1 Year Price';
                        if (plan === '3months') return '3 Months Price';
                        if (plan === '1month') return '1 Month Price';
                        return 'Price';
                      })()
                    : 'Price'
                  }
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-600">{stats.conversionRate || 0}%</div>
                <div className="text-sm text-indigo-700">Conversion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-600">{stats.trialSubscriptions || 0}</div>
                <div className="text-sm text-indigo-700">Active Trials</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Status Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Subscription Status Overview</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.activeSubscriptions || 0}
              </div>
              <div className="text-sm text-green-700">Active</div>
              <div className="text-xs text-green-600 mt-1">Completed & Active</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {stats.trialSubscriptions || 0}
              </div>
              <div className="text-sm text-yellow-700">Trials</div>
              <div className="text-xs text-yellow-600 mt-1">Active Trials</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {stats.pendingSubscriptions || 0}
              </div>
              <div className="text-sm text-orange-700">Pending</div>
              <div className="text-xs text-orange-600 mt-1">Awaiting Completion</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-2xl font-bold text-gray-600 mb-1">
                {(stats.totalSubscriptions || 0) - (stats.activeSubscriptions || 0) - (stats.trialSubscriptions || 0) - (stats.pendingSubscriptions || 0)}
              </div>
              <div className="text-sm text-gray-700">Other</div>
              <div className="text-xs text-gray-600 mt-1">Cancelled/Expired</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actual Subscription Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Actual Subscription Details</h2>
        </div>
        <div className="p-5">
          {stats.subscriptionAmounts && stats.subscriptionAmounts.length > 0 ? (
            <div className="space-y-4">
              <div className="text-center p-6 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  Database Subscription Data
                </div>
                <div className="text-sm text-blue-700 mb-4">
                  Real subscription amounts from your database
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.subscriptionAmounts.map((subscription, index) => (
                    <div key={index} className="text-center p-3 bg-white rounded border">
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(subscription.amount)}
                      </div>
                      <div className="text-sm text-blue-700 capitalize">
                        {subscription.plan} Plan
                      </div>
                      <div className="text-xs text-blue-600">
                        {subscription.currency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-lg font-bold text-green-600">
                  Total Active Subscription Revenue: {formatCurrency(stats.totalActiveSubscriptionRevenue || 0)}
                </div>
                <div className="text-sm text-green-700">
                  Average per subscription: {formatCurrency(stats.averageSubscriptionAmount || 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg font-medium mb-2">No Active Subscriptions</div>
              <div className="text-sm">No subscription data available</div>
            </div>
          )}
        </div>
      </div>

      {/* Conversion Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial Conversion Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Trial Conversion Metrics</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Trial Users</span>
                <span className="text-sm font-medium text-yellow-600">
                  {stats.trialSubscriptions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Converted Users</span>
                <span className="text-sm font-medium text-green-600">
                  {Math.round((stats.conversionRate || 0) / 100 * (stats.trialSubscriptions || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Conversion Rate</span>
                <span className="text-sm font-medium text-blue-600">
                  {stats.conversionRate || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Churn Rate</span>
                <span className="text-sm font-medium text-red-600">
                  {100 - (stats.conversionRate || 0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Per Plan */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Pro Plan Revenue</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pro Plan Revenue</span>
                <span className="text-sm font-medium text-indigo-600">
                  {formatCurrency(stats.totalActiveSubscriptionRevenue || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Average Subscription</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(stats.averageSubscriptionAmount || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Subscriptions</span>
                <span className="text-sm font-medium text-green-600">{stats.activeSubscriptions || 0}</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Total MRR</span>
                  <span className="text-sm font-bold text-green-600">
                    {formatCurrency(stats.monthlyRecurringRevenue || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Performance Metrics</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="text-lg font-bold text-green-600 mb-1">
                {stats.dailyActiveUsers || 0}
              </div>
              <div className="text-sm text-green-700">Daily Active</div>
              <div className="text-xs text-green-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <div className="text-lg font-bold text-blue-600 mb-1">
                {stats.weeklyActiveUsers || 0}
              </div>
              <div className="text-sm text-blue-700">Weekly Active</div>
              <div className="text-xs text-blue-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50">
              <div className="text-lg font-bold text-purple-600 mb-1">
                {stats.monthlyActiveUsers || 0}
              </div>
              <div className="text-sm text-purple-700">Monthly Active</div>
              <div className="text-xs text-purple-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50">
              <div className="text-lg font-bold text-orange-600 mb-1">
                {stats.avgSessionDuration || 0} min
              </div>
              <div className="text-sm text-orange-700">Avg Session</div>
              <div className="text-xs text-orange-600 mt-1">Duration</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
          <Download size={16} className="mr-2" />
          Download Analytics Report
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View Detailed Metrics
        </button>
      </div>
    </div>
  );
} 