"use client";

import { useState, useEffect, useMemo } from "react";
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
import StatCard from "@/components/ui/StatCard";

/** Statement order for opening balance grouping */
const COA_CATEGORY_ORDER = ["Asset", "Liability", "Equity", "Revenue", "Expense"];

/** Map DB / GL type to chart section (Income rolls into Revenue for display) */
function coaSectionKey(accountType) {
  if (accountType === "Income") return "Revenue";
  return accountType || "";
}

function compareAccountCodes(a, b) {
  const ca = String(a.accountCode ?? "").trim();
  const cb = String(b.accountCode ?? "").trim();
  return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: "base" });
}

/** Indent depth: only ancestors present in the filtered list count */
function hierarchyDepth(account, byId) {
  let depth = 0;
  let cur = account;
  const visited = new Set();
  while (
    cur.parentAccount?.id &&
    byId.has(cur.parentAccount.id) &&
    !visited.has(cur.parentAccount.id)
  ) {
    visited.add(cur.parentAccount.id);
    depth += 1;
    cur = byId.get(cur.parentAccount.id);
    if (!cur) break;
  }
  return depth;
}

const COA_SECTION_HEADER_CLASS = {
  Asset: "bg-blue-50 border-blue-200",
  Liability: "bg-red-50 border-red-200",
  Equity: "bg-green-50 border-green-200",
  Revenue: "bg-purple-50 border-purple-200",
  Expense: "bg-orange-50 border-orange-200",
};

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
  const [statusReport, setStatusReport] = useState(null);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    fetchAccounts();
    fetchStatusReport();
  }, []);

  const fetchStatusReport = async () => {
    try {
      const res = await fetch("/api/opening-balances");
      if (res.ok) {
        const data = await res.json();
        setStatusReport(data);
        if (data.startingDate) {
          setOpeningDate(new Date(data.startingDate).toISOString().split('T')[0]);
        }
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const res = await fetch(`/api/opening-balances/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opening-balances.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

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
      await fetchStatusReport();
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
    if (filter !== "all") {
      const section = coaSectionKey(account.accountType);
      if (section !== filter && account.accountType !== filter) {
        return false;
      }
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const parentLabel = account.parentAccount
        ? `${account.parentAccount.accountCode || ""} ${account.parentAccount.accountName || ""}`.toLowerCase()
        : "";
      return (
        account.accountCode?.toLowerCase().includes(search) ||
        account.accountName?.toLowerCase().includes(search) ||
        account.accountType?.toLowerCase().includes(search) ||
        parentLabel.includes(search)
      );
    }

    return true;
  });

  const groupedByCoa = useMemo(() => {
    const byId = new Map(filteredAccounts.map((a) => [a.id, a]));
    const sorted = [...filteredAccounts].sort((a, b) => {
      const da = hierarchyDepth(a, byId);
      const db = hierarchyDepth(b, byId);
      if (da !== db) return da - db;
      return compareAccountCodes(a, b);
    });

    /** @type {Map<string, typeof sorted>} */
    const buckets = new Map();
    for (const key of COA_CATEGORY_ORDER) {
      buckets.set(key, []);
    }
    for (const acc of sorted) {
      const key = coaSectionKey(acc.accountType);
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(acc);
    }
    return COA_CATEGORY_ORDER.map((key) => ({
      key,
      label:
        key === "Revenue"
          ? "Revenue & income"
          : key === "Asset"
            ? "Assets"
            : key === "Liability"
              ? "Liabilities"
              : key === "Equity"
                ? "Equity"
                : key === "Expense"
                  ? "Expenses"
                  : key,
      accounts: buckets.get(key) || [],
    })).filter((g) => g.accounts.length > 0);
  }, [filteredAccounts]);

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

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const summary = statusReport?.summary;
  const isLocked = summary?.locked === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PermissionGuard permissions={["openingBalances.manage", "openingBalances.view", "accounts.update"]}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Opening Balances Setup</h1>
              <p className="text-gray-600 mt-1">
                Enter bulk COA opening balances — imbalances post to Opening Balance Equity (3190)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("xlsx")}
                disabled={!!exporting}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {exporting === "pdf" ? "Exporting…" : "Export PDF"}
              </button>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <HelpCircle className="h-5 w-5" />
                Help
              </button>
            </div>
          </div>

          {isLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900">Opening balances locked</h3>
                <p className="text-sm text-amber-800">
                  At least one accounting period has been closed. Use a manual journal entry or controlled period reopening to make corrections.
                </p>
              </div>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Opening stock", value: summary.stockTotal },
                { label: "Payment accounts", value: summary.paymentAccountsTotal },
                { label: "Receivables", value: summary.receivablesTotal },
                { label: "Payables", value: summary.payablesTotal },
              ].map((card) => (
                <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="text-lg font-semibold text-gray-900">MWK {fmt(card.value)}</p>
                </div>
              ))}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 col-span-2 md:col-span-4">
                <p className="text-xs text-indigo-700">Opening Balance Equity (3190)</p>
                <p className="text-lg font-semibold text-indigo-900">
                  MWK {fmt(summary.equityAccount?.balance)} · {summary.journalCount} journal(s)
                </p>
              </div>
            </div>
          )}

          {showHelp && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to Set Opening Balances</h3>
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                <li>Enter the starting balance for each account as of your opening date</li>
                <li>For Asset and Expense accounts: Enter positive amounts for debit balances</li>
                <li>For Liability, Equity, and Revenue accounts: Enter positive amounts for credit balances</li>
                <li>The system balances any difference to Opening Balance Equity (3190)</li>
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
                <option value="all">All categories (chart order)</option>
                {accountTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "Revenue" ? "Revenue & income" : type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Balance Sheet Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total Assets"
            value={`MWK ${getTotalAssets().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueClassName="text-blue-900"
            barClassName="from-blue-400 via-indigo-500 to-blue-600"
          />
          <StatCard
            label="Total Liabilities"
            value={`MWK ${getTotalLiabilities().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueClassName="text-red-900"
            barClassName="from-red-400 via-rose-500 to-pink-500"
          />
          <StatCard
            label="Total Equity"
            value={`MWK ${getTotalEquity().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueClassName="text-green-900"
            barClassName="from-emerald-400 via-green-500 to-teal-500"
          />
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
                {" "}(On save, the system posts the difference to Opening Balance Equity 3190)
              </span>
            )}
          </div>
        </div>

        {/* Accounts — grouped by chart category (statement order), indented by CoA parent chain */}
        <div className="space-y-8">
          {groupedByCoa.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No accounts match your filters
            </div>
          ) : (
            groupedByCoa.map((group) => {
              const byId = new Map(group.accounts.map((a) => [a.id, a]));
              return (
                <div
                  key={group.key}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  <div
                    className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                      COA_SECTION_HEADER_CLASS[group.key] || "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-gray-500 rotate-90 shrink-0" aria-hidden />
                      <h2 className="text-lg font-semibold text-gray-900">{group.label}</h2>
                      <span className="text-xs font-medium text-gray-500">
                        {group.accounts.length} account{group.accounts.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                            Code
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                            GL type
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                            Current
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                            Opening
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {group.accounts.map((account) => {
                          const depth = hierarchyDepth(account, byId);
                          const pad = Math.min(depth, 6) * 14;
                          const typeBadge =
                            accountTypeColors[account.accountType] ||
                            "bg-gray-50 text-gray-700 border-gray-200";
                          return (
                            <tr key={account.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono font-medium text-gray-900 align-top">
                                {account.accountCode || "—"}
                              </td>
                              <td className="px-4 py-2.5 text-sm text-gray-900 align-top">
                                <div style={{ paddingLeft: pad }} className="min-w-0">
                                  {depth > 0 && account.parentAccount && (
                                    <div className="text-[11px] text-gray-400 truncate mb-0.5">
                                      Under {account.parentAccount.accountCode}{" "}
                                      {account.parentAccount.accountName}
                                    </div>
                                  )}
                                  <div className="font-medium text-gray-900">{account.accountName}</div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap align-top">
                                <span
                                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${typeBadge}`}
                                >
                                  {account.accountType}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600 text-right align-top tabular-nums">
                                MWK{" "}
                                {parseFloat(account.currentBalance || 0).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-right align-top">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={balances[account.id] || ""}
                                  onChange={(e) => handleBalanceChange(account.id, e.target.value)}
                                  placeholder="0.00"
                                  className="w-32 ml-auto px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right tabular-nums"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
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
            disabled={saving || isLocked}
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










