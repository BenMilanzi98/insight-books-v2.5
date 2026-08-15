"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft,
  Calendar,
  Download,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  FileText
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

function toYmdLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function initialThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toYmdLocalDate(start), end: toYmdLocalDate(end) };
}

export default function TaxAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const monthInit = initialThisMonthRange();
  const taxTypeId = params?.id != null ? String(params.id) : "";

  const [accountData, setAccountData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [startDate, setStartDate] = useState(monthInit.start);
  const [endDate, setEndDate] = useState(monthInit.end);
  const [selectedPeriod, setSelectedPeriod] = useState("thisMonth");

  const toYmdLocal = (value) => toYmdLocalDate(new Date(value));

  useEffect(() => {
    checkPermissions();
    setDefaultDates();
  }, [selectedPeriod]);

  useEffect(() => {
    if (taxTypeId && (selectedPeriod !== 'custom' || (startDate && endDate))) {
      loadData();
    }
  }, [taxTypeId, startDate, endDate, selectedPeriod]);

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
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    setStartDate(toYmdLocal(start));
    setEndDate(toYmdLocal(end));
  };

  const checkPermissions = async () => {
    const [accountingView, reportsView, taxView] = await Promise.all([
      getPermission("accounting.view"),
      getPermission("reports.view"),
      getPermission("tax.view"),
    ]);
    
    setHasAccess(accountingView || reportsView || taxView);
  };

  const loadData = async () => {
    if (!taxTypeId || !startDate || !endDate) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      
      const response = await fetch(`/api/tax-accounts/${taxTypeId}/balance?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load tax account details');
      }
      
      const data = await response.json();
      setAccountData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !accountData) {
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

  if (error && !accountData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700"
        >
          ← Go Back
        </button>
      </div>
    );
  }

  if (!accountData) {
    return null;
  }

  const { taxType, account, summary, transactionHistory } = accountData;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{taxType.taxName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tax Code: {taxType.taxCode} | Account: {account?.accountCode || 'N/A'} - {account?.accountName || 'Not Linked'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Period')}</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
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
          
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <RefreshCw size={18} />
              {tt('Refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-blue-600" size={24} />
            <h3 className="text-sm font-medium text-gray-700">{tt('Total Collected')}</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(summary.totalCollected || 0)}
          </p>
        </div>
        
        <div className="bg-red-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="text-red-600" size={24} />
            <h3 className="text-sm font-medium text-gray-700">{tt('Total Paid')}</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(summary.totalPaid || 0)}
          </p>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <Info className="text-yellow-600" size={24} />
            <h3 className="text-sm font-medium text-gray-700">{tt('Total Refunded')}</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {formatCurrency(summary.totalRefunded || 0)}
          </p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-blue-600" size={24} />
            <h3 className="text-sm font-medium text-gray-700">Net due (period)</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(
              summary.netDueInPeriod ?? Math.max(0, summary.netPayable || 0)
            )}
          </p>
          {Number(summary.periodReversalOverhang) > 0 && (
            <p className="text-xs text-amber-900 mt-1">
              Reversal overhang in window: {formatCurrency(summary.periodReversalOverhang)}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Current Balance: {formatCurrency(summary.currentBalance || 0)}
          </p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{tt('Transaction History')}</h2>
        </div>
        
        {transactionHistory.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">{tt('No transactions found for this period.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Reference')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Description')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{tt('Type')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{tt('Debit')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{tt('Credit')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{tt('Balance')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactionHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tx.reference}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tx.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tx.transactionType === 'collected' ? 'bg-blue-100 text-blue-800' :
                        tx.transactionType === 'paid' ? 'bg-red-100 text-red-800' :
                        tx.transactionType === 'refunded' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {tx.debitAmount > 0 ? formatCurrency(tx.debitAmount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {tx.creditAmount > 0 ? formatCurrency(tx.creditAmount) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      {formatCurrency(tx.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

