"use client";

import { useState, useEffect, useCallback } from "react";

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
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (!tenantId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        tenantId,
        limit: "100"
      });

      // Map showActiveOnly to status parameter
      if (showActiveOnly === false) {
        params.append('status', 'all');
      } else if (showActiveOnly === true) {
        params.append('status', 'active');
      }

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/purchases/suppliers?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch suppliers");
      }

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
    onChange({
      target: {
        name: "supplierId",
        value: supplier.id,
      },
    });
    setSearch(supplier.supplierName);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange({
      target: {
        name: "supplierId",
        value: "",
      },
    });
    setSearch("");
    setIsOpen(false);
  };

  const selectedSupplier = suppliers.find((s) => s.id === value);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Supplier <span className="text-gray-400 font-normal">(optional)</span>
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
          No suppliers found. Create a supplier first.
        </div>
      )}
    </div>
  );
}
