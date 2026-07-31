"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxCreditsPage() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/credits");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load credits");
      setCredits(data.credits || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPermission("tax.update").then(setCanUpdate);
    load();
  }, []);

  const createCredit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reference, source: "manual" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      setAmount("");
      setReference("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const voidCredit = async (creditId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", creditId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Void failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: "amount",
      label: "Amount",
      render: (r) => formatCurrency(Number(r.amount || 0)),
    },
    {
      key: "remaining",
      label: "Remaining",
      render: (r) => formatCurrency(Number(r.remaining || 0)),
    },
    { key: "status", label: "Status" },
    { key: "reference", label: "Reference" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate && r.status === "OPEN" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => voidCredit(r.id)}
            className="text-sm text-red-600 hover:underline"
          >
            Void
          </button>
        ) : null,
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax credits"
        description="Credit register — apply against settlements; does not invent GL balances."
      />
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {canUpdate ? (
        <form
          onSubmit={createCredit}
          className="mb-4 grid gap-3 rounded border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 md:grid-cols-3"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded border border-[var(--border-default)] bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded border border-[var(--border-default)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Add credit
          </button>
        </form>
      ) : null}
      <TaxOpsTable columns={columns} rows={credits} loading={loading} />
    </div>
  );
}
