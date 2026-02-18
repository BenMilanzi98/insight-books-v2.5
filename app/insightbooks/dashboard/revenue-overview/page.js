"use client";
import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  Filter,
  ChevronLeft,
  Eye,
  FileText,
  ShoppingCart,
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RevenueOverview() {
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
            <h3 className="text-sm font-medium text-red-800">Error loading revenue data</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No revenue data available</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue Overview</h1>
        <p className="text-gray-600">Comprehensive analysis of platform revenue, trends, and financial performance</p>
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

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
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
            <span>All time revenue</span>
          </div>
        </div>

        {/* Daily Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
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
            <span>+{stats.revenueGrowth || 0}% from yesterday</span>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
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
            <span>+{stats.revenueGrowth || 0}% from last month</span>
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-600">Outstanding</div>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Receipt size={16} className="text-red-600" />
            </div>
          </div>
          <div className="text-2xl font-bold mb-1">
            {formatCurrency(stats.outstandingInvoices || 0)}
          </div>
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle size={16} className="mr-1" />
            <span>Pending collection</span>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Revenue Trends</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Daily Revenue</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-600 mr-2">
                    {formatCurrency(stats.dailyRevenue || 0)}
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-green-500"
                      style={{ width: `${((stats.dailyRevenue || 0) / (stats.totalRevenue || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Monthly Revenue</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-blue-600 mr-2">
                    {formatCurrency(stats.monthlyRevenue || 0)}
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${((stats.monthlyRevenue || 0) / (stats.totalRevenue || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Revenue</span>
                <div className="flex items-center">
                  <span className="text-sm font-medium text-purple-600 mr-2">
                    {formatCurrency(stats.totalRevenue || 0)}
                  </span>
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-purple-500"
                      style={{ width: '100%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Financial Summary</h2>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Sales</span>
                <span className="text-sm font-medium">{stats.totalSales || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Expenses</span>
                <span className="text-sm font-medium text-red-600">
                  {formatCurrency(stats.totalExpenses || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Net Profit</span>
                <span className="text-sm font-medium text-green-600">
                  {formatCurrency((stats.totalRevenue || 0) - (stats.totalExpenses || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Profit Margin</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.totalRevenue > 0 ? (((stats.totalRevenue - (stats.totalExpenses || 0)) / stats.totalRevenue) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Analytics */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Revenue Analytics</h2>
          <button className="text-sm text-indigo-600 flex items-center hover:text-indigo-800">
            <Download size={16} className="mr-1" />
            Export Report
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Growth Metrics */}
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {formatPercentage(stats.revenueGrowth || 0)}
              </div>
              <div className="text-sm text-gray-600">Revenue Growth</div>
              <div className="text-xs text-gray-500 mt-1">Month over month</div>
            </div>
            
            {/* Sales Metrics */}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {formatPercentage(stats.salesGrowth || 0)}
              </div>
              <div className="text-sm text-gray-600">Sales Growth</div>
              <div className="text-xs text-gray-500 mt-1">Month over month</div>
            </div>
            
            {/* Conversion Metrics */}
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {stats.conversionRate || 0}%
              </div>
              <div className="text-sm text-gray-600">Conversion Rate</div>
              <div className="text-xs text-gray-500 mt-1">Trial to paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Status Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Invoice Status Overview</h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {stats.totalInvoices - (stats.overdueInvoices || 0) - (stats.pendingInvoices || 0)}
              </div>
              <div className="text-sm text-green-700">Paid</div>
              <CheckCircle size={20} className="mx-auto mt-2 text-green-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {stats.pendingInvoices || 0}
              </div>
              <div className="text-sm text-yellow-700">Pending</div>
              <Clock size={20} className="mx-auto mt-2 text-yellow-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {stats.overdueInvoices || 0}
              </div>
              <div className="text-sm text-red-700">Overdue</div>
              <AlertCircle size={20} className="mx-auto mt-2 text-red-500" />
            </div>
            
            <div className="text-center p-4 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold text-gray-600 mb-1">
                {stats.totalInvoices || 0}
              </div>
              <div className="text-sm text-gray-700">Total</div>
              <FileText size={20} className="mx-auto mt-2 text-gray-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4">
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
          <Download size={16} className="mr-2" />
          Download Full Report
        </button>
        <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center">
          <Eye size={16} className="mr-2" />
          View Detailed Analytics
        </button>
      </div>
    </div>
  );
} 