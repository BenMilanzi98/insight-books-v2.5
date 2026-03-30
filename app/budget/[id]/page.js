"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  CheckCircle,
  Loader2,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  BarChart3,
  Target,
  Percent,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

function safeDate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function RevenueBudgetDetailsPage() {
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [budget, setBudget] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canUpdate: false,
    canDelete: false,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bRes, cRes] = await Promise.all([
        fetch(`/api/budgets/${id}`, { cache: "no-store" }),
        fetch(`/api/budgets/${id}/vs-actual`, { cache: "no-store" }),
      ]);

      const bJson = await bRes.json();
      if (!bRes.ok) throw new Error(bJson?.error || "Failed to load budget");
      setBudget(bJson?.data || null);

      const cJson = await cRes.json();
      if (!cRes.ok) throw new Error(cJson?.error || "Failed to load comparison");
      setComparison(cJson?.data || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  useEffect(() => {
    const fetchPermissions = async () => {
      const canUpdate = await getPermission("budgets.update");
      const canDelete = await getPermission("budgets.delete");
      setPagePermissions({ canUpdate, canDelete });
    };
    fetchPermissions();
  }, []);

  const handleAction = async (action) => {
    try {
      setActionLoading(true);
      setError(null);

      const res = await fetch(`/api/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to ${action} budget`);

      setSuccess(`Budget ${action}ed successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isLocked = budget?.isLocked || false;
  const isExpense =
    budget?.budgetType === "expense" ||
    comparison?.budget?.budgetType === "expense";

  // Comparison data (API returns { budget, comparison, breakdowns, expenseLines, ... })
  const comp = comparison?.comparison;
  const budgetedAmount = comp?.budgetedRevenue || 0;
  const actualAmount = comp?.actualRevenue || 0;
  const variance = comp?.variance?.amount || 0;
  const variancePercent = comp?.variance?.percent || 0;
  const achievement = comp?.achievement?.percent || 0;
  const status = comp?.achievement?.status || "unknown";
  const expenseLines = comparison?.expenseLines || [];

  // Chart data
  const chartData = useMemo(() => {
    if (!comparison) return [];
    return [
      { name: 'Budgeted', value: budgetedAmount, fill: '#3b82f6' },
      { name: 'Actual', value: actualAmount, fill: '#10b981' },
    ];
  }, [comparison, budgetedAmount, actualAmount]);

  // Breakdown chart data
  const breakdownData = useMemo(() => {
    if (!comparison?.breakdowns) return [];
    return comparison.breakdowns.map((item, idx) => ({
      name: item.referenceName,
      budgeted: item.budgetedAmount,
      actual: item.actualAmount || 0,
      variance: item.variance || 0,
      fill: COLORS[idx % COLORS.length],
    }));
  }, [comparison]);

  const expenseLineChartData = useMemo(() => {
    if (!expenseLines.length) return [];
    return expenseLines.map((row, idx) => ({
      name:
        row.accountCode
          ? `${row.accountCode} ${row.accountName}`.slice(0, 28)
          : row.accountName,
      budgeted: row.budgetedAmount,
      actual: row.actualAmount,
      fill: COLORS[idx % COLORS.length],
    }));
  }, [expenseLines]);

  const breakdownSectionTitle = useMemo(() => {
    const t = comparison?.breakdowns?.[0]?.breakdownType;
    if (t === "branch") return "Branch";
    if (t === "product_category") return "Inventory category";
    return "Category";
  }, [comparison?.breakdowns]);

  // Variance status helpers (revenue: over target = good; expense: over budget = bad)
  const getStatusBadge = (st) => {
    switch (st) {
      case "over":
        return isExpense ? (
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
            <TrendingUp size={14} />
            Over budget
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
            <TrendingUp size={14} />
            Over target
          </span>
        );
      case "under":
        return isExpense ? (
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
            <TrendingDown size={14} />
            Under budget
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
            <TrendingDown size={14} />
            Under target
          </span>
        );
      case "on_target":
        return (
          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            <Target size={14} />
            {isExpense ? "On budget" : "On target"}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <PermissionGuard permission="budgets.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href="/budget" className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft size={18} />
            Back to Budgets
          </Link>

          <div className="flex items-center gap-2">
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-gray-100 text-gray-600">
                <Lock size={16} />
                Read-only
              </span>
            ) : (
              <>
                {budget?.status === 'draft' && pagePermissions.canUpdate && (
                  <button
                    type="button"
                    onClick={() => handleAction('activate')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
                {budget?.status === 'active' && pagePermissions.canUpdate && (
                  <button
                    type="button"
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                )}
                {budget?.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => handleAction('close')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Lock size={16} />
                    Close
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-md text-green-700 flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-10 flex items-center justify-center text-gray-600">
            <Loader2 size={24} className="animate-spin mr-2 text-green-600" />
            Loading budget...
          </div>
        ) : error && !budget ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            {error}
          </div>
        ) : (
          <>
            {/* Budget Overview */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {budget?.name || (isExpense ? "Expense budget" : "Revenue budget")}
                    </h1>
                    {isLocked && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                        <Lock size={12} />
                        Locked
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      budget?.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                      budget?.status === 'active' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      budget?.status === 'closed' ? 'bg-gray-100 text-gray-600 border border-gray-300' :
                      'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                      {budget?.status || 'draft'}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {budget?.periodType}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      {safeDate(budget?.startDate)} → {safeDate(budget?.endDate)}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="inline-flex items-center gap-1">
                      <DollarSign size={14} className="text-gray-400" />
                      {budget?.currency || 'MWK'}
                    </span>
                  </div>
                  {budget?.description && (
                    <p className="text-sm text-gray-700 mt-3">{budget.description}</p>
                  )}
                </div>
                
                {/* Quick stats */}
                <div className="flex flex-wrap gap-3">
                  {comparison && getStatusBadge(status)}
                </div>
              </div>
            </div>

            {/* Main Comparison Cards */}
            {comparison && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Budgeted */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Target size={18} className="text-blue-600" />
                    <span className="text-sm font-medium">
                      {isExpense ? "Budgeted expense" : "Budgeted revenue"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(budgetedAmount)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isExpense ? "Planned spending for the period" : "Expected revenue for the period"}
                  </div>
                </div>

                {/* Actual */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <DollarSign size={18} className="text-green-600" />
                    <span className="text-sm font-medium">
                      {isExpense ? "Actual expense" : "Actual revenue"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{formatCurrency(actualAmount)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isExpense ? "Posted to expense accounts in period" : "Revenue achieved so far"}
                  </div>
                </div>

                {/* Variance */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    {isExpense ? (
                      variance > 0 ? (
                        <TrendingUp size={18} className="text-red-600" />
                      ) : (
                        <TrendingDown size={18} className="text-green-600" />
                      )
                    ) : variance >= 0 ? (
                      <TrendingUp size={18} className="text-green-600" />
                    ) : (
                      <TrendingDown size={18} className="text-red-600" />
                    )}
                    <span className="text-sm font-medium">Variance</span>
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      isExpense
                        ? variance > 0
                          ? "text-red-600"
                          : variance < 0
                            ? "text-green-600"
                            : "text-gray-900"
                        : variance >= 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {variance >= 0 ? "+" : ""}
                    {formatCurrency(variance)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isExpense
                      ? variance > 0
                        ? "Over budget (unfavorable)"
                        : variance < 0
                          ? "Under budget (favorable)"
                          : "On budget"
                      : variance >= 0
                        ? "Over target"
                        : "Under target"}
                  </div>
                </div>

                {/* Achievement */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Percent size={18} className="text-purple-600" />
                    <span className="text-sm font-medium">
                      {isExpense ? "% of budget used" : "Achievement"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{achievement.toFixed(1)}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full ${
                        isExpense
                          ? achievement <= 100
                            ? "bg-blue-500"
                            : "bg-red-500"
                          : achievement >= 100
                            ? "bg-green-500"
                            : achievement >= 80
                              ? "bg-blue-500"
                              : achievement >= 50
                                ? "bg-yellow-500"
                                : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(achievement, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Charts Row */}
            {comparison && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Budget vs Actual Chart */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-600" />
                    Budget vs Actual
                  </h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                        <Tooltip formatter={(v) => formatCurrency(v)} />
                        <Legend />
                        <Bar dataKey="value" name="Amount" fill="#3b82f6">
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Breakdown Chart */}
                {breakdownData.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart3 size={18} className="text-purple-600" />
                      Breakdown by {breakdownSectionTitle}
                    </h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={breakdownData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                          <Bar dataKey="actual" name="Actual" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {isExpense && expenseLineChartData.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 lg:col-span-2">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart3 size={18} className="text-orange-600" />
                      Expense lines: budget vs actual
                    </h3>
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expenseLineChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                          <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="budgeted" name="Budgeted" fill="#3b82f6" />
                          <Bar dataKey="actual" name="Actual" fill="#f97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Breakdowns Table */}
            {comparison?.breakdowns?.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Budget Breakdown Details</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Reference</th>
                        <th className="text-left px-4 py-3 font-medium">Type</th>
                        <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                        <th className="text-right px-4 py-3 font-medium">Actual</th>
                        <th className="text-right px-4 py-3 font-medium">Variance</th>
                        <th className="text-right px-4 py-3 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {comparison.breakdowns.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {item.referenceName}
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">
                            {item.breakdownType === "branch"
                              ? "Branch"
                              : item.breakdownType === "product_category"
                                ? "Inventory category"
                                : "Category"}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.budgetedAmount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.actualAmount || 0)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance || 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {item.variancePercent?.toFixed(1) || '0.0'}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isExpense && expenseLines.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Expense lines — variance</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Budget vs posted GL per expense account. Positive variance means over budget.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Account</th>
                        <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                        <th className="text-right px-4 py-3 font-medium">Actual</th>
                        <th className="text-right px-4 py-3 font-medium">Variance</th>
                        <th className="text-right px-4 py-3 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {expenseLines.map((row) => (
                        <tr key={row.accountId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {row.accountCode ? `${row.accountCode} — ${row.accountName}` : row.accountName}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.budgetedAmount)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.actualAmount)}</td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              row.variance > 0 ? "text-red-600" : row.variance < 0 ? "text-green-600" : "text-gray-700"
                            }`}
                          >
                            {row.variance >= 0 ? "+" : ""}
                            {formatCurrency(row.variance)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {Number(row.variancePercent || 0).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Approval Info */}
            {comparison?.approvedBy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-blue-800 font-medium">
                  <CheckCircle size={18} />
                  Approved by {comparison.approvedBy.name}
                </div>
                <div className="text-sm text-blue-600 mt-1">
                  {comparison.approvedBy.email}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
