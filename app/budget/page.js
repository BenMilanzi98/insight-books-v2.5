"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Calendar,
  CheckCircle,
  XCircle,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

const DEFAULT_FORM = {
  name: "",
  description: "",
  periodType: "annual",
  startDate: "",
  endDate: "",
  items: [],
};

export default function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [budgets, setBudgets] = useState([]);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [pagePermissions, setPagePermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });

  const [form, setForm] = useState(DEFAULT_FORM);

  const filteredBudgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return budgets;
    return budgets.filter((b) => (b?.name || "").toLowerCase().includes(q));
  }, [budgets, search]);

  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/budgets", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load budgets");
      setBudgets(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      setAccountsLoading(true);
      setError(null);
      // Align with Payment Processing “main accounts” (payment method mappings -> COA asset accounts)
      const res = await fetch("/api/payments/method-mappings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load payment accounts");
      setAccountOptions(json?.mappings || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  useEffect(() => {
    const fetchPermissions = async () => {
      const canCreate = await getPermission("budgets.create");
      const canUpdate = await getPermission("budgets.update");
      const canDelete = await getPermission("budgets.delete");
      setPagePermissions({ canCreate, canUpdate, canDelete });
    };
    fetchPermissions();
  }, []);

  const resetCreate = () => {
    setForm(DEFAULT_FORM);
    setShowCreate(false);
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          accountId: "",
          budgetedAmount: "",
          notes: "",
        },
      ],
    }));
  };

  const removeItem = (idx) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const updateItem = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const handleOpenCreate = async () => {
    setShowCreate(true);
    if (accountOptions.length === 0) {
      await loadAccounts();
    }
    if (form.items.length === 0) addItem();
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);

      if (!form.name || !form.startDate || !form.endDate) {
        throw new Error("Budget Name, Start Date, and End Date are required.");
      }

      const cleanItems = (form.items || [])
        .filter((i) => i.accountId && i.budgetedAmount !== "" && i.budgetedAmount !== null && i.budgetedAmount !== undefined)
        .map((i) => ({
          accountId: i.accountId,
          // Backend expects a 'period' per item; for annual budgets we store at start date.
          period: form.startDate,
          budgetedAmount: Number(i.budgetedAmount),
          notes: i.notes || null,
        }));

      if (cleanItems.length === 0) {
        throw new Error("Add at least one budget category with an amount.");
      }

      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          periodType: form.periodType || "annual",
          startDate: form.startDate,
          endDate: form.endDate,
          items: cleanItems,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create budget");

      resetCreate();
      await loadBudgets();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBudget = async (budget) => {
    try {
      if (!pagePermissions.canDelete) return;
      if (budget?.status === "approved" || budget?.status === "active") {
        throw new Error("Cannot delete approved/active budgets. Archive them instead.");
      }
      const ok = window.confirm(`Delete budget "${budget?.name}"? This cannot be undone.`);
      if (!ok) return;

      const res = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete budget");
      await loadBudgets();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <PermissionGuard permission="budgets.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budgeting</h1>
            <p className="text-sm text-gray-600">
              Plan, monitor, and control finances by comparing budgets with actual transactions.
            </p>
          </div>
          {pagePermissions.canCreate && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Create New Budget
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search budgets..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={loadBudgets}
              className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-600">
              <Loader2 size={24} className="animate-spin mr-2 text-blue-600" />
              Loading budgets...
            </div>
          ) : filteredBudgets.length === 0 ? (
            <div className="p-10 text-center text-gray-600">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <Calendar size={22} className="text-blue-600" />
              </div>
              <div className="font-medium text-gray-800">No budgets found</div>
              <div className="text-sm text-gray-500 mt-1">Create your first budget to start tracking variance.</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredBudgets.map((b) => (
                <div key={b.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/budget/${b.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{b.name}</span>
                        {b.status === "approved" || b.status === "active" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle size={14} />
                            {b.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                            <XCircle size={14} />
                            {b.status || "draft"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(b.startDate).toISOString().slice(0, 10)} → {new Date(b.endDate).toISOString().slice(0, 10)}
                        <span className="mx-2">•</span>
                        {b.items?.length || 0} lines
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      {pagePermissions.canDelete && !(b.status === "approved" || b.status === "active") && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBudget(b)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                          title="Delete budget"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                      <Link
                        href={`/budget/${b.id}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        View
                        <ChevronRight size={16} className="text-gray-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={resetCreate}>
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Create New Budget</h2>
                  <p className="text-sm text-gray-600">Set budgeted amounts per COA income/expense account.</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={resetCreate}>
                  <X size={22} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(85vh-140px)] space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget Name *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., 2026 Operating Budget"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
                    <select
                      value={form.periodType}
                      onChange={(e) => setForm((p) => ({ ...p, periodType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="annual">Annual</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      For now, amounts are stored as total for the full period.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Description</label>
                    <textarea
                      rows={2}
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Optional: budgeting assumptions, plan notes, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Budget Categories</h3>
                      <p className="text-xs text-gray-500">Map each budget line to a COA account.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <Plus size={16} />
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
                      {(form.items || []).map((it, idx) => (
                        <div key={idx} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Account *</label>
                            <select
                              value={it.accountId}
                              onChange={(e) => updateItem(idx, { accountId: e.target.value })}
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
                              onChange={(e) => updateItem(idx, { budgetedAmount: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="0.00"
                            />
                            {it.budgetedAmount !== "" && !Number.isNaN(Number(it.budgetedAmount)) && (
                              <div className="text-xs text-gray-500 mt-1">{formatCurrency(Number(it.budgetedAmount))}</div>
                            )}
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                            <input
                              value={it.notes}
                              onChange={(e) => updateItem(idx, { notes: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Optional justification"
                            />
                          </div>

                          <div className="md:col-span-1 flex md:justify-end items-end">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
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
                  onClick={resetCreate}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Create Budget
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}


