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
  TrendingDown,
  BarChart3,
  Lock,
  Unlock,
  Filter,
  RefreshCw
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

const DEFAULT_FORM = {
  name: "",
  description: "",
  budgetType: "revenue",
  periodType: "monthly",
  startDate: "",
  endDate: "",
  expectedRevenue: "",
  breakdowns: [],
  items: [],
};

export default function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [budgets, setBudgets] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [budgetTypeFilter, setBudgetTypeFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [branchOptions, setBranchOptions] = useState([]);
  const [expenseAccountOptions, setExpenseAccountOptions] = useState([]);
  const [inventoryCategoryOptions, setInventoryCategoryOptions] = useState([]);
  const [pagePermissions, setPagePermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});

  // Filter and search
  const filteredBudgets = useMemo(() => {
    let result = budgets;
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(b => b.status === statusFilter);
    }
    
    // Apply period type filter
    if (periodFilter) {
      result = result.filter(b => b.periodType === periodFilter);
    }

    if (budgetTypeFilter) {
      result = result.filter(b => (b.budgetType || "revenue") === budgetTypeFilter);
    }
    
    // Apply search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(b => 
        (b?.name || "").toLowerCase().includes(q) ||
        (b?.description || "").toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [budgets, search, statusFilter, periodFilter]);

  // Load budgets
  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (periodFilter) params.set('periodType', periodFilter);
      if (budgetTypeFilter) params.set('budgetType', budgetTypeFilter);
      
      const res = await fetch(`/api/budgets?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load budgets");
      setBudgets(json?.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load options for budget creation
  const loadOptions = async () => {
    try {
      setOptionsLoading(true);
      const res = await fetch("/api/budgets", { 
        method: "OPTIONS",
        cache: "no-store" 
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        setBranchOptions(json.data.branches || []);
        const expense = json.data.expenseAccounts || json.data.categories || [];
        setExpenseAccountOptions(expense);
        setInventoryCategoryOptions(json.data.inventoryCategories || []);
      } else {
        // Fallback: load expense accounts directly (some environments block OPTIONS via access controls)
        const catRes = await fetch("/api/categories?type=expense", { cache: "no-store" });
        const catJson = await catRes.json().catch(() => ({}));
        if (catRes.ok) {
          setExpenseAccountOptions(catJson.categories || []);
        } else {
          console.warn("Budget options failed:", catJson?.error || catRes.statusText);
        }
      }
    } catch (e) {
      console.error("Error loading options:", e);
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [statusFilter, periodFilter, budgetTypeFilter]);

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

  const calculateBreakdownTotal = () => {
    return (form.breakdowns || [])
      .reduce((sum, item) => sum + (Number(item.budgetedAmount) || 0), 0);
  };

  // Budget Line Items functions
  const calculateLineItemsTotal = () => {
    return (form.items || [])
      .reduce((sum, item) => sum + (Number(item.budgetedAmount) || 0), 0);
  };

  const addLineItem = () => {
    const newItem = {
      lineNumber: (form.items?.length || 0) + 1,
      accountId: "",
      description: "",
      period: form.startDate || new Date().toISOString().split('T')[0],
      budgetedAmount: ""
    };
    
    setForm((prev) => ({
      ...prev,
      items: [...(prev.items || []), newItem]
    }));
  };

  const removeLineItem = (idx) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateLineItem = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === idx) {
          return { ...item, ...patch };
        }
        return item;
      })
    }));
  };

  const breakdownOptionsFor = (type) =>
    type === 'branch' ? branchOptions : inventoryCategoryOptions;

  const addBreakdown = (type) => {
    const options = breakdownOptionsFor(type);
    const existingIds = (form.breakdowns || [])
      .filter(b => b.breakdownType === type)
      .map(b => b.referenceId);

    const available = options.filter(opt => !existingIds.includes(opt.id));
    
    if (available.length === 0) return;

    const newBreakdown = {
      breakdownType: type,
      referenceId: available[0].id,
      referenceName: available[0].name,
      budgetedAmount: ""
    };

    setForm((prev) => ({
      ...prev,
      breakdowns: [...(prev.breakdowns || []), newBreakdown]
    }));
  };

  const removeBreakdown = (idx) => {
    setForm((prev) => ({
      ...prev,
      breakdowns: prev.breakdowns.filter((_, i) => i !== idx)
    }));
  };

  const updateBreakdown = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      breakdowns: prev.breakdowns.map((item, i) => {
        if (i === idx) {
          if (patch.referenceId) {
            const options = breakdownOptionsFor(item.breakdownType);
            const selected = options.find((opt) => opt.id === patch.referenceId);
            return { ...item, ...patch, referenceName: selected?.name || item.referenceName };
          }
          return { ...item, ...patch };
        }
        return item;
      })
    }));
  };

  const handleOpenCreate = async () => {
    if (!pagePermissions.canCreate) {
      setError("You don't have permission to create budgets. Please contact your administrator.");
      return;
    }
    setShowCreate(true);
    if (
      branchOptions.length === 0 ||
      expenseAccountOptions.length === 0
    ) {
      await loadOptions();
    }
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
    
    if (!form.expectedRevenue || Number(form.expectedRevenue) <= 0) {
      errors.expectedRevenue = form.budgetType === "expense"
        ? "Expected expense must be greater than zero"
        : "Expected revenue must be greater than zero";
    }
    
    if (form.budgetType === "revenue" && form.breakdowns && form.breakdowns.length > 0) {
      form.breakdowns.forEach((item, idx) => {
        if (!item.budgetedAmount || Number(item.budgetedAmount) <= 0) {
          errors[`breakdown_${idx}_amount`] = "Enter a valid amount";
        }
      });
    }
    
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

      const breakdowns = (form.breakdowns || [])
        .filter(item => item.budgetedAmount && Number(item.budgetedAmount) > 0)
        .map(item => ({
          breakdownType: item.breakdownType,
          referenceId: item.referenceId,
          referenceName: item.referenceName,
          budgetedAmount: Number(item.budgetedAmount)
        }));

      const items = (form.items || [])
        .filter(item => item.budgetedAmount && Number(item.budgetedAmount) > 0)
        .map(item => {
          const account = expenseAccountOptions.find((acc) => acc.id === item.accountId);
          return {
            accountId: item.accountId || null,
            category: account?.name || null,
            description: item.description || null,
            period: item.period,
            budgetedAmount: Number(item.budgetedAmount)
          };
        });

      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
        budgetType: form.budgetType,
          periodType: form.periodType,
          startDate: form.startDate,
          endDate: form.endDate,
          expectedRevenue: Number(form.expectedRevenue),
        breakdowns: form.budgetType === "revenue" && breakdowns.length > 0 ? breakdowns : undefined,
        items: form.budgetType === "expense" && items.length > 0 ? items : undefined
        }),
      });
      const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to create budget");

    setSuccess(form.budgetType === "expense"
      ? "Expense budget created successfully!"
      : "Revenue budget created successfully!");
      setTimeout(() => setSuccess(null), 3000);
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
      if (budget?.isLocked) {
        throw new Error("Cannot delete a locked budget. The budget period has ended.");
      }
      const ok = window.confirm(`Delete budget "${budget?.name}"? This action cannot be undone.`);
      if (!ok) return;

      const res = await fetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete budget");
      
      setSuccess("Budget deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      await loadBudgets();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAction = async (budget, action) => {
    try {
      if (budget.isLocked) {
        throw new Error("Cannot modify a locked budget");
      }

      const res = await fetch(`/api/budgets/${budget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to ${action} budget`);
      
      setSuccess(`Budget ${action}d successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      await loadBudgets();
    } catch (e) {
      setError(e.message);
    }
  };

  // Status badge helper
  const getStatusBadge = (budget) => {
    if (budget.isLocked) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
          <Lock size={12} />
          Locked
        </span>
      );
    }
    
    switch (budget.status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <TrendingUp size={12} />
            Active
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
            Draft
          </span>
        );
    }
  };

  return (
    <PermissionGuard permission="budgets.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
            <p className="text-sm text-gray-600">
              Plan, track, and analyze revenue and expense budgets against actuals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/budget/reports"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <BarChart3 size={18} />
              Reports
            </Link>
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={permissionsLoading || !pagePermissions.canCreate}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                permissionsLoading
                  ? "bg-gray-400 text-white cursor-wait"
                  : pagePermissions.canCreate
                  ? "bg-green-600 text-white hover:bg-green-700"
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
              New Budget
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-700 hover:text-red-900"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 border border-green-200 bg-green-50 rounded-md text-green-700 flex items-center gap-2">
            <CheckCircle size={18} />
            <span>{success}</span>
            <button 
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-700 hover:text-green-900"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search budgets..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="approved">Approved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Periods</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>

              <select
                value={budgetTypeFilter}
                onChange={(e) => setBudgetTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            
            <button
              type="button"
              onClick={loadBudgets}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
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
              <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <DollarSign size={22} className="text-green-600" />
              </div>
              <div className="font-medium text-gray-800">No budgets found</div>
              <div className="text-sm text-gray-500 mt-1">Create your first budget to start forecasting.</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredBudgets.map((b) => (
                <div key={b.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/budget/${b.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{b.name}</span>
                        {getStatusBadge(b)}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          (b.budgetType || "revenue") === "expense"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {(b.budgetType || "revenue") === "expense" ? "Expense" : "Revenue"}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {b.periodType}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                        {b.breakdowns?.length > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            {b.breakdowns.length} breakdown(s)
                          </>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      {b.isLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 px-2 py-1">
                          <Lock size={12} />
                          Read-only
                        </span>
                      ) : (
                        <>
                          {b.status === 'draft' && pagePermissions.canUpdate && (
                            <button
                              type="button"
                              onClick={() => handleAction(b, 'activate')}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                              title="Activate budget"
                            >
                              <Unlock size={12} />
                              Activate
                            </button>
                          )}
                          {/* Approve button hidden - budgets are auto-approved */}
                          {b.status !== 'closed' && (
                            <button
                              type="button"
                              onClick={() => handleAction(b, 'close')}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100"
                              title="Close budget"
                            >
                              <Lock size={12} />
                              Close
                            </button>
                          )}
                        </>
                      )}
                      
                      {pagePermissions.canDelete && !b.isLocked && (b.status === 'draft' || b.status === 'active' || b.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBudget(b)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                          title="Delete budget"
                        >
                          <Trash2 size={16} />
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
                  
                  {/* Budget amount preview */}
                  <div className="mt-2 flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      Budgeted {(b.budgetType || "revenue") === "expense" ? "Expense" : "Revenue"}:{" "}
                      <span className="font-semibold text-gray-900">{formatCurrency(b.expectedRevenue || 0)}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Budget Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={resetCreate}>
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50 flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Create {form.budgetType === "expense" ? "Expense" : "Revenue"} Budget
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Plan your expected {form.budgetType === "expense" ? "expenses" : "revenue"} for a specific period.
                  </p>
                </div>
                <button className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0" onClick={resetCreate}>
                  <X size={22} />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 sm:space-y-6">
                {/* Budget Summary Card */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="text-green-600" size={20} />
                      <span className="text-sm font-medium text-gray-700">
                        Expected {form.budgetType === "expense" ? "Expense" : "Revenue"}:
                      </span>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={form.expectedRevenue}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, expectedRevenue: e.target.value }));
                        if (formErrors.expectedRevenue) setFormErrors((prev) => ({ ...prev, expectedRevenue: null }));
                      }}
                      className={`w-40 px-3 py-2 text-right border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-bold ${
                        formErrors.expectedRevenue ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {formErrors.expectedRevenue && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.expectedRevenue}</p>
                  )}
                  {form.expectedRevenue && (
                    <div className="mt-2 text-xl font-bold text-green-700">
                      {formatCurrency(Number(form.expectedRevenue) || 0)}
                    </div>
                  )}
                </div>

                {/* Basic Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Info size={16} className="text-green-600" />
                    Budget Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Budget Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.budgetType}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setForm((p) => ({
                            ...p,
                            budgetType: nextType,
                            breakdowns: nextType === "expense" ? [] : p.breakdowns,
                          }));
                          setFormErrors((prev) => ({ ...prev, breakdowns: null }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="revenue">Revenue</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Budget Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, name: e.target.value }));
                          if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: null }));
                        }}
                        placeholder="e.g., Q1 2026 Budget"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={form.currency || 'MWK'}
                        onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="MWK">MWK - Malawian Kwacha</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="ZAR">ZAR - South African Rand</option>
                      </select>
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
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
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
                        placeholder="Optional: notes, assumptions, or targets."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {form.budgetType === "revenue" && (
                  <>
                    {/* Optional Breakdown Section */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Filter size={18} className="text-green-600" />
                          Optional Breakdown
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Optionally forecast revenue by branch or inventory category. Splits do not need to add up to your total above.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addBreakdown('branch')}
                          disabled={optionsLoading || branchOptions.length === 0}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm disabled:opacity-50"
                        >
                          <Plus size={14} />
                          Add Branch
                        </button>
                        <button
                          type="button"
                          onClick={() => addBreakdown('product_category')}
                          disabled={optionsLoading || inventoryCategoryOptions.length === 0}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 text-sm disabled:opacity-50"
                        >
                          <Plus size={14} />
                          Add Category
                        </button>
                      </div>
                    </div>
                  </div>

                  {optionsLoading ? (
                    <div className="p-6 text-gray-600 flex items-center">
                      <Loader2 size={18} className="animate-spin mr-2 text-green-600" />
                      Loading options...
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {(form.breakdowns || [])
                        .map((item, idx) => {
                          const hasAmountError = formErrors[`breakdown_${idx}_amount`];
                          const options = breakdownOptionsFor(item.breakdownType);
                          
                          return (
                            <div key={idx} className={`p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 ${hasAmountError ? "bg-red-50/30" : ""}`}>
                              <div className="sm:col-span-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  {item.breakdownType === 'branch' ? 'Branch' : 'Inventory category'}
                                </label>
                                <select
                                  value={item.referenceId || ""}
                                  onChange={(e) => updateBreakdown(idx, { referenceId: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                >
                                  <option value="">Select...</option>
                                  {options.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-4">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Budgeted Amount <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={item.budgetedAmount}
                                  onChange={(e) => {
                                    updateBreakdown(idx, { budgetedAmount: e.target.value });
                                    if (formErrors[`breakdown_${idx}_amount`]) {
                                      setFormErrors((prev) => ({ ...prev, [`breakdown_${idx}_amount`]: null }));
                                    }
                                  }}
                                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                                    hasAmountError ? "border-red-300 bg-red-50" : "border-gray-300"
                                  }`}
                                  placeholder="0.00"
                                />
                                {hasAmountError && (
                                  <p className="text-xs text-red-600 mt-1">{hasAmountError}</p>
                                )}
                                {item.budgetedAmount && (
                                  <div className="text-xs text-green-600 mt-1 font-medium">
                                    {formatCurrency(Number(item.budgetedAmount) || 0)}
                                  </div>
                                )}
                              </div>

                              <div className="sm:col-span-3 flex items-end">
                                <div className="text-xs text-gray-500">
                                  {item.breakdownType === 'branch' ? 'Branch' : 'Category'}
                                </div>
                              </div>

                              <div className="sm:col-span-1 flex sm:justify-end items-end">
                                <button
                                  type="button"
                                  onClick={() => removeBreakdown(idx)}
                                  className="w-full sm:w-auto px-3 py-2 rounded-md border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                                  title="Remove breakdown"
                                >
                                  <X size={16} className="hidden sm:inline" />
                                  <span className="sm:hidden">Remove</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      
                      {form.breakdowns?.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                          <p className="text-sm">No breakdowns configured.</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Adding breakdowns helps track revenue by branch or category.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Breakdown total validation */}
                  {form.breakdowns?.length > 0 && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="text-sm text-gray-600">Breakdown total (reference only):</span>
                          <span className="ml-2 font-semibold text-gray-800">
                            {formatCurrency(calculateBreakdownTotal())}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Expected revenue: {formatCurrency(Number(form.expectedRevenue) || 0)}
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        Optional splits for tracking performance; they do not have to match the header total.
                      </p>
                    </div>
                  )}
                    </div>
                  </>
                )}
                {form.budgetType === "expense" && (
                  <>
                    {/* Budget Lines Section */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <DollarSign size={18} className="text-blue-600" />
                          Expense Lines
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Add expense lines by chart account to compare actuals and variance line by line (optional).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 text-sm"
                      >
                        <Plus size={14} />
                        Add Line Item
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {(form.items || [])
                      .map((item, idx) => {
                        const hasAmountError = formErrors[`item_${idx}_amount`];
                        
                        return (
                          <div key={idx} className={`p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 ${hasAmountError ? "bg-red-50/30" : ""}`}>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Line #
                              </label>
                              <div className="px-3 py-2 bg-gray-100 rounded-md text-gray-600 text-sm">
                                {idx + 1}
                              </div>
                            </div>

                            <div className="sm:col-span-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Expense Account
                              </label>
                              <select
                                value={item.accountId || ""}
                                onChange={(e) => updateLineItem(idx, { accountId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              >
                                <option value="">Select an expense account...</option>
                                {expenseAccountOptions.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.code ? `${cat.code} - ${cat.name}` : cat.name}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-gray-500">
                                Create new categories in{" "}
                                <a href="/chart-of-accounts" className="text-blue-600 hover:text-blue-800 underline">
                                  Chart of Accounts
                                </a>
                                .
                              </p>
                            </div>

                            <div className="sm:col-span-4">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={item.description || ""}
                                onChange={(e) => updateLineItem(idx, { description: e.target.value })}
                                placeholder="e.g., Office Rent"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Amount <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={item.budgetedAmount}
                                onChange={(e) => {
                                  updateLineItem(idx, { budgetedAmount: e.target.value });
                                  if (formErrors[`item_${idx}_amount`]) {
                                    setFormErrors((prev) => ({ ...prev, [`item_${idx}_amount`]: null }));
                                  }
                                }}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                                  hasAmountError ? "border-red-300 bg-red-50" : "border-gray-300"
                                }`}
                                placeholder="0.00"
                              />
                              {hasAmountError && (
                                <p className="text-xs text-red-600 mt-1">{hasAmountError}</p>
                              )}
                              {item.budgetedAmount && (
                                <div className="text-xs text-blue-600 mt-1 font-medium">
                                  {formatCurrency(Number(item.budgetedAmount) || 0)}
                                </div>
                              )}
                            </div>

                            <div className="sm:col-span-1 flex sm:justify-end items-end">
                              <button
                                type="button"
                                onClick={() => removeLineItem(idx)}
                                className="w-full sm:w-auto px-3 py-2 rounded-md border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors text-sm"
                                title="Remove line item"
                              >
                                <X size={16} className="hidden sm:inline" />
                                <span className="sm:hidden">Remove</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    
                    {form.items?.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <p className="text-sm">No budget lines added.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Add line items to track budget by specific categories or descriptions.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Line items total validation */}
                  {form.items?.length > 0 && (
                    <div className="p-4 bg-blue-50 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-600">Line Items Total:</span>
                          <span className={`ml-2 font-semibold ${Math.abs(calculateLineItemsTotal() - Number(form.expectedRevenue || 0)) > 0.01 ? 'text-red-600' : 'text-blue-600'}`}>
                            {formatCurrency(calculateLineItemsTotal())}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Expected Expense: {formatCurrency(Number(form.expectedRevenue) || 0)}
                        </div>
                      </div>
                    </div>
                  )}
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm"
                    disabled={creating}
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
