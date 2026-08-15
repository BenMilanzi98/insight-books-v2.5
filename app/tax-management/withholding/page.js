"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxWithholdingPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/withholding");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load withholding");
      setRows(data.remittances || []);
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

  const createDraft = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/withholding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, counterparty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      setAmount("");
      setCounterparty("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remit = async (remittanceId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/withholding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remit", remittanceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Remit failed");
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
    { key: "counterparty", label: "Counterparty" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate && r.status === "DRAFT" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => remit(r.id)}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            {tt('Mark remitted')}
          </button>
        ) : null,
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Withholding tax"
        description="Withholding remittance register. Remit status after the V2 payment journal is posted."
      />
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {canUpdate ? (
        <form
          onSubmit={createDraft}
          className="mb-4 grid gap-3 rounded border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 md:grid-cols-3"
        >
          <input
            type="number"
            step="0.01"
            min="0"
            required
            placeholder={tt('Amount')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded border border-[var(--border-default)] bg-white px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder={tt('Counterparty')}
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            className="rounded border border-[var(--border-default)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {tt('Create draft')}
          </button>
        </form>
      ) : null}
      <TaxOpsTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
