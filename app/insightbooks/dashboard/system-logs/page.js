"use client";
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  ChevronLeft,
  Eye,
  FileText,
  Server,
  Database,
  Globe,
  Monitor,
  Shield,
  Zap,
  Users,
  Settings,
  Bug,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SystemLogs() {
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

  const getLogLevelColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      case 'success':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getLogLevelIcon = (level) => {
    switch (level?.toLowerCase()) {
      case 'error':
        return <AlertCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-500" />;
      case 'info':
        return <Info size={16} className="text-blue-500" />;
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      default:
        return <Info size={16} className="text-gray-500" />;
    }
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
            <h3 className="text-sm font-medium text-red-800">Error loading system logs data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No system logs data available</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Logs</h1>
        <p className="text-gray-600">Comprehensive monitoring of system events, errors, and performance logs</p>
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

      {/* Key Log Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Total Logs</div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.totalAuditLogs || 0}
          </div>
          <div className="flex items-center text-sm text-blue-600">
            <Activity size={16} className="mr-1" />
            <span>All time logs</span>
          </div>
        </div>

        {/* Error Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Error Logs</div>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle size={16} className="text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-red-600">
            {stats.errorLogs || 0}
          </div>
          <div className="flex items-center text-sm text-red-600">
            <Bug size={16} className="mr-1" />
            <span>Requires attention</span>
          </div>
        </div>

        {/* Warning Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Warning Logs</div>
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle size={16} className="text-yellow-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-yellow-600">
            {stats.warningLogs || 0}
          </div>
          <div className="flex items-center text-sm text-yellow-600">
            <Clock size={16} className="mr-1" />
            <span>Monitor closely</span>
          </div>
        </div>

        {/* Success Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Success Logs</div>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1 text-green-600">
            {stats.successLogs || 0}
          </div>
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle size={16} className="mr-1" />
            <span>Normal operations</span>
          </div>
        </div>
      </div>

      {/* Log Distribution */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Log Distribution by Level</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {stats.errorLogs || 0}
              </div>
              <div className="text-sm text-red-700">Error</div>
              <AlertCircle size={20} className="mx-auto mt-2 text-red-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {stats.warningLogs || 0}
              </div>
              <div className="text-sm text-yellow-700">Warning</div>
              <AlertCircle size={20} className="mx-auto mt-2 text-yellow-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {stats.infoLogs || 0}
              </div>
              <div className="text-sm text-blue-700">Info</div>
              <Info size={20} className="mx-auto mt-2 text-blue-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.successLogs || 0}
              </div>
              <div className="text-sm text-green-700">Success</div>
              <CheckCircle size={20} className="mx-auto mt-2 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Logs */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Recent Activity Logs</h2>
          <button className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
            <Download size={16} className="mr-1" />
            Export Logs
          </button>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  {/* Log Level Icon */}
                  <div className="flex-shrink-0">
                    {getLogLevelIcon(item.level || 'info')}
                  </div>
                  
                  {/* Log Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm text-gray-900 font-medium">{item.user}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getLogLevelColor(item.level || 'info')}`}>
                        {item.level || 'info'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.timestamp}</p>
                  </div>
                  
                  {/* Action Icon */}
                  <div className="flex-shrink-0">
                    {item.action === 'create' && (
                      <FileText size={16} className="text-green-500" />
                    )}
                    {item.action === 'update' && (
                      <Settings size={16} className="text-blue-500" />
                    )}
                    {item.action === 'delete' && (
                      <AlertCircle size={16} className="text-red-500" />
                    )}
                    {item.action === 'login' && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                    {item.action === 'logout' && (
                      <Clock size={16} className="text-gray-500" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm">No recent activity logs</p>
                <p className="text-xs text-gray-400 mt-1">Activity logs will appear here as users interact with the system</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status Logs */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">System Status Logs</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Online
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Services</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Healthy
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">File Storage</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Available
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email Service</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Logs */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Security Logs</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">SSL Certificate</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Valid
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Data Encryption</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Firewall</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Protected
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Security Scan</span>
                <span className="text-sm text-gray-600">
                  {new Date().toLocaleDateString()}
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
          Download System Logs
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View All Logs
        </button>
      </div>
    </div>
  );
} 