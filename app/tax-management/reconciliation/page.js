"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";

export default function TaxReconciliationPage() {
  const [suite, setSuite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/tax-management/reconciliation?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reconciliation failed");
      setSuite(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (startDate && endDate) load();
  }, [startDate, endDate]);

  const card = (title, result) => {
    if (!result) {
      return (
        <div className="rounded border border-[var(--border-default)] p-4 text-sm text-[var(--text-secondary)]">
          {title}: not run
        </div>
      );
    }
    const tone =
      result.status === "MATCHED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : result.status === "VARIANCE"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-[var(--border-default)] bg-[var(--surface-muted)] text-[var(--text-primary)]";
    return (
      <div className={`rounded border p-4 text-sm ${tone}`}>
        <div className="mb-1 font-medium">
          {title}: {result.status}
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs opacity-90">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title={tt('Tax reconciliation')}
        description="Subledger ↔ GL, return ↔ transactions, reversal journal linkage."
        actions={
          <button
            type="button"
            onClick={load}
            className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {tt('Re-run')}
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">
          Start{" "}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="ml-1 rounded border border-[var(--border-default)] px-2 py-1"
          />
        </label>
        <label className="text-sm">
          End{" "}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="ml-1 rounded border border-[var(--border-default)] px-2 py-1"
          />
        </label>
      </div>
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">{tt('Running suite…')}</p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Overall: {suite?.overall || "—"}{" "}
            <span className="font-normal text-[var(--text-secondary)]">
              {suite?.ranAt ? `(${new Date(suite.ranAt).toLocaleString()})` : ""}
            </span>
          </div>
          {card("Subledger vs GL", suite?.results?.subledgerVsGl)}
          {card("Return vs transactions", suite?.results?.returnVsTx)}
          {card("Reversal journal linkage", suite?.results?.reversalLinkage)}
        </div>
      )}
    </div>
  );
}
