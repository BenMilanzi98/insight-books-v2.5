"use client";
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Briefcase } from "lucide-react";

const BILLING_OPTIONS = [
  { value: "fixed", label: "Fixed price" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
];

/**
 * Create or edit a billable service (stored as Product with isService=true).
 * Inventory fields are intentionally omitted.
 */
export default function ServiceFormModal({
  isOpen,
  onClose,
  initialProduct,
  onSaved,
  showToast,
  canSubmit = true,
}) {
  const isEdit = Boolean(initialProduct?.id);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [billingType, setBillingType] = useState("fixed");
  const [rate, setRate] = useState("");
  const [defaultQty, setDefaultQty] = useState("1");
  const [selectedTaxIds, setSelectedTaxIds] = useState([]);
  const [taxTypes, setTaxTypes] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForCreate = useCallback(() => {
    setName("");
    setSku("");
    setDescription("");
    setBillingType("fixed");
    setRate("");
    setDefaultQty("1");
    setSelectedTaxIds([]);
    setErrors({});
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setLoadingMeta(true);
      try {
        const taxRes = await fetch("/api/tax-types?status=Active", { cache: "no-store" });
        if (taxRes.ok) {
          const d = await taxRes.json();
          const list = Array.isArray(d?.taxTypes) ? d.taxTypes : Array.isArray(d) ? d : [];
          setTaxTypes(list);
        } else {
          setTaxTypes([]);
        }
      } catch (e) {
        console.error(e);
        showToast?.("error", "Load failed", "Could not load tax types.");
      } finally {
        setLoadingMeta(false);
      }
    };
    load();
  }, [isOpen, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialProduct?.id) {
      setName(initialProduct.name || "");
      setSku(initialProduct.sku || "");
      setDescription(initialProduct.description || "");
      setBillingType(
        ["fixed", "hourly", "daily"].includes(initialProduct.serviceBillingType)
          ? initialProduct.serviceBillingType
          : "fixed"
      );
      setRate(
        initialProduct.unitPrice != null
          ? String(initialProduct.unitPrice)
          : initialProduct.price != null
            ? String(initialProduct.price)
            : ""
      );
      const dq = initialProduct.serviceDefaultQty;
      setDefaultQty(
        dq != null && dq !== "" && !Number.isNaN(Number(dq)) ? String(Number(dq)) : "1"
      );
      setErrors({});
    } else {
      resetForCreate();
    }
  }, [isOpen, initialProduct, resetForCreate]);

  useEffect(() => {
    if (!isOpen || !initialProduct?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${initialProduct.id}/taxes`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.taxes) ? data.taxes : [];
        const ids = list.map((pt) => pt.taxTypeId ?? pt.id).filter(Boolean);
        if (!cancelled) setSelectedTaxIds(ids);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialProduct?.id]);

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Service name is required";
    const r = parseFloat(rate);
    if (Number.isNaN(r) || r < 0) e.rate = "Enter a valid rate (0 or greater)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveTaxes = async (productId) => {
    const res = await fetch(`/api/products/${productId}/taxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taxTypeIds: selectedTaxIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save taxes");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const rateNum = parseFloat(rate);
      const body = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        serviceBillingType: billingType,
        rate: rateNum,
        serviceDefaultQty:
          defaultQty.trim() === "" ? undefined : parseFloat(defaultQty) || undefined,
        selectedTaxIds,
      };

      if (isEdit) {
        const res = await fetch(`/api/stock/${initialProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            isService: true,
            unitPrice: rateNum,
            price: rateNum,
            quantityInStock: 0,
            cost: 0,
            costPrice: 0,
            category: initialProduct.category || "Services",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Update failed");
        }
        await saveTaxes(initialProduct.id);
        showToast?.("success", "Service updated", name.trim());
      } else {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Could not create service");
        }
        const data = await res.json();
        const pid = data.product?.id;
        if (pid) {
          await saveTaxes(pid);
        }
        showToast?.("success", "Service created", name.trim());
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      showToast?.("error", "Save failed", err.message || "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-form-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col border border-slate-200/80">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
              <Briefcase className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="service-form-title" className="text-lg font-semibold text-slate-900 truncate">
                {isEdit ? "Edit service" : "Add service"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Billable item — no inventory. Revenue posts to account{" "}
                <span className="font-semibold text-slate-800">4000</span> {tt('when present in your chart of accounts.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label={tt('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="service-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{tt('Service name *')}</label>
            <input
              type="text"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.name ? "border-red-300 bg-red-50/50" : "border-slate-200"
              }`}
              placeholder={tt('e.g. Consulting')}
              autoComplete="off"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Service code (optional)</label>
            <input
              type="text"
              value={sku}
              onChange={(ev) => setSku(ev.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              placeholder={tt('Auto-generated if empty')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{tt('Description')}</label>
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-y min-h-[72px]"
              placeholder="What is included?"
            />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{tt('Pricing')}</p>
            <div>
              <span className="block text-xs font-medium text-slate-600 mb-2">{tt('Billing type')}</span>
              <div className="flex flex-wrap gap-2">
                {BILLING_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`inline-flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                      billingType === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingType"
                      value={opt.value}
                      checked={billingType === opt.value}
                      onChange={() => setBillingType(opt.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{tt('Rate *')}</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={rate}
                onChange={(ev) => setRate(ev.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${
                  errors.rate ? "border-red-300" : "border-slate-200"
                }`}
                placeholder="0.00"
              />
              {errors.rate && <p className="text-xs text-red-600 mt-1">{errors.rate}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{tt('Accounting')}</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              Income is recorded against your standard{" "}
              <span className="font-semibold text-slate-800">Revenue (4000)</span> account (or the first matching revenue account the system finds).
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">VAT / tax (from tax management)</label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
                {taxTypes.length === 0 && !loadingMeta && (
                  <p className="text-xs text-slate-500 px-1">{tt('No active tax types.')}</p>
                )}
                {taxTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer px-1 py-0.5 rounded hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedTaxIds.includes(t.id)}
                      onChange={() => {
                        setSelectedTaxIds((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-slate-800">{t.taxName}</span>
                    <span className="text-slate-500 text-xs">({t.taxRate ?? 0}%)</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Default quantity (optional)</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.0001"
              value={defaultQty}
              onChange={(ev) => setDefaultQty(ev.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder={tt('e.g. 1 for one hour')}
            />
            <p className="text-xs text-slate-500 mt-1">{tt('Used as a default on invoices or POS when applicable.')}</p>
          </div>
        </form>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => !submitting && onClose?.()}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-white"
          >
            {tt('Cancel')}
          </button>
          <button
            type="submit"
            form="service-modal-form"
            disabled={submitting || !canSubmit || loadingMeta}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {tt('Saving…')}
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create service"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatBillingLabel(v) {
  const o = BILLING_OPTIONS.find((x) => x.value === v);
  return o ? o.label : v || "—";
}
