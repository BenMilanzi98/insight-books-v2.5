"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  ChevronDown,
  CheckCircle,
  FileText,
  XCircle,
  RotateCcw,
  Printer,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  CreditCard,
  DollarSign,
  Smartphone,
  User,
  Clock,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { fetchSales, exportSales } from "@/app/services/salesService";
import { getPermission, getCurrentUser } from "@/lib/permissions";
import { paymentMethods } from "@/lib/paymentMethods";

const SalesListPage = () => {
  const router = useRouter();
  
  // State for sales data
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filters and pagination
  const [filters, setFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    clientId: "all",
    paymentMethod: "all",
    search: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0
  });
  const [sortBy, setSortBy] = useState("saleDate");
  const [sortOrder, setSortOrder] = useState("desc");
  
  // State for export
  const [isExporting, setIsExporting] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [pagePermissions, setPagePermissions] = useState({ 
    canVoidSales: false,
    canCreateSales: false,
    canDeleteSales:false, 
    canExportSales:false, 
    canRefundSales:false, 
    canUpdateSales:false,
    canClearHistory: false,
  });
  
  useEffect(() => {
    const fetchPermissions = async () => { 
      const canVoidSales = await getPermission("sales.void");
      const canCreateSales = await getPermission("sales.create");
      const canDeleteSales = await getPermission("sales.delete");
      const canExportSales = await getPermission("sales.export"); 
      const canRefundSales = await getPermission("sales.refund");
      const canUpdateSales = await getPermission("sales.update");
      
      // Check if user is admin (MASTER_ADMIN) or has sales.delete permission
      const user = await getCurrentUser();
      const isMasterAdmin = user?.role?.name === 'MASTER_ADMIN';
      const canClearHistory = isMasterAdmin || canDeleteSales;
  
      setPagePermissions({ 
        canVoidSales,
        canCreateSales,
        canDeleteSales, 
        canExportSales, 
        canRefundSales, 
        canUpdateSales,
        canClearHistory,
        });
    };
  
    fetchPermissions();
  }, []);
  // Load sales on initial render and when filters or pagination change
  useEffect(() => {
    loadSales();
  }, [filters, pagination.page, sortBy, sortOrder]);
  
  // Load sales data
  const loadSales = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Prepare parameters
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
        ...filters
      };
      
      // Fetch sales
      const response = await fetchSales(params);
      setSales(response.sales || []);
      setPagination(response.pagination || {
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 0
      });
    } catch (error) {
      console.error("Error loading sales:", error);
      setError("Failed to load sales. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters({
      ...filters,
      [key]: value
    });
    
    // Reset page to 1 when filters change
    setPagination({
      ...pagination,
      page: 1
    });
  };
  
  // Handle search
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      handleFilterChange('search', e.target.value);
    }
  };
  
  // Handle sort
  const handleSort = (column) => {
    // If clicking the current sort column, toggle the order
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Otherwise, sort by the new column in ascending order
      setSortBy(column);
      setSortOrder('asc');
    }
  };
  
  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination({
        ...pagination,
        page: newPage
      });
    }
  };
  
  // Handle export
  const handleExport = async (format = 'csv') => {
    try {
      setIsExporting(true);
      await exportSales(filters, format);
    } catch (error) {
      console.error("Error exporting sales:", error);
      alert("Failed to export sales. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle clear sales history
  const handleClearHistory = async () => {
    try {
      setIsClearingHistory(true);
      const response = await fetch('/api/sales/clear-history', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear sales history');
      }

      // Show success message
      alert(`Successfully cleared ${data.deletedCount || 0} sales records.`);
      
      // Reload sales list
      await loadSales();
      
      // Close modal
      setShowClearConfirmModal(false);
    } catch (error) {
      console.error("Error clearing sales history:", error);
      alert(error.message || "Failed to clear sales history. Please try again.");
    } finally {
      setIsClearingHistory(false);
    }
  };
  
  // Navigate to sale detail
  const viewSaleDetail = (saleId) => {
    router.push(`/pos/list/${saleId}`);
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      status: "all",
      dateFrom: "",
      dateTo: "",
      clientId: "all",
      paymentMethod: "all",
      search: ""
    });
    setPagination({
      ...pagination,
      page: 1
    });
  };
  
  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'card':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'mobile_money':
        return <Smartphone className="w-4 h-4 text-purple-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };
  
  // Format payment method for display
  const formatPaymentMethod = (method) => {
    const methodMap = {
      'cash': 'Cash',
      'card': 'Card',
      'mobile_money': 'Mobile Money',
      'bank_transfer': 'Bank Transfer',
      'check': 'Check'
    };
    
    return methodMap[method] || method;
  };
  
  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "completed":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "draft":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <FileText className="w-3.5 h-3.5 mr-1" />;
        break;
      case "void":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle className="w-3.5 h-3.5 mr-1" />;
        break;
      case "refunded":
        badgeClass = "bg-purple-100 text-purple-800";
        icon = <RotateCcw className="w-3.5 h-3.5 mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center whitespace-nowrap ${badgeClass}`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <button 
            className="mr-4 p-2 rounded-full hover:bg-gray-100"
            onClick={() => router.push('/pos')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Sales History</h1>
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          
          {pagePermissions.canExportSales &&( <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export</span>
              </>
            )}
          </button>)}
          
          {pagePermissions.canCreateSales &&( <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center"
            onClick={() => router.push('/pos')}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New Sale</span>
          </button>)}
          
          {pagePermissions.canClearHistory && (
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded-md flex items-center hover:bg-red-700"
              onClick={() => setShowClearConfirmModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <input 
              type="text" 
              placeholder="Search sales..." 
              className="w-full p-2 pl-10 border border-gray-200 rounded-md"
              defaultValue={filters.search}
              onKeyDown={handleSearch}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select 
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-md bg-white"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
                <option value="void">Void</option>
                <option value="refunded">Refunded</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </div>
            
            <div className="relative">
              <select 
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-md bg-white"
                value={filters.paymentMethod}
                onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
              >
                <option value="all">All Payment Methods</option>
                {paymentMethods.map(method => (
                  <option key={method.key} value={method.key}>{method.name}</option>
                ))}
                {/* <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_money">Mobile Money</option> */}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-200 rounded-md"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">To Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-200 rounded-md"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
              
              <div className="flex items-end">
                <button 
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sales list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-500 mb-4">{error}</p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={loadSales}
            >
              <RefreshCw className="w-4 h-4 mr-2 inline-block" />
              Try Again
            </button>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No sales found matching your filters</p>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('saleNumber')}
                    >
                      <div className="flex items-center">
                        Sale #
                        {sortBy === 'saleNumber' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('saleDate')}
                    >
                      <div className="flex items-center">
                        Date
                        {sortBy === 'saleDate' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('rawTotal')}
                    >
                      <div className="flex items-center justify-end">
                        Total
                        {sortBy === 'rawTotal' && (
                          <span className="ml-1">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-gray-50"
                      onClick={() => viewSaleDetail(sale.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {sale.saleNumber}
                          {sale.isHistorical && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              <Calendar className="w-3 h-3 mr-1" />
                              Historical
                            </span>
                          )}
                        </div>
                        {sale.isHistorical && sale.originalReference && (
                          <div className="text-xs text-gray-500 mt-1">
                            Original: {sale.originalReference}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center">
                          <Calendar className={`w-4 h-4 mr-1 ${sale.isHistorical ? 'text-amber-500' : 'text-gray-400'}`} />
                          <div>
                            {sale.date}
                            {sale.isHistorical && (
                              <div className="text-xs text-amber-600 font-medium">
                                Historical Date
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1 text-gray-400" />
                          {sale.client}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="line-clamp-2">
                          {sale.productSummary || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center">
                          {getPaymentMethodIcon(sale.paymentMethod)}
                          <span className="ml-1">{formatPaymentMethod(sale.paymentMethod)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <StatusBadge status={sale.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {sale.total}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          className="text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            viewSaleDetail(sale.id);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </button>
                  <button
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="font-medium">{pagination.totalCount}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                      {/* Show current page and nearby pages */}
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                        .filter(page => 
                          page === 1 || 
                          page === pagination.totalPages || 
                          Math.abs(page - pagination.page) <= 1
                        )
                        .map((page, i, arr) => {
                          // Add ellipsis if there are gaps in the sequence
                          if (i > 0 && page - arr[i - 1] > 1) {
                            return (
                              <span 
                                key={`ellipsis-${page}`}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                              >
                                ...
                              </span>
                            );
                          }
                          
                          return (
                            <button
                              key={page}
                              className={`relative inline-flex items-center px-4 py-2 border ${
                                pagination.page === page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              } text-sm font-medium`}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </button>
                          );
                        })
                      }
                      
                      <button
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear History Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Clear Sales History
              </h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Are you sure you want to clear all sales history? This action cannot be undone. 
                All sales records, payments, and related data will be permanently deleted.
              </p>
              <div className="flex space-x-3">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setShowClearConfirmModal(false)}
                  disabled={isClearingHistory}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleClearHistory}
                  disabled={isClearingHistory}
                >
                  {isClearingHistory ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 inline-block animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    'Clear History'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesListPage;