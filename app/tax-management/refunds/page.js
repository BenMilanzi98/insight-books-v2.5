"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/refunds");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load refunds");
      setRefunds(data.refunds || []);
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
      const res = await fetch("/api/tax-management/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const postRefund = async (refundId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", refundId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Post failed");
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
    { key: "status", label: "Status" },
    { key: "reason", label: "Reason" },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate && r.status === "DRAFT" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => postRefund(r.id)}
            className="text-sm text-[var(--brand-primary)] hover:underline"
          >
            {tt('Mark posted')}
          </button>
        ) : null,
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax refunds"
        description="Refund workflow register. Mark posted after the V2 refund settlement journal exists."
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
            placeholder={tt('Reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
      <TaxOpsTable columns={columns} rows={refunds} loading={loading} />
    </div>
  );
}
