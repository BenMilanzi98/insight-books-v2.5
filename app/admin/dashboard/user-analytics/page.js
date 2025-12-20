"use client";
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Users, 
  UserPlus, 
  UserMinus, 
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  ChevronLeft,
  Eye,
  FileText,
  Clock,
  MapPin,
  Globe,
  Calendar,
  Target,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UserAnalytics() {
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
            <h3 className="text-sm font-medium text-red-800">Error loading user analytics data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No user analytics data available</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Analytics</h1>
        <p className="text-gray-600">Comprehensive analysis of user behavior, engagement patterns, and demographic insights</p>
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

      {/* Key User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Total Users</div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Users size={16} className="text-blue-600" />
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

        {/* Daily Active Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Daily Active</div>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Activity size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.dailyActiveUsers || 0}
          </div>
          <div className="flex items-center text-sm text-green-600">
            <TrendingUp size={16} className="mr-1" />
            <span>Active today</span>
          </div>
        </div>

        {/* New Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">New Users</div>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <UserPlus size={16} className="text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.newUsers || 0}
          </div>
          <div className="flex items-center text-sm text-purple-600">
            <Calendar size={16} className="mr-1" />
            <span>This month</span>
          </div>
        </div>

        {/* Churn Rate */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Churn Rate</div>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <UserMinus size={16} className="text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-red-600">
            {stats.churnRate || 0}%
          </div>
          <div className="flex items-center text-sm text-red-600">
            <TrendingDown size={16} className="mr-1" />
            <span>Monthly churn</span>
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
              <div className="text-xs text-blue-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.weeklyActiveUsers || 0}
              </div>
              <div className="text-sm text-green-700">Weekly Active</div>
              <div className="text-xs text-green-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {stats.monthlyActiveUsers || 0}
              </div>
              <div className="text-sm text-purple-700">Monthly Active</div>
              <div className="text-xs text-purple-600 mt-1">Users</div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {stats.avgSessionDuration || 0} min
              </div>
              <div className="text-sm text-orange-700">Avg Session</div>
              <div className="text-xs text-orange-600 mt-1">Duration</div>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Distribution */}
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

      {/* Plan Information */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Subscription Plan</h2>
        </div>
        <div className="p-5">
          <div className="text-center p-6 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="text-4xl font-bold text-indigo-600 mb-2">
              Pro Plan
            </div>
            <div className="text-lg text-indigo-700 mb-3">Active Subscriptions</div>
            <div className="text-2xl font-bold text-indigo-800 mb-2">
              {stats.activeUsers || 0}
            </div>
            <div className="text-sm text-indigo-600">
              {stats.totalUsers > 0 ? ((stats.activeUsers || 0) / stats.totalUsers * 100).toFixed(1) : 0}% of total users
            </div>
            <div className="text-xs text-indigo-500 mt-2">Professional features for business owners</div>
          </div>
        </div>
      </div>

      {/* User Growth Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Growth Metrics</h2>
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
                <span className="text-sm text-gray-600">New User Acquisition</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600">
                    {stats.newUsers || 0}
                  </span>
                  <ArrowUpRight size={16} className="text-green-500 ml-1" />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Retention Rate</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-blue-600">
                    {100 - (stats.churnRate || 0)}%
                  </span>
                  <Target size={16} className="text-blue-500 ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Engagement Metrics</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Session Duration</span>
                <span className="text-sm font-medium text-blue-600">
                  {stats.avgSessionDuration || 0} min
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pages per Session</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.pagesPerSession || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Bounce Rate</span>
                <span className="text-sm font-medium text-red-600">
                  {stats.bounceRate || 0}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Return Rate</span>
                <span className="text-sm font-medium text-purple-600">
                  {stats.returnRate || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
          <Download size={16} className="mr-2" />
          Download User Analytics Report
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View User Details
        </button>
      </div>
    </div>
  );
} 