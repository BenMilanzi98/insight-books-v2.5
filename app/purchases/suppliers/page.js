"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Image from "next/image";
import { Eye, Search } from "lucide-react";
import SupplierForm from "@/components/purchases/SupplierForm";

async function updateSupplier(id, payload) {
  const res = await fetch(`/api/purchases/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update supplier");
  }
  return res.json();
}

async function deleteSupplier(id) {
  const res = await fetch(`/api/purchases/suppliers/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to delete supplier");
  }
  return res.json();
}

const formatMoney = (value) => `MWK ${Number(value || 0).toLocaleString()}`;

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 ">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 ">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white  hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Removing…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function fetchSuppliers(search = "", status = "all") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status && status !== "all") params.set("status", status);
  const res = await fetch(`/api/purchases/suppliers?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load suppliers");
  }
  return res.json();
}

async function bulkUpdateSuppliers(ids, updates) {
  const res = await fetch("/api/purchases/suppliers/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, updates }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update suppliers");
  }
  return res.json();
}

// Bills functions
async function fetchBills(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/bills?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch bills");
  }
  return res.json();
}

async function createBill(payload) {
  const res = await fetch("/api/purchases/bills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create bill");
  }
  return res.json();
}

async function updateBill(id, payload) {
  const res = await fetch(`/api/purchases/bills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to update bill");
  }
  return res.json();
}

async function deleteBill(id) {
  const res = await fetch(`/api/purchases/bills/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to delete bill");
  }
  return res.json();
}

// Orders functions
async function getOrders(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });
  const res = await fetch(`/api/purchases/orders?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch purchase orders");
  return res.json();
}

async function createOrder(payload) {
  const res = await fetch("/api/purchases/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to create purchase order");
  }
  return res.json();
}

async function updateOrder(id, payload) {
  const res = await fetch(`/api/purchases/orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to update purchase order");
  }
  return res.json();
}

async function deleteOrder(id) {
  const res = await fetch(`/api/purchases/orders/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to delete purchase order");
  }
  return res.json();
}

// Receipts functions
async function fetchReceipts(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/receipts?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch receipts");
  return res.json();
}

async function postReceipt(payload) {
  const res = await fetch("/api/purchases/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to post receipt");
  }
  return res.json();
}

// Payments functions
async function fetchPayments(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/payments?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json();
}

async function createPayment(payload) {
  const res = await fetch("/api/purchases/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to create payment");
  }
  return res.json();
}

