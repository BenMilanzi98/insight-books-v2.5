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
  Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SubscriptionGrowth() {
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
            <h3 className="text-sm font-medium text-red-800">Error loading subscription data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No subscription data available</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription Growth</h1>
        <p className="text-gray-600">Comprehensive analysis of subscription trends, plan distribution, and user growth patterns</p>
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

      {/* Key Subscription Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Active Subscriptions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
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
            <span>Currently active</span>
          </div>
        </div>

        {/* Trial Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Active Trials</div>
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

        {/* Conversion Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Conversion Rate</div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600" />
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

        {/* Total Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
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
            <span>+{stats.userGrowth || 0}% this month</span>
          </div>
        </div>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Pro Plan Status</h2>
          </div>
          <div className="p-5">
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

        {/* Growth Trends */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Growth Trends</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">User Growth</span>
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${(stats.userGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(stats.userGrowth || 0)}
                  </span>
                  {(stats.userGrowth || 0) >= 0 ? (
                    <ArrowUpRight size={16} className="text-green-500 ml-1" />
                  ) : (
                    <ArrowDownRight size={16} className="text-red-500 ml-1" />
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tenant Growth</span>
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${(stats.tenantGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(stats.tenantGrowth || 0)}
                  </span>
                  {(stats.tenantGrowth || 0) >= 0 ? (
                    <ArrowUpRight size={16} className="text-green-500 ml-1" />
                  ) : (
                    <ArrowDownRight size={16} className="text-red-500 ml-1" />
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subscription Growth</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600">
                    +{((stats.activeUsers || 0) / (stats.totalUsers || 1) * 100).toFixed(1)}%
                  </span>
                  <ArrowUpRight size={16} className="text-green-500 ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Analytics */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Subscription Analytics</h2>
          <button className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
            <Download size={16} className="mr-1" />
            Export Report
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* MRR */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                MWK {(stats.monthlyRecurringRevenue || 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Monthly Recurring Revenue</div>
              <div className="text-xs text-gray-500 mt-1">Predictable monthly income</div>
            </div>
            
            {/* Active vs Trial */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {stats.activeUsers || 0} / {stats.trialUsers || 0}
              </div>
              <div className="text-sm text-gray-600">Active / Trial Users</div>
              <div className="text-xs text-gray-500 mt-1">Current ratio</div>
            </div>
            
            {/* Growth Rate */}
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {stats.userGrowth || 0}%
              </div>
              <div className="text-sm text-gray-600">Monthly Growth Rate</div>
              <div className="text-xs text-gray-500 mt-1">User acquisition</div>
            </div>
          </div>
        </div>
      </div>

      {/* User Engagement Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">User Engagement Metrics</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {stats.dailyActiveUsers || 0}
              </div>
              <div className="text-sm text-blue-700">Daily Active</div>
              <Activity size={20} className="mx-auto mt-2 text-blue-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.weeklyActiveUsers || 0}
              </div>
              <div className="text-sm text-green-700">Weekly Active</div>
              <TrendingUp size={20} className="mx-auto mt-2 text-green-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {stats.monthlyActiveUsers || 0}
              </div>
              <div className="text-sm text-purple-700">Monthly Active</div>
              <BarChart3 size={20} className="mx-auto mt-2 text-purple-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {stats.avgSessionDuration || 0} min
              </div>
              <div className="text-sm text-orange-700">Avg Session</div>
              <Clock size={20} className="mx-auto mt-2 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
          <Download size={16} className="mr-2" />
          Download Growth Report
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View User Analytics
        </button>
      </div>
    </div>
  );
} 