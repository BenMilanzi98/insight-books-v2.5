"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";
import {
  assertReceiptDateOnOrAfterPurchaseOrder,
  getPurchaseOrderMinReceiptDateStr,
  isReceiptDateStrictlyAfterTodayUTC,
} from "@/lib/goodsReceiptDateUtils";
import { receiptUnitCostFromPurchaseOrderLine } from "@/lib/receiptUnitCostFromPoLine";

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

function ReceiptForm({ suppliers, products, purchaseOrders, receiptMode = "inventory", onSave, onCancel }) {
  const isServiceMode = receiptMode === "service";
  const [form, setForm] = useState({
    supplierId: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    purchaseOrderId: "",
    status: receiptMode === "service" ? "Draft" : "Posted",
    notes: "",
  });
  const [items, setItems] = useState([
    { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedPo = useMemo(
    () => purchaseOrders.find((po) => po.id === form.purchaseOrderId) || null,
    [purchaseOrders, form.purchaseOrderId]
  );

  /** When a supplier is chosen, only list their purchase orders. */
  const purchaseOrdersForSupplier = useMemo(() => {
    if (!form.supplierId) return purchaseOrders;
    return purchaseOrders.filter((po) => po.supplierId === form.supplierId);
  }, [purchaseOrders, form.supplierId]);

  useEffect(() => {
    if (!form.purchaseOrderId || !form.supplierId) return;
    const po = purchaseOrders.find((p) => p.id === form.purchaseOrderId);
    if (po && po.supplierId !== form.supplierId) {
      setForm((prev) => ({ ...prev, purchaseOrderId: "" }));
      if (!isServiceMode) {
        setItems([
          { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
        ]);
      }
    }
  }, [form.supplierId, form.purchaseOrderId, purchaseOrders, isServiceMode]);

  const receiptDateMin =
    getPurchaseOrderMinReceiptDateStr(selectedPo) ?? undefined;

  const showFutureStockNotice =
    !isServiceMode &&
    form.receiptDate &&
    isReceiptDateStrictlyAfterTodayUTC(form.receiptDate);

  const poLinesLocked = !isServiceMode && Boolean(form.purchaseOrderId);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "supplierId") {
      const filtered = value
        ? purchaseOrders.filter((po) => po.supplierId === value)
        : purchaseOrders;
      const keepPo = filtered.some((p) => p.id === form.purchaseOrderId);
      setForm((prev) => ({
        ...prev,
        supplierId: value,
        purchaseOrderId: keepPo ? prev.purchaseOrderId : "",
      }));
      if (!keepPo && !isServiceMode) {
        setItems([
          { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
        ]);
      }
      return;
    }
    if (name === "purchaseOrderId") {
      if (!value) {
        setForm((prev) => ({ ...prev, purchaseOrderId: "" }));
        if (!isServiceMode) {
          setItems([
            { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
          ]);
        }
        return;
      }
      const selectedPO = purchaseOrdersForSupplier.find((po) => po.id === value);
      const poMin = getPurchaseOrderMinReceiptDateStr(selectedPO);
      setForm((prev) => ({
        ...prev,
        purchaseOrderId: value,
        // Default receipt to PO order date so backdated orders can be received on historical dates.
        receiptDate: poMin || prev.receiptDate,
        ...(selectedPO?.supplierId ? { supplierId: selectedPO.supplierId } : {}),
      }));
      if (!isServiceMode && selectedPO?.items?.length) {
        const goodsItems = selectedPO.items.filter(
          (line) => line.productId && (line.lineType || "goods") === "goods"
        );
        const openLines = goodsItems.filter((line) => {
          const rem =
            Number(line.quantityOrdered ?? 0) - Number(line.quantityReceived ?? 0);
          return rem > 0;
        });
        if (openLines.length > 0) {
          const pit = selectedPO.pricesIncludeTax === true;
          setItems(
            openLines.map((line) => {
              const ordered = Number(line.quantityOrdered ?? 0);
              const already = Number(line.quantityReceived ?? 0);
              const remaining = Math.max(0, ordered - already);
              return {
                productId: line.productId,
                poItemId: line.id,
                quantityReceived: remaining > 0 ? remaining : 1,
                unitCost: receiptUnitCostFromPurchaseOrderLine(line, pit),
              };
            })
          );
        } else {
          setItems([
            { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
          ]);
        }
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => {
    if (poLinesLocked) return;
    setItems((prev) => [
      ...prev,
      { productId: "", quantityReceived: 1, unitCost: 0, poItemId: null },
    ]);
  };

  const removeItem = (index) => {
    if (poLinesLocked) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (selectedPo && receiptDateMin && form.receiptDate) {
        try {
          assertReceiptDateOnOrAfterPurchaseOrder(form.receiptDate, selectedPo);
        } catch (validationErr) {
          throw new Error(validationErr.message || String(validationErr));
        }
      }
      const payload = isServiceMode
        ? { ...form, receiptType: "service", items: [] }
        : {
            ...form,
            receiptType: "inventory",
            status: "Posted",
            items: items.map((row) => ({
              ...row,
              poItemId: row.poItemId || undefined,
            })),
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
              min={receiptDateMin}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            />
            {receiptDateMin && selectedPo && (
              <p className="mt-1 text-xs text-gray-500">
                Cannot be before the purchase order date (
                {format(
                  new Date(selectedPo.poDate || selectedPo.createdAt),
                  "dd MMM yyyy"
                )}
                ). You can choose that day or any later date (including today).
              </p>
            )}
            {showFutureStockNotice && (
              <p className="mt-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                This receipt date is in the future. Stock, inventory valuation, and the linked supplier bill will be
                applied automatically on that date (daily job). You can still record the receipt now.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Purchase Order</label>
            <select
              name="purchaseOrderId"
              value={form.purchaseOrderId}
              onChange={handleChange}
              required={isServiceMode}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">
                {isServiceMode
                  ? form.supplierId
                    ? "Select service PO"
                    : "Select supplier first"
                  : form.supplierId
                    ? "(Optional)"
                    : "Select supplier to filter orders (optional)"}
              </option>
              {purchaseOrdersForSupplier.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} — {po.supplier?.supplierName}
                </option>
              ))}
            </select>
          </div>
          {isServiceMode && (
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
          )}
        </div>
      </FormSection>

      {isServiceMode ? (
        <FormSection
          title="Service Receipt Confirmation"
          description="Confirms service completion for a services/mixed PO. This does not update inventory stock."
        >
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Select a service PO, then post receipt to move it to payables.
          </div>
        </FormSection>
      ) : (
        <FormSection title="Items Received">
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
                  {items.length > 1 && !poLinesLocked && (
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
              disabled={poLinesLocked}
              className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add Item
            </button>
          </div>
        </FormSection>
      )}

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
              <div className="mt-1 space-y-1">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    receipt.status === "Posted"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {receipt.status}
                </span>
                {receipt.deferredStockPosting && (
                  <p className="text-xs text-sky-800">
                    Stock scheduled for{" "}
                    {receipt.receiptDate ? formatDateDDMMYYYY(receipt.receiptDate) : "receipt date"}.
                  </p>
                )}
                {receipt.stockPostingPending && !receipt.deferredStockPosting && (
                  <p className="text-xs text-amber-800">
                    Stock posting pending (runs on the next scheduled job if not applied yet).
                  </p>
                )}
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
              {Array.isArray(receipt.items) && receipt.items.length > 0 ? (
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
                    {receipt.items.map((item) => (
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
              ) : (
                <div className="bg-white px-4 py-3 text-sm text-gray-600">
                  Service receipt (no inventory items).
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoodsReceiptsPage() {
  const [activeReceiptTab, setActiveReceiptTab] = useState("inventory");
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
        fetch("/api/stock").then((res) => res.json()),
        fetch("/api/purchases/orders?status=Approved").then((res) => res.json()),
      ]);
      const allReceipts = receiptData.receipts ?? [];
      const filteredReceipts =
        activeReceiptTab === "service"
          ? allReceipts.filter((r) => (r.receiptType || "inventory") === "service")
          : allReceipts.filter((r) => (r.receiptType || "inventory") === "inventory");
      setReceipts(filteredReceipts);
      setSuppliers(supplierData.suppliers ?? []);
      setProducts(productData.products ?? []);
      const allPos = poData.purchaseOrders ?? [];
      const filteredPos =
        activeReceiptTab === "service"
          ? allPos.filter(
              (po) =>
                po &&
                (po.orderType === "services" || po.orderType === "mixed") &&
                (po.status === "Approved" || po.status === "Partially Received")
            )
          : allPos.filter(
              (po) =>
                po &&
                (po.orderType === "goods" || po.orderType === "mixed" || po.orderType === "assets") &&
                (po.status === "Approved" || po.status === "Partially Received")
            );
      setPurchaseOrders(filteredPos);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load goods receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, supplierFilter, activeReceiptTab]);

  const stats = useMemo(() => {
    const total = receipts.length;
    const draft = receipts.filter((receipt) => receipt.status === "Draft").length;
    const posted = receipts.filter((receipt) => receipt.status === "Posted").length;
    const pendingStock = receipts.filter((r) => r.stockPostingPending).length;
    const inventoryValue = receipts
      .filter((receipt) => receipt.status === "Posted")
      .reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
    return { total, draft, posted, pendingStock, inventoryValue };
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
          <h1 className="text-2xl font-semibold text-gray-900">
            {activeReceiptTab === "service" ? "Service Receipts" : "Goods Receipts"}
          </h1>
          <p className="text-sm text-gray-500">
            {activeReceiptTab === "service"
              ? "Confirm completed service deliveries separately from inventory receipts."
              : "Receive purchased items and update inventory with average cost."}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {activeReceiptTab === "service" ? "Receive Service" : "Receive Goods"}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-1 inline-flex gap-1">
        <button
          type="button"
          onClick={() => setActiveReceiptTab("inventory")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeReceiptTab === "inventory"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Inventory Receipt
        </button>
        <button
          type="button"
          onClick={() => setActiveReceiptTab("service")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            activeReceiptTab === "service"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Goods/Service Receipt
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Receipts" value={stats.total} helper="All statuses" />
        {activeReceiptTab === "inventory" ? (
          <SummaryCard
            label="Stock pending"
            value={stats.pendingStock}
            helper="Posted, not in stock yet"
          />
        ) : (
          <SummaryCard label="Draft" value={stats.draft} />
        )}
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
          <p className="text-sm text-gray-500">
            {activeReceiptTab === "service" ? "No service receipts found." : "No goods receipts found."}
          </p>
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
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            receipt.status === "Posted"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {receipt.status}
                        </span>
                        {receipt.deferredStockPosting && (
                          <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-900">
                            Stock on receipt date
                          </span>
                        )}
                      </div>
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
              <h2 className="text-lg font-semibold text-gray-900">
                {activeReceiptTab === "service" ? "Receive Service" : "Receive Goods"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <ReceiptForm
              key={activeReceiptTab}
              suppliers={suppliers}
              products={products}
              purchaseOrders={purchaseOrders}
              receiptMode={activeReceiptTab}
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

