 "use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const statusColors = {
  Draft: "bg-gray-100 text-gray-800",
  Approved: "bg-blue-100 text-blue-800",
  Sent: "bg-indigo-100 text-indigo-800",
  "Partially Received": "bg-yellow-100 text-yellow-800",
  Received: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

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

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 ">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
    </div>
  );
}

function DetailDrawer({ order, onClose }) {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white ">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{order.poNumber}</h2>
            <p className="text-sm text-gray-500">
              {order.supplier?.supplierName ?? "No supplier"} •{" "}
              {order.poDate ? formatDateDDMMYYYY(order.poDate) : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-6 p-6">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-xs uppercase text-gray-500">Status</div>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[order.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Expected Delivery</div>
                <div className="mt-1 text-gray-900">
                  {order.expectedDeliveryDate
                    ? formatDateDDMMYYYY(order.expectedDeliveryDate)
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Total</div>
                <div className="mt-1 text-gray-900">
                  MWK {Number(order.totalAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Unit Cost</th>
                    <th className="px-4 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {order.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-gray-900">{item.description || "Product"}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {Number(item.quantityOrdered || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        MWK {Number(item.unitCost || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        MWK{" "}
                        {(
                          Number(item.quantityOrdered || 0) * Number(item.unitCost || 0)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {order.receipts?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Linked Receipts</h3>
              <div className="mt-2 space-y-3">
                {order.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{receipt.receiptNumber}</div>
                      <div className="text-xs text-gray-500">
                        {receipt.receiptDate
                          ? format(new Date(receipt.receiptDate), "dd MMM yyyy")
                          : "—"}
                      </div>
                    </div>
                    <span className="text-xs uppercase text-gray-500">Posted</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
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

const formPanelClass =
  "space-y-4 rounded-2xl border border-gray-200 bg-white/95 p-4  ring-1 ring-gray-50";

function FormSection({ title, description, children }) {
  return (
    <div className={formPanelClass}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

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
    status: initialData?.status || "Draft",
    notes: initialData?.notes || "",
  }));
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered:
          item.quantityOrdered === undefined || item.quantityOrdered === null
            ? ""
            : String(item.quantityOrdered),
        unitCost:
          item.unitCost === undefined || item.unitCost === null
            ? ""
            : String(item.unitCost),
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
      status: initialData.status || "Draft",
      notes: initialData.notes || "",
    });
    setItems(
      (initialData.items || []).map((item) => ({
        productId: item.productId,
        description: item.description || "",
        quantityOrdered: Number(item.quantityOrdered || 1),
        unitCost: Number(item.unitCost || 0),
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
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              {Object.keys(statusColors).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">PO Date *</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
              value={form.poDate}
              onChange={(e) => handleChange("poDate", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.productId}
                  onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                  required
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                  value={item.quantityOrdered}
                  onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Unit Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
              rows={3}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Delivery windows, approvals, offloading instructions…"
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-700">Subtotal</p>
              <p className="text-sm text-indigo-900">Products × unit cost</p>
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
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white  hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Update Purchase Order" : "Save Purchase Order"}
        </button>
      </div>
    </form>
  );
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [activeOrder, setActiveOrder] = useState(null);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [orderRes, supplierRes, productRes] = await Promise.all([
        getOrders({ search, status: statusFilter }),
        fetch("/api/purchases/suppliers").then((res) => res.json()),
        fetch("/api/inventory").then((res) => res.json()),
      ]);
      setOrders(orderRes.purchaseOrders ?? []);
      setSuppliers(supplierRes.suppliers ?? []);
      setProducts(productRes.products ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const awaitingApproval = orders.filter((o) => ["Draft", "Sent"].includes(o.status)).length;
    const awaitingReceipt = orders.filter((o) => o.status === "Approved" || o.status === "Partially Received").length;
    const openAmount = orders
      .filter((o) => o.status !== "Cancelled")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    return {
      total,
      awaitingApproval,
      awaitingReceipt,
      openAmount,
    };
  }, [orders]);

  const openCreateForm = () => {
    setFormMode("create");
    setActiveOrder(null);
    setShowForm(true);
  };

  const openEditForm = (order) => {
    setFormMode("edit");
    setActiveOrder(order);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setActiveOrder(null);
  };

  const handleSaveOrder = async (payload) => {
    try {
      if (formMode === "edit" && activeOrder) {
        await updateOrder(activeOrder.id, payload);
      } else {
        await createOrder(payload);
      }
      closeForm();
      await loadInitialData();
      showToast("Purchase order saved.", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save purchase order.");
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setDeleteLoading(true);
    try {
      await deleteOrder(deletingOrder.id);
      setDeletingOrder(null);
      await loadInitialData();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to delete purchase order.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg border px-4 py-2 text-sm ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500">
            Track procurement requests, approvals, receipts, and remaining balances.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          New Purchase Order
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Orders" value={stats.total} helper="All time" />
        <SummaryCard label="Awaiting Approval" value={stats.awaitingApproval} />
        <SummaryCard label="Awaiting Receipt" value={stats.awaitingReceipt} />
        <SummaryCard
          label="Open Amount"
          value={`MWK ${stats.openAmount.toLocaleString()}`}
          helper="Excludes cancelled orders"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 ">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search PO number or supplier…"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.keys(statusColors).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading purchase orders…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
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
                      {order.poDate ? formatDateDDMMYYYY(order.poDate) : "—"}
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
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          onClick={() => setViewingOrder(order)}
                        >
                          View
                        </button>
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          onClick={() => openEditForm(order)}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 ">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {formMode === "edit" ? "Edit Purchase Order" : "New Purchase Order"}
                </h2>
                {formMode === "edit" && (
                  <p className="text-xs text-gray-500">{activeOrder?.poNumber}</p>
                )}
              </div>
              <button
                onClick={closeForm}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <OrderForm
              suppliers={suppliers}
              products={products}
              initialData={formMode === "edit" ? activeOrder : null}
              onSave={handleSaveOrder}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      {viewingOrder && (
        <DetailDrawer order={viewingOrder} onClose={() => setViewingOrder(null)} />
      )}

      {deletingOrder && (
        <ConfirmDialog
          title="Delete Purchase Order"
          message={`Are you sure you want to delete ${deletingOrder.poNumber}? This cannot be undone.`}
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeletingOrder(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

