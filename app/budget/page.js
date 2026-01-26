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
  Info,
  DollarSign,
  TrendingUp,
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
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [pagePermissions, setPagePermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});

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

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);
      setError(null);
      const res = await fetch("/api/categories?type=expense", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load expense categories");
      setCategoryOptions(json?.categories || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  useEffect(() => {
    const fetchPermissions = async () => {
      setPermissionsLoading(true);
      try {
        const canCreate = await getPermission("budgets.create");
        const canUpdate = await getPermission("budgets.update");
        const canDelete = await getPermission("budgets.delete");
        setPagePermissions({ canCreate, canUpdate, canDelete });
      } finally {
        setPermissionsLoading(false);
      }
    };
    fetchPermissions();
  }, []);

  const resetCreate = () => {
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setShowCreate(false);
  };

  const calculateTotalBudget = () => {
    return (form.items || [])
      .filter((i) => i.category && i.budgetedAmount)
      .reduce((sum, i) => sum + (Number(i.budgetedAmount) || 0), 0);
  };

  const addCommonCategories = () => {
    const commonCategories = ["Rent", "Utilities", "Office Supplies", "Professional Services", "Marketing"];
    const existingCategories = form.items.map(i => i.category).filter(Boolean);
    const toAdd = commonCategories.filter(cat => !existingCategories.includes(cat));
    
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        ...toAdd.map(cat => ({
          category: cat,
          budgetedAmount: "",
          notes: "",
        }))
      ],
    }));
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          category: "",
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
    if (!pagePermissions.canCreate) {
      setError("You don't have permission to create budgets. Please contact your administrator.");
      return;
    }
    setShowCreate(true);
    if (categoryOptions.length === 0) {
      await loadCategories();
    }
    if (form.items.length === 0) addItem();
  };

  const validateForm = () => {
    const errors = {};
    
    if (!form.name?.trim()) {
      errors.name = "Budget name is required";
    }
    
    if (!form.startDate) {
      errors.startDate = "Start date is required";
    }
    
    if (!form.endDate) {
      errors.endDate = "End date is required";
    }
    
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      errors.endDate = "End date must be after start date";
    }
    
    const validItems = (form.items || []).filter((i) => 
      i.category && 
      i.budgetedAmount !== "" && 
      i.budgetedAmount !== null && 
      i.budgetedAmount !== undefined &&
      Number(i.budgetedAmount) > 0
    );
    
    if (validItems.length === 0) {
      errors.items = "Add at least one budget line with a valid amount";
    }
    
    // Validate individual items
    form.items?.forEach((item, idx) => {
      if (!item.category && (item.budgetedAmount || item.notes)) {
        errors[`item_${idx}_selection`] = "Select a category";
      }
      if (item.category && (!item.budgetedAmount || Number(item.budgetedAmount) <= 0)) {
        errors[`item_${idx}_amount`] = "Enter a valid budgeted amount";
      }
    });
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      setFormErrors({});

      if (!validateForm()) {
        throw new Error("Please fix the form errors before submitting.");
      }

      const cleanItems = (form.items || [])
        .filter((i) => i.category && i.budgetedAmount !== "" && i.budgetedAmount !== null && i.budgetedAmount !== undefined)
        .map((i) => ({
          category: i.category || null,
          // Backend expects a 'period' per item; for annual budgets we store at start date.
          period: form.startDate,
          budgetedAmount: Number(i.budgetedAmount),
          notes: i.notes || null,
        }));

      if (cleanItems.length === 0) {
        throw new Error("Add at least one budget line (category) with an amount.");
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
          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={permissionsLoading || !pagePermissions.canCreate}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              permissionsLoading
                ? "bg-gray-400 text-white cursor-wait"
                : pagePermissions.canCreate
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            title={
              permissionsLoading
                ? "Loading permissions..."
                : !pagePermissions.canCreate
                ? "You don't have permission to create budgets"
                : ""
            }
          >
            {permissionsLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Create New Budget
          </button>
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={resetCreate}>
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
                  <div className="p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Create New Budget</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Plan your finances by setting budgeted amounts for expense categories.</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0" onClick={resetCreate}>
                  <X size={22} />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-6">
                {/* Budget Summary Card */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="text-blue-600" size={20} />
                      <span className="text-sm font-medium text-gray-700">Total Budgeted:</span>
                    </div>
                    <span className="text-xl font-bold text-blue-700">{formatCurrency(calculateTotalBudget())}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {form.items?.filter((i) => i.category && i.budgetedAmount).length || 0} budget line(s) configured
                  </div>
                </div>

                {/* Basic Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Info size={16} className="text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Budget Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, name: e.target.value }));
                          if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: null }));
                        }}
                        placeholder="e.g., 2026 Operating Budget"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.name ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.name && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                      )}
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
                        Budget amounts are for the entire period.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, startDate: e.target.value }));
                          if (formErrors.startDate) setFormErrors((prev) => ({ ...prev, startDate: null, endDate: null }));
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.startDate ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.startDate && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.startDate}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.endDate}
                        min={form.startDate || undefined}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, endDate: e.target.value }));
                          if (formErrors.endDate) setFormErrors((prev) => ({ ...prev, endDate: null }));
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.endDate ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.endDate && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.endDate}</p>
                      )}
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
                </div>

                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingUp size={18} className="text-blue-600" />
                          Budget Lines
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Create budgets by expense category (e.g., "Rent", "Utilities").</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={addCommonCategories}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm"
                          title="Add common expense categories"
                        >
                          <Plus size={14} />
                          <span className="hidden sm:inline">Quick Add</span>
                        </button>
                        <button
                          type="button"
                          onClick={addItem}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <Plus size={16} />
                          <span className="hidden sm:inline">Add Line</span>
                          <span className="sm:hidden">Add</span>
                        </button>
                      </div>
                    </div>
                    
                  </div>

                  {categoriesLoading ? (
                    <div className="p-6 text-gray-600 flex items-center">
                      <Loader2 size={18} className="animate-spin mr-2 text-blue-600" />
                      Loading options...
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {(form.items || [])
                        .map((it, idx) => {
                          const hasError = formErrors[`item_${idx}_selection`] || formErrors[`item_${idx}_amount`];
                          
                          return (
                            <div key={idx} className={`p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 ${hasError ? "bg-red-50/30" : ""}`}>
                              <div className="sm:col-span-5">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={it.category || ""}
                                  onChange={(e) => {
                                    updateItem(idx, { category: e.target.value });
                                    if (formErrors[`item_${idx}_selection`]) {
                                      setFormErrors((prev) => ({ ...prev, [`item_${idx}_selection`]: null }));
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                    formErrors[`item_${idx}_selection`] ? "border-red-300 bg-red-50" : "border-gray-300"
                                  }`}
                                >
                                  <option value="">Select category...</option>
                                  {categoryOptions.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                                {formErrors[`item_${idx}_selection`] && (
                                  <p className="text-xs text-red-600 mt-1">{formErrors[`item_${idx}_selection`]}</p>
                                )}
                                {it.category && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <span className="inline-flex items-center gap-1 text-green-600">
                                      <CheckCircle size={12} />
                                      Category: {it.category}
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Budgeted Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={it.budgetedAmount}
                                  onChange={(e) => {
                                    updateItem(idx, { budgetedAmount: e.target.value });
                                    if (formErrors[`item_${idx}_amount`]) {
                                      setFormErrors((prev) => ({ ...prev, [`item_${idx}_amount`]: null }));
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                    formErrors[`item_${idx}_amount`] ? "border-red-300 bg-red-50" : "border-gray-300"
                                  }`}
                                  placeholder="0.00"
                                />
                                {formErrors[`item_${idx}_amount`] && (
                                  <p className="text-xs text-red-600 mt-1">{formErrors[`item_${idx}_amount`]}</p>
                                )}
                                {it.budgetedAmount !== "" && !Number.isNaN(Number(it.budgetedAmount)) && Number(it.budgetedAmount) > 0 && (
                                  <div className="text-xs text-green-600 mt-1 font-medium">{formatCurrency(Number(it.budgetedAmount))}</div>
                                )}
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                <input
                                  value={it.notes}
                                  onChange={(e) => updateItem(idx, { notes: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Optional notes"
                                />
                              </div>

                              <div className="sm:col-span-1 flex sm:justify-end items-end">
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="w-full sm:w-auto px-3 py-2 rounded-md border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                                  title="Remove this budget line"
                                >
                                  <span className="sm:hidden">Remove</span>
                                  <X size={16} className="hidden sm:inline" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {form.items?.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          <p className="text-sm">No budget lines yet.</p>
                          <button
                            type="button"
                            onClick={addItem}
                            className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            Add your first budget line
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {formErrors.items && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle size={16} />
                        {formErrors.items}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Total Budgeted:</span>{" "}
                    <span className="text-lg font-bold text-blue-700">{formatCurrency(calculateTotalBudget())}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {form.items?.filter((i) => i.category && i.budgetedAmount).length || 0} valid line(s)
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={resetCreate}
                    className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
                    disabled={creating || calculateTotalBudget() === 0}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Create Budget
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}


