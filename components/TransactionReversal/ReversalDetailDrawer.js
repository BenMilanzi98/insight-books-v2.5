"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "impact", label: "Impact" },
  { id: "journals", label: "Journals" },
  { id: "tax", label: "Tax" },
  { id: "register", label: "Register / Approvals" },
];

function mapUiTypeToApi(type) {
  const t = String(type || "").toLowerCase();
  if (t === "sale" || t === "invoice") return "Invoice";
  if (t === "expense") return "Expense";
  if (t === "payment") return "Payment";
  if (t === "sale_refund") return "Sale";
  if (t === "payroll") return "Transaction";
  if (t === "refund") return "Invoice";
  return type;
}

export default function ReversalDetailDrawer({ open, onClose, reversal }) {
  const [tab, setTab] = useState("overview");
  const [details, setDetails] = useState(null);
  const [impact, setImpact] = useState(null);
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !reversal) return;
    setTab("overview");
    setDetails(null);
    setImpact(null);
    setRegister(null);
    setError(null);

    const apiType = mapUiTypeToApi(reversal.type);
    // Prefer original document id when list row is the reversal child
    const sourceId =
      reversal.originalTransactionId ||
      reversal.originalExpenseId ||
      reversal.id;


    const load = async () => {
      setLoading(true);
      try {
        const [dRes, iRes, rRes] = await Promise.all([
          fetch(
            `/api/transactions/reverse?action=details&transactionId=${encodeURIComponent(sourceId)}&transactionType=${encodeURIComponent(apiType)}`
          ),
          fetch(
            `/api/transactions/reverse?action=impact&transactionId=${encodeURIComponent(sourceId)}&transactionType=${encodeURIComponent(apiType)}`
          ),
          fetch(
            `/api/transactions/reverse?action=register&transactionId=${encodeURIComponent(sourceId)}&transactionType=${encodeURIComponent(apiType)}`
          ),
        ]);
        const d = await dRes.json().catch(() => ({}));
        const i = await iRes.json().catch(() => ({}));
        const r = await rRes.json().catch(() => ({}));
        if (!dRes.ok) throw new Error(d.error || "Failed to load details");
        setDetails(d);
        setImpact(iRes.ok ? i : null);
        setRegister(rRes.ok ? r.register || null : null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, reversal]);

  if (!open || !reversal) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={tt('Close drawer overlay')}
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{tt('Reversal detail')}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {reversal.displayReference || reversal.description || reversal.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${
                tab === t.id
                  ? "border-b-2 border-indigo-600 text-indigo-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm">
          {loading ? (
            <p className="text-slate-500">{tt('Loading…')}</p>
          ) : error ? (
            <p className="text-amber-700">{error}</p>
          ) : (
            <>
              {tab === "overview" && (
                <dl className="space-y-2">
                  <div>
                    <dt className="text-slate-500">{tt('Type')}</dt>
                    <dd className="font-medium">{reversal.type}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tt('Reason')}</dt>
                    <dd>{reversal.reversalReason || details?.original?.reversalReason || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tt('Is reversed')}</dt>
                    <dd>{details?.isReversed ? tt('Yes') : tt('Unknown / see register')}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tt('Original id')}</dt>
                    <dd className="font-mono text-xs">
                      {reversal.originalTransactionId || details?.original?.id || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tt('Reversal doc id')}</dt>
                    <dd className="font-mono text-xs">
                      {reversal.reversalTransactionId || details?.reversal?.id || reversal.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tt('GL journal')}</dt>
                    <dd className="font-mono text-xs">
                      {reversal.glReversalJournalId || "—"}
                    </dd>
                  </div>
                </dl>
              )}

              {tab === "impact" && (
                <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
                  {JSON.stringify(impact || { note: "No impact payload" }, null, 2)}
                </pre>
              )}

              {tab === "journals" && (
                <div className="space-y-2">
                  <p className="text-slate-600">
                    {tt('V2 reversals create linked opposite journals. Use General Ledger for full line drill-down.')}
                  </p>
                  <p>
                    Linked GL id:{" "}
                    <span className="font-mono text-xs">
                      {reversal.glReversalJournalId ||
                        register?.reversalJournalEntryId ||
                        "not on list payload"}
                    </span>
                  </p>
                  {register?.originalJournalEntryId ? (
                    <p>
                      Original journal:{" "}
                      <span className="font-mono text-xs">{register.originalJournalEntryId}</span>
                    </p>
                  ) : null}
                </div>
              )}

              {tab === "tax" && (
                <div>
                  {(details?.taxReversals || []).length === 0 ? (
                    <p className="text-slate-500">
                      No tax reversal rows on this detail payload.
                      {reversal.taxReversed
                        ? ` List shows tax reversed ≈ ${reversal.taxReversed}.`
                        : ""}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {details.taxReversals.map((tr, idx) => (
                        <li key={idx} className="rounded border border-slate-200 p-3">
                          <div>
                            {tr.originalTaxTransaction?.description || "Tax line"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Reversed amount:{" "}
                            {tr.reversalTaxTransaction?.reversedTaxAmount ?? "—"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === "register" && (
                <div>
                  {!register ? (
                    <p className="text-slate-500">
                      No TransactionReversal register row (pre-Wave-2 reverse or register not
                      dual-written).
                    </p>
                  ) : (
                    <dl className="space-y-2">
                      <div>
                        <dt className="text-slate-500">{tt('Status')}</dt>
                        <dd className="font-medium">{register.status}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{tt('Requested by')}</dt>
                        <dd className="font-mono text-xs">{register.requestedById || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{tt('Approved by')}</dt>
                        <dd className="font-mono text-xs">{register.approvedById || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{tt('Executed by')}</dt>
                        <dd className="font-mono text-xs">{register.executedById || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{tt('Period policy')}</dt>
                        <dd>{register.periodPolicy}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{tt('Cross-period disclosure')}</dt>
                        <dd>{register.crossPeriodDisclosure ? tt('Yes') : tt('No')}</dd>
                      </div>
                      {register.errorMessage ? (
                        <div>
                          <dt className="text-slate-500">{tt('Error')}</dt>
                          <dd className="text-amber-700">{register.errorMessage}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
