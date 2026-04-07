 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";
import ProductSearchSelect from "@/components/ProductSearchSelect";

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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Failed to fetch purchase orders (${res.status})`;
    throw new Error(msg);
  }
  return data;
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

async function fetchOrderById(id) {
  const res = await fetch(`/api/purchases/orders/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch order");
  const data = await res.json();
  return data.purchaseOrder;
}

function DetailDrawer({ order, onClose, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !order?.id) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/purchases/orders/${order.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploadSuccess?.(order.id);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
                <div className="text-xs uppercase text-gray-500">Order type</div>
                <div className="mt-1 text-gray-900 capitalize">{order.orderType || "goods"}</div>
              </div>
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
                <div className="text-xs uppercase text-gray-500">Subtotal</div>
                <div className="mt-1 text-gray-900">
                  MWK {Number(order.subtotal ?? 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Tax</div>
                <div className="mt-1 text-gray-900">
                  MWK {Number(order.taxAmount ?? 0).toLocaleString()}
                  {order.taxRate != null && Number(order.taxRate) > 0 && (
                    <span className="ml-1 text-gray-500">({Number(order.taxRate).toFixed(1)}%)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Total</div>
                <div className="mt-1 font-semibold text-gray-900">
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
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Product / Description</th>
                    <th className="px-4 py-2">Expense category (code)</th>
                    <th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Unit Cost</th>
                    <th className="px-4 py-2 text-right">Tax %</th>
                    <th className="px-4 py-2 text-right">Tax (MWK)</th>
                    <th className="px-4 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {order.items?.map((item) => {
                    const lineSub = Number(item.quantityOrdered || 0) * Number(item.unitCost || 0);
                    const lineTax = Number(item.taxAmount || 0);
                    const lineTotal = lineSub + lineTax;
                    const taxPct = item.taxRate != null && Number(item.taxRate) !== 0 ? Number(item.taxRate) : (lineSub > 0 && lineTax > 0 ? (lineTax / lineSub) * 100 : 0);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-gray-700 capitalize">{item.lineType || "goods"}</td>
                        <td className="px-4 py-2 text-gray-900">{item.description || (item.product?.name) || "—"}</td>
                        <td className="px-4 py-2 text-gray-700 text-sm">
                          {formatExpenseCategoryLabel(item.expenseCategory)}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {Number(item.quantityOrdered || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          MWK {Number(item.unitCost || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {taxPct > 0 ? `${taxPct.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          MWK {lineTax.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          MWK {lineTotal.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-medium text-gray-900">
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-sm text-gray-600">
                      Subtotal (excl. tax)
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">—</td>
                    <td className="px-4 py-2 text-right">
                      MWK {Number(order.subtotal ?? 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-4 py-2 text-right text-sm text-gray-600">
                      Total tax
                    </td>
                    <td className="px-4 py-2 text-right">
                      MWK {Number(order.taxAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">—</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={6} className="px-4 py-3 text-right text-sm uppercase text-gray-500">
                      Total (incl. tax)
                    </td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      MWK {Number(order.totalAmount ?? 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {order.supplierBills?.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Supplier bills (payables)</h3>
              <p className="mt-1 text-xs text-gray-500">
                Created when the PO is fully received. Pay from Purchases → Bills / Payments until status is Paid.
              </p>
              <div className="mt-2 space-y-3">
                {order.supplierBills.map((bill) => {
                  const unpaid =
                    Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0);
                  return (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{bill.billNumber}</div>
                        <div className="text-xs text-gray-500">
                          {bill.billDate ? format(new Date(bill.billDate), "dd MMM yyyy") : "—"} · {bill.status}
                          {bill.billType ? ` · ${bill.billType}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          MWK {Number(bill.totalAmount || 0).toLocaleString()}
                        </div>
                        {unpaid > 0 && bill.status !== "Paid" && (
                          <div className="text-xs text-amber-700">Due: MWK {unpaid.toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {order.expenses?.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Linked expenses (legacy)</h3>
              <p className="mt-1 text-xs text-gray-500">
                Older PO-linked expense rows; new service POs use supplier bills only after receipt.
              </p>
              <div className="mt-2 space-y-3">
                {order.expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{exp.description}</div>
                      <div className="text-xs text-gray-500">
                        {exp.date ? format(new Date(exp.date), "dd MMM yyyy") : "—"} · {exp.status}
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">MWK {Number(exp.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Supplier Invoice & Ledger</h3>
            <div className="mt-2 space-y-2">
              {order.supplierInvoiceUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={order.supplierInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View supplier invoice
                  </a>
                  <span className="text-gray-500">|</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Replace"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Attach supplier invoice (PDF/Image)"}
                  </button>
                </div>
              )}
              {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
              {order.supplierId && (
                <p className="text-xs text-gray-500">
                  <a href={`/purchases/suppliers/${order.supplierId}`} className="text-indigo-600 hover:underline">
                    View supplier ledger →
                  </a>
                </p>
              )}
            </div>
          </div>
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

const ORDER_TYPES = [
  { value: "goods", label: "Inventory / Goods Purchase" },
  { value: "services", label: "Goods & Services Purchase" },
  { value: "assets", label: "Asset Purchase" },
];

function formatExpenseCategoryLabel(cat) {
  if (!cat) return "—";
  const code = cat.code || cat.accountCode || cat.account?.accountCode || "";
  const name = cat.name || cat.account?.accountName || "";
  if (code && name) return `${code} — ${name}`;
  return code || name || "—";
}

function OrderForm({ suppliers, products, expenseCategories = [], taxTypes = [], initialData = null, onSave, onCancel }) {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState(() => ({
    supplierId: initialData?.supplierId || "",
    orderType: initialData?.orderType || "goods",
    poDate: initialData?.poDate
      ? format(new Date(initialData.poDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    expectedDeliveryDate: initialData?.expectedDeliveryDate
      ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
      : "",
    status: initialData?.status || "Draft",
    notes: initialData?.notes || "",
    pricesIncludeTax: initialData?.pricesIncludeTax ?? false,
  }));

  const defaultLineType = (orderType) => {
    if (orderType === "assets") return "asset";
    if (orderType === "services") return "service";
    return "goods";
  };

  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        lineType: item.lineType || (item.productId ? "goods" : "service"),
        productId: item.productId || "",
        expenseCategoryId: item.expenseCategoryId || "",
        description: item.description || "",
        quantityOrdered:
          item.quantityOrdered === undefined || item.quantityOrdered === null
            ? ""
            : String(item.quantityOrdered),
        unitCost:
          item.unitCost === undefined || item.unitCost === null
            ? ""
            : String(item.unitCost),
        taxTypeId: item.taxTypeId || "",
        taxRate: item.taxRate != null ? String(item.taxRate) : "",
        taxAmount: item.taxAmount != null ? String(item.taxAmount) : "",
      }));
    }
    return [{ lineType: "goods", productId: "", expenseCategoryId: "", quantityOrdered: "", unitCost: "", description: "", taxTypeId: "", taxRate: "", taxAmount: "" }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expenseCategorySearch, setExpenseCategorySearch] = useState("");

  const expenseCategoriesSorted = useMemo(() => {
    return [...expenseCategories].sort((a, b) => {
      const codeA = String(a.code || a.accountCode || a.account?.accountCode || "").toLowerCase();
      const codeB = String(b.code || b.accountCode || b.account?.accountCode || "").toLowerCase();
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
  }, [expenseCategories]);

  const filteredExpenseCategories = useMemo(() => {
    const term = expenseCategorySearch.trim().toLowerCase();
    if (!term) return expenseCategoriesSorted;
    return expenseCategoriesSorted.filter((cat) => {
      const parts = [
        cat.code,
        cat.accountCode,
        cat.account?.accountCode,
        cat.name,
        cat.account?.accountName,
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return parts.some((p) => p.includes(term));
    });
  }, [expenseCategoriesSorted, expenseCategorySearch]);

  useEffect(() => {
    if (!initialData) return;
    setForm({
      supplierId: initialData.supplierId || "",
      orderType: initialData.orderType || "goods",
      poDate: initialData.poDate
        ? format(new Date(initialData.poDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      expectedDeliveryDate: initialData.expectedDeliveryDate
        ? format(new Date(initialData.expectedDeliveryDate), "yyyy-MM-dd")
        : "",
      status: initialData.status || "Draft",
      notes: initialData.notes || "",
      pricesIncludeTax: initialData.pricesIncludeTax ?? false,
    });
    setItems(
      (initialData.items || []).map((item) => ({
        lineType: item.lineType || (item.productId ? "goods" : "service"),
        productId: item.productId || "",
        expenseCategoryId: item.expenseCategoryId || "",
        description: item.description || "",
        quantityOrdered: item.quantityOrdered != null ? String(item.quantityOrdered) : "1",
        unitCost: item.unitCost != null ? String(item.unitCost) : "",
        taxTypeId: item.taxTypeId || "",
        taxRate: item.taxRate != null ? String(item.taxRate) : "",
        taxAmount: item.taxAmount != null ? String(item.taxAmount) : "",
      }))
    );
  }, [initialData]);

  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  const { subtotal, totalTax, totalAmount } = useMemo(() => {
    const pricesIncludeTax = form.pricesIncludeTax;
    let sub = 0;
    let tax = 0;
    items.forEach((item) => {
      const qty = Number(item.quantityOrdered || 0);
      const unitCost = Number(item.unitCost || 0);
      const taxRatePct = Number(item.taxRate || 0);
      let lineSub;
      let lineTax = Number(item.taxAmount || 0);
      if (pricesIncludeTax && taxRatePct > 0) {
        const lineTotalInclusive = qty * unitCost;
        lineSub = lineTotalInclusive / (1 + taxRatePct / 100);
        lineTax = lineTotalInclusive - lineSub;
      } else {
        lineSub = qty * unitCost;
        if (lineTax === 0 && taxRatePct > 0) lineTax = lineSub * (taxRatePct / 100);
      }
      sub += round2(lineSub);
      tax += round2(lineTax);
    });
    return {
      subtotal: round2(sub),
      totalTax: round2(tax),
      totalAmount: round2(sub + tax),
    };
  }, [items, form.pricesIncludeTax]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    // When order type changes, reset line types and clear inappropriate fields
    if (name === "orderType") {
      setItems((prev) =>
        prev.map((item) => {
          if (value === "goods") return { ...item, lineType: "goods", expenseCategoryId: "" };
          if (value === "assets") return { ...item, lineType: "asset", productId: "" };
          // services: keep existing lineType if valid, otherwise default to service
          return { ...item, lineType: item.lineType === "goods" ? "goods" : "service" };
        })
      );
    }
  };

  const getDefaultProductCost = (product) => {
    if (!product) return 0;
    
    // Helper to convert Decimal/object values to numbers
    const toNumber = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && val !== null) {
        // Handle Prisma Decimal type
        return Number(val) || null;
      }
      const num = Number(val);
      return isNaN(num) ? null : num;
    };
    
    // Try multiple fields in order of preference
    // Priority: lastPurchaseCost > cost > averageCost > costPrice > purchasePrice
    const lastPurchaseCost = toNumber(product.lastPurchaseCost);
    const cost = toNumber(product.cost);
    const averageCost = toNumber(product.averageCost);
    const costPrice = toNumber(product.costPrice);
    const purchasePrice = toNumber(product.purchasePrice);
    const unitCost = toNumber(product.unitCost);
    
    const value = lastPurchaseCost || cost || averageCost || costPrice || purchasePrice || unitCost || 0;
    return value;
  };

  const handleItemChange = (index, key, value) => {
    setItems((prev) => {
      const updated = prev.map((item, idx) => {
        if (idx === index) {
          let newItem = { ...item, [key]: value };
          if (key === "taxTypeId" && value) {
            const taxType = taxTypes.find((t) => t.id === value);
            if (taxType != null) newItem.taxRate = String(taxType.taxRate ?? "");
          }
          // If product is being changed, auto-populate unit cost
          if (key === "productId" && value) {
            const selectedProduct = products.find((p) => p.id === value);
            if (selectedProduct) {
              const defaultCost = getDefaultProductCost(selectedProduct);
              
              // Debug: log product data to help troubleshoot
              if (process.env.NODE_ENV === 'development') {
                console.log('Selected product:', {
                  id: selectedProduct.id,
                  name: selectedProduct.name,
                  cost: selectedProduct.cost,
                  costPrice: selectedProduct.costPrice,
                  lastPurchaseCost: selectedProduct.lastPurchaseCost,
                  averageCost: selectedProduct.averageCost,
                  defaultCost: defaultCost
                });
              }
              
              // Always populate cost when product is selected (user can still manually change it)
              // Use the cost value even if it's 0, but format it properly
              newItem.unitCost = defaultCost > 0 ? String(defaultCost) : "";
              
              // Also auto-populate description if empty
              if (!newItem.description && selectedProduct.name) {
                newItem.description = selectedProduct.name;
              }
            } else {
              // Product not found, clear the cost
              newItem.unitCost = "";
            }
          }
          
          return newItem;
        }
        return item;
      });
      return updated;
    });
  };

  const addItem = () => {
    const lt = defaultLineType(form.orderType);
    setItems((prev) => [
      ...prev,
      { lineType: lt, productId: "", expenseCategoryId: "", quantityOrdered: "", unitCost: "", description: "", taxTypeId: "", taxRate: "", taxAmount: "" },
    ]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const pricesIncludeTax = form.pricesIncludeTax;
      const normalizedItems = items.map((item) => {
        const qty = Number(item.quantityOrdered || 0);
        const unitCost = Number(item.unitCost || 0);
        const taxRatePct = Number(item.taxRate || 0);
        let lineSub;
        let taxAmount = Number(item.taxAmount || 0);
        if (pricesIncludeTax && taxRatePct > 0) {
          const lineTotalInclusive = qty * unitCost;
          lineSub = lineTotalInclusive / (1 + taxRatePct / 100);
          taxAmount = lineTotalInclusive - lineSub;
        } else {
          lineSub = qty * unitCost;
          if (taxAmount === 0 && taxRatePct > 0) taxAmount = lineSub * (taxRatePct / 100);
        }
        const lineType = form.orderType === "assets" ? "asset"
          : form.orderType === "goods" ? "goods"
          : (item.lineType || (item.productId ? "goods" : "service"));
        return {
          lineType,
          productId: item.productId || undefined,
          expenseCategoryId: item.expenseCategoryId || undefined,
          description: item.description?.trim() || undefined,
          quantityOrdered: qty,
          unitCost,
          taxTypeId: item.taxTypeId || undefined,
          taxRate: taxRatePct,
          taxAmount: round2(taxAmount),
        };
      });
      await onSave({ ...form, orderType: form.orderType, pricesIncludeTax: form.pricesIncludeTax, items: normalizedItems });
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
        description="Supplier, order type, timing and status for this purchase request."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Order type
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
              value={form.orderType}
              onChange={(e) => handleChange("orderType", e.target.value)}
            >
              {ORDER_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
              min={form.poDate || undefined}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
              value={form.expectedDeliveryDate}
              onChange={(e) => handleChange("expectedDeliveryDate", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pricesIncludeTax}
                onChange={(e) => handleChange("pricesIncludeTax", e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Prices include tax</span>
            </label>
            <span className="text-xs text-gray-500">(Otherwise prices exclude tax)</span>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Line Items"
        description={
          form.orderType === "goods"
            ? "Select products from your inventory. Stock increases only when you post a goods receipt, not when saving the PO."
            : form.orderType === "services"
            ? "Add goods (product select) and/or service lines (custom description + expense account). Toggle per line."
            : form.orderType === "assets"
            ? "Describe each asset being purchased. Assets are received via receipt and auto-created in Asset Management."
            : ""
        }
      >
        {(form.orderType === "services" || form.orderType === "assets") &&
          expenseCategoriesSorted.length > 0 && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <label className="block text-xs font-medium text-gray-600">
              Filter expense accounts (code or name)
            </label>
            <input
              type="search"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Type to narrow the account list…"
              value={expenseCategorySearch}
              onChange={(e) => setExpenseCategorySearch(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-3">
          {items.map((item, idx) => {
            // Determine effective line type based on order type
            const effectiveLineType =
              form.orderType === "assets" ? "asset"
              : form.orderType === "goods" ? "goods"
              : (item.lineType || "goods");

            const isGoods = effectiveLineType === "goods";
            const isService = effectiveLineType === "service";
            const isAsset = effectiveLineType === "asset";
            const showExpenseAccount = isService || isAsset;
            const showProductSelect = isGoods;
            const showLineToggle = form.orderType === "services";

            const pricesIncludeTax = form.pricesIncludeTax;
            const qty = Number(item.quantityOrdered || 0);
            const unitCost = Number(item.unitCost || 0);
            const taxRatePct = Number(item.taxRate || 0);
            let lineSub;
            let lineTax = Number(item.taxAmount || 0);
            if (pricesIncludeTax && taxRatePct > 0) {
              const lineTotalInclusive = qty * unitCost;
              lineSub = lineTotalInclusive / (1 + taxRatePct / 100);
              lineTax = lineTotalInclusive - lineSub;
            } else {
              lineSub = qty * unitCost;
              if (lineTax === 0 && taxRatePct > 0) lineTax = lineSub * (taxRatePct / 100);
            }
            const lineSubR = round2(lineSub);
            const lineTaxR = round2(lineTax);
            const lineTotal = lineSubR + lineTaxR;
            return (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Line type toggle for Goods & Services orders */}
                  {showLineToggle && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Line Type</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        value={item.lineType || "goods"}
                        onChange={(e) => {
                          handleItemChange(idx, "lineType", e.target.value);
                          if (e.target.value === "goods") handleItemChange(idx, "expenseCategoryId", "");
                          if (e.target.value === "service") handleItemChange(idx, "productId", "");
                        }}
                      >
                        <option value="goods">Goods (Product)</option>
                        <option value="service">Service (Custom)</option>
                      </select>
                    </div>
                  )}

                  {/* GOODS lines: product select */}
                  {showProductSelect && (
                    <div className={showLineToggle ? "" : "sm:col-span-2"}>
                      <label className="block text-xs font-medium text-gray-600">Product <span className="text-red-500">*</span></label>
                      <div className="mt-1">
                        <ProductSearchSelect
                          products={products}
                          value={item.productId}
                          onChange={(productId) => handleItemChange(idx, "productId", productId)}
                          required
                          placeholder="Search by name, SKU, code, or barcode…"
                        />
                      </div>
                    </div>
                  )}

                  {/* SERVICE lines: description + expense account */}
                  {isService && (
                    <>
                      <div className={showLineToggle ? "" : "sm:col-span-2"}>
                        <label className="block text-xs font-medium text-gray-600">Description <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Maintenance, Consultancy, Cleaning"
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Expense Account <span className="text-red-500">*</span>
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          value={item.expenseCategoryId}
                          onChange={(e) => handleItemChange(idx, "expenseCategoryId", e.target.value)}
                          required
                        >
                          <option value="">Select account (code — name)</option>
                          {filteredExpenseCategories.map((cat) => (
                            <option key={cat.id} value={cat.expenseCategoryId || cat.id}>
                              {formatExpenseCategoryLabel(cat)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* ASSET lines: asset name + description + expense account */}
                  {isAsset && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Asset Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Laptop, Office Desk, Vehicle"
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Expense Account
                        </label>
                        <select
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                          value={item.expenseCategoryId}
                          onChange={(e) => handleItemChange(idx, "expenseCategoryId", e.target.value)}
                        >
                          <option value="">Select account (code — name)</option>
                          {filteredExpenseCategories.map((cat) => (
                            <option key={cat.id} value={cat.expenseCategoryId || cat.id}>
                              {formatExpenseCategoryLabel(cat)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* Optional description for goods lines */}
                  {showProductSelect && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Description</label>
                      <input
                        type="text"
                        placeholder="Optional note"
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step={isGoods ? "1" : "0.01"}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={item.quantityOrdered}
                      onChange={(e) => handleItemChange(idx, "quantityOrdered", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Unit cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={item.unitCost}
                      onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Tax type</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={item.taxTypeId}
                      onChange={(e) => handleItemChange(idx, "taxTypeId", e.target.value)}
                    >
                      <option value="">— None</option>
                      {taxTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.taxName} ({t.taxRate}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={item.taxRate}
                      onChange={(e) => handleItemChange(idx, "taxRate", e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    <span>
                      Total incl: MWK {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {lineTaxR > 0 && (
                        <span className="ml-1 block text-xs font-normal text-gray-500">
                          tax: MWK {lineTaxR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </span>
                    {items.length > 1 && (
                      <button type="button" className="text-xs text-red-600" onClick={() => removeItem(idx)}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            + Add Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Notes & Totals" description="Internal instructions. Totals: Subtotal, Total Tax, Grand Total.">
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
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
              <span className="text-gray-600">Subtotal (excl. tax)</span>
              <span className="font-medium text-gray-900">MWK {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
              <span className="text-gray-600">Total Tax</span>
              <span className="font-medium text-gray-900">MWK {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <span className="text-xs uppercase tracking-wide text-indigo-700">Grand Total</span>
              <span className="text-lg font-semibold text-indigo-900">MWK {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [taxTypes, setTaxTypes] = useState([]);
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
      const [orderRes, supplierRes, productRes, categoriesRes, taxTypesRes] = await Promise.all([
        getOrders({ search, status: statusFilter }),
        fetch("/api/purchases/suppliers").then((res) => res.json()),
        fetch("/api/stock").then((res) => res.json()),
        fetch("/api/categories?type=expense").then((res) => res.ok ? res.json() : { categories: [] }).catch(() => ({ categories: [] })),
        fetch("/api/tax-types?status=Active").then((res) => res.ok ? res.json() : []).catch(() => []),
      ]);
      setOrders(orderRes.purchaseOrders ?? []);
      setSuppliers(supplierRes.suppliers ?? []);
      setProducts(productRes.products ?? []);

      let expCats = categoriesRes.categories ?? [];

      // Fallback: if categories endpoint returned empty, try expense-categories endpoint
      if (expCats.length === 0) {
        try {
          const fallbackRes = await fetch("/api/expense-categories");
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            expCats = (fallbackData.categories ?? []).map((cat) => ({
              id: cat.id,
              code: cat.accountCode || cat.account?.accountCode || "",
              name: cat.name || cat.account?.accountName || "",
              accountId: cat.accountId || cat.id,
              expenseCategoryId: cat.id,
              account: cat.account ?? null,
            }));
          }
        } catch (_) { /* non-fatal */ }
      }

      setExpenseCategories(expCats);
      setTaxTypes(Array.isArray(taxTypesRes) ? taxTypesRes : (taxTypesRes?.taxTypes ?? taxTypesRes?.data ?? []));
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
                    Tax
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
                    <td className="px-4 py-2 text-right text-gray-600">
                      MWK {Number(order.taxAmount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      MWK {Number(order.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          onClick={async () => {
                            try {
                              const full = await fetchOrderById(order.id);
                              setViewingOrder(full);
                            } catch {
                              setViewingOrder(order);
                            }
                          }}
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
              expenseCategories={expenseCategories}
              taxTypes={taxTypes}
              initialData={formMode === "edit" ? activeOrder : null}
              onSave={handleSaveOrder}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      {viewingOrder && (
        <DetailDrawer
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
          onUploadSuccess={async (id) => {
            try {
              const updated = await fetchOrderById(id);
              setViewingOrder(updated);
            } catch (_) {}
          }}
        />
      )}

      {deletingOrder && (
        <ConfirmDialog
          title="Delete Purchase Order"
          message={`Cancel ${deletingOrder.poNumber}? The system will reverse linked bills/expenses where allowed and keep an audit trail. If goods were already received, cancellation may be blocked.`}
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeletingOrder(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

