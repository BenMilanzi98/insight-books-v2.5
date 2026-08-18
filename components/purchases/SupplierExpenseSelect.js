"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300/80 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500";

export default function SupplierExpenseSelect({
  value = "",
  onChange,
  tenantId,
  disabled = false,
  placeholder = "Select supplier (optional)",
  showActiveOnly = true,
  className = "",
  onSupplierAdded,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ supplierName: "", contactPerson: "", email: "", phone: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchSuppliers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (tenantId) params.set("tenantId", tenantId);
      if (showActiveOnly === false) params.append("status", "all");
      else if (showActiveOnly === true) params.append("status", "active");
      if (search) params.append("search", search);

      const response = await fetch(`/api/purchases/suppliers?${params}`);
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      const data = await response.json();
      setSuppliers(data.suppliers || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, search, showActiveOnly]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchSuppliers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchSuppliers]);

  const handleSelect = (supplier) => {
    const id = supplier?.id ?? "";
    if (typeof onChange === "function") onChange(id);
    setSearch(supplier?.supplierName ?? "");
    setIsOpen(false);
  };

  const handleClear = () => {
    if (typeof onChange === "function") onChange("");
    setSearch("");
    setIsOpen(false);
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    const name = (addForm.supplierName || "").trim();
    if (!name) {
      setAddError("Supplier name is required");
      return;
    }
    setAddError("");
    setAddSaving(true);
    try {
      const res = await fetch("/api/purchases/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: name,
          contactPerson: addForm.contactPerson?.trim() || null,
          email: addForm.email?.trim() || null,
          phone: addForm.phone?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create supplier");
      await fetchSuppliers();
      const newId = data.supplier?.id;
      if (newId) {
        if (typeof onSupplierAdded === "function") onSupplierAdded(newId);
        onChange(newId);
        setSearch(data.supplier?.supplierName ?? name);
      }
      setShowAddModal(false);
      setAddForm({ supplierName: "", contactPerson: "", email: "", phone: "" });
      setIsOpen(false);
    } catch (err) {
      setAddError(err.message || "Failed to add supplier");
    } finally {
      setAddSaving(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === value);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {tt('Supplier')} <span className="text-gray-400 font-normal">(optional)</span>
      </label>

      <div className="relative">
        <input
          type="text"
          className={inputClass}
          value={value && selectedSupplier ? selectedSupplier.supplierName : search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || loading}
          autoComplete="off"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {isOpen && !disabled && suppliers.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suppliers.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 ${
                value === supplier.id ? "bg-indigo-50" : ""
              }`}
              onClick={() => handleSelect(supplier)}
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">
                  {supplier.supplierName}
                </span>
                <span className="text-xs text-gray-500">
                  {supplier.email && `${supplier.email} • `}
                  {supplier.phone && supplier.phone}
                  {supplier.paymentPreference && ` • ${supplier.paymentPreference}`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !loading && search && suppliers.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-500">
          {tt('No suppliers found.')}
        </div>
      )}

      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          {tt('Add supplier')}
        </button>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => { setShowAddModal(false); setAddError(""); }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{tt('Add supplier')}</h3>
              <button type="button" onClick={() => { setShowAddModal(false); setAddError(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {addError && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{addError}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Supplier name *')}</label>
                <input
                  type="text"
                  value={addForm.supplierName}
                  onChange={(e) => setAddForm((f) => ({ ...f, supplierName: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSupplier(e))}
                  className={inputClass}
                  placeholder={tt('Company or supplier name')}
                  aria-required="true"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Contact person')}</label>
                <input
                  type="text"
                  value={addForm.contactPerson}
                  onChange={(e) => setAddForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  className={inputClass}
                  placeholder={tt('Optional')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Email')}</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  placeholder={tt('Optional')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{tt('Phone')}</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                  placeholder={tt('Optional')}
                />
              </div>
              <p className="text-xs text-gray-500">{tt('Supplier will be saved to Purchases → Suppliers.')}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddError(""); }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {tt('Cancel')}
                </button>
                <button
                  type="button"
                  disabled={addSaving}
                  onClick={handleAddSupplier}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addSaving ? tt('Saving...') : tt('Add supplier')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
