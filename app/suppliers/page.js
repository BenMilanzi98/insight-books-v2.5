"use client";
import { tt } from '@/lib/i18n/runtime';
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  X,
  Trash2,
  Info,
  DollarSign,
  Users,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  RefreshCw,
  BarChart3,
  FileText,
  History
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

const DEFAULT_FORM = {
  supplierName: "",
  contactPerson: "",
  email: "",
  phone: "",
  mobile: "",
  address: "",
  city: "",
  country: "Malawi",
  postalCode: "",
  taxId: "",
  paymentTerms: 30,
  currency: "MWK",
  creditLimit: "",
  bankName: "",
  bankAccountNumber: "",
  bankBranch: "",
  notes: "",
  website: ""
};

export default function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // active/inactive

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false
  });
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});

  // Filter and search
  const filteredSuppliers = useMemo(() => {
    let result = suppliers;
    
    // Apply status filter
    if (statusFilter === "active") {
      result = result.filter(s => s.isActive);
    } else if (statusFilter === "inactive") {
      result = result.filter(s => !s.isActive);
    }
    
    // Apply search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(s => 
        (s?.supplierName || "").toLowerCase().includes(q) ||
        (s?.supplierCode || "").toLowerCase().includes(q) ||
        (s?.contactPerson || "").toLowerCase().includes(q) ||
        (s?.email || "").toLowerCase().includes(q) ||
        (s?.phone || "").toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [suppliers, search, statusFilter]);

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('isActive', statusFilter === 'active' ? 'true' : 'false');
      const qs = params.toString();
      const res = await fetch(qs ? `/api/suppliers?${qs}` : '/api/suppliers', { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load suppliers");
      setSuppliers(json?.suppliers || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [statusFilter]);

  useEffect(() => {
    const fetchPermissions = async () => {
      setPermissionsLoading(true);
      try {
        const canCreate = await getPermission("suppliers.create");
        const canUpdate = await getPermission("suppliers.update");
        const canDelete = await getPermission("suppliers.delete");
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

  const validateForm = () => {
    const errors = {};
    
    if (!form.supplierName?.trim()) {
      errors.supplierName = "Supplier name is required";
    }
    
    if (form.email && form.email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        errors.email = "Invalid email format";
      }
    }
    
    if (form.phone && form.phone.trim() !== "") {
      const phoneRegex = /^[+\d\s-]{10,}$/;
      if (!phoneRegex.test(form.phone)) {
        errors.phone = "Invalid phone number format";
      }
    }
    
    if (form.creditLimit && Number(form.creditLimit) < 0) {
      errors.creditLimit = "Credit limit cannot be negative";
    }
    
    if (form.paymentTerms !== undefined && (form.paymentTerms < 0 || form.paymentTerms > 365)) {
      errors.paymentTerms = "Payment terms must be between 0 and 365 days";
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

      // Get current user/tenant from session (in a real app)
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;

      if (!tenantId) {
        throw new Error("Tenant ID not found. Please log in again.");
      }

      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          userId,
          ...form,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create supplier");

      setSuccess("Supplier created successfully!");
      setTimeout(() => setSuccess(null), 3000);
      resetCreate();
      await loadSuppliers();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSupplier = async (supplier) => {
    try {
      if (!pagePermissions.canDelete) return;
      
      const confirmed = window.confirm(
        `Delete supplier "${supplier?.supplierName}"?\n\n` +
        `Bills: ${supplier._count?.supplierBills || 0}\n` +
        `Payments: ${supplier._count?.supplierPayments || 0}\n\n` +
        `Note: Suppliers with transactions will be deactivated instead of deleted.`
      );
      if (!confirmed) return;

      setDeleting(supplier.id);
      const tenantId = localStorage.getItem('tenantId');
      
      const res = await fetch(`/api/suppliers/${supplier.id}?tenantId=${tenantId}`, { 
        method: "DELETE" 
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to delete supplier");
      
      setSuccess(json.message || "Supplier deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
      await loadSuppliers();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (supplier) => {
    try {
      if (!pagePermissions.canUpdate) return;
      
      const tenantId = localStorage.getItem('tenantId');
      const userId = localStorage.getItem('userId');
      
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          userId,
          isActive: !supplier.isActive
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update supplier");
      
      setSuccess(`Supplier ${supplier.isActive ? 'deactivated' : 'activated'} successfully!`);
      setTimeout(() => setSuccess(null), 3000);
      await loadSuppliers();
    } catch (e) {
      setError(e.message);
    }
  };

  // Status badge helper
  const getStatusBadge = (supplier) => {
    if (!supplier.isActive) {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
          <XCircle size={12} />
          {tt('Inactive')}
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
        <CheckCircle size={12} />
        {tt('Active')}
      </span>
    );
  };

  // Format currency helper
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat('en-MW', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    }).format(num);
  };

  return (
    <PermissionGuard permission="suppliers.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tt('Supplier Management')}</h1>
            <p className="text-sm text-gray-600">
              {tt('Manage your suppliers, track purchases, and monitor accounts payable.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/suppliers/reports"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <BarChart3 size={18} />
              {tt('Reports')}
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
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
                  ? "You don't have permission to create suppliers"
                  : ""
              }
            >
              {permissionsLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              New Supplier
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
                  placeholder={tt('Search suppliers...')}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{tt('All Suppliers')}</option>
                <option value="active">{tt('Active Only')}</option>
                <option value="inactive">{tt('Inactive Only')}</option>
              </select>
            </div>
            
            <button
              type="button"
              onClick={loadSuppliers}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {tt('Refresh')}
            </button>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-600">
              <Loader2 size={24} className="animate-spin mr-2 text-blue-600" />
              {tt('Loading suppliers...')}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-10 text-center text-gray-600">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <Users size={22} className="text-blue-600" />
              </div>
              <div className="font-medium text-gray-800">{tt('No suppliers found')}</div>
              <div className="text-sm text-gray-500 mt-1">{tt('Add your first supplier to start managing your supply chain.')}</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Supplier')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Contact')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Location')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Terms')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Balance')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Status')}</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">{tt('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/suppliers/${s.id}`} className="block">
                          <div className="font-medium text-gray-900">{s.supplierName}</div>
                          <div className="text-xs text-gray-500">{s.supplierCode}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {s.contactPerson && (
                            <div className="text-gray-900">{s.contactPerson}</div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Mail size={12} />
                              <span className="truncate max-w-[150px]">{s.email}</span>
                            </div>
                          )}
                          {s.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Phone size={12} />
                              <span>{s.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600">
                          {s.city && <div className="flex items-center gap-1"><MapPin size={12} />{s.city}</div>}
                          {s.country && <div className="text-xs text-gray-500">{s.country}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-gray-900">{s.paymentTerms || 30} days</div>
                          <div className="text-xs text-gray-500">
                            Credit: {formatNumber(s.creditLimit)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-medium ${s.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(s.currentBalance || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(s)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/suppliers/${s.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                            title="View Details"
                          >
                            <ChevronRight size={14} />
                            {tt('View')}
                          </Link>
                          
                          {pagePermissions.canUpdate && (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(s)}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border ${
                                s.isActive 
                                  ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                                  : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                              }`}
                              title={s.isActive ? "Deactivate" : "Activate"}
                            >
                              {s.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                              {s.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
                          
                          {pagePermissions.canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSupplier(s)}
                              disabled={deleting === s.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                              title="Delete supplier"
                            >
                              {deleting === s.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Supplier Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={resetCreate}>
            <div
              className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-4xl my-auto flex flex-col max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-start justify-between gap-3 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{tt('Add New Supplier')}</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{tt('Enter supplier details to create a new supplier record.')}</p>
                </div>
                <button className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0" onClick={resetCreate}>
                  <X size={22} />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-6">
                {/* Basic Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Info size={16} className="text-blue-600" />
                    {tt('Basic Information')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {tt('Supplier Name')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.supplierName}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, supplierName: e.target.value }));
                          if (formErrors.supplierName) setFormErrors((prev) => ({ ...prev, supplierName: null }));
                        }}
                        placeholder={tt('e.g., ABC Supplies Ltd.')}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.supplierName ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.supplierName && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.supplierName}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Contact Person')}</label>
                      <input
                        value={form.contactPerson}
                        onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                        placeholder={tt('e.g., John Smith')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Tax ID / TIN')}</label>
                      <input
                        value={form.taxId}
                        onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))}
                        placeholder={tt('e.g., TAX-123456')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Phone size={16} className="text-blue-600" />
                    {tt('Contact Information')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Email')}</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, email: e.target.value }));
                          if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: null }));
                        }}
                        placeholder={tt('supplier@example.com')}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.email ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.email && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Phone')}</label>
                      <input
                        value={form.phone}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, phone: e.target.value }));
                          if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: null }));
                        }}
                        placeholder="+265 123 456 789"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.phone ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-red-600 mt-1">{formErrors.phone}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Mobile')}</label>
                      <input
                        value={form.mobile}
                        onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                        placeholder="+265 987 654 321"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Website')}</label>
                      <input
                        value={form.website}
                        onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://www.supplier.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Address')}</label>
                      <input
                        value={form.address}
                        onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                        placeholder={tt('Street address')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('City')}</label>
                      <input
                        value={form.city}
                        onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                        placeholder={tt('e.g., Lilongwe')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Country')}</label>
                      <select
                        value={form.country}
                        onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="Malawi">{tt('Malawi')}</option>
                        <option value="Zambia">{tt('Zambia')}</option>
                        <option value="Mozambique">{tt('Mozambique')}</option>
                        <option value="Tanzania">{tt('Tanzania')}</option>
                        <option value="South Africa">{tt('South Africa')}</option>
                        <option value="Other">{tt('Other')}</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Postal Code')}</label>
                      <input
                        value={form.postalCode}
                        onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                        placeholder={tt('e.g., P.O. Box 123')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Financial Terms */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-blue-600" />
                    {tt('Financial Terms')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (Days)</label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={form.paymentTerms}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, paymentTerms: parseInt(e.target.value) || 0 }));
                          if (formErrors.paymentTerms) setFormErrors((prev) => ({ ...prev, paymentTerms: null }));
                        }}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.paymentTerms ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Currency')}</label>
                      <select
                        value={form.currency}
                        onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="MWK">{tt('MWK - Malawian Kwacha')}</option>
                        <option value="USD">{tt('USD - US Dollar')}</option>
                        <option value="ZAR">{tt('ZAR - South African Rand')}</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Credit Limit')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.creditLimit}
                        onChange={(e) => {
                          setForm((p) => ({ ...p, creditLimit: e.target.value }));
                          if (formErrors.creditLimit) setFormErrors((prev) => ({ ...prev, creditLimit: null }));
                        }}
                        placeholder="0.00"
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          formErrors.creditLimit ? "border-red-300 bg-red-50" : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign size={16} className="text-blue-600" />
                    Banking Information (Optional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Bank Name')}</label>
                      <input
                        value={form.bankName}
                        onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                        placeholder={tt('e.g., National Bank')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Account Number')}</label>
                      <input
                        value={form.bankAccountNumber}
                        onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                        placeholder={tt('Account number')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Branch')}</label>
                      <input
                        value={form.bankBranch}
                        onChange={(e) => setForm((p) => ({ ...p, bankBranch: e.target.value }))}
                        placeholder={tt('e.g., Main Branch')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    {tt('Notes')}
                  </h3>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder={tt('Any additional notes about this supplier...')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={resetCreate}
                    className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={creating}
                  >
                    {tt('Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {tt('Creating...')}
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        {tt('Create Supplier')}
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
