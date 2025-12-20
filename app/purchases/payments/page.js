"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

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

const cardPanelClass =
  "space-y-4 rounded-2xl border border-gray-200 bg-white/95 p-4  ring-1 ring-gray-50";

function PaymentFormSection({ title, description, children }) {
  return (
    <div className={cardPanelClass}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function PaymentForm({ suppliers, bills, onSave, onCancel }) {
  const [form, setForm] = useState({
    supplierId: "",
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "Bank Transfer",
    referenceNumber: "",
    notes: "",
  });
  const [allocations, setAllocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const supplierBills = useMemo(() => {
    if (!form.supplierId) return [];
    return bills.filter((bill) => bill.supplierId === form.supplierId && bill.balanceDue > 0);
  }, [form.supplierId, bills]);

  useEffect(() => {
    if (form.supplierId) {
      setAllocations(
        supplierBills.map((bill) => ({
          billId: bill.id,
          amount: 0,
        }))
      );
    } else {
      setAllocations([]);
    }
  }, [form.supplierId, supplierBills]);

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
            <label className="block text-sm font-medium text-gray-700">Payment Date</label>
            <input
              type="date"
              name="paymentDate"
              value={form.paymentDate}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
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
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
              supplierBills.map((bill) => (
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
                      Balance MWK {Number(bill.balanceDue || 0).toLocaleString()}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={bill.balanceDue}
                    step="0.01"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
                    value={allocations.find((alloc) => alloc.billId === bill.id)?.amount || ""}
                    onChange={(e) => handleAllocationChange(bill.id, e.target.value)}
                  />
                </div>
              ))
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
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm  focus:border-indigo-500 focus:ring-indigo-500"
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
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white  hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Record Payment"}
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

function PaymentDetails({ payment, onClose }) {
  if (!payment) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white ">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{payment.paymentNumber}</h2>
            <p className="text-sm text-gray-500">
              {payment.supplier?.supplierName ?? "—"} •{" "}
              {payment.paymentDate ? format(new Date(payment.paymentDate), "dd MMM yyyy") : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase text-gray-500">Payment Method</div>
              <div className="mt-1 text-gray-900">{payment.paymentMethod}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Reference</div>
              <div className="mt-1 text-gray-900">{payment.referenceNumber || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Total Amount</div>
              <div className="mt-1 text-gray-900">
                MWK {Number(payment.totalAmount || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Allocations</div>
              <div className="mt-1 text-gray-900">{payment.allocations?.length ?? 0}</div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700">Bill Allocations</h3>
            <div className="mt-2 overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Bill</th>
                    <th className="px-4 py-2 text-right">Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {payment.allocations?.length ? (
                    payment.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="px-4 py-2 text-gray-900">
                          {allocation.bill?.billNumber ?? allocation.billId}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">
                          MWK {Number(allocation.amountAllocated || allocation.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-2 text-gray-500" colSpan={2}>
                        No allocations recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupplierPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentData, supplierData, billData] = await Promise.all([
        fetchPayments({ supplierId: supplierFilter }),
        fetch("/api/purchases/suppliers").then((res) => res.json()),
        fetch("/api/purchases/bills?status=Unpaid").then((res) => res.json()),
      ]);
      setPayments(paymentData.payments ?? []);
      setSuppliers(supplierData.suppliers ?? []);
      setBills(
        billData.bills?.map((bill) => ({
          ...bill,
          balanceDue: Number(bill.totalAmount || 0) - Number(bill.amountPaid || 0),
        })) ?? []
      );
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supplierFilter]);

  const stats = useMemo(() => {
    const total = payments.length;
    const totalAmount = payments.reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0);
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const monthAmount = payments
      .filter((payment) => {
        if (!payment.paymentDate) return false;
        const date = new Date(payment.paymentDate);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .reduce((sum, payment) => sum + Number(payment.totalAmount || 0), 0);
    const avg =
      total > 0 ? totalAmount / total : 0;
    return {
      total,
      totalAmount,
      monthAmount,
      avg,
    };
  }, [payments]);

  const handleCreate = async (payload) => {
    await createPayment(payload);
    setShowForm(false);
    await loadData();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Supplier Payments</h1>
          <p className="text-sm text-gray-500">Pay suppliers and close outstanding bills.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white  hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Record Payment
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Payments Recorded" value={stats.total} />
        <SummaryCard label="Total Disbursed" value={`MWK ${stats.totalAmount.toLocaleString()}`} />
        <SummaryCard label="This Month" value={`MWK ${stats.monthAmount.toLocaleString()}`} />
        <SummaryCard
          label="Average Payment"
          value={`MWK ${stats.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
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
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading payments…</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
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
                        {payment.allocations?.length || 0} allocations
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
                        onClick={() => setViewingPayment(payment)}
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 ">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Record Supplier Payment</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <PaymentForm
              suppliers={suppliers}
              bills={bills}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {viewingPayment && (
        <PaymentDetails payment={viewingPayment} onClose={() => setViewingPayment(null)} />
      )}
    </div>
  );
}