const statusOptions = ["Draft", "Approved", "Unpaid", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const statusColors = {
  Draft: "bg-gray-100 text-gray-800",
  Approved: "bg-blue-100 text-blue-800",
  Sent: "bg-indigo-100 text-indigo-800",
  "Partially Received": "bg-yellow-100 text-yellow-800",
  Received: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

// Form Section Components
function BillFormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function PaymentFormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function formatProductLabel(product) {
  const code = product.code || product.sku || product.productCode || "";
  const name = product.name || product.productName || "Unnamed Product";
  return code ? `${code} — ${name}` : name;
}

function ProductSearchSelect({
  products = [],
  value,
  onChange,
  placeholder = "Search products...",
  required = false,
}) {
  const containerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === value),
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
    if (!term) {
      return products.slice(0, 50);
    }
    return products
      .filter((product) => formatProductLabel(product).toLowerCase().includes(term))
      .slice(0, 50);
  }, [products, searchTerm]);

  const handleSelect = (product) => {
    onChange?.(product.id);
    setOpen(false);
    setSearchTerm(formatProductLabel(product));
  };

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" value={value || ""} required={required} />
      <input
        type="text"
        value={searchTerm}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setOpen(true);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filteredProducts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No products found</p>
          ) : (
            filteredProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSelect(product)}
              >
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">
                    {product.sku || product.code || "No SKU"} • In stock:{" "}
                    {product.stockLevel ?? product.quantityOnHand ?? "N/A"}
                  </p>
                </div>
                <div className="text-xs font-semibold text-gray-700">
                  MWK{" "}
                  {Number(
                    product.costPrice || product.purchasePrice || product.price || 0
                  ).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const getDefaultProductCost = (product) => {
  if (!product) return 0;
  const value =
    product.costPrice ??
    product.purchasePrice ??
    product.unitCost ??
    product.price ??
    product.defaultPrice ??
    0;
  return Number(value) || 0;
};

// Bill Form Component
function BillForm({ suppliers, initialData = null, onSave, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState({
    supplierId: initialData?.supplierId || "",
    billDate: initialData?.billDate
      ? format(new Date(initialData.billDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    dueDate: initialData?.dueDate
      ? format(new Date(initialData.dueDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    status: initialData?.status || "Unpaid",
    billNumber: initialData?.billNumber || "",
    notes: initialData?.notes || "",
    billType: initialData?.billType || "inventory",
  });
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        productId: item.productId || "",
        quantity: Number(item.quantity || item.quantityOrdered || 1),
        unitCost: Number(item.unitCost || 0),
        description: item.description || "",
      }));
    }
    return [{ productId: "", quantity: 1, unitCost: 0, description: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("/api/inventory").then((res) => res.json()).then((data) => {
      setProducts(data.products || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      supplierId: initialData.supplierId || "",
      billDate: initialData.billDate
        ? format(new Date(initialData.billDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      dueDate: initialData.dueDate
        ? format(new Date(initialData.dueDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      status: initialData.status || "Unpaid",
      billNumber: initialData.billNumber || "",
      notes: initialData.notes || "",
      billType: initialData.billType || "inventory",
    });
    setItems(
      (initialData.items || []).map((item) => ({
        productId: item.productId || "",
        quantity: Number(item.quantity || item.quantityOrdered || 1),
        unitCost: Number(item.unitCost || 0),
        description: item.description || "",
      }))
    );
  }, [initialData]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            if (!Number(item.unitCost)) {
              updated.unitCost = getDefaultProductCost(product);
            }
            if (!item.description) {
              updated.description = product.description || product.name || "";
            }
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantity: 1, unitCost: 0, description: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        items: items.map(item => ({
          productId: item.productId || null,
          quantity: Number(item.quantity || 0),
          unitCost: Number(item.unitCost || 0),
          description: item.description || "",
        })),
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
      };
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <BillFormSection title="Bill Details" description="Supplier and key dates.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bill Type</label>
            <select
              name="billType"
              value={form.billType}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="inventory">Inventory Purchase</option>
              <option value="expense">Operating Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bill Number</label>
            <input
              type="text"
              name="billNumber"
              value={form.billNumber || ""}
              onChange={handleChange}
              placeholder="Optional reference"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bill Date</label>
            <input
              type="date"
              name="billDate"
              value={form.billDate}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </BillFormSection>

      <BillFormSection title="Line Items" description="Add products and quantities.">
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-4"
            >
              {form.billType === "inventory" && (
                <ProductSearchSelect
                  products={products}
                  value={item.productId}
                  onChange={(productId) => handleItemChange(idx, "productId", productId)}
                  required
                />
              )}
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantity}
                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                required
                placeholder="Quantity"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
                placeholder="Cost Price"
              />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK {(Number(item.quantity) * Number(item.unitCost)).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </BillFormSection>

      <BillFormSection title="Notes & Totals">
        <div className="space-y-3">
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Extra context, project references, approvals…"
          />
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-700">Bill Total</p>
              <p className="text-sm text-amber-900">Subtotal excluding taxes</p>
            </div>
            <div className="text-lg font-semibold text-amber-900">
              MWK {subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </BillFormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Update Bill" : "Save Bill"}
        </button>
      </div>
    </form>
  );
}

// Order Form Component
function OrderForm({ suppliers, products, initialData = null, onSave, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState(() => ({
    supplierId: initialData?.supplierId || "",
    poDate: initialData?.poDate
      ? format(new Date(initialData.poDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    expectedDeliveryDate: initialData?.expectedDeliveryDate
      ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
      : "",
    status: initialData?.status || "Posted",
    notes: initialData?.notes || "",
  }));
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered: String(item.quantityOrdered || ""),
        unitCost: String(item.unitCost || ""),
      }));
    }
    return [{ productId: "", quantityOrdered: "", unitCost: "", description: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      supplierId: initialData.supplierId || "",
      poDate: initialData.poDate
        ? format(new Date(initialData.poDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      expectedDeliveryDate: initialData.expectedDeliveryDate
        ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
        : "",
      status: initialData.status || "Posted",
      notes: initialData.notes || "",
    });
    setItems(
      (initialData.items || []).map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered: String(item.quantityOrdered || ""),
        unitCost: String(item.unitCost || ""),
      }))
    );
  }, [initialData]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.quantityOrdered || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  );

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            if (!item.unitCost || Number(item.unitCost) === 0) {
              updated.unitCost = String(getDefaultProductCost(product));
            }
            if (!item.description) {
              updated.description = product.description || product.name || "";
            }
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantityOrdered: "", unitCost: "", description: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalizedItems = items.map((item) => ({
        ...item,
        quantityOrdered: Number(item.quantityOrdered || 0),
        unitCost: Number(item.unitCost || 0),
      }));
      await onSave({ ...form, items: normalizedItems });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <FormSection
        title="Order Information"
        description="Supplier, timing and status for this purchase request."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.supplierId}
              onChange={(e) => handleChange("supplierId", e.target.value)}
              required
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">PO Date *</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.poDate}
              onChange={(e) => handleChange("poDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              value={form.expectedDeliveryDate}
              onChange={(e) => handleChange("expectedDeliveryDate", e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Line Items"
        description="Each product row drives receiving, costing, and billing."
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 sm:grid-cols-5"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600">Product</label>
                <ProductSearchSelect
                  products={products}
                  value={item.productId}
                  onChange={(productId) => handleItemChange(idx, "productId", productId)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.quantityOrdered}
                  onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Cost Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.unitCost}
                  onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Description</label>
                <input
                  type="text"
                  placeholder="Optional note"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.description}
                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK{" "}
                  {(
                    Number(item.quantityOrdered || 0) * Number(item.unitCost || 0)
                  ).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => removeItem(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Notes & Totals" description="Internal instructions and quick totals overview.">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Delivery windows, approvals, offloading instructions…"
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-700">Subtotal</p>
              <p className="text-sm text-indigo-900">Products × cost price</p>
            </div>
            <div className="text-lg font-semibold text-indigo-900">
              MWK {subtotal.toLocaleString()}
            </div>
          </div>
        </div>
      </FormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Update Purchase Order" : "Save Purchase Order"}
        </button>
      </div>
    </form>
  );
}

// Receipt Form Component
function ReceiptForm({ suppliers, products, purchaseOrders, onSave, onCancel }) {
  const [form, setForm] = useState({
    supplierId: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    purchaseOrderId: "",
    status: "Posted",
    notes: "",
  });
  const [items, setItems] = useState([
    { productId: "", quantityReceived: 1, unitCost: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [key]: value };
        if (key === "productId" && value) {
          const product = products.find((p) => p.id === value);
          if (product && (!Number(item.unitCost) || Number(item.unitCost) === 0)) {
            updated.unitCost = getDefaultProductCost(product);
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantityReceived: 1, unitCost: 0 }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, items });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <FormSection title="Receipt Details" description="Supplier, dates, and posting status.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Receipt Date</label>
            <input
              type="date"
              name="receiptDate"
              value={form.receiptDate}
              onChange={handleChange}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
            <select
              name="purchaseOrderId"
              value={form.purchaseOrderId}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">(Optional)</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} — {po.supplier?.supplierName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Items Received"
        description="Quantities update product stock levels using weighted cost."
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-4"
            >
              <ProductSearchSelect
                products={products}
                value={item.productId}
                onChange={(productId) => handleItemChange(idx, "productId", productId)}
                required
              />
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantityReceived}
                onChange={(e) => handleItemChange(idx, "quantityReceived", e.target.value)}
                required
                placeholder="Quantity"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
                placeholder="Cost Price"
              />
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                <span>
                  MWK{" "}
                  {(
                    Number(item.quantityReceived || 0) * Number(item.unitCost || 0)
                  ).toLocaleString()}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Notes" description="Optional internal notes for this receipt.">
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Condition of goods, discrepancies, quality checks…"
        />
      </FormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Posting..." : "Post Receipt"}
        </button>
      </div>
    </form>
  );
}

// Payment Form Component
function PaymentForm({ suppliers, bills, onSave, onCancel, initialSupplierId = "", initialBillAllocations = [] }) {
  const [form, setForm] = useState({
    supplierId: initialSupplierId || "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState(initialBillAllocations);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const supplierBills = useMemo(() => {
    if (!form.supplierId) return [];
    return bills.filter((bill) => {
      const balanceDue = Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
      const supplierId = bill.supplierId || bill.supplier?.id || "";
      return supplierId === form.supplierId && balanceDue > 0;
    });
  }, [form.supplierId, bills]);

  useEffect(() => {
    if (form.supplierId) {
      setAllocations(
        supplierBills.map((bill) => ({
          billId: bill.id,
          amount:
            initialBillAllocations.find((alloc) => alloc.billId === bill.id)?.amount || 0,
        }))
      );
    } else {
      setAllocations([]);
    }
  }, [form.supplierId, supplierBills, initialBillAllocations]);

  useEffect(() => {
    if (initialSupplierId) {
      setForm((prev) => ({ ...prev, supplierId: initialSupplierId }));
    }
    if (initialBillAllocations.length) {
      setAllocations(initialBillAllocations);
    }
  }, [initialSupplierId, initialBillAllocations]);

  const totalAllocations = useMemo(
    () => allocations.reduce((sum, alloc) => sum + Number(alloc.amount || 0), 0),
    [allocations]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        totalAmount: totalAllocations,
        allocations: allocations.filter((alloc) => Number(alloc.amount) > 0),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAllocationChange = (billId, amount) => {
    setAllocations((prev) =>
      prev.map((alloc) => (alloc.billId === billId ? { ...alloc, amount } : alloc))
    );
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <PaymentFormSection title="Payment Details" description="Who is being paid and how.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier</label>
            <select
              name="supplierId"
              value={form.supplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, supplierId: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              name="paymentDate"
              value={form.paymentDate}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Airtel Money">Airtel Money</option>
              <option value="Mpamba">Mpamba</option>
              <option value="PayChangu">PayChangu</option>
              <option value="Cheque">Cheque</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reference</label>
            <input
              type="text"
              name="referenceNumber"
              value={form.referenceNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
              placeholder="Optional"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
      </PaymentFormSection>

      <PaymentFormSection
        title="Allocate to Bills"
        description="Distribute the payment across outstanding supplier bills."
      >
        {form.supplierId ? (
          <div className="space-y-3">
            {supplierBills.length === 0 ? (
              <p className="text-sm text-gray-500">No outstanding bills for this supplier.</p>
            ) : (
              supplierBills.map((bill) => {
                const balanceDue = Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
                return (
                  <div
                    key={bill.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{bill.billNumber}</div>
                      <div className="text-xs text-gray-500">
                        Due {bill.dueDate ? format(new Date(bill.dueDate), "dd MMM yyyy") : "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Balance MWK {balanceDue.toLocaleString()}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={balanceDue}
                      step="0.01"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={allocations.find((alloc) => alloc.billId === bill.id)?.amount || ""}
                      onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select a supplier to allocate payments.</p>
        )}
      </PaymentFormSection>

      <PaymentFormSection title="Notes & Total" description="Optional memo plus total payment amount.">
        <div className="space-y-3">
          <textarea
            name="notes"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Payment memo, cheque details, bank confirmation code…"
          />
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-700">Total Payment</p>
              <p className="text-sm text-emerald-900">Sum of bill allocations</p>
            </div>
            <div className="text-lg font-semibold text-emerald-900">
              MWK {totalAllocations.toLocaleString()}
            </div>
          </div>
        </div>
      </PaymentFormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || totalAllocations <= 0}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Record Payment"}
        </button>
      </div>
    </form>
  );
}

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState("suppliers");

  const receiptPoStatusFilter = useMemo(
    () => new Set(["Approved", "Sent", "Partially Received", "Received"]),
    []
  );
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [activeSupplier, setActiveSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Bills state
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billsError, setBillsError] = useState(null);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billFormMode, setBillFormMode] = useState("create");
  const [activeBill, setActiveBill] = useState(null);
  const [deletingBill, setDeletingBill] = useState(null);
  const [deleteBillLoading, setDeleteBillLoading] = useState(false);
  const [billStatusFilter, setBillStatusFilter] = useState("");
  const [billSupplierFilter, setBillSupplierFilter] = useState("");
  
  // Orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderFormMode, setOrderFormMode] = useState("create");
  const [activeOrder, setActiveOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [deleteOrderLoading, setDeleteOrderLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [businessBrand, setBusinessBrand] = useState({
    name: "Your Business Name",
    tagline: "Purchase Order Receipt",
    address: "Add your business address in settings",
    phone: "+000 000 000 000",
    email: "info@yourbusiness.com",
    logoUrl: null
  });
  
  // Receipts state
  const [receipts, setReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptsError, setReceiptsError] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [receiptStatusFilter, setReceiptStatusFilter] = useState("");
  const [receiptSupplierFilter, setReceiptSupplierFilter] = useState("");
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  
  // Payments state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSupplierFilter, setPaymentSupplierFilter] = useState("");
  const [unpaidBills, setUnpaidBills] = useState([]);

  // Load suppliers
  useEffect(() => {
    const fetchTenantBrand = async () => {
      try {
        const res = await fetch("/api/tenant/settings");
        if (!res.ok) {
          throw new Error("Failed to load business profile");
        }
        const data = await res.json();
        setBusinessBrand({
          name: data.name || "Your Business Name",
          tagline: "Purchase Order Receipt",
          address: data.businessAddress || "Add your business address in settings",
          phone: data.businessPhone || "+000 000 000 000",
          email: data.businessEmail || data.email || "info@yourbusiness.com",
          logoUrl: data.logoUrl || null
        });
      } catch (error) {
        console.error("Failed to load tenant profile", error);
      }
    };
    fetchTenantBrand();
  }, []);

  // Load suppliers
  useEffect(() => {
    if (activeTab !== "suppliers") return;
    let mounted = true;
    setLoading(true);
    fetchSuppliers(search, statusFilter)
      .then((data) => {
        if (mounted) {
          let sorted = [...(data.suppliers ?? [])];
          
          // Sort suppliers
          sorted.sort((a, b) => {
            let aVal = a[sortBy] || "";
            let bVal = b[sortBy] || "";
            
            // Handle numeric sorting
            if (sortBy === "currentBalance" || sortBy === "paymentTerms") {
              aVal = Number(aVal) || 0;
              bVal = Number(bVal) || 0;
            } else {
              aVal = String(aVal).toLowerCase();
              bVal = String(bVal).toLowerCase();
            }
            
            if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
            if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
            return 0;
          });
          
          setSuppliers(sorted);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, search, statusFilter, sortBy, sortOrder]);

  // Load bills
  useEffect(() => {
    if (activeTab !== "bills") return;
    let mounted = true;
    setBillsLoading(true);
    Promise.all([
      fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
    ])
      .then(([billData, supplierData]) => {
        if (mounted) {
          setBills(billData.bills ?? []);
          setBillsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setBillsError(err.message);
      })
      .finally(() => {
        if (mounted) setBillsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, billStatusFilter, billSupplierFilter]);

  // Load orders
  useEffect(() => {
    if (activeTab !== "orders") return;
    let mounted = true;
    setOrdersLoading(true);
    Promise.all([
      getOrders({ search: orderSearch, status: orderStatusFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/inventory").then((res) => res.json()),
    ])
      .then(([orderData, supplierData, productData]) => {
        if (mounted) {
          setOrders(orderData.purchaseOrders ?? []);
          setProducts(productData.products ?? []);
          setOrdersError(null);
        }
      })
      .catch((err) => {
        if (mounted) setOrdersError(err.message);
      })
      .finally(() => {
        if (mounted) setOrdersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, orderSearch, orderStatusFilter]);

  // Load receipts
  useEffect(() => {
    if (activeTab !== "receipts") return;
    let mounted = true;
    setReceiptsLoading(true);
    Promise.all([
      fetchReceipts({ status: receiptStatusFilter, supplierId: receiptSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/inventory").then((res) => res.json()),
      fetch("/api/purchases/orders?limit=200").then((res) => res.json()),
    ])
      .then(([receiptData, supplierData, productData, poData]) => {
        if (mounted) {
          setReceipts(receiptData.receipts ?? []);
          setProducts(productData.products ?? []);
          const filteredPOs = (poData.purchaseOrders ?? []).filter((po) =>
            receiptPoStatusFilter.has(po.status)
          );
          setPurchaseOrders(filteredPOs);
          setReceiptsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setReceiptsError(err.message);
      })
      .finally(() => {
        if (mounted) setReceiptsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, receiptStatusFilter, receiptSupplierFilter]);

  // Load payments
  useEffect(() => {
    if (activeTab !== "payments") return;
    let mounted = true;
    setPaymentsLoading(true);
    Promise.all([
      fetchPayments({ supplierId: paymentSupplierFilter }),
      fetch("/api/purchases/suppliers").then((res) => res.json()),
      fetch("/api/purchases/bills").then((res) => res.json()),
    ])
      .then(([paymentData, supplierData, billData]) => {
        if (mounted) {
          setPayments(paymentData.payments ?? []);
          const outstandingBills =
            billData.bills?.filter(
              (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
            ) ?? [];
          setUnpaidBills(
            outstandingBills.map((bill) => ({
              ...bill,
              balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
              supplierId: bill.supplierId || bill.supplier?.id || "",
            }))
          );
          setPaymentsError(null);
        }
      })
      .catch((err) => {
        if (mounted) setPaymentsError(err.message);
      })
      .finally(() => {
        if (mounted) setPaymentsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeTab, paymentSupplierFilter]);

  useEffect(() => {
    const outstandingBills =
      bills.filter(
        (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
      ) ?? [];
    setUnpaidBills(
      outstandingBills.map((bill) => ({
        ...bill,
        balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
        supplierId: bill.supplierId || bill.supplier?.id || ""
      }))
    );
  }, [bills]);

  const stats = useMemo(() => {
    const count = suppliers.length;
    const totalBalance = suppliers.reduce((sum, supplier) => sum + Number(supplier.currentBalance || 0), 0);
    const active = suppliers.filter((supplier) => supplier.isActive !== false).length;
    return {
      count,
      totalBalance,
      active,
    };
  }, [suppliers]);

  const handleSaveSupplier = async (formData) => {
    if (formMode === "edit" && activeSupplier) {
      await updateSupplier(activeSupplier.id, formData);
    } else {
      const res = await fetch("/api/purchases/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save supplier");
      }
    }
    setShowForm(false);
    setActiveSupplier(null);
    setSearch("");
    // Refresh suppliers list
    refreshSuppliers();
  };

  const refreshSuppliers = async () => {
    try {
      setLoading(true);
      const data = await fetchSuppliers(search, statusFilter);
      let sorted = [...(data.suppliers ?? [])];
      
      // Sort suppliers
      sorted.sort((a, b) => {
        let aVal = a[sortBy] || "";
        let bVal = b[sortBy] || "";
        
        // Handle numeric sorting
        if (sortBy === "currentBalance" || sortBy === "paymentTerms") {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else {
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();
        }
        
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
      
      setSuppliers(sorted);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setDeleteLoading(true);
    try {
      await deleteSupplier(deletingSupplier.id);
      setDeletingSupplier(null);
      setSearch("");
      refreshSuppliers();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedSuppliers.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      const updates = action === "activate" ? { isActive: true } : { isActive: false };
      await bulkUpdateSuppliers(Array.from(selectedSuppliers), updates);
      setSelectedSuppliers(new Set());
      setSearch("");
      refreshSuppliers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedSuppliers(new Set(suppliers.map(s => s.id)));
    } else {
      setSelectedSuppliers(new Set());
    }
  };

  const handleSelectSupplier = (id) => {
    const newSelected = new Set(selectedSuppliers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSuppliers(newSelected);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Bills handlers
  const billsStats = useMemo(() => {
    const total = bills.length;
    const unpaid = bills.filter((bill) => bill.status === "Unpaid" || bill.status === "Partially Paid").length;
    const overdue = bills.filter((bill) => bill.status === "Overdue").length;
    const outstanding = bills.reduce(
      (sum, bill) => sum + (Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0)),
      0
    );
    return { total, unpaid, overdue, outstanding };
  }, [bills]);

  const handleSaveBill = async (payload) => {
    if (billFormMode === "edit" && activeBill) {
      await updateBill(activeBill.id, payload);
    } else {
      await createBill(payload);
    }
    setShowBillForm(false);
    setActiveBill(null);
    // Reload bills
    const billData = await fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter });
    setBills(billData.bills ?? []);
  };

  const handleDeleteBill = async () => {
    if (!deletingBill) return;
    setDeleteBillLoading(true);
    try {
      await deleteBill(deletingBill.id);
      setDeletingBill(null);
      const billData = await fetchBills({ status: billStatusFilter, supplierId: billSupplierFilter });
      setBills(billData.bills ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteBillLoading(false);
    }
  };

  // Orders handlers
  const ordersStats = useMemo(() => {
    const total = orders.length;
    const awaitingApproval = orders.filter((order) => order.status === "Draft").length;
    const awaitingReceipt = orders.filter((order) => order.status === "Approved" || order.status === "Sent").length;
    const openAmount = orders
      .filter((order) => order.status !== "Cancelled" && order.status !== "Received")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    return { total, awaitingApproval, awaitingReceipt, openAmount };
  }, [orders]);

  const handleSaveOrder = async (payload) => {
    if (orderFormMode === "edit" && activeOrder) {
      await updateOrder(activeOrder.id, payload);
    } else {
      await createOrder(payload);
    }
    setShowOrderForm(false);
    setActiveOrder(null);
    // Reload orders
    const orderData = await getOrders({ search: orderSearch, status: orderStatusFilter });
    setOrders(orderData.purchaseOrders ?? []);
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setDeleteOrderLoading(true);
    try {
      await deleteOrder(deletingOrder.id);
      setDeletingOrder(null);
      const orderData = await getOrders({ search: orderSearch, status: orderStatusFilter });
      setOrders(orderData.purchaseOrders ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteOrderLoading(false);
    }
  };

  const handlePreviewOrder = (order) => {
    setPreviewOrder(order);
    setShowOrderPreview(true);
  };

  const handleExportOrderPreview = () => {
    if (!previewOrder) return;

    const itemsRows = (previewOrder.items || [])
      .map(
        (item, index) => `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">${index + 1}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${item.product?.name || item.description || "Product"}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${Number(item.quantityOrdered || 0).toLocaleString()}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoney(item.unitCost)}</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formatMoney(Number(item.quantityOrdered || 0) * Number(item.unitCost || 0))}</td>
        </tr>`
      )
      .join("");

    const logoUrl = businessBrand.logoUrl
      ? businessBrand.logoUrl.startsWith("http")
        ? businessBrand.logoUrl
        : `${window.location.origin}${businessBrand.logoUrl}`
      : null;

    const exportWindow = window.open("", "_blank");
    exportWindow.document.write(`
      <html>
        <head>
          <title>${previewOrder.poNumber} - Purchase Order</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h2 { margin-top: 32px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #f3f4f6; text-align: left; padding: 8px; border:1px solid #e5e7eb; }
            td { padding: 8px; border:1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:16px;">
              ${
                logoUrl
                  ? `<div style="height:64px;width:64px;border:1px solid #e5e7eb;border-radius:16px;padding:6px;display:flex;align-items:center;justify-content:center;">
                      <img src="${logoUrl}" alt="Logo" style="max-height:100%;max-width:100%;object-fit:contain;" />
                    </div>`
                  : ""
              }
              <div>
                <h1 style="margin:0;font-size:20px;color:#111827;">${businessBrand.name}</h1>
                <p style="margin:2px 0;color:#6b7280;font-size:12px;">${businessBrand.address}</p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">${businessBrand.phone} • ${businessBrand.email}</p>
              </div>
            </div>
            <div style="text-align:right;">
              <p style="text-transform:uppercase;font-size:10px;color:#6b7280;margin:0;">Document</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#111827;">${businessBrand.tagline}</p>
              <p style="margin:4px 0 0;color:#374151;font-size:16px;">${previewOrder.poNumber}</p>
            </div>
          </div>

          <p><strong>Supplier:</strong> ${previewOrder.supplier?.supplierName || "-"}</p>
          <p><strong>PO Date:</strong> ${
            previewOrder.poDate ? format(new Date(previewOrder.poDate), "dd MMM yyyy") : "-"
          }</p>
          <p><strong>Status:</strong> ${previewOrder.status}</p>
          <p><strong>Total Amount:</strong> ${formatMoney(previewOrder.totalAmount)}</p>
          <h2 style="margin-top:32px;">Line Items</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th style="text-align:right;">Qty Ordered</th>
                <th style="text-align:right;">Cost Price</th>
                <th style="text-align:right;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || `<tr><td colspan="5" style="padding:8px;border:1px solid #e5e7eb;text-align:center;">No items available</td></tr>`}
            </tbody>
          </table>
          
          ${
            previewOrder.notes
              ? `<h2 style="margin-top:32px;">Notes</h2>
                <div style="padding:12px;border:1px dashed #d1d5db;border-radius:8px;background:#f9fafb;">
                  ${previewOrder.notes}
                </div>`
              : ""
          }
        </body>
      </html>
    `);
    exportWindow.document.close();
    exportWindow.focus();
    exportWindow.print();
    exportWindow.close();
  };

  // Receipts handlers
  const receiptsStats = useMemo(() => {
    const total = receipts.length;
    const draft = receipts.filter((receipt) => receipt.status === "Draft").length;
    const posted = receipts.filter((receipt) => receipt.status === "Posted").length;
    const inventoryValue = receipts
      .filter((receipt) => receipt.status === "Posted")
      .reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
    return { total, draft, posted, inventoryValue };
  }, [receipts]);

  const handleSaveReceipt = async (payload) => {
    await postReceipt(payload);
    setShowReceiptForm(false);
    // Reload receipts
    const receiptData = await fetchReceipts({ status: receiptStatusFilter, supplierId: receiptSupplierFilter });
    setReceipts(receiptData.receipts ?? []);
  };

  // Payments handlers
  const paymentsStats = useMemo(() => {
    const total = payments.length;
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0);
    return { total, totalPaid };
  }, [payments]);

  const [pendingPaymentPrefill, setPendingPaymentPrefill] = useState(null);

  const handleSavePayment = async (payload) => {
    await createPayment(payload);
    setShowPaymentForm(false);
    setPendingPaymentPrefill(null);
    // Reload payments
    const paymentData = await fetchPayments({ supplierId: paymentSupplierFilter });
    setPayments(paymentData.payments ?? []);
    // Reload unpaid bills
    const billData = await fetch("/api/purchases/bills").then((res) => res.json());
    const outstandingBills =
      billData.bills?.filter(
        (bill) => Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0)
      ) ?? [];
    setUnpaidBills(
      outstandingBills.map((bill) => ({
        ...bill,
        balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
        supplierId: bill.supplierId || bill.supplier?.id || "",
      }))
    );
    setBills(billData.bills ?? []);
  };

  // Tab navigation
  const tabs = [
    { id: "suppliers", label: "Suppliers", icon: "👥" },
    
    { id: "orders", label: "Orders", icon: "📋" },
    { id: "bills", label: "Bills", icon: "📄" },
    { id: "receipts", label: "Receipts", icon: "📦" },
    { id: "payments", label: "Payments", icon: "💳" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Supplier Management</h1>
          <p className="text-sm text-gray-500">Manage suppliers, bills, orders, receipts, and payments.</p>
        </div>
        {activeTab === "suppliers" && (
          <button
            onClick={() => {
              setFormMode("create");
              setActiveSupplier(null);
              setShowForm(true);
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add Supplier
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "suppliers" && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Total Suppliers" value={stats.count} />
            <SummaryCard label="Active Suppliers" value={stats.active} />
            <SummaryCard
              label="Total Balance"
              value={`MWK ${stats.totalBalance.toLocaleString()}`}
              helper="Summed current balances"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 ">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, email, or phone..."
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">All Suppliers</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          <button
            onClick={refreshSuppliers}
            disabled={loading}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh supplier list"
          >
            {loading ? "Refreshing..." : "🔄"}
          </button>
        </div>

        {selectedSuppliers.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-indigo-50 p-3">
            <span className="text-sm font-medium text-indigo-900">
              {selectedSuppliers.size} supplier{selectedSuppliers.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction("activate")}
                disabled={bulkActionLoading}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkAction("deactivate")}
                disabled={bulkActionLoading}
                className="rounded-md bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                Deactivate
              </button>
              <button
                onClick={() => setSelectedSuppliers(new Set())}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading suppliers…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-500">No suppliers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.size === suppliers.length && suppliers.length > 0}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("supplierCode")}
                  >
                    <div className="flex items-center gap-1">
                      Code
                      {sortBy === "supplierCode" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("supplierName")}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortBy === "supplierName" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Phone
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("paymentTerms")}
                  >
                    <div className="flex items-center gap-1">
                      Payment Terms
                      {sortBy === "paymentTerms" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("isActive")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortBy === "isActive" && (sortOrder === "asc" ? "↑" : "↓")}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm">
                {suppliers.map((supplier) => (
                  <tr 
                    key={supplier.id}
                    className={selectedSuppliers.has(supplier.id) ? "bg-indigo-50" : ""}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.has(supplier.id)}
                        onChange={() => handleSelectSupplier(supplier.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs text-gray-600">{supplier.supplierCode}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-gray-900">{supplier.supplierName}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.contactPerson || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.phone || supplier.mobile || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {supplier.paymentTerms ?? 30} days
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        supplier.isActive !== false 
                          ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {supplier.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          onClick={() => {
                            setFormMode("edit");
                            setActiveSupplier(supplier);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingSupplier(supplier)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </>
      )}

      {activeTab === "bills" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Total Bills" value={billsStats.total} />
            <SummaryCard label="Unpaid / Partially Paid" value={billsStats.unpaid} />
            <SummaryCard label="Overdue" value={billsStats.overdue} />
            <SummaryCard
              label="Outstanding Balance"
              value={`MWK ${billsStats.outstanding.toLocaleString()}`}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Supplier Bills</h2>
              <button
                onClick={() => {
                  setBillFormMode("create");
                  setActiveBill(null);
                  setShowBillForm(true);
                }}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                New Bill
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={billSupplierFilter}
                onChange={(e) => setBillSupplierFilter(e.target.value)}
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={billStatusFilter}
                onChange={(e) => setBillStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {billsLoading ? (
              <p className="text-sm text-gray-500">Loading bills…</p>
            ) : billsError ? (
              <p className="text-sm text-red-500">{billsError}</p>
            ) : bills.length === 0 ? (
              <p className="text-sm text-gray-500">No bills found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Bill #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Due Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Balance
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {bills.map((bill) => (
                      <tr key={bill.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{bill.billNumber}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {bill.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">{bill.supplierInvoiceNumber ?? "-"}</div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {bill.dueDate ? format(new Date(bill.dueDate), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              bill.status === "Paid"
                                ? "bg-green-100 text-green-800"
                                : bill.status === "Overdue"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {bill.status}
                          </span>
                    </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number((Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0))).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            {Number(bill.totalAmount || 0) > Number(bill.amountPaid || 0) && (
                              <button
                                className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                                onClick={() => {
                                  const supplierId = bill.supplierId || bill.supplier?.id || "";
                                  setPaymentSupplierFilter(supplierId);
                                  setShowPaymentForm(true);
                              setPendingPaymentPrefill({
                                supplierId,
                                allocations: [
                                  {
                                    billId: bill.id,
                                    amount: Number(
                                      (Number(bill.totalAmount || 0) -
                                        Number(bill.amountPaid || 0)).toFixed(2)
                                    ),
                                  },
                                ],
                              });
                                }}
                              >
                                Make Payment
                              </button>
                            )}
                            <button
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                              onClick={() => {
                                setBillFormMode("edit");
                                setActiveBill(bill);
                                setShowBillForm(true);
                              }}
                              disabled={bill.status === "Paid" || bill.status === "Partially Paid"}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                              onClick={() => setDeletingBill(bill)}
                              disabled={bill.status === "Paid" || bill.status === "Partially Paid"}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "orders" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Total Orders" value={ordersStats.total} helper="All time" />
            <SummaryCard label="Awaiting Approval" value={ordersStats.awaitingApproval} />
            <SummaryCard label="Awaiting Receipt" value={ordersStats.awaitingReceipt} />
            <SummaryCard
              label="Open Amount"
              value={`MWK ${ordersStats.openAmount.toLocaleString()}`}
              helper="Excludes cancelled orders"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Purchase Orders</h2>
              <button
                onClick={() => {
                  setOrderFormMode("create");
                  setActiveOrder(null);
                  setShowOrderForm(true);
                }}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                New Purchase Order
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="Search PO number or supplier…"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                {Object.keys(statusColors).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {ordersLoading ? (
              <p className="text-sm text-gray-500">Loading purchase orders…</p>
            ) : ordersError ? (
              <p className="text-sm text-red-500">{ordersError}</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-gray-500">No purchase orders found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        PO #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Total
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{order.poNumber}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {order.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.items?.length ?? 0} items
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {order.poDate ? format(new Date(order.poDate), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              statusColors[order.status] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(order.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-gray-50"
                              onClick={() => handlePreviewOrder(order)}
                            >
                              <Eye size={14} />
                              Preview
                            </button>
                            <button
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                              onClick={() => {
                                setOrderFormMode("edit");
                                setActiveOrder(order);
                                setShowOrderForm(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() => setDeletingOrder(order)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "receipts" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Receipts" value={receiptsStats.total} helper="All statuses" />
            <SummaryCard label="Draft" value={receiptsStats.draft} />
            <SummaryCard label="Posted" value={receiptsStats.posted} />
            <SummaryCard
              label="Posted Inventory"
              value={`MWK ${receiptsStats.inventoryValue.toLocaleString()}`}
              helper="Added to stock"
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Goods Receipts</h2>
              <button
                onClick={() => setShowReceiptForm(true)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Receive Goods
              </button>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={receiptSupplierFilter}
                onChange={(e) => setReceiptSupplierFilter(e.target.value)}
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={receiptStatusFilter}
                onChange={(e) => setReceiptStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Posted">Posted</option>
              </select>
            </div>

            {receiptsLoading ? (
              <p className="text-sm text-gray-500">Loading receipts…</p>
            ) : receiptsError ? (
              <p className="text-sm text-red-500">{receiptsError}</p>
            ) : receipts.length === 0 ? (
              <p className="text-sm text-gray-500">No goods receipts found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Receipt #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {receipts.map((receipt) => (
                      <tr key={receipt.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {receipt.receiptNumber}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {receipt.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            PO {receipt.purchaseOrder?.poNumber ?? "-"}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {receipt.receiptDate
                            ? format(new Date(receipt.receiptDate), "dd MMM yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              receipt.status === "Posted"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {receipt.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(receipt.totalAmount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "payments" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="Payments Recorded" value={paymentsStats.total} />
            <SummaryCard label="Total Disbursed" value={`MWK ${paymentsStats.totalPaid.toLocaleString()}`} />
            <SummaryCard
              label="This Month"
              value={`MWK ${payments
                .filter((payment) => {
                  if (!payment.paymentDate) return false;
                  const date = new Date(payment.paymentDate);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                })
                .reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0)
                .toLocaleString()}`}
            />
            <SummaryCard
              label="Average Payment"
              value={`MWK ${(paymentsStats.totalPaid / (paymentsStats.total || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Supplier Payments</h2>
              <button
                onClick={() => setShowPaymentForm(true)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Record Payment
              </button>
            </div>

            <div className="mb-4">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={paymentSupplierFilter}
                onChange={(e) => setPaymentSupplierFilter(e.target.value)}
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>

            {paymentsLoading ? (
              <p className="text-sm text-gray-500">Loading payments…</p>
            ) : paymentsError ? (
              <p className="text-sm text-red-500">{paymentsError}</p>
            ) : payments.length === 0 ? (
              <p className="text-sm text-gray-500">No supplier payments recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Payment #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Method
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white text-sm">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-2 font-semibold text-gray-900">{payment.paymentNumber}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900">
                            {payment.supplier?.supplierName ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.allocations?.length || 0} bill{payment.allocations?.length !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {payment.paymentDate ? format(new Date(payment.paymentDate), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{payment.paymentMethod}</td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(payment.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showOrderPreview && previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="relative border-b bg-gray-50 px-6 py-6">
              <button
                onClick={() => {
                  setShowOrderPreview(false);
                  setPreviewOrder(null);
                }}
                className="absolute right-4 top-4 text-gray-500 transition hover:text-gray-700"
                aria-label="Close preview"
              >
                ✕
              </button>
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {businessBrand.logoUrl && (
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-indigo-100 bg-white p-2">
                    <Image
                      src={businessBrand.logoUrl}
                      alt={`${businessBrand.name} logo`}
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <div className={businessBrand.logoUrl ? "" : "pl-0"}>
                    <p className="text-lg font-semibold text-gray-900">
                      {businessBrand.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {businessBrand.address}
                    </p>
                    <p className="text-xs text-gray-400">
                      {businessBrand.phone} • {businessBrand.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Document
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {businessBrand.tagline}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {previewOrder.poNumber}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase text-gray-500 tracking-wide">
            Supplier Details
          </p>
          <div className="mt-2 text-sm">
            <p className="font-semibold text-gray-900">
              {previewOrder.supplier?.supplierName || "—"}
            </p>
            <p className="text-gray-500">
              Code: {previewOrder.supplier?.supplierCode || "—"}
            </p>
            <p className="text-gray-500">
              Email: {previewOrder.supplier?.email || "—"}
            </p>
            <p className="text-gray-500">
              Phone: {previewOrder.supplier?.phone || previewOrder.supplier?.mobile || "—"}
            </p>
          </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase text-gray-500 tracking-wide">
            Order Details
          </p>
          <div className="mt-2 text-sm text-gray-900 space-y-1">
            <p>
              <span className="text-gray-500">PO Date:</span>{" "}
              {previewOrder.poDate
                ? format(new Date(previewOrder.poDate), "dd MMM yyyy")
                : "—"}
            </p>
            <p>
              <span className="text-gray-500">Expected Delivery:</span>{" "}
              {previewOrder.expectedDeliveryDate
                ? format(new Date(previewOrder.expectedDeliveryDate), "dd MMM yyyy")
                : "—"}
            </p>
            <p>
              <span className="text-gray-500">Payment Terms:</span>{" "}
              {previewOrder.paymentTerms
                ? `${previewOrder.paymentTerms} days`
                : "—"}
            </p>
          </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">Status</p>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[previewOrder.status] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {previewOrder.status}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs uppercase text-gray-500">Total Amount</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatMoney(previewOrder.totalAmount)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Line Items
                  </h3>
                </div>
                <div className="mt-2 overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2">Product</th>
                        <th className="px-4 py-2 text-right">Qty Ordered</th>
                        <th className="px-4 py-2 text-right">Cost Price</th>
                        <th className="px-4 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewOrder.items?.length ? (
                        previewOrder.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-gray-900">
                              {item.product?.name || item.description || "Product"}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {Number(item.quantityOrdered || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {formatMoney(item.unitCost)}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">
                              {formatMoney(
                                Number(item.quantityOrdered || 0) *
                                  Number(item.unitCost || 0)
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="px-4 py-4 text-center text-gray-500"
                            colSpan={4}
                          >
                            No items available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-xs uppercase text-gray-500 tracking-wide">
                  Notes
                </p>
                <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 min-h-[80px]">
                  {previewOrder.notes || "No additional notes provided for this purchase order."}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setShowOrderPreview(false);
                  setPreviewOrder(null);
                }}
              >
                Close
              </button>
              <button
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                onClick={handleExportOrderPreview}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 ">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formMode === "edit" ? "Edit Supplier" : "New Supplier"}
                </h2>
                {formMode === "edit" && (
                  <p className="text-xs text-gray-500">{activeSupplier?.supplierCode}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setActiveSupplier(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <SupplierForm
              initialData={formMode === "edit" ? activeSupplier : undefined}
              onSave={handleSaveSupplier}
              onCancel={() => {
                setShowForm(false);
                setActiveSupplier(null);
              }}
            />
          </div>
        </div>
      )}

      {deletingSupplier && (
        <ConfirmDialog
          title="Delete Supplier"
          message={`Are you sure you want to delete ${deletingSupplier.supplierName}?`}
          onConfirm={handleDeleteSupplier}
          onCancel={() => setDeletingSupplier(null)}
          loading={deleteLoading}
        />
      )}

      {/* Bill Form Modal */}
      {showBillForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {billFormMode === "edit" ? "Edit Bill" : "New Supplier Bill"}
              </h2>
              <button
                onClick={() => {
                  setShowBillForm(false);
                  setActiveBill(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <BillForm
              suppliers={suppliers}
              initialData={billFormMode === "edit" ? activeBill : null}
              onSave={handleSaveBill}
              onCancel={() => {
                setShowBillForm(false);
                setActiveBill(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Order Form Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {orderFormMode === "edit" ? "Edit Purchase Order" : "New Purchase Order"}
              </h2>
              <button
                onClick={() => {
                  setShowOrderForm(false);
                  setActiveOrder(null);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <OrderForm
              suppliers={suppliers}
              products={products}
              initialData={orderFormMode === "edit" ? activeOrder : null}
              onSave={handleSaveOrder}
              onCancel={() => {
                setShowOrderForm(false);
                setActiveOrder(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Receipt Form Modal */}
      {showReceiptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Goods Receipt</h2>
              <button
                onClick={() => setShowReceiptForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptForm
              suppliers={suppliers}
              products={products}
              purchaseOrders={purchaseOrders}
              onSave={handleSaveReceipt}
              onCancel={() => setShowReceiptForm(false)}
            />
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New Supplier Payment</h2>
              <button
                onClick={() => setShowPaymentForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              suppliers={suppliers}
              bills={unpaidBills}
              onSave={handleSavePayment}
              onCancel={() => {
                setShowPaymentForm(false);
                setPendingPaymentPrefill(null);
              }}
              initialSupplierId={pendingPaymentPrefill?.supplierId}
              initialBillAllocations={pendingPaymentPrefill?.allocations || []}
            />
          </div>
        </div>
      )}
    </div>
  );
}

