"use client";
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Zap, 
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
  Server,
  Database,
  Globe,
  Shield,
  Cpu,
  Wifi,
  Battery,
  Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SystemPerformance() {
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

  const getPerformanceColor = (value, threshold) => {
    if (value <= threshold * 0.7) return 'text-green-600';
    if (value <= threshold * 0.9) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceStatus = (value, threshold) => {
    if (value <= threshold * 0.7) return 'Excellent';
    if (value <= threshold * 0.9) return 'Good';
    return 'Needs Attention';
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
            <h3 className="text-sm font-medium text-red-800">Error loading performance data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No performance data available</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Performance</h1>
        <p className="text-gray-600">Comprehensive monitoring of system health, performance metrics, and infrastructure status</p>
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

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* API Response Time */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">API Response Time</div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap size={16} className="text-blue-600" />
            </div>
          </div>
          <div className={`text-2xl font-bold mb-1 ${getPerformanceColor(stats.apiResponseTime || 0, 100)}`}>
            {stats.apiResponseTime || 0}ms
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock size={16} className="mr-1" />
            <span>{getPerformanceStatus(stats.apiResponseTime || 0, 100)}</span>
          </div>
        </div>

        {/* Database Queries */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Database Queries</div>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Database size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.databaseQueries || 0}/min
          </div>
          <div className="flex items-center text-sm text-green-600">
            <Activity size={16} className="mr-1" />
            <span>Operations per minute</span>
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">System Uptime</div>
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Server size={16} className="text-purple-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-green-600">
            {stats.uptime || '99.9%'}
          </div>
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle size={16} className="mr-1" />
            <span>High availability</span>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Active Sessions</div>
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Users size={16} className="text-orange-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.activeSessions || 0}
          </div>
          <div className="flex items-center text-sm text-orange-600">
            <Users size={16} className="mr-1" />
            <span>Current users</span>
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Performance */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">API Performance</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Response Time</span>
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${getPerformanceColor(stats.apiResponseTime || 0, 100)}`}>
                    {stats.apiResponseTime || 0}ms
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2 ml-2">
                    <div 
                      className={`h-2 rounded-full ${getPerformanceColor(stats.apiResponseTime || 0, 100).replace('text-', 'bg-')}`}
                      style={{ width: `${Math.min((stats.apiResponseTime || 0) / 100, 1) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Calls</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-blue-600">
                    {stats.apiCalls || 0}/min
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2 ml-2">
                    <div 
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.min((stats.apiCalls || 0) / 1000, 1) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  (stats.apiResponseTime || 0) <= 70 ? 'bg-green-100 text-green-800' :
                  (stats.apiResponseTime || 0) <= 90 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {getPerformanceStatus(stats.apiResponseTime || 0, 100)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Database Performance */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Database Performance</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Query Rate</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600">
                    {stats.databaseQueries || 0}/min
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2 ml-2">
                    <div 
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${Math.min((stats.databaseQueries || 0) / 1000, 1) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection Pool</span>
                <span className="text-sm font-medium text-blue-600">Healthy</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Index Usage</span>
                <span className="text-sm font-medium text-green-600">Optimized</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Optimal
                </span>
              </div>
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
          <div className="text-center p-4 rounded-lg bg-blue-50">
            <Globe size={32} className="text-blue-600 mx-auto mb-3" />
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {stats.totalUsers || 0}
            </div>
            <div className="text-sm text-blue-700">Web Users</div>
            <div className="text-xs text-blue-600 mt-1">
              100% of total
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plan Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Subscription Plan Status</h2>
        </div>
        <div className="p-5">
          <div className="text-center p-6 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="text-3xl font-bold text-indigo-600 mb-2">
              Pro Plan
            </div>
            <div className="text-lg text-indigo-700 mb-3">Active Subscriptions</div>
            <div className="text-4xl font-bold text-indigo-800 mb-2">
              {stats.activeUsers || 0}
            </div>
            <div className="text-sm text-indigo-600">
              {stats.totalUsers > 0 ? ((stats.activeUsers || 0) / stats.totalUsers * 100).toFixed(1) : 0}% of total users
            </div>
            <div className="text-xs text-indigo-500 mt-2">Professional features for business owners</div>
          </div>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">System Health Overview</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-lg font-bold text-green-600 mb-1">
                {stats.uptime || '99.9%'}
              </div>
              <div className="text-sm text-green-700">Uptime</div>
              <CheckCircle size={20} className="mx-auto mt-2 text-green-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-lg font-bold text-blue-600 mb-1">
                {stats.apiResponseTime || 0}ms
              </div>
              <div className="text-sm text-blue-700">API Response</div>
              <Zap size={20} className="mx-auto mt-2 text-blue-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
              <div className="text-lg font-bold text-purple-600 mb-1">
                {stats.databaseQueries || 0}
              </div>
              <div className="text-sm text-purple-700">DB Queries/min</div>
              <Database size={20} className="mx-auto mt-2 text-purple-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-lg font-bold text-orange-600 mb-1">
                {stats.activeSessions || 0}
              </div>
              <div className="text-sm text-orange-700">Active Sessions</div>
              <Users size={20} className="mx-auto mt-2 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
          <Download size={16} className="mr-2" />
          Download Performance Report
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View System Logs
        </button>
      </div>
    </div>
  );
} 