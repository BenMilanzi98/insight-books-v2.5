"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import { getPermission } from "@/lib/permissions";

export default function TaxPeriodsPage() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/periods");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load periods");
      setPeriods(data.periods || []);
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

  const rollForward = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "roll-forward" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Roll-forward failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tax-management/periods/${id}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `${action} failed`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "code", label: "Code" },
    { key: "label", label: "Label" },
    {
      key: "range",
      label: "Range",
      render: (r) =>
        `${new Date(r.startDate).toLocaleDateString()} – ${new Date(r.endDate).toLocaleDateString()}`,
    },
    { key: "status", label: "Status" },
    {
      key: "counts",
      label: "Returns / Payments",
      render: (r) =>
        `${r._count?.returns ?? 0} / ${r._count?.payments ?? 0}`,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <div className="flex flex-wrap gap-2">
            {r.status === "OPEN" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(r.id, "close")}
                className="text-sm text-[var(--brand-primary)] underline-offset-2 hover:underline"
              >
                Close
              </button>
            ) : null}
            {r.status === "CLOSED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(r.id, "reopen")}
                className="text-sm text-[var(--brand-primary)] underline-offset-2 hover:underline"
              >
                Reopen
              </button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax periods"
        description="Filing calendar with open → closed → filed state machine."
        actions={
          canUpdate ? (
            <button
              type="button"
              disabled={busy}
              onClick={rollForward}
              className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Roll forward month
            </button>
          ) : null
        }
      />
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      <TaxOpsTable
        columns={columns}
        rows={periods}
        loading={loading}
        emptyLabel="No tax periods yet. Use Roll forward month to create the current period."
      />
    </div>
  );
}
