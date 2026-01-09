"use client";
import { useState, useEffect, useMemo } from "react";
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
  TrendingDown,
  X
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
// Format date (DD-MM-YYYY)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return 'N/A';
  }
};

// Skeleton element
const SkeletonElement = ({ className = "" }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

const AccountsPayable = () => {
  const [timeframe, setTimeframe] = useState("thisMonth");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [payables, setPayables] = useState(null);
  const [outstandingPayables, setOutstandingPayables] = useState([]);
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
  const [viewingPayable, setViewingPayable] = useState(null);
  const [isLoadingPayable, setIsLoadingPayable] = useState(false);

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
        setOutstandingPayables(data.payables || []);
        
      } catch (err) {
        console.error("Error fetching payables data:", err);
        setError("Failed to load payables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayablesData();
  }, [timeframe, customDateRange]);

  // Handle view payable
  const handleViewPayable = async (payable) => {
    setIsLoadingPayable(true);
    try {
      if (payable.type === 'bill') {
        // Fetch full bill details
        const response = await fetch(`/api/purchases/bills/${payable.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch bill details');
        }
        const data = await response.json();
        setViewingPayable({ ...data.bill, type: 'bill' });
      } else if (payable.type === 'expense') {
        // Fetch full expense details
        const response = await fetch(`/api/expenses/${payable.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch expense details');
        }
        const expenseData = await response.json();
        // The API returns the expense directly, not wrapped in an expense property
        setViewingPayable({ ...expenseData, type: 'expense' });
      }
    } catch (error) {
      console.error('Error fetching payable details:', error);
      alert('Failed to load payable details');
    } finally {
      setIsLoadingPayable(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      // Build query parameters based on current filters
      const queryParams = new URLSearchParams();
      
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }
      
      if (statusFilter && statusFilter !== 'All') {
        queryParams.append('status', statusFilter);
      }

      const queryString = queryParams.toString();
      const url = `/api/payables/export${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to export payables');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `accounts_payable_export_${new Date().toISOString().split('T')[0]}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].trim();
          // Ensure it ends with .csv
          if (!filename.endsWith('.csv')) {
            filename = filename.replace(/\.csv_?$/, '') + '.csv';
          }
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error exporting payables:', error);
      alert('Failed to export payables. Please try again.');
    }
  };

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
        setOutstandingPayables(data.payables || []);
        
      } catch (err) {
        console.error("Error refreshing payables data:", err);
        setError("Failed to refresh payables data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayablesData();
  };

  // Filter and sort outstanding payables
  const filteredAndSortedPayables = useMemo(() => {
    let filtered = [...outstandingPayables];

    // Apply search filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(payable =>
        payable.referenceNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.supplierName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.receiptNumber?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      filtered = filtered.filter(payable => {
        if (statusFilter === 'Overdue') {
          return payable.daysPastDue > 0;
        }
        if (statusFilter === 'Not Due') {
          return payable.daysPastDue === 0 && payable.status === 'Not Due';
        }
        if (statusFilter === 'Pending') {
          return payable.status === 'Pending';
        }
        if (statusFilter === 'Partial') {
          return payable.status === 'Partial';
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'referenceNumber':
          aValue = a.referenceNumber || '';
          bValue = b.referenceNumber || '';
          break;
        case 'supplierName':
          aValue = a.supplierName || '';
          bValue = b.supplierName || '';
          break;
        case 'billDate':
        case 'dueDate':
          aValue = new Date(a[sortField] || 0).getTime();
          bValue = new Date(b[sortField] || 0).getTime();
          break;
        case 'amountOwed':
          aValue = parseFloat(a.amountOwed || 0);
          bValue = parseFloat(b.amountOwed || 0);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = a[sortField] || '';
          bValue = b[sortField] || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [outstandingPayables, searchTerm, statusFilter, sortField, sortDirection]);

  // Handle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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
              <button 
                onClick={handleExport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
              >
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
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('referenceNumber')}
                >
                  <div className="flex items-center">
                    Reference
                    {sortField === 'referenceNumber' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('supplierName')}
                >
                  <div className="flex items-center">
                    Supplier/Vendor
                    {sortField === 'supplierName' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('billDate')}
                >
                  <div className="flex items-center">
                    Date
                    {sortField === 'billDate' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('dueDate')}
                >
                  <div className="flex items-center">
                    Due Date
                    {sortField === 'dueDate' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('amountOwed')}
                >
                  <div className="flex items-center justify-end">
                    Outstanding
                    {sortField === 'amountOwed' && (
                      sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedPayables.length > 0 ? (
                filteredAndSortedPayables.map((payable) => (
                  <tr key={payable.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {payable.referenceNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payable.supplierName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payable.type === 'bill' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          <FileText className="mr-1 h-3 w-3" />
                          Bill
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          <DollarSign className="mr-1 h-3 w-3" />
                          Expense
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payable.billDate || payable.receiptDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(payable.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(payable.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(payable.amountPaid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                      {formatCurrency(payable.amountOwed)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${payable.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                          payable.status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                          payable.status === 'Pending' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'}
                      `}>
                        {payable.status === 'Overdue' && <AlertCircle className="mr-1 h-3 w-3" />}
                        {payable.status === 'Partial' && <Clock className="mr-1 h-3 w-3" />}
                        {payable.status === 'Pending' && <FileText className="mr-1 h-3 w-3" />}
                        {payable.status === 'Not Due' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {payable.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewPayable(payable)}
                        className="text-indigo-600 hover:text-indigo-900 p-1"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-6 py-4 text-center text-sm text-gray-500">
                    {isLoading ? "Loading payables..." : "No outstanding payables found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Payable Modal */}
      {viewingPayable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                {viewingPayable.type === 'bill' ? 'Supplier Bill Details' : 'Expense Details'}
              </h2>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setViewingPayable(null)}
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingPayable ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {viewingPayable.type === 'bill' ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Bill Number</div>
                          <div className="text-gray-900 font-medium">{viewingPayable.billNumber || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Supplier</div>
                          <div className="text-gray-900">{viewingPayable.supplier?.supplierName || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Bill Date</div>
                          <div className="text-gray-900">{formatDate(viewingPayable.billDate)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Due Date</div>
                          <div className="text-gray-900">{formatDate(viewingPayable.dueDate)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Status</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              viewingPayable.status === "Paid" ? "bg-green-100 text-green-800" :
                              viewingPayable.status === "Overdue" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {viewingPayable.status}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Total Amount</div>
                          <div className="text-gray-900 font-semibold">{formatCurrency(viewingPayable.totalAmount || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Amount Paid</div>
                          <div className="text-gray-900">{formatCurrency(viewingPayable.amountPaid || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Balance Due</div>
                          <div className="text-gray-900 font-bold">
                            {formatCurrency((viewingPayable.totalAmount || 0) - (viewingPayable.amountPaid || 0))}
                          </div>
                        </div>
                      </div>
                      {viewingPayable.items && viewingPayable.items.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Items</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {viewingPayable.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.description || 'N/A'}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{Number(item.quantity || 0).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.unitCost || 0)}</td>
                                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.lineTotal || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Description</div>
                          <div className="text-gray-900 font-medium">{viewingPayable.description || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Merchant/Vendor</div>
                          <div className="text-gray-900">{viewingPayable.merchant || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Category</div>
                          <div className="text-gray-900">{viewingPayable.category || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Date</div>
                          <div className="text-gray-900">{formatDate(viewingPayable.date)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Payment Status</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              viewingPayable.paymentStatus === "Fully paid" ? "bg-green-100 text-green-800" :
                              viewingPayable.paymentStatus === "Partially" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {viewingPayable.paymentStatus}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Total Amount</div>
                          <div className="text-gray-900 font-semibold">{formatCurrency(viewingPayable.amount || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Amount Paid</div>
                          <div className="text-gray-900">{formatCurrency(viewingPayable.paidAmount || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Balance Due</div>
                          <div className="text-gray-900 font-bold">
                            {formatCurrency((viewingPayable.amount || 0) - (viewingPayable.paidAmount || 0))}
                          </div>
                        </div>
                      </div>
                      {viewingPayable.notes && (
                        <div>
                          <div className="text-xs uppercase text-gray-500 mb-1">Notes</div>
                          <div className="text-gray-900">{viewingPayable.notes}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPayable; 