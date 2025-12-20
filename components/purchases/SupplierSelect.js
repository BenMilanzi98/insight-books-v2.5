"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Reusable Supplier Selection Component
 * Features:
 * - Type-ahead search (by name or code)
 * - Shows: Supplier Code - Supplier Name
 * - Keyboard navigation
 * - "Add New Supplier" option
 * - Recently used suppliers at top
 * - Inactive suppliers shown but disabled
 */
export default function SupplierSelect({
  value,
  onChange,
  onAddNew,
  placeholder = "Select or search supplier...",
  required = false,
  disabled = false,
  className = "",
  showAddNew = true,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSuppliers, setRecentSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/purchases/suppliers?limit=1000");
        if (response.ok) {
          const data = await response.json();
          setSuppliers(data.suppliers || []);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSuppliers();
  }, []);

  // Load recently used suppliers from localStorage
  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem("recentSuppliers") || "[]");
    setRecentSuppliers(recent);
  }, []);

  // Filter suppliers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      // Show recent suppliers first, then all active suppliers
      const recentIds = new Set(recentSuppliers);
      const sorted = [...suppliers].sort((a, b) => {
        const aRecent = recentIds.has(a.id);
        const bRecent = recentIds.has(b.id);
        if (aRecent && !bRecent) return -1;
        if (!aRecent && bRecent) return 1;
        return a.supplierName.localeCompare(b.supplierName);
      });
      setFilteredSuppliers(sorted);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = suppliers.filter(
        (supplier) =>
          supplier.supplierName.toLowerCase().includes(term) ||
          supplier.supplierCode.toLowerCase().includes(term) ||
          (supplier.email && supplier.email.toLowerCase().includes(term))
      );
      setFilteredSuppliers(filtered);
    }
    setHighlightedIndex(-1);
  }, [searchTerm, suppliers, recentSuppliers]);

  // Get selected supplier name for display
  const selectedSupplier = suppliers.find((s) => s.id === value);
  const displayValue = selectedSupplier
    ? `${selectedSupplier.supplierCode} - ${selectedSupplier.supplierName}`
    : "";

  // Handle supplier selection
  const handleSelect = useCallback((supplier) => {
    if (supplier && supplier.isActive !== false) {
      onChange?.(supplier.id);
      
      // Save to recently used
      const recent = JSON.parse(localStorage.getItem("recentSuppliers") || "[]");
      const updated = [supplier.id, ...recent.filter((id) => id !== supplier.id)].slice(0, 5);
      localStorage.setItem("recentSuppliers", JSON.stringify(updated));
      setRecentSuppliers(updated);
      
      setIsOpen(false);
      setSearchTerm("");
    }
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuppliers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuppliers.length) {
          handleSelect(filteredSuppliers[highlightedIndex]);
        } else if (highlightedIndex === -1 && filteredSuppliers.length === 1) {
          handleSelect(filteredSuppliers[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchTerm("");
        break;
      default:
        if (!isOpen) setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const item = dropdownRef.current.children[highlightedIndex];
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const inputBaseClass = `w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500 ${
    disabled ? "bg-gray-100 cursor-not-allowed" : ""
  } ${className}`;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              if (!searchTerm) setSearchTerm("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputBaseClass}
          autoComplete="off"
        />
        {!isOpen && value && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              onChange?.("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={disabled}
          >
            ×
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading ? (
            <div className="px-4 py-2 text-sm text-gray-500">Loading suppliers...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              No suppliers found
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          ) : (
            <>
              {filteredSuppliers.map((supplier, index) => {
                const isRecent = recentSuppliers.includes(supplier.id);
                const isActive = supplier.isActive !== false;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={supplier.id}
                    onClick={() => isActive && handleSelect(supplier)}
                    className={`px-4 py-2 text-sm cursor-pointer ${
                      isHighlighted ? "bg-indigo-50" : "hover:bg-gray-50"
                    } ${
                      !isActive
                        ? "opacity-50 cursor-not-allowed bg-gray-50"
                        : ""
                    } ${
                      isRecent && index < 3 ? "border-l-2 border-indigo-500" : ""
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {supplier.supplierCode} - {supplier.supplierName}
                        </div>
                        {supplier.contactPerson && (
                          <div className="text-xs text-gray-500">
                            {supplier.contactPerson}
                          </div>
                        )}
                      </div>
                      {!isActive && (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                          Inactive
                        </span>
                      )}
                      {isRecent && index < 3 && (
                        <span className="ml-2 text-xs text-indigo-600">Recent</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {showAddNew && (
                <div
                  className="border-t border-gray-200 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew?.();
                  }}
                >
                  + Add New Supplier
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

