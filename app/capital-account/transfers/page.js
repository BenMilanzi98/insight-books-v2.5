"use client";
import { tt } from '@/lib/i18n/runtime';
import { useState, useEffect } from "react";
import { ArrowRightLeft, ArrowUpRight, ArrowDownRight, Filter, Download, Search, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/dateUtils";
import { paymentMethods } from "@/lib/paymentMethods";
import StatCard from "@/components/ui/StatCard";

const CapitalAccountTransfersPage = () => {
  const [transfers, setTransfers] = useState([]);
  /** Actual payment accounts from /payments/management with real balances */
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: 'all',
    dateFrom: '',
    dateTo: '',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [capitalAccount, setCapitalAccount] = useState(null);

  useEffect(() => {
    fetchTransfers();
    fetchPaymentAccounts();
    fetchCapitalAccount();
  }, [filters, currentPage]);

  const fetchPaymentAccounts = async () => {
    try {
      const response = await fetch('/api/payment-accounts/balances');
      if (response.ok) {
        const data = await response.json();
        setPaymentAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching payment accounts:', error);
    }
  };

  /** Resolve display name: by payment account id, then legacy payment method key, then capital account */
  const getPaymentMethodName = (keyOrId) => {
    if (!keyOrId) return 'Unknown';
    if (keyOrId === capitalAccount?.id) return capitalAccount?.name || 'Capital Account';
    const byId = paymentAccounts.find((a) => a.id === keyOrId);
    if (byId?.name) return byId.name;
    return paymentMethods.find((m) => m.key === keyOrId)?.name || keyOrId;
  };

  const fetchTransfers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/capital-account/transfers?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        throw new Error('Failed to fetch transfers');
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      setError('Failed to load transfer history');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCapitalAccount = async () => {
    try {
      const response = await fetch('/api/capital-account');
      if (response.ok) {
        const data = await response.json();
        setCapitalAccount(data.capitalAccount || null);
      }
    } catch (error) {
      console.error('Error fetching capital account:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        export: 'true',
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/capital-account/transfers/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `capital-account-transfers-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting transfers:', error);
    }
  };

  const getTransferTypeIcon = (type) => {
    return type === 'outgoing' ? (
      <ArrowDownRight className="h-4 w-4 text-red-500" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-green-500" />
    );
  };

  const getTransferTypeColor = (type) => {
    return type === 'outgoing' 
      ? 'bg-red-100 text-red-800 border-red-200' 
      : 'bg-green-100 text-green-800 border-green-200';
  };

  if (error) {
    return (
      <div className="flex w-full items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{tt('Error Loading Transfers')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {tt('Try Again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tt('Capital Account Transfer History')}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {tt('View and analyze all transfers to and from your capital account')}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.href = '/capital-account?showTransferModal=true'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {tt('New Transfer')}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                {tt('Export')}
              </button>
              <a
                href="/capital-account"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                {tt('Back to Capital Account')}
              </a>
            </div>
          </div>
        </div>

        {/* Capital Account Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{tt('Capital Account Summary')}</h2>
            <a
              href="/capital-account"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Capital Account
            </a>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Current Balance"
              value={formatCurrency(capitalAccount?.balance || 0)}
              icon={ArrowRightLeft}
              valueClassName="text-blue-900"
              barClassName="from-blue-400 via-indigo-500 to-blue-600"
              iconWrapClassName="bg-blue-100 text-blue-600"
            />
            <StatCard
              label="Account Code"
              value={capitalAccount?.code || 'N/A'}
              barClassName="from-emerald-400 via-green-500 to-teal-500"
              valueClassName="text-green-900"
            />
            <StatCard
              label="Total Transfers"
              value={transfers.length > 0 ? transfers.length : '0'}
              barClassName="from-blue-400 via-sky-500 to-indigo-500"
              valueClassName="text-blue-900"
            />
          </div>
        </div>

        {/* Payment account balances (same as /payments/management) */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Available Balances')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {paymentAccounts
              .filter((a) => a.isActive !== false)
              .map((account) => {
                const balance = typeof account.balance === 'number' ? account.balance : parseFloat(account.balance) || 0;
                return (
                  <StatCard
                    key={account.id}
                    label={account.name}
                    value={formatCurrency(balance)}
                    helper="Available Balance"
                  />
                );
              })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">{tt('Filters')}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tt('Transfer Type')}</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="all">{tt('All Types')}</option>
                <option value="outgoing">{tt('Outgoing')}</option>
                <option value="incoming">{tt('Incoming')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tt('Date From')}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tt('Date To')}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{tt('Search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder={tt('Reference, notes...')}
                  className="w-full pl-10 pr-4 p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{tt('Transfer History')}</h2>
          </div>
          
          {isLoading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">{tt('Loading transfers...')}</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-6 text-center">
              <ArrowRightLeft className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">{tt('No transfers found')}</p>
              <p className="text-sm text-gray-400 mt-1">{tt('Transfers will appear here once you make them')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {tt('Transfer Details')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {tt('Type')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {tt('Amount')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {tt('Date')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {tt('Reference')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {transfer.type === 'outgoing' ? 'To:' : 'From:'} {
                                transfer.type === 'outgoing' 
                                  ? getPaymentMethodName(transfer.destinationAccount)
                                  : getPaymentMethodName(transfer.sourceAccount)
                              }
                            </div>
                            <div className="text-sm text-gray-500">
                                {transfer.type === 'outgoing' 
                                  ? `Payment Method: ${getPaymentMethodName(transfer.destinationAccount)}`
                                  : `Payment Method: ${getPaymentMethodName(transfer.sourceAccount)}`
                                }
                              </div>
                            <div className="text-sm text-gray-500">
                              {transfer.notes || 'No description'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTransferTypeColor(transfer.type)}`}>
                            {getTransferTypeIcon(transfer.type)}
                            <span className="ml-1">
                              {transfer.type === 'outgoing' ? 'Outgoing' : 'Incoming'}
                            </span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(transfer.amount)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {formatDate(transfer.date)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-mono">
                            {transfer.reference}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        {tt('Previous')}
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        {tt('Next')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CapitalAccountTransfersPage; 