"use client";
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Package,
  ClipboardList,
  Inbox,
  RefreshCw,
  Truck,
  CheckCircle2,
} from "lucide-react";

function formatShortDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ReceivingModule({ refreshTrigger = 0 }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    orderedGoodsOutstanding: [],
    postedInventoryPending: [],
    goodsReceivedPosted: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stock/receiving", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load (${res.status})`);
      }
      setData({
        orderedGoodsOutstanding: json.orderedGoodsOutstanding || [],
        postedInventoryPending: json.postedInventoryPending || [],
        goodsReceivedPosted: json.goodsReceivedPosted || [],
      });
    } catch (e) {
      setError(e.message || "Could not load receiving data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const orderedCount = data.orderedGoodsOutstanding.length;
  const pendingCount = data.postedInventoryPending.length;
  const receivedCount = data.goodsReceivedPosted.length;

  const unitsStillToReceive = useMemo(
    () =>
      data.orderedGoodsOutstanding.reduce(
        (sum, po) =>
          sum +
          (po.lines || []).reduce(
            (s, line) => s + (Number(line.quantityRemaining) || 0),
            0
          ),
        0
      ),
    [data.orderedGoodsOutstanding]
  );

  /** Middle column badge: outstanding units (normal case) + rare deferred stock postings. */
  const goodsToReceiveBadge = useMemo(() => {
    const parts = [];
    if (unitsStillToReceive > 0) {
      parts.push(
        `${unitsStillToReceive} unit${unitsStillToReceive !== 1 ? "s" : ""}`
      );
    }
    if (pendingCount > 0) {
      parts.push(
        `${pendingCount} stock-pending receipt${pendingCount !== 1 ? "s" : ""}`
      );
    }
    if (parts.length === 0) return "All caught up";
    return parts.join(" · ");
  }, [unitsStillToReceive, pendingCount]);

  return (
    <div className="mb-6 lg:mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-stretch border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
        <button
          type="button"
          id="receiving-module-toggle"
          aria-expanded={open}
          aria-controls="receiving-module-panel"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50/80 transition-colors text-left min-w-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-700 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="receiving-module-title"
                className="text-lg font-semibold text-gray-900"
              >
                {tt('Receiving & purchase orders')}
              </h2>
              <p className="text-xs text-gray-500">
                {open ? (
                  <span className="block truncate">
                    Ordered lines · Quantities still to receive · Recently received (in
                    stock)
                  </span>
                ) : (
                  <span className="block text-teal-800/90">
                    Click or tap here, or press{" "}
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-[10px] font-sans text-gray-700">
                      {tt('Enter')}
                    </kbd>{" "}
                    or{" "}
                    <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-[10px] font-sans text-gray-700">
                      {tt('Space')}
                    </kbd>
                    , to view receiving status and purchase order details.
                  </span>
                )}
              </p>
            </div>
          </div>
          {open ? (
            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
          )}
        </button>
        <div className="flex items-center pr-2 border-l border-gray-100/80">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div
          id="receiving-module-panel"
          role="region"
          aria-labelledby="receiving-module-title"
          className="p-4 lg:p-6 space-y-6"
        >
          <div className="flex flex-wrap gap-2">
            <Link
              href="/purchases/receipts"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              <Inbox className="w-4 h-4" />
              {tt('Receive goods')}
            </Link>
            <Link
              href="/purchases/orders"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ClipboardList className="w-4 h-4" />
              {tt('All purchase orders')}
            </Link>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading && !error ? (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="h-48 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-48 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-48 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <section className="rounded-xl border border-amber-100 bg-amber-50/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-100/80 bg-amber-50/80 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {tt('Ordered goods')}
                  </h3>
                  <span className="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    {orderedCount} PO{orderedCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="px-4 pt-2 text-xs text-gray-600">
                  {tt('Goods still to receive on approved / in-flight purchase orders. Lines disappear as you post receipts up to the ordered quantity.')}
                </p>
                <div className="p-3 max-h-[min(380px,48vh)] overflow-y-auto space-y-3">
                  {data.orderedGoodsOutstanding.length === 0 ? (
                    <p className="text-sm text-gray-500 px-1 py-4 text-center">
                      {tt('No outstanding goods on purchase orders.')}
                    </p>
                  ) : (
                    data.orderedGoodsOutstanding.map((po) => (
                      <div
                        key={po.id}
                        className="rounded-lg border border-white/80 bg-white shadow-sm p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {po.poNumber}
                            </div>
                            <div className="text-xs text-gray-500">
                              {po.supplierName} · {formatShortDate(po.poDate)} ·{" "}
                              {po.status}
                            </div>
                          </div>
                          <Link
                            href="/purchases/receipts"
                            className="text-xs font-medium text-teal-700 hover:underline shrink-0"
                          >
                            {tt('Receive →')}
                          </Link>
                        </div>
                        <ul className="text-xs space-y-1.5 border-t border-gray-100 pt-2">
                          {po.lines.map((line) => (
                            <li
                              key={line.lineId}
                              className="flex justify-between gap-2 text-gray-700"
                            >
                              <span className="truncate">
                                {line.productName}
                                {line.sku ? (
                                  <span className="text-gray-400 ml-1">
                                    ({line.sku})
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 font-mono text-amber-900">
                                {line.quantityRemaining} left / {line.quantityOrdered}{" "}
                                ordered
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-teal-100 bg-teal-50/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-teal-100/80 bg-teal-50/60 flex items-center gap-2 flex-wrap">
                  <Inbox className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {tt('Goods to be received')}
                  </h3>
                  <span className="text-xs font-medium text-teal-900 bg-teal-100 px-2 py-0.5 rounded-full max-w-[min(100%,14rem)] truncate" title={goodsToReceiveBadge}>
                    {goodsToReceiveBadge}
                  </span>
                </div>
                <p className="px-4 pt-2 text-xs text-gray-600">
                  Quantities on purchase orders that still need a goods receipt, plus any
                  posted receipts whose stock is scheduled (e.g. future receipt date).
                </p>
                <div className="p-3 max-h-[min(380px,48vh)] overflow-y-auto space-y-4">
                  {data.postedInventoryPending.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                        {tt('Stock posting pending')}
                      </h4>
                      <ul className="space-y-2">
                        {data.postedInventoryPending.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-lg border border-white bg-white p-3 text-sm shadow-sm"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-medium text-gray-900">
                                {r.receiptNumber}
                              </span>
                              <Link
                                href="/purchases/receipts"
                                className="text-xs text-teal-700 hover:underline shrink-0"
                              >
                                {tt('View')}
                              </Link>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {r.supplierName}
                              {r.poNumber ? ` · PO ${r.poNumber}` : ""} ·{" "}
                              {formatShortDate(r.receiptDate)} · applies on receipt date
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                      {tt('Awaiting goods receipt')}
                    </h4>
                    {data.orderedGoodsOutstanding.length === 0 ? (
                      <p className="text-sm text-gray-500 px-1 py-2 text-center">
                        {tt('No open quantities on purchase orders.')}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {data.orderedGoodsOutstanding.map((po) => {
                          const units = (po.lines || []).reduce(
                            (s, line) =>
                              s + (Number(line.quantityRemaining) || 0),
                            0
                          );
                          const lineCount = (po.lines || []).length;
                          return (
                            <li
                              key={po.id}
                              className="rounded-lg border border-white bg-white p-3 text-sm shadow-sm"
                            >
                              <div className="flex justify-between gap-2 items-start">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {po.poNumber}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {po.supplierName} · {lineCount} line
                                    {lineCount !== 1 ? "s" : ""} ·{" "}
                                    <span className="font-mono text-teal-900">
                                      {units} unit{units !== 1 ? "s" : ""} to receive
                                    </span>
                                  </div>
                                </div>
                                <Link
                                  href="/purchases/receipts"
                                  className="text-xs font-medium text-teal-700 hover:underline shrink-0"
                                >
                                  {tt('Receive')}
                                </Link>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-emerald-100 bg-emerald-50/25 overflow-hidden">
                <div className="px-4 py-3 border-b border-emerald-100/80 bg-emerald-50/50 flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {tt('Goods received')}
                  </h3>
                  <span className="text-xs font-medium text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {receivedCount} recent
                  </span>
                </div>
                <p className="px-4 pt-2 text-xs text-gray-600">
                  {tt('Posted receipts with stock applied. PO lines no longer appear in “Ordered goods” once fully received.')}
                </p>
                <div className="p-3 max-h-[min(380px,48vh)] overflow-y-auto space-y-2">
                  {data.goodsReceivedPosted.length === 0 ? (
                    <p className="text-sm text-gray-500 px-1 py-4 text-center">
                      {tt('No recent completed receipts.')}
                    </p>
                  ) : (
                    data.goodsReceivedPosted.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-white bg-white p-3 text-sm shadow-sm"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-gray-900">
                            {r.receiptNumber}
                          </span>
                          <Link
                            href="/purchases/receipts"
                            className="text-xs text-emerald-700 hover:underline shrink-0"
                          >
                            {tt('View')}
                          </Link>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {r.supplierName}
                          {r.poNumber ? ` · PO ${r.poNumber}` : ""} ·{" "}
                          {formatShortDate(r.receiptDate)} · {r.itemCount} line
                          {r.itemCount !== 1 ? "s" : ""} in stock
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
