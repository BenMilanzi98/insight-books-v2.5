"use client";
import { tt } from '@/lib/i18n/runtime';

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

export default function TaxAccountsBalances() {
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
        const accountWithPayable = taxAccounts.find(
          (acc) => (acc.netDueInPeriod ?? Math.max(0, acc.netPayable || 0)) > 0
        );
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
          <h3 className="text-lg font-medium text-red-800 mb-2">{tt('Access Denied')}</h3>
          <p className="text-red-600">{tt("You don't have permission to access this feature.")}</p>
        </div>
      </div>
    );
  }

  const resolveAccountFlow = (account) =>
    account.flow ||
    (String(account.account?.accountCode || "").startsWith("2045-") ? "outflow" : "inflow");

  const inflowAccounts = taxAccounts.filter((a) => resolveAccountFlow(a) === "inflow");
  const outflowAccounts = taxAccounts.filter((a) => resolveAccountFlow(a) === "outflow");

  const renderTaxAccountRow = (account) => (
    <div key={account.taxType.id} className="p-6 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{account.taxType.taxName}</h3>
            {account.isSystem && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-800">MRA</span>
            )}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              resolveAccountFlow(account) === "inflow" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"
            }`}>
              {resolveAccountFlow(account) === "inflow" ? "2041" : "2045"}
            </span>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 font-mono">
              {account.account?.accountCode || account.taxType.taxCode}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {account.account?.accountName || "Not linked"} ·{" "}
            {account.taxType.calculationType === "Percentage"
              ? `${account.taxType.taxRate}%`
              : formatCurrency(account.taxType.taxRate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(account.netDueInPeriod ?? Math.max(0, account.netPayable || 0)) > 0 && (
            <button
              onClick={() => handleSettleTax(account)}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm"
            >
              <CreditCard size={16} />
              {tt('Settle')}
            </button>
          )}
          <Link
            href={`/tax-management/accounts/${account.taxType.id}`}

            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Eye size={18} />
            {tt('View Details')}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">{tt('Collected')}</p>
          <p className="text-lg font-semibold text-blue-600">{formatCurrency(account.totalCollected)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">{tt('Paid')}</p>
          <p className="text-lg font-semibold text-red-600">{formatCurrency(account.totalPaid)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">{tt('Reversed / voided')}</p>
          <p className="text-lg font-semibold text-yellow-600">{formatCurrency(account.totalRefunded)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Net due (period)</p>
          <p className="text-lg font-semibold text-blue-600">
            {formatCurrency(account.netDueInPeriod ?? Math.max(0, account.netPayable || 0))}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tt('Tax Accounts Dashboard')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tt('Track and manage all tax obligations across multiple tax accounts')}
          </p>
        </div>
        <div className="flex gap-2">
          {summary && (summary.totalNetDueInPeriod ?? Math.max(0, summary.totalNetPayable || 0)) > 0 && (
            <button
              onClick={() => handleSettleTax(null)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <CreditCard size={18} />
              {tt('Settle Tax')}
            </button>
          )}
          <button
            onClick={loadData}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={18} />
            {tt('Refresh')}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Period')}</label>
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
              <option value="today">{tt('Today')}</option>
              <option value="thisWeek">{tt('This Week')}</option>
              <option value="thisMonth">{tt('This Month')}</option>
              <option value="lastMonth">{tt('Last Month')}</option>
              <option value="thisQuarter">{tt('This Quarter')}</option>
              <option value="lastQuarter">{tt('Last Quarter')}</option>
              <option value="thisYear">{tt('This Year')}</option>
              <option value="custom">{tt('Custom Range')}</option>
            </select>
          </div>
          
          {selectedPeriod === 'custom' && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Start Date')}</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('End Date')}</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Group By')}</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="day">{tt('Daily')}</option>
              <option value="month">{tt('Monthly')}</option>
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
          Roll-up GL parents — each MRA tax posts to its own child account (2041-xx / 2045-xx). Direct posting to 2041 or 2045 is blocked.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100">
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Tax inflow (collected)</span>
            <p className="text-sm font-medium text-gray-900 mt-0.5">2041 – Tax Inflow (Collected)</p>
            <p className="text-xs text-gray-500 mt-0.5">{tt('VAT output, PAYE, WHT, excise — child accounts 2041-01+')}</p>
          </div>
          <div className="bg-orange-50 rounded-lg px-3 py-2.5 border border-orange-100">
            <span className="text-xs font-medium text-orange-700 uppercase tracking-wide">Tax outflow (paid)</span>
            <p className="text-sm font-medium text-gray-900 mt-0.5">2045 – Tax Outflow (Paid)</p>
            <p className="text-xs text-gray-500 mt-0.5">{tt('Input VAT, CIT, levies — child accounts 2045-01+')}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="text-blue-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">{tt('Total Collected')}</h3>
            </div>
            <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-blue-600 sm:text-2xl">
              {formatCurrency(summary.totalCollected || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Across {summary.totalTaxAccounts || 0} tax accounts
            </p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="text-red-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">{tt('Total Paid')}</h3>
            </div>
            <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-red-600 sm:text-2xl">
              {formatCurrency(summary.totalPaid || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {tt('Payments to tax authorities')}
            </p>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <Info className="text-yellow-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">{tt('Total Refunded')}</h3>
            </div>
            <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-yellow-600 sm:text-2xl">
              {formatCurrency(summary.totalRefunded || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {tt('Tax refunds and adjustments')}
            </p>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="text-blue-600" size={24} />
              <h3 className="text-sm font-medium text-gray-700">Net due (period)</h3>
            </div>
            <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-blue-600 sm:text-2xl">
              {formatCurrency(
                summary.totalNetDueInPeriod ?? Math.max(0, summary.totalNetPayable || 0)
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Amount still owed for the selected date window (reversals shown separately, not as negative net
              tax).
            </p>
            {Number(summary.totalPeriodReversalOverhang) > 0 && (
              <p className="text-xs text-amber-900 mt-2 border-t border-amber-100 pt-2">
                Reversals in window exceed in-window collections by{" "}
                <span className="font-semibold">
                  {formatCurrency(summary.totalPeriodReversalOverhang)}
                </span>
                . Use Tax Types → Reversed Taxes or widen the range to align with original invoice tax dates.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tax Accounts List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{tt('Tax Accounts')}</h2>
        </div>
        
        {taxAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Info className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">{tt('No tax accounts found. Create tax types to get started.')}</p>
            <Link
              href="/tax-management/accounts?tab=codes"

              className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
            >
              {tt('Go to Tax codes →')}
            </Link>
          </div>
        ) : (
          <div>
            {inflowAccounts.length > 0 && (
              <div>
                <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100">
                  <h3 className="text-sm font-semibold text-emerald-900">2041 — Tax Inflow (Collected)</h3>
                  <p className="text-xs text-emerald-700">{inflowAccounts.length} account(s)</p>
                </div>
                {inflowAccounts.map(renderTaxAccountRow)}
              </div>
            )}
            {outflowAccounts.length > 0 && (
              <div>
                <div className="px-6 py-3 bg-orange-50 border-b border-orange-100">
                  <h3 className="text-sm font-semibold text-orange-900">2045 — Tax Outflow (Paid)</h3>
                  <p className="text-xs text-orange-700">{outflowAccounts.length} account(s)</p>
                </div>
                {outflowAccounts.map(renderTaxAccountRow)}
              </div>
            )}
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
        taxLiability={
          selectedAccount
            ? selectedAccount.netDueInPeriod ?? Math.max(0, selectedAccount.netPayable || 0)
            : summary?.totalNetDueInPeriod ?? Math.max(0, summary?.totalNetPayable || 0)
        }
        taxTypeId={selectedAccount ? selectedAccount.taxType.id : null}
      />

      {/* Success Message */}
      {settlementSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Info size={20} />
          <span>{tt('Tax settlement recorded successfully!')}</span>
        </div>
      )}
    </div>
  );
}

