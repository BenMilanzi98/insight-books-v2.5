"use client";

import { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  DollarSign,
  Receipt,
  CreditCard,
  Users,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import PermissionGuard from '@/components/PermissionGuard';
import { getPermission } from '@/lib/permissions';

const ReversalsPage = () => {
  const [reversals, setReversals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totals, setTotals] = useState({ count: 0, totalAmount: 0, byType: {} });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalCount: 0, totalPages: 1 });
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pagePermissions, setPagePermissions] = useState({
    canViewReversals: true, // Default to true for now
    canExportReversals: false
  });

  // Fetch permissions on mount
  useEffect(() => {
    const fetchPermissions = async () => {
      // Check for accounting or reports view permissions
      const canViewAccounting = await getPermission("accounting.view");
      const canViewReports = await getPermission("reports.view");
      const canViewExpenses = await getPermission("expenses.view");
      const canViewInvoices = await getPermission("invoices.view");
      
      const canExport = await getPermission("reports.export");
      
      // Allow access if user has any relevant permission
      const canView = canViewAccounting || canViewReports || canViewExpenses || canViewInvoices;
      
      setPagePermissions({ 
        canViewReversals: canView, 
        canExportReversals: canExport 
      });
    };
    fetchPermissions();
  }, []);

  // Fetch reversals when filters change
  useEffect(() => {
    if (pagePermissions.canViewReversals) {
      fetchReversals();
    }
  }, [typeFilter, pagination.page, dateRange, pagePermissions.canViewReversals]);

  const fetchReversals = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        type: typeFilter,
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/transactions/reversals?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch reversals');
      }

      const data = await response.json();
      setReversals(data.reversals);
      setTotals(data.totals);
      setPagination(prev => ({
        ...prev,
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages
      }));

    } catch (err) {
      console.error('Error fetching reversals:', err);
      setError(err.message || 'Failed to load reversed transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchReversals();
  };

  const handleDateFilter = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchReversals();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'expense':
        return <Receipt className="w-4 h-4 text-red-500" />;
      case 'sale':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'refund':
        return <RotateCcw className="w-4 h-4 text-amber-500" />;
      case 'sale_refund':
        return <RotateCcw className="w-4 h-4 text-purple-500" />;
      case 'payroll':
        return <Users className="w-4 h-4 text-indigo-500" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'expense':
        return 'Expense';
      case 'sale':
        return 'Sale/Invoice';
      case 'payment':
        return 'Payment';
      case 'refund':
        return 'Invoice Refund';
      case 'sale_refund':
        return 'POS Refund';
      case 'payroll':
        return 'Payroll';
      default:
        return 'Transaction';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'expense':
        return 'bg-red-100 text-red-800';
      case 'sale':
        return 'bg-green-100 text-green-800';
      case 'payment':
        return 'bg-blue-100 text-blue-800';
      case 'refund':
        return 'bg-amber-100 text-amber-800';
      case 'sale_refund':
        return 'bg-purple-100 text-purple-800';
      case 'payroll':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        limit: '10000' // Get all for export
      });

      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }

      const response = await fetch(`/api/transactions/reversals?${params}`);
      const data = await response.json();

      // Generate CSV
      const headers = ['ID', 'Type', 'Description', 'Original Amount', 'Reversal Amount', 'Tax Reversed', 'Date', 'Reversed At', 'Reason', 'Performed By'];
      const rows = data.reversals.map(r => [
        r.id,
        getTypeLabel(r.type),
        r.description,
        r.originalAmount,
        r.reversalAmount,
        r.taxReversed != null && r.taxReversed > 0 ? r.taxReversed : '',
        r.date,
        r.reversedAt,
        `"${r.reversalReason || ''}"`,
        r.performedBy?.name || 'N/A'
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reversed-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error exporting reversals:', err);
      alert('Failed to export reversals');
    }
  };

  // If permissions haven't been determined yet, show loading
  if (pagePermissions.canViewReversals === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If user doesn't have permission, show access denied
  if (!pagePermissions.canViewReversals) {
    return (
      <PermissionGuard permission="reports.view">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">
              You don't have permission to view reversed transactions. 
              Please contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 shadow-xl shadow-indigo-200/50 p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <RotateCcw className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Reversed Transactions</h1>
                <p className="text-indigo-100 text-sm mt-0.5">View and track all reversed transactions with full audit trail</p>
              </div>
            </div>
            {pagePermissions.canExportReversals && reversals.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium border border-white/20 transition-all"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Reversals</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{totals.count}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-100">
                <RotateCcw className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</p>
                <p className="text-2xl sm:text-3xl font-bold text-rose-600 mt-1">{formatCurrency(totals.totalAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-100">
                <DollarSign className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Expenses</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{totals.byType?.expense || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-100">
                <Receipt className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sales/Invoice</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{totals.byType?.sale || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payroll</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 mt-1">{totals.byType?.payroll || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Type</label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              >
                <option value="all">All Types</option>
                <option value="expense">Expenses</option>
                <option value="sale">Sales/Invoices</option>
                <option value="payment">Payments</option>
                <option value="refund">Invoice Refunds</option>
                <option value="sale_refund">POS Refunds</option>
                <option value="payroll">Payroll</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
              />
            </div>

            {/* Apply Button */}
            <div className="flex items-end">
              <button
                onClick={handleDateFilter}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <Filter className="w-4 h-4 inline mr-2" />
                Apply
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search by reason or user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 pl-11 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </form>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-gray-200/50 border border-white/50 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p className="text-gray-500">Loading reversed transactions...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">{error}</p>
              <button 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={fetchReversals}
              >
                Try Again
              </button>
            </div>
          ) : reversals.length === 0 ? (
            <div className="p-8 text-center">
              <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No reversed transactions found</h3>
              <p className="text-gray-500">
                {typeFilter !== 'all' 
                  ? `No ${typeFilter} reversals match your filters`
                  : 'No transactions have been reversed yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Original Amount
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Reversal Amount
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Original Date
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Reversed At
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tax Reversed
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Performed By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reversals.map((reversal) => (
                    <tr 
                      key={`${reversal.type}-${reversal.id}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(reversal.type)}`}>
                          {getTypeIcon(reversal.type)}
                          <span className="ml-1.5">{getTypeLabel(reversal.type)}</span>
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{reversal.description}</span>
                          <span className="text-xs text-gray-500">ID: {reversal.id}</span>
                          {reversal.client && (
                            <span className="text-xs text-gray-500">{reversal.client.name}</span>
                          )}
                          {reversal.merchant && (
                            <span className="text-xs text-gray-500">{reversal.merchant}</span>
                          )}
                          {reversal.type === 'payroll' && reversal.employee && (
                            <span className="text-xs text-indigo-600 font-medium">{reversal.employee.name}</span>
                          )}
                          {reversal.type === 'payroll' && reversal.periodStart && reversal.periodEnd && (
                            <span className="text-xs text-gray-500">
                              {new Date(reversal.periodStart).toLocaleDateString()} – {new Date(reversal.periodEnd).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-gray-900">MK {formatCurrency(reversal.originalAmount)}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <span className="inline-flex items-center text-sm font-semibold text-red-600">
                          <ArrowDownRight className="w-4 h-4 mr-1" />
                          MK {formatCurrency(Math.abs(reversal.reversalAmount))}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(reversal.date)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(reversal.reversedAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <span className="text-sm text-gray-600 max-w-xs truncate block" title={reversal.reversalReason}>
                          {reversal.reversalReason || 'No reason provided'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                        {reversal.taxReversed != null && reversal.taxReversed > 0 ? (
                          <span className="font-medium text-amber-700">MK {formatCurrency(reversal.taxReversed)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {reversal.performedBy ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{reversal.performedBy.name}</span>
                            <span className="text-xs text-gray-500">{reversal.performedBy.email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">Unknown</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !error && reversals.length > 0 && (
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100/50 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
              <div className="text-sm text-gray-700 order-2 sm:order-1 font-medium">
                Showing <span className="text-gray-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.totalCount)}</span> of <span className="text-gray-900">{pagination.totalCount}</span> reversals
              </div>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button 
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm" 
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Previous
                </button>
                <span className="text-sm text-gray-600 font-medium px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button 
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg bg-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm" 
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReversalsPage;
