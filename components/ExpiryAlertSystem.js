"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Clock,
  XCircle,
  RefreshCw,
  Package,
  Loader2,
} from "lucide-react";

/**
 * Batch-level expiry alerts from GET /api/inventory/expiry-alerts (FIFO batches with expiryDate).
 * Write-off and restock call inventory APIs.
 */
const ExpiryAlertSystem = ({
  onViewProduct,
  showToast,
  canAdjustStock = false,
  onInventoryChanged,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [writeOffBatch, setWriteOffBatch] = useState(null);
  const [writeOffQty, setWriteOffQty] = useState("");
  const [writeOffSubmitting, setWriteOffSubmitting] = useState(false);
  const [restockCtx, setRestockCtx] = useState(null);
  const [restockForm, setRestockForm] = useState({
    quantity: "",
    unitCost: "",
    expiryDate: "",
    notes: "",
  });
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({ earlyDays: "60", urgentDays: "7" });
  const [savingThresholds, setSavingThresholds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/expiry-alerts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load alerts");
      setData(json);
      setThresholdForm({
        earlyDays: String(json?.thresholds?.earlyDays ?? 60),
        urgentDays: String(json?.thresholds?.urgentDays ?? 7),
      });
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MWK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const statusBadge = (status, th) => {
    const map = {
      expired: "bg-red-100 text-red-800 border-red-200",
      urgent: "bg-orange-100 text-orange-800 border-orange-200",
      early: "bg-amber-50 text-amber-900 border-amber-200",
    };
    const ud = th?.urgentDays ?? 7;
    const ed = th?.earlyDays ?? 30;
    const label =
      status === "early"
        ? `Early (≤${ed}d)`
        : status === "urgent"
          ? `Urgent (≤${ud}d)`
          : "Expired";
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${map[status] || ""}`}
      >
        {label}
      </span>
    );
  };

  const handleWriteOff = async () => {
    if (!writeOffBatch) return;
    const qty =
      writeOffQty === "" || writeOffQty == null
        ? undefined
        : parseFloat(writeOffQty);
    setWriteOffSubmitting(true);
    try {
      const res = await fetch("/api/inventory/write-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: writeOffBatch.batchId,
          quantity: qty,
          notes: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Write-off failed");
      showToast?.("success", "Written off", formatCurrency(json.lossAmount));
      setWriteOffBatch(null);
      setWriteOffQty("");
      await load();
      onInventoryChanged?.();
    } catch (e) {
      showToast?.("error", "Write-off failed", e.message);
    } finally {
      setWriteOffSubmitting(false);
    }
  };

  const handleRestock = async () => {
    if (!restockCtx) return;
    const q = parseFloat(restockForm.quantity);
    const c = parseFloat(restockForm.unitCost);
    if (!Number.isFinite(q) || q <= 0) {
      showToast?.("error", "Invalid quantity", "Enter a positive quantity");
      return;
    }
    if (!Number.isFinite(c) || c < 0) {
      showToast?.("error", "Invalid cost", "Enter a valid unit cost");
      return;
    }
    setRestockSubmitting(true);
    try {
      const res = await fetch("/api/inventory/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: restockCtx.productId,
          quantity: q,
          unitCost: c,
          expiryDate: restockForm.expiryDate || null,
          branchId: restockCtx.branchId,
          notes: restockForm.notes || null,
          priorBatchId: restockCtx.batchId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Restock failed");
      showToast?.("success", "Restock recorded", `New batch ${json.restockBatchId?.slice(0, 8)}…`);
      setRestockCtx(null);
      setRestockForm({ quantity: "", unitCost: "", expiryDate: "", notes: "" });
      await load();
      onInventoryChanged?.();
    } catch (e) {
      showToast?.("error", "Restock failed", e.message);
    } finally {
      setRestockSubmitting(false);
    }
  };

  const handleSaveThresholds = async () => {
    const earlyDays = Number(thresholdForm.earlyDays);
    const urgentDays = Number(thresholdForm.urgentDays);
    if (!Number.isFinite(earlyDays) || earlyDays <= 0) {
      showToast?.("error", "Invalid alert window", "Early warning days must be greater than 0");
      return;
    }
    if (!Number.isFinite(urgentDays) || urgentDays <= 0) {
      showToast?.("error", "Invalid alert window", "Urgent warning days must be greater than 0");
      return;
    }
    if (urgentDays > earlyDays) {
      showToast?.("error", "Invalid alert window", "Urgent days cannot be greater than early warning days");
      return;
    }

    setSavingThresholds(true);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiryWarnDaysEarly: earlyDays,
          expiryWarnDaysUrgent: urgentDays,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save expiry alert settings");
      showToast?.("success", "Expiry alerts updated", `Early warning set to ${earlyDays} days`);
      await load();
    } catch (e) {
      showToast?.("error", "Save failed", e.message || "Could not save expiry alert settings");
    } finally {
      setSavingThresholds(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-600 gap-2">
        <Loader2 className="animate-spin" size={22} />
        Loading expiry alerts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 flex justify-between items-center gap-4">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-red-300 text-sm"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { summary, rows, thresholds } = data || {
    summary: {},
    rows: [],
    thresholds: {},
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Per-batch expiry (goods receipts / stock in). Thresholds: urgent ≤{" "}
          {thresholds?.urgentDays ?? 7} days, early ≤ {thresholds?.earlyDays ?? 60} days (tenant
          settings override defaults).
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-950">Expiry alert window</h3>
            <p className="mt-1 text-xs text-blue-800">
              Default early warning is 60 days (about 2 months). Adjust this tenant-wide for
              goods received into expiring batches.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-blue-950">
              Early warning days
              <input
                type="number"
                min="1"
                max="365"
                value={thresholdForm.earlyDays}
                onChange={(e) =>
                  setThresholdForm((prev) => ({ ...prev, earlyDays: e.target.value }))
                }
                className="mt-1 block w-28 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-blue-950">
              Urgent days
              <input
                type="number"
                min="1"
                max="365"
                value={thresholdForm.urgentDays}
                onChange={(e) =>
                  setThresholdForm((prev) => ({ ...prev, urgentDays: e.target.value }))
                }
                className="mt-1 block w-28 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveThresholds}
              disabled={savingThresholds}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingThresholds ? "Saving…" : "Save alerts"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-800 font-semibold">
            <XCircle size={18} /> Expired batches
          </div>
          <div className="text-2xl font-bold text-red-900 mt-1">{summary?.expired ?? 0}</div>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-2 text-orange-800 font-semibold">
            <AlertTriangle size={18} /> Urgent
          </div>
          <div className="text-2xl font-bold text-orange-900 mt-1">{summary?.urgent ?? 0}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <Clock size={18} /> Early warning
          </div>
          <div className="text-2xl font-bold text-amber-950 mt-1">{summary?.early ?? 0}</div>
        </div>
      </div>

      {rows?.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center text-green-800">
          <Package className="mx-auto mb-2 opacity-70" size={40} />
          <p className="font-medium">No batch expiry alerts</p>
          <p className="text-sm mt-1 opacity-90">
            No batches with expiry in the next {thresholds?.earlyDays ?? 60} days (or expired), or
            batches have no expiry date set.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2 text-right">Unit cost</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.batchId} className="hover:bg-gray-50/80">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.productName}</td>
                  <td className="px-3 py-2 text-gray-600">{r.sku || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.qtyRemaining}</td>
                  <td className="px-3 py-2">{formatDate(r.expiryDate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.daysRemaining}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(r.unitCost)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(r.lineValue)}
                  </td>
                  <td className="px-3 py-2">{statusBadge(r.status, thresholds)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
                        onClick={() => onViewProduct?.({ id: r.productId })}
                      >
                        Product
                      </button>
                      {canAdjustStock && (
                        <>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-800 bg-red-50 hover:bg-red-100"
                            onClick={() => {
                              setWriteOffBatch(r);
                              setWriteOffQty(String(r.qtyRemaining));
                            }}
                          >
                            Write off
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100"
                            onClick={() => {
                              setRestockCtx(r);
                              setRestockForm({
                                quantity: String(r.qtyRemaining),
                                unitCost: String(r.unitCost),
                                expiryDate: "",
                                notes: "",
                              });
                            }}
                          >
                            Restock (new batch)
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {writeOffBatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg">Write off batch</h3>
            <p className="text-sm text-gray-600">
              {writeOffBatch.productName} — line value {formatCurrency(writeOffBatch.lineValue)}.
              Posts DR Inventory Adjustment Loss / CR Inventory for qty × unit cost.
            </p>
            <label className="block text-sm font-medium text-gray-700">Quantity (optional)</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2"
              value={writeOffQty}
              onChange={(e) => setWriteOffQty(e.target.value)}
              min={0}
              step="any"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-gray-300"
                onClick={() => setWriteOffBatch(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={writeOffSubmitting}
                className="px-4 py-2 rounded-md bg-red-600 text-white disabled:opacity-50"
                onClick={handleWriteOff}
              >
                {writeOffSubmitting ? "Processing…" : "Confirm write-off"}
              </button>
            </div>
          </div>
        </div>
      )}

      {restockCtx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-lg">Restock — new batch only</h3>
            <p className="text-sm text-gray-600">
              Creates a new FIFO batch (does not merge). Link recorded in expiry audit.
            </p>
            <label className="block text-sm font-medium">Quantity</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2"
              value={restockForm.quantity}
              onChange={(e) => setRestockForm((f) => ({ ...f, quantity: e.target.value }))}
              min={0}
              step="any"
            />
            <label className="block text-sm font-medium">Unit cost</label>
            <input
              type="number"
              className="w-full border rounded-md px-3 py-2"
              value={restockForm.unitCost}
              onChange={(e) => setRestockForm((f) => ({ ...f, unitCost: e.target.value }))}
              min={0}
              step="any"
            />
            <label className="block text-sm font-medium">Expiry date (optional)</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2"
              value={restockForm.expiryDate}
              onChange={(e) => setRestockForm((f) => ({ ...f, expiryDate: e.target.value }))}
            />
            <label className="block text-sm font-medium">Notes (optional)</label>
            <input
              type="text"
              className="w-full border rounded-md px-3 py-2"
              value={restockForm.notes}
              onChange={(e) => setRestockForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-gray-300"
                onClick={() => setRestockCtx(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={restockSubmitting}
                className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
                onClick={handleRestock}
              >
                {restockSubmitting ? "Saving…" : "Create batch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpiryAlertSystem;
