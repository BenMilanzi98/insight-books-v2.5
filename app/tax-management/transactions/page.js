"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxTransactionsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/transactions");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load tax transactions");
      }
      const data = await res.json();
      setRows(data.transactions || []);
      setTotal(data.accumulated);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPermission("tax.update").then(setCanUpdate);
    load();
  }, []);

  const runBackfill = async () => {
    setBackfilling(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tax-management/transactions/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 500 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Backfill failed");
      setMessage(data.message || `Wrote ${data.writtenLines} line(s).`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title={tt('Tax transactions')}
        description="Subledger projected from posted journal lines (Wave 3)."
        actions={
          canUpdate ? (
            <button
              type="button"
              disabled={backfilling}
              onClick={runBackfill}
              className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {backfilling ? tt('Backfilling…') : tt('Backfill from journals')}
            </button>
          ) : null
        }
      />
      {message ? (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}


      {total?.available ? (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Accumulated (signed):{" "}
          <span className="font-medium text-[var(--text-primary)]">
            {formatCurrency(total.total)}
          </span>
        </p>
      ) : (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          {tt('Subledger fills as journals are projected. Until then, balances still come from tax accounts / GL.')}
        </p>
      )}

      {error ? (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-2 font-medium">{tt('Date')}</th>
              <th className="px-4 py-2 font-medium">{tt('Purpose')}</th>
              <th className="px-4 py-2 font-medium">{tt('Direction')}</th>
              <th className="px-4 py-2 font-medium">{tt('Amount')}</th>
              <th className="px-4 py-2 font-medium">{tt('Source')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-[var(--text-secondary)]">
                  {tt('Loading…')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-[var(--text-secondary)]">
                  {tt('No tax subledger rows yet.')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border-default)]">
                  <td className="px-4 py-2">
                    {r.postingDate
                      ? new Date(r.postingDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">{r.purpose || "—"}</td>
                  <td className="px-4 py-2">{r.direction}</td>
                  <td className="px-4 py-2">{formatCurrency(Number(r.amountSigned || 0))}</td>
                  <td className="px-4 py-2 text-[var(--text-secondary)]">
                    {r.sourceType || "—"}
                    {r.isReversal ? " (reversal)" : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
