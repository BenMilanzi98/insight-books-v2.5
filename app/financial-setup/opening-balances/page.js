"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  DollarSign,
  FileText,
  ChevronRight,
  Loader2,
  X,
  HelpCircle,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";

export default function OpeningBalancesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/accounts/opening-balances");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
      
      // Initialize balances from existing opening balances
      const initialBalances = {};
      data.accounts.forEach(account => {
        if (account.hasOpeningBalance) {
          initialBalances[account.id] = account.openingBalance;
        }
      });
      setBalances(initialBalances);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceChange = (accountId, value) => {
    const numValue = parseFloat(value) || 0;
    setBalances(prev => ({
      ...prev,
      [accountId]: numValue,
    }));
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Build balances array (only include non-zero balances)
      const balancesArray = Object.entries(balances)
        .filter(([_, amount]) => amount !== 0 && amount !== null && amount !== undefined)
        .map(([accountId, amount]) => ({
          accountId,
          amount: parseFloat(amount),
        }));

      if (balancesArray.length === 0) {
        setError("Please enter at least one opening balance");
        setSaving(false);
        return;
      }

      const response = await fetch("/api/accounts/opening-balances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          balances: balancesArray,
          date: openingDate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set opening balances");
      }

      setSuccess("Opening balances set successfully!");
      setTimeout(() => {
        router.push("/chart-of-accounts");
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredAccounts = accounts.filter(account => {
    // Filter by account type
    if (filter !== "all" && account.accountType !== filter) {
      return false;
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        account.accountCode?.toLowerCase().includes(search) ||
        account.accountName?.toLowerCase().includes(search) ||
        account.accountType?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const accountTypes = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
  const accountTypeColors = {
    Asset: "bg-blue-50 text-blue-700 border-blue-200",
    Liability: "bg-red-50 text-red-700 border-red-200",
    Equity: "bg-green-50 text-green-700 border-green-200",
    Revenue: "bg-purple-50 text-purple-700 border-purple-200",
    Expense: "bg-orange-50 text-orange-700 border-orange-200",
  };

  const getTotalByType = (type) => {
    return filteredAccounts
      .filter(acc => acc.accountType === type)
      .reduce((sum, acc) => sum + (parseFloat(balances[acc.id] || 0)), 0);
  };

  const getTotalAssets = () => getTotalByType("Asset");
  const getTotalLiabilities = () => getTotalByType("Liability");
  const getTotalEquity = () => getTotalByType("Equity");
  const getTotalRevenue = () => getTotalByType("Revenue");
  const getTotalExpenses = () => getTotalByType("Expense");

  const balanceSheetBalanced = Math.abs(
    getTotalAssets() - (getTotalLiabilities() + getTotalEquity())
  ) < 0.01;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PermissionGuard requiredPermission="accounting:manage">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Opening Balances Setup</h1>
              <p className="text-gray-600 mt-1">
                Set opening balances for your accounts to begin accounting
              </p>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <HelpCircle className="h-5 w-5" />
              Help
            </button>
          </div>

          {showHelp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to Set Opening Balances</h3>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>Enter the starting balance for each account as of your opening date</li>
                <li>For Asset and Expense accounts: Enter positive amounts for debit balances</li>
                <li>For Liability, Equity, and Revenue accounts: Enter positive amounts for credit balances</li>
                <li>The system will automatically balance using the Opening Balances Equity account</li>
                <li>You can filter accounts by type or search by code/name</li>
                <li>Only accounts with non-zero balances will be saved</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Success</h3>
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          )}
        </div>

        {/* Opening Date */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Opening Balance Date
          </label>
          <input
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Account Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Balance Sheet Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Assets</div>
            <div className="text-2xl font-bold text-blue-900">
              MWK {getTotalAssets().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-600 font-medium">Total Liabilities</div>
            <div className="text-2xl font-bold text-red-900">
              MWK {getTotalLiabilities().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Total Equity</div>
            <div className="text-2xl font-bold text-green-900">
              MWK {getTotalEquity().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Balance Sheet Equation */}
        <div className={`rounded-lg p-4 mb-6 ${
          balanceSheetBalanced 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {balanceSheetBalanced ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <span className={`font-semibold ${
              balanceSheetBalanced ? 'text-green-900' : 'text-yellow-900'
            }`}>
              Balance Sheet Equation: Assets = Liabilities + Equity
            </span>
          </div>
          <div className={`text-sm ${
            balanceSheetBalanced ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {balanceSheetBalanced ? (
              <span>✓ Balanced: {getTotalAssets().toLocaleString('en-US', { minimumFractionDigits: 2 })} = {(getTotalLiabilities() + getTotalEquity()).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            ) : (
              <span>
                Difference: MWK {Math.abs(getTotalAssets() - (getTotalLiabilities() + getTotalEquity())).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                {" "}(The system will automatically balance using Opening Balances Equity)
              </span>
            )}
          </div>
        </div>

        {/* Accounts Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opening Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {account.accountCode || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {account.accountName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${
                          accountTypeColors[account.accountType] || "bg-gray-50 text-gray-700 border-gray-200"
                        }`}>
                          {account.accountType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        MWK {parseFloat(account.currentBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.01"
                          value={balances[account.id] || ""}
                          onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                          placeholder="0.00"
                          className="w-32 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Opening Balances
              </>
            )}
          </button>
        </div>
      </div>
    </PermissionGuard>
  );
}










