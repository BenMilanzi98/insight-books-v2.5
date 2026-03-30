"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export function formatProductLabel(product) {
  if (!product) return "";
  const code = product.sku || product.code || product.accountCode || "";
  const name = product.name || "";
  return code ? `${code} — ${name}` : name;
}

function productMatchesSearch(product, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  const barcodes = [];
  if (product.barcode) barcodes.push(String(product.barcode));
  if (Array.isArray(product.productBarcodes)) {
    product.productBarcodes.forEach((pb) => {
      if (pb?.barcode) barcodes.push(String(pb.barcode));
    });
  }
  const haystack = [
    product.name,
    product.sku,
    product.code,
    product.category,
    product.description,
    ...barcodes,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return haystack.some((h) => h.includes(t));
}

const MAX_OPEN_LIST = 120;

/**
 * Searchable product picker (combobox). Filters client-side by name, SKU, code, category, barcode.
 */
export default function ProductSearchSelect({
  products = [],
  value,
  onChange,
  placeholder = "Search products…",
  required = false,
  disabled = false,
  className = "",
  showCost = false,
}) {
  const containerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === value),
    [products, value]
  );

  useEffect(() => {
    if (!open) {
      setSearchTerm(selectedProduct ? formatProductLabel(selectedProduct) : "");
    }
  }, [selectedProduct, open]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        if (selectedProduct) {
          setSearchTerm(formatProductLabel(selectedProduct));
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = products.filter((p) => productMatchesSearch(p, term));
    return list.slice(0, MAX_OPEN_LIST);
  }, [products, searchTerm]);

  const handleSelect = (product) => {
    onChange?.(product.id);
    setOpen(false);
    setSearchTerm(formatProductLabel(product));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input type="hidden" value={value || ""} required={required} readOnly aria-hidden />
      <input
        type="text"
        value={searchTerm}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
        autoComplete="off"
      />
      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No products match your search</p>
          ) : (
            filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSelect(product)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.sku || product.code || "—"} • Stock:{" "}
                    {product.stockLevel ?? product.quantityInStock ?? "—"}
                  </p>
                </div>
                {showCost && (
                  <div className="shrink-0 text-xs font-semibold text-gray-700">
                    MWK{" "}
                    {Number(
                      product.costPrice ||
                        product.cost ||
                        product.purchasePrice ||
                        product.price ||
                        0
                    ).toLocaleString()}
                  </div>
                )}
              </button>
            ))
          )}
          {products.length > MAX_OPEN_LIST && !searchTerm.trim() && (
            <p className="border-t border-gray-100 px-3 py-1.5 text-xs text-gray-500">
              Showing first {MAX_OPEN_LIST} products — type to narrow down
            </p>
          )}
        </div>
      )}
    </div>
  );
}
