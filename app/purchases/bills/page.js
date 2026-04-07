"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const statusOptions = ["Draft", "Approved", "Unpaid", "Partially Paid", "Paid", "Overdue", "Cancelled"];

async function fetchBills(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const res = await fetch(`/api/purchases/bills?${searchParams.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch bills");
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

async function reverseBill(id, reversalReason) {
  const res = await fetch(`/api/purchases/bills/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reversalReason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to reverse bill");
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

function ConfirmDialog({ title, message, onConfirm, onCancel, loading, confirmLabel = "Confirm" }) {
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
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReverseDialog({ billNumber, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Reverse Supplier Bill</h3>
        <p className="mt-2 text-sm text-gray-600">
          This cancels the bill and records reversals for audit: unpaid bills reverse the bill journal; paid or
          partially paid bills also unwind linked supplier payments (full or per-allocation GL entries), input tax
          where applicable, and supplier balances.           Inventory: linked FIFO layers are removed (including goods-receipt–sourced stock), prior
          sale allocations on those layers are cleared, and product quantities are recalculated. Posted
          COGS from past sales is not auto-reversed—review journals if stock had already been sold.
        </p>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reversal reason <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-red-500 focus:ring-red-500"
            rows={3}
            placeholder={`Why are you reversing bill ${billNumber}? (min 10 characters)`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-1 text-xs text-gray-500">
            The reason is stored for audit.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading || reason.trim().length < 10}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Reversing…" : "Reverse"}
          </button>
        </div>
      </div>
    </div>
  );
}

const billFormPanel =
  "space-y-4 rounded-2xl border border-gray-200 bg-white/95 p-4  ring-1 ring-gray-50";

function BillFormSection({ title, description, children }) {
  return (
    <div className={billFormPanel}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

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
  });
  const [items, setItems] = useState(() => {
    if (initialData?.items?.length) {
      return initialData.items.map((item) => ({
        quantity: Number(item.quantityOrdered || item.quantity || 1),
        unitCost: Number(item.unitCost || 0),
      }));
    }
    return [{ quantity: 1, unitCost: 0 }];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    });
    setItems(
      (initialData.items || []).map((item) => ({
        quantity: Number(item.quantityOrdered || item.quantity || 1),
        unitCost: Number(item.unitCost || 0),
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
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { quantity: 1, unitCost: 0 }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        items,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
      });
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
            <label className="block text-sm font-medium text-gray-700">Bill Number</label>
            <input
              type="text"
              name="billNumber"
              value={form.billNumber || ""}
              onChange={handleChange}
              placeholder="Optional reference"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
      </BillFormSection>

      <BillFormSection
        title="Line Items"
        description="Quick inputs for quantity × unit cost. Expand later if we add full expense categories."
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:grid-cols-3"
            >
              <input
                type="number"
                min="0"
                step="1"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                value={item.quantity}
                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                required
                placeholder="Quantity"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                value={item.unitCost}
                onChange={(e) => handleItemChange(idx, "unitCost", e.target.value)}
                required
                placeholder="Unit Cost"
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
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white  hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Update Bill" : "Save Bill"}
        </button>
      </div>
    </form>
  );
}

export default function SupplierBillsPage() {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingBill, setDeletingBill] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [billData, supplierData] = await Promise.all([
        fetchBills({ status: statusFilter, supplierId: supplierFilter }),
        fetch("/api/purchases/suppliers").then((res) => res.json()),
      ]);
      setBills(billData.bills ?? []);
      setSuppliers(supplierData.suppliers ?? []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, supplierFilter]);

  const stats = useMemo(() => {
    const total = bills.length;
    const unpaid = bills.filter((bill) => bill.status === "Unpaid" || bill.status === "Partially Paid").length;
    const overdue = bills.filter((bill) => bill.status === "Overdue").length;
    const outstanding = bills.reduce(
      (sum, bill) => sum + (Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0)),
      0
    );
    return { total, unpaid, overdue, outstanding };
  }, [bills]);

  const openCreateForm = () => {
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
  };

  const handleSaveBill = async (payload) => {
    await createBill(payload);
    closeForm();
    await loadData();
  };

  const handleReverseBill = async (reversalReason) => {
    if (!deletingBill) return;
    setDeleteLoading(true);
    try {
      await reverseBill(deletingBill.id, reversalReason);
      setDeletingBill(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to reverse bill");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Supplier Bills</h1>
          <p className="text-sm text-gray-500">
            Track Accounts Payable from goods receipts and manual bills.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          New Bill
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total Bills" value={stats.total} />
        <SummaryCard label="Unpaid / Partially Paid" value={stats.unpaid} />
        <SummaryCard label="Overdue" value={stats.overdue} />
        <SummaryCard
          label="Outstanding Balance"
          value={`MWK ${stats.outstanding.toLocaleString()}`}
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
          <p className="text-sm text-gray-500">Loading bills…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
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
                      <div className="text-xs text-gray-500">Invoice {bill.supplierInvoiceNumber ?? "-"}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {bill.dueDate ? formatDateDDMMYYYY(bill.dueDate) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          bill.status === "Paid"
                            ? "bg-green-100 text-green-800"
                            : bill.status === "Partially Paid"
                            ? "bg-amber-100 text-amber-900"
                            : bill.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : bill.status === "Cancelled"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      <div className="flex flex-col items-end gap-0.5">
                        <span>
                          MWK{" "}
                          {Number(
                            Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0)
                          ).toLocaleString()}
                        </span>
                        {Number(bill.amountPaid || 0) > 0 && (
                          <span className="text-[10px] text-gray-500">
                            Paid MWK {Number(bill.amountPaid || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                          onClick={() => setDeletingBill(bill)}
                          disabled={bill.status === "Cancelled"}
                          title={
                            bill.status === "Cancelled"
                              ? "Already cancelled"
                              : Number(bill.amountPaid || 0) > 0
                              ? "Reverses payments and GL as needed (including multi-bill payments via slice entries)."
                              : "Cancel bill and reverse accounting"
                          }
                        >
                          Reverse
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
                  New Supplier Bill
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Existing bills cannot be edited; reverse a bill if you need to undo it.
                </p>
              </div>
              <button
                onClick={closeForm}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <BillForm
              suppliers={suppliers}
              initialData={null}
              onSave={handleSaveBill}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      {deletingBill && (
        <ReverseDialog
          billNumber={deletingBill.billNumber}
          onConfirm={handleReverseBill}
          onCancel={() => setDeletingBill(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

