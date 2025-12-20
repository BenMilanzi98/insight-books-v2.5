"use client";
import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Building,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { getPermission } from "@/lib/permissions";
import UniversalDateRangeFilter from "@/components/UniversalDateRangeFilter";
import { calculateDateRange } from "@/lib/dateUtils";

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MWK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace('MWK', 'MWK');
};

// Format date
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Skeleton element
const SkeletonElement = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

const AccountsPayable = () => {
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [payables, setPayables] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canViewPayables: false
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState("dueDate");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    const fetchPermissions = async () => {
      setPermissionsLoading(true);
      // Temporarily allow access while permissions are being set up
      const canViewPayables = true; // await getPermission("payables.view");
      setPagePermissions({
        canViewPayables
      });
      setPermissionsLoading(false);
    };
  
    fetchPermissions();
  }, []);

  // Get current date range based on timeframe and custom range
  const getCurrentDateRange = () => {
    if (timeframe === 'custom' && customDateRange) {
      return customDateRange;
    }
    const range = calculateDateRange(timeframe);
    return {
      startDate: range.startDate.toISOString().split('T')[0],
      endDate: range.endDate.toISOString().split('T')[0]
    };
  };

  // Fetch payables data
  useEffect(() => {
    const fetchPayablesData = async () => {
      setIsLoading(true);
      setError(null);
      
      const dateRange = getCurrentDateRange();
      
      try {
        const response = await fetch(`/api/dashboard/payables?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch payables data');
        }
        
        const data = await response.json();
        setPayables(data.accountsPayable || data);
        
      } catch (err) {
        console.error("Error fetching payables data:", err);
        setError("Failed to load payables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayablesData();
  }, [timeframe, customDateRange]);

  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    if (newTimeframe !== 'custom') {
      setCustomDateRange(null);
    }
  };

  // Handle custom date range change
  const handleCustomDateChange = (range) => {
    setCustomDateRange(range);
  };

  // Handle refresh
  const handleRefresh = () => {
    const fetchPayablesData = async () => {
      setIsLoading(true);
      setError(null);
      
      const dateRange = getCurrentDateRange();
      
      try {
        const response = await fetch(`/api/dashboard/payables?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch payables data');
        }
        
        const data = await response.json();
        setPayables(data.accountsPayable || data);
        
      } catch (err) {
        console.error("Error refreshing payables data:", err);
        setError("Failed to refresh payables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayablesData();
  };

  // Error state
  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Error Loading Payables</h2>
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

  if (permissionsLoading) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <DollarSign className="h-12 w-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Loading Permissions</h2>
          <p className="text-gray-600">Checking user permissions...</p>
        </div>
      </div>
    );
  }

  if (!pagePermissions.canViewPayables) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Accounts Payable</h1>
          <p className="text-gray-600 mt-1">
            Manage and track outstanding expenses and vendor payments
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <UniversalDateRangeFilter
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
            onCustomDateChange={handleCustomDateChange}
            onRefresh={handleRefresh}
            loading={isLoading}
            showRefresh={true}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payables</p>
              <div className="text-2xl font-bold text-gray-900">
                {payables?.current !== undefined ? formatCurrency(payables.current) : <SkeletonElement className="h-8 w-32" />}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Not Due</p>
              <div className="text-2xl font-bold text-gray-900">
                {payables?.notDue !== undefined ? formatCurrency(payables.notDue) : <SkeletonElement className="h-8 w-32" />}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <div className="text-2xl font-bold text-gray-900">
                {payables?.overdue !== undefined ? formatCurrency(payables.overdue) : <SkeletonElement className="h-8 w-32" />}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <Building className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Active Vendors</p>
              <div className="text-2xl font-bold text-gray-900">
                {payables?.aging ? payables.aging.length : <SkeletonElement className="h-8 w-16" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Aging Summary</h2>
        </div>
        <div className="p-5">
          {payables?.aging ? (
            <div className="space-y-4">
              {payables.aging.map((period, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32 text-sm font-medium text-gray-700">{period.range}</div>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full ${
                          index > 2 ? 'bg-red-500' : index > 1 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${(period.amount / (payables?.current || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <div className="text-sm font-semibold text-gray-900">{formatCurrency(period.amount)}</div>
                    <div className="text-xs text-gray-500">
                      {((period.amount / (payables?.current || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="flex items-center">
                  <div className="w-32"><SkeletonElement className="h-4 w-24" /></div>
                  <div className="flex-1 mx-4"><SkeletonElement className="h-3 w-full" /></div>
                  <div className="w-32 text-right"><SkeletonElement className="h-5 w-20 ml-auto" /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search expenses, vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
                <option value="Not Due">Not Due</option>
              </select>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Outstanding Expenses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expense ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Placeholder for actual expense data */}
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">EXP-001</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Office Supplies</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Supplies</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(new Date())}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(25000)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button className="text-indigo-600 hover:text-indigo-900">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountsPayable; 