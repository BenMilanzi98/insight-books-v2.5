"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const statusOptions = ["Draft", "Posted"];

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

const formCardClass =
  "space-y-4 rounded-2xl border border-gray-200 bg-white/95 p-4  ring-1 ring-gray-50";

function FormSection({ title, description, children }) {
  return (
    <div className={formCardClass}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ReceiptForm({ suppliers, products, purchaseOrders, onSave, onCancel }) {
  const [form, setForm] = useState({
    supplierId: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    purchaseOrderId: "",
    status: "Draft",
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
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
            <select
              name="purchaseOrderId"
              value={form.purchaseOrderId}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">(Optional)</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} — {po.supplier?.supplierName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              <select
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                value={item.productId}
                onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                required
              >
                <option value="">Product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantityReceived}
                onChange={(e) => handleItemChange(idx, "quantityReceived", e.target.value)}
                required
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
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
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white  hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Posting..." : "Post Receipt"}
        </button>
      </div>
    </form>
  );
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

function ReceiptDetails({ receipt, onClose }) {
  if (!receipt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white ">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{receipt.receiptNumber}</h2>
            <p className="text-sm text-gray-500">
              {receipt.supplier?.supplierName ?? "—"} •{" "}
              {receipt.receiptDate ? formatDateDDMMYYYY(receipt.receiptDate) : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-gray-500">Status</div>
              <div className="mt-1">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    receipt.status === "Posted"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {receipt.status}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Total Amount</div>
              <div className="mt-1 text-gray-900">
                MWK {Number(receipt.totalAmount || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">PO Link</div>
              <div className="mt-1 text-gray-900">
                {receipt.purchaseOrder?.poNumber ?? "Not linked"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Received By</div>
              <div className="mt-1 text-gray-900">{receipt.receivedBy?.name ?? "—"}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Items</h3>
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
                  {receipt.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-gray-900">{item.product?.name ?? item.productId}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {Number(item.quantityReceived || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        MWK {Number(item.unitCost || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        MWK{" "}
                        {(
                          Number(item.quantityReceived || 0) * Number(item.unitCost || 0)
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptData, supplierData, productData, poData] = await Promise.all([
        fetchReceipts({ status: statusFilter, supplierId: supplierFilter }),
        fetch("/api/purchases/suppliers").then((res) => res.json()),
        fetch("/api/inventory").then((res) => res.json()),
        fetch("/api/purchases/orders?status=Approved").then((res) => res.json()),
      ]);
      setReceipts(receiptData.receipts ?? []);
      setSuppliers(supplierData.suppliers ?? []);
      setProducts(productData.products ?? []);
      setPurchaseOrders(poData.purchaseOrders ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load goods receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, supplierFilter]);

  const stats = useMemo(() => {
    const total = receipts.length;
    const draft = receipts.filter((receipt) => receipt.status === "Draft").length;
    const posted = receipts.filter((receipt) => receipt.status === "Posted").length;
    const inventoryValue = receipts
      .filter((receipt) => receipt.status === "Posted")
      .reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
    return { total, draft, posted, inventoryValue };
  }, [receipts]);

  const handleCreate = async (payload) => {
    await postReceipt(payload);
    setShowForm(false);
    await loadData();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Goods Receipts</h1>
          <p className="text-sm text-gray-500">
            Receive purchased items and update inventory with average cost.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Receive Goods
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Receipts" value={stats.total} helper="All statuses" />
        <SummaryCard label="Draft" value={stats.draft} />
        <SummaryCard label="Posted" value={stats.posted} />
        <SummaryCard
          label="Posted Inventory"
          value={`MWK ${stats.inventoryValue.toLocaleString()}`}
          helper="Added to stock"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 ">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">All Suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplierName}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading receipts…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
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
                    <td className="px-4 py-2 text-right">
                      <button
                        className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        onClick={() => setViewingReceipt(receipt)}
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 ">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Receive Goods</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptForm
              suppliers={suppliers}
              products={products}
              purchaseOrders={purchaseOrders}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {viewingReceipt && (
        <ReceiptDetails receipt={viewingReceipt} onClose={() => setViewingReceipt(null)} />
      )}
    </div>
  );
}

