"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  ArrowRight,
  Info,
  AlertCircle,
  CreditCard
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import Link from "next/link";
import TaxSettlementModal from "@/components/TaxSettlementModal";

export default function TaxAccountsPage() {
  const [taxAccounts, setTaxAccounts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [groupBy, setGroupBy] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('thisMonth');
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [settlementSuccess, setSettlementSuccess] = useState(false);

  const toYmdLocal = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    checkPermissions();
    setDefaultDates();
    loadData();
  }, [selectedPeriod, groupBy]);

  const setDefaultDates = () => {
    const now = new Date();
    let start, end;

    switch (selectedPeriod) {
      case 'today':
        start = new Date(now);
        end = new Date(now);
        break;
      case 'thisWeek':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        end = new Date(now.getFullYear(), (q + 1) * 3, 0);
        break;
      }
      case 'lastQuarter': {
        const cq = Math.floor(now.getMonth() / 3);
        const lq = cq === 0 ? 3 : cq - 1;
        const lqy = cq === 0 ? now.getFullYear() - 1 : now.getFullYear();
        start = new Date(lqy, lq * 3, 1);
        end = new Date(lqy, (lq + 1) * 3, 0);
        break;
      }
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        // Use provided dates
        return;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setStartDate(toYmdLocal(start));
    setEndDate(toYmdLocal(end));
  };

  useEffect(() => {
    if (selectedPeriod !== 'custom' || (startDate && endDate)) {
      loadData();
    }
  }, [startDate, endDate, groupBy]);

  const checkPermissions = async () => {
    const [accountingView, reportsView, taxView] = await Promise.all([
      getPermission("accounting.view"),
      getPermission("reports.view"),
      getPermission("tax.view"),
    ]);
    
    setHasAccess(accountingView || reportsView || taxView);
  };

  const loadData = async () => {
    // Use default dates if not set (handles initial load timing issues)
    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;
    
    if (!effectiveStartDate || !effectiveEndDate) {
      // Set default dates for the current month
      const now = new Date();
      effectiveStartDate = toYmdLocal(new Date(now.getFullYear(), now.getMonth(), 1));
      effectiveEndDate = toYmdLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tax-accounts/balances?${new URLSearchParams({
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        groupBy,
      }).toString()}`);
      
      if (!response.ok) throw new Error('Failed to load tax account balances');
      
      const data = await response.json();
      setTaxAccounts(data.taxAccounts || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettleTax = (account = null) => {
    setSelectedAccount(account);
    setShowSettlementModal(true);
    setSettlementSuccess(false);
  };

  const handleSettlementSubmit = async (formData) => {
    try {
      // If settling from main button, find the tax account with net payable
      let taxTypeId = selectedAccount ? selectedAccount.taxType.id : null;
      if (!taxTypeId && taxAccounts.length > 0) {
        // Find the tax account with the highest net payable
        const accountWithPayable = taxAccounts.find(acc => acc.netPayable > 0);
        if (accountWithPayable) {
          taxTypeId = accountWithPayable.taxType.id;
        }
      }

      const response = await fetch('/api/tax/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          description: formData.description || `Tax Settlement - ${selectedAccount ? selectedAccount.taxType.taxName : (taxAccounts.find(acc => acc.taxType.id === taxTypeId)?.taxType.taxName || 'Tax Account')}`,
          notes: formData.notes || `Settlement for period ${startDate} to ${endDate}`,
          taxPeriod: `${startDate} to ${endDate}`,
          taxTypeId: taxTypeId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record tax settlement');
      }

      const result = await response.json();
      setSettlementSuccess(true);
      
      // Refresh data after successful settlement
      setTimeout(() => {
        loadData();
        setShowSettlementModal(false);
        setSettlementSuccess(false);
        setSelectedAccount(null);
      }, 1500);
    } catch (error) {
      console.error('Error settling tax:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  if (isLoading && !taxAccounts.length) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">You don't have permission to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Accounts Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage all tax obligations across multiple tax accounts
          </p>
        </div>
        <div className="flex gap-2">
          {summary && summary.totalNetPayable > 0 && (
            <button
              onClick={() => handleSettleTax(null)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <CreditCard size={18} />
              Settle Tax
            </button>
          )}
          <button
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                if (e.target.value === 'custom') {
                  // Keep current dates
                }
              }}
            >
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisQuarter">This Quarter</option>
              <option value="lastQuarter">Last Quarter</option>
              <option value="thisYear">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          
          {selectedPeriod === 'custom' && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Showing balances for {startDate} to {endDate}. Use the same period on Tax Types so numbers match.
        </p>
      </div>

      {/* Fixed default tax accounts — cannot be changed by tenants */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="text-indigo-600" size={20} />
          <h2 className="text-base font-semibold text-gray-900">Default tax accounts (fixed)</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Tax is always recorded to these system accounts. They cannot be changed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax inflow (collected)</span>
            <p className="text-sm font-medium text-gray-900 mt-0.5">2041 – Tax Inflow (Collected)</p>
            <p className="text-xs text-gray-500 mt-0.5">Tax from sales, invoices and POS</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax outflow (paid)</span>
            <p className="text-sm font-medium text-gray-900 mt-0.5">2045 – Tax Outflow (Paid)</p>
            <p className="text-xs text-gray-500 mt-0.5">Tax on expenses and supplier bills</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="text-blue-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">Total Collected</h3>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalCollected || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Across {summary.totalTaxAccounts || 0} tax accounts
            </p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="text-red-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">Total Paid</h3>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalPaid || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Payments to tax authorities
            </p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Info className="text-yellow-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">Total Refunded</h3>
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.totalRefunded || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Tax refunds and adjustments
            </p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-purple-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">Net Payable</h3>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(summary.totalNetPayable || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Amount due to tax authorities
            </p>
          </div>
        </div>
      )}

      {/* Tax Accounts List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tax Accounts</h2>
        </div>
        
        {taxAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Info className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">No tax accounts found. Create tax types to get started.</p>
            <Link
              href="/tax-types"
              className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
            >
              Go to Tax Types →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {taxAccounts.map((account) => (
              <div key={account.taxType.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {account.taxType.taxName}
                      </h3>
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {account.taxType.taxCode}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {account.account?.accountType || 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Account: {account.account?.accountCode || 'N/A'} - {account.account?.accountName || 'Not Linked'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Rate: {account.taxType.calculationType === 'Percentage' 
                        ? `${account.taxType.taxRate}%` 
                        : formatCurrency(account.taxType.taxRate)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {account.netPayable > 0 && (
                      <button
                        onClick={() => handleSettleTax(account)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm"
                      >
                        <CreditCard size={16} />
                        Settle
                      </button>
                    )}
                    <Link
                      href={`/tax-accounts/${account.taxType.id}`}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Eye size={18} />
                      View Details
                    </Link>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Collected</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {formatCurrency(account.totalCollected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                    <p className="text-lg font-semibold text-red-600">
                      {formatCurrency(account.totalPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Refunded</p>
                    <p className="text-lg font-semibold text-yellow-600">
                      {formatCurrency(account.totalRefunded)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Net Payable</p>
                    <p className={`text-lg font-semibold ${
                      account.netPayable >= 0 ? 'text-purple-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(account.netPayable)}
                    </p>
                  </div>
                </div>
                
                {/* Breakdown Chart */}
                {account.breakdown.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">
                      {groupBy === 'day' ? 'Daily' : 'Monthly'} Breakdown
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {account.breakdown.slice(0, 12).map((period) => (
                        <div
                          key={period.period}
                          className="flex-1 min-w-[80px] bg-gray-50 rounded p-2"
                        >
                          <p className="text-xs text-gray-600 mb-1">{period.period}</p>
                          <p className="text-xs font-semibold text-blue-600">
                            {formatCurrency(period.collected)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tax Settlement Modal */}
      <TaxSettlementModal
        isOpen={showSettlementModal}
        onClose={() => {
          setShowSettlementModal(false);
          setSelectedAccount(null);
          setSettlementSuccess(false);
        }}
        onSubmit={handleSettlementSubmit}
        taxLiability={selectedAccount ? selectedAccount.netPayable : (summary?.totalNetPayable || 0)}
        taxTypeId={selectedAccount ? selectedAccount.taxType.id : null}
      />

      {/* Success Message */}
      {settlementSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Info size={20} />
          <span>Tax settlement recorded successfully!</span>
        </div>
      )}
    </div>
  );
}

