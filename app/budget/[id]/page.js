"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  X,
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
} from "recharts";

function safeDate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function BudgetDetailsPage() {
  const params = useParams();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [budget, setBudget] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [asOfDate, setAsOfDate] = useState("");
  const [pagePermissions, setPagePermissions] = useState({
    canUpdate: false,
    canDelete: false,
  });
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    periodType: "annual",
    startDate: "",
    endDate: "",
    items: [],
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bRes, cRes] = await Promise.all([
        fetch(`/api/budgets/${id}`, { cache: "no-store" }),
        fetch(`/api/budgets/${id}/vs-actual${asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : ""}`, {
          cache: "no-store",
        }),
      ]);

      const bJson = await bRes.json();
      if (!bRes.ok) throw new Error(bJson?.error || "Failed to load budget");
      setBudget(bJson?.data || null);

      const cJson = await cRes.json();
      if (!cRes.ok) throw new Error(cJson?.error || "Failed to load budget comparison");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const fetchPermissions = async () => {
      const canUpdate = await getPermission("budgets.update");
      const canDelete = await getPermission("budgets.delete");
      setPagePermissions({ canUpdate, canDelete });
    };
    fetchPermissions();
  }, []);

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      const res = await fetch("/api/payments/method-mappings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load payment accounts");
      setAccountOptions(json?.mappings || []);
    } finally {
      setAccountsLoading(false);
    }
  };

  const canEditOrDelete = (budget?.status !== "approved" && budget?.status !== "active");

  const openEdit = async () => {
    setError(null);
    if (accountOptions.length === 0) await loadAccounts();
    const source = comparison?.budget || budget;
    setEditForm({
      name: source?.name || "",
      description: source?.description || "",
      periodType: source?.periodType || "annual",
      startDate: safeDate(source?.startDate),
      endDate: safeDate(source?.endDate),
      items: (source?.items || []).map((it) => ({
        id: it.id,
        accountId: it.accountId,
        budgetedAmount: String(it.budgetedAmount ?? ""),
        notes: it.notes || "",
      })),
    });
    if ((source?.items || []).length === 0) {
      setEditForm((p) => ({ ...p, items: [{ accountId: "", budgetedAmount: "", notes: "" }] }));
    }
    setShowEdit(true);
  };

  const updateEditItem = (idx, patch) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const addEditItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, { accountId: "", budgetedAmount: "", notes: "" }],
    }));
  };

  const removeEditItem = (idx) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const saveEdit = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!editForm.name || !editForm.startDate || !editForm.endDate) {
        throw new Error("Budget Name, Start Date, and End Date are required.");
      }
      const items = (editForm.items || [])
        .filter((i) => i.accountId && i.budgetedAmount !== "")
        .map((i) => ({
          accountId: i.accountId,
          period: editForm.startDate,
          budgetedAmount: Number(i.budgetedAmount),
          notes: i.notes || null,
        }));
      if (items.length === 0) throw new Error("Add at least one budget line.");

      const res = await fetch(`/api/budgets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          periodType: editForm.periodType || "annual",
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update budget");

      setShowEdit(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteBudget = async () => {
    try {
      setError(null);
      if (!pagePermissions.canDelete) return;
      if (!canEditOrDelete) throw new Error("Cannot delete approved/active budgets.");
      const ok = window.confirm(`Delete budget "${budget?.name}"? This cannot be undone.`);
      if (!ok) return;

      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete budget");
      window.location.href = "/budget";
    } catch (e) {
      setError(e.message);
    }
  };

  const lines = useMemo(() => {
    const items = comparison?.budget?.items || budget?.items || [];
    return items.map((it) => {
      const accountName =
        it?.account?.accountName ||
        it?.accountName ||
        "Account";
      const accountType =
        it?.account?.accountType ||
        it?.accountType ||
        "";
      const budgeted = Number(it?.budgetedAmount || 0);
      const actual = Number(it?.actualAmount || 0);
      const variance = Number(it?.variance ?? (budgeted - actual));
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;
      const isOverBudget = accountType === "Expense" ? actual > budgeted : false;
      const isUnderTarget = accountType === "Income" ? actual < budgeted : false;
      return {
        id: it.id,
        accountType,
        accountName,
        budgeted,
        actual,
        variance,
        variancePercent,
        isOverBudget,
        isUnderTarget,
      };
    });
  }, [comparison, budget]);

  const alerts = useMemo(() => {
    const over = lines.filter((l) => l.isOverBudget);
    const underIncome = lines.filter((l) => l.isUnderTarget);
    return {
      over,
      underIncome,
    };
  }, [lines]);

  const chartData = useMemo(() => {
    // Keep the chart readable: top 12 by absolute variance
    return [...lines]
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 12)
      .map((l) => ({
        name: l.accountName.length > 18 ? `${l.accountName.slice(0, 18)}…` : l.accountName,
        budgeted: l.budgeted,
        actual: l.actual,
        variance: l.variance,
      }));
  }, [lines]);

  const summary = comparison?.summary;

  return (
    <PermissionGuard permission="budgets.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link href="/budget" className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
            <ArrowLeft size={18} />
            Back to Budgets
          </Link>

          <div className="flex items-center gap-2">
            {pagePermissions.canUpdate && canEditOrDelete && (
              <button
                type="button"
                onClick={openEdit}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={16} />
                Edit
              </button>
            )}
            {pagePermissions.canDelete && canEditOrDelete && (
              <button
                type="button"
                onClick={deleteBudget}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-10 flex items-center justify-center text-gray-600">
            <Loader2 size={24} className="animate-spin mr-2 text-blue-600" />
            Loading budget...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{budget?.name || "Budget"}</h1>
                  <div className="text-sm text-gray-600 mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      {safeDate(budget?.startDate)} → {safeDate(budget?.endDate)}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="capitalize">{budget?.status || "draft"}</span>
                  </div>
                  {budget?.description && (
                    <div className="text-sm text-gray-700 mt-3">{budget.description}</div>
                  )}
                </div>

                <div className="min-w-[260px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">As of date (optional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={load}
                      className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      title="Apply"
                    >
                      Apply
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Compares actual transactions up to this date.
                  </div>
                </div>
              </div>
            </div>

            {(alerts.over.length > 0 || alerts.underIncome.length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
                <div className="flex items-center gap-2 text-amber-900 font-semibold mb-2">
                  <AlertTriangle size={18} />
                  Alerts
                </div>
                <div className="text-sm text-amber-800 space-y-2">
                  {alerts.over.length > 0 && (
                    <div>
                      <span className="font-medium">Over budget (Expenses):</span>{" "}
                      {alerts.over.slice(0, 5).map((l) => l.accountName).join(", ")}
                      {alerts.over.length > 5 ? ` (+${alerts.over.length - 5} more)` : ""}
                    </div>
                  )}
                  {alerts.underIncome.length > 0 && (
                    <div>
                      <span className="font-medium">Under target (Income):</span>{" "}
                      {alerts.underIncome.slice(0, 5).map((l) => l.accountName).join(", ")}
                      {alerts.underIncome.length > 5 ? ` (+${alerts.underIncome.length - 5} more)` : ""}
                    </div>
                  )}
                </div>
              </div>
            )}

            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase font-medium mb-1">Income (Budget vs Actual)</div>
                  <div className="text-sm text-gray-700">
                    Budget: <span className="font-semibold">{formatCurrency(summary?.income?.budgeted || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Actual: <span className="font-semibold">{formatCurrency(summary?.income?.actual || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Variance:{" "}
                    <span className="font-semibold">{formatCurrency(summary?.income?.variance || 0)}</span>{" "}
                    <span className="text-xs text-gray-500">({(summary?.income?.variancePercent || 0).toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase font-medium mb-1">Expenses (Budget vs Actual)</div>
                  <div className="text-sm text-gray-700">
                    Budget: <span className="font-semibold">{formatCurrency(summary?.expense?.budgeted || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Actual: <span className="font-semibold">{formatCurrency(summary?.expense?.actual || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Variance:{" "}
                    <span className="font-semibold">{formatCurrency(summary?.expense?.variance || 0)}</span>{" "}
                    <span className="text-xs text-gray-500">({(summary?.expense?.variancePercent || 0).toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase font-medium mb-1">Total</div>
                  <div className="text-sm text-gray-700">
                    Budget: <span className="font-semibold">{formatCurrency(summary?.total?.budgeted || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Actual: <span className="font-semibold">{formatCurrency(summary?.total?.actual || 0)}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Variance:{" "}
                    <span className="font-semibold">{formatCurrency(summary?.total?.variance || 0)}</span>{" "}
                    <span className="text-xs text-gray-500">({(summary?.total?.variancePercent || 0).toFixed(1)}%)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-gray-900">Budget vs Actual (Top Variances)</div>
                <div className="inline-flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle size={14} className="text-green-600" />
                  Variance = Budgeted − Actual
                </div>
              </div>
              {chartData.length === 0 ? (
                <div className="p-6 text-center text-gray-600">No budget lines to chart.</div>
              ) : (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={70} />
                      <YAxis tickFormatter={(v) => formatCurrency(v).replace("MWK ", "")} />
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="budgeted" fill="#2563eb" name="Budgeted" />
                      <Bar dataKey="actual" fill="#dc2626" name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Budget vs Actual Details</div>
                <div className="text-xs text-gray-500">{lines.length} lines</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Category</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Budgeted</th>
                      <th className="text-right px-4 py-3 font-medium">Actual</th>
                      <th className="text-right px-4 py-3 font-medium">Variance</th>
                      <th className="text-right px-4 py-3 font-medium">Variance %</th>
                      <th className="text-left px-4 py-3 font-medium">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lines.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{l.accountName}</td>
                        <td className="px-4 py-3 text-gray-700">{l.accountType}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(l.budgeted)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(l.actual)}</td>
                        <td className={`px-4 py-3 text-right ${l.variance < 0 ? "text-red-600" : "text-green-700"}`}>
                          {formatCurrency(l.variance)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {l.budgeted > 0 ? `${l.variancePercent.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {l.isOverBudget ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle size={14} />
                              Over budget
                            </span>
                          ) : l.isUnderTarget ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle size={14} />
                              Under target
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {showEdit && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEdit(false)}>
                <div
                  className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Edit Budget</h2>
                      <p className="text-sm text-gray-600">Update budget details and lines.</p>
                    </div>
                    <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowEdit(false)}>
                      <X size={22} />
                    </button>
                  </div>

                  <div className="p-5 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Budget Name *</label>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
                        <select
                          value={editForm.periodType}
                          onChange={(e) => setEditForm((p) => ({ ...p, periodType: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="annual">Annual</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                        <input
                          type="date"
                          value={editForm.startDate}
                          onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                        <input
                          type="date"
                          value={editForm.endDate}
                          onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Description</label>
                        <textarea
                          rows={2}
                          value={editForm.description}
                          onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg">
                      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">Budget Lines</h3>
                          <p className="text-xs text-gray-500">Uses the same “main accounts” as Payment Processing.</p>
                        </div>
                        <button
                          type="button"
                          onClick={addEditItem}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          Add Line
                        </button>
                      </div>

                      {accountsLoading ? (
                        <div className="p-6 text-gray-600 flex items-center">
                          <Loader2 size={18} className="animate-spin mr-2 text-blue-600" />
                          Loading accounts...
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {(editForm.items || []).map((it, idx) => (
                            <div key={idx} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                              <div className="md:col-span-5">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Account *</label>
                                <select
                                  value={it.accountId}
                                  onChange={(e) => updateEditItem(idx, { accountId: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select account...</option>
                                  {accountOptions.map((m) => (
                                    <option key={m.paymentMethod} value={m.accountId || ""} disabled={!m.accountId}>
                                      {m.paymentMethodName}
                                      {m.accountCode ? ` (${m.accountCode})` : ""}
                                      {!m.isConfigured ? " (not configured)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Budgeted Amount *</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={it.budgetedAmount}
                                  onChange={(e) => updateEditItem(idx, { budgetedAmount: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                <input
                                  value={it.notes}
                                  onChange={(e) => updateEditItem(idx, { notes: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Optional justification"
                                />
                              </div>

                              <div className="md:col-span-1 flex md:justify-end items-end">
                                <button
                                  type="button"
                                  onClick={() => removeEditItem(idx)}
                                  className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowEdit(false)}
                      className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      disabled={saving}
                    >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionGuard>
  );
}


