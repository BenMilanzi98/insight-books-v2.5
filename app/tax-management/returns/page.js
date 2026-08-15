"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import TaxOpsTable from "@/components/tax/TaxOpsTable";
import { formatCurrency } from "@/lib/currencyUtils";
import { getPermission } from "@/lib/permissions";

export default function TaxReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canUpdate, setCanUpdate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [retRes, perRes] = await Promise.all([
        fetch("/api/tax-management/returns"),
        fetch("/api/tax-management/periods"),
      ]);
      const retData = await retRes.json().catch(() => ({}));
      const perData = await perRes.json().catch(() => ({}));
      if (!retRes.ok) throw new Error(retData.error || "Failed to load returns");
      setReturns(retData.returns || []);
      setPeriods(perData.periods || []);
      if (!periodId && perData.periods?.[0]) {
        setPeriodId(perData.periods[0].id);
      }
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

  const createDraft = async () => {
    if (!periodId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", taxPeriodId: periodId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action, returnId, extra = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tax-management/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, returnId, ...extra }),
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
    {
      key: "period",
      label: "Period",
      render: (r) => r.taxPeriod?.code || r.taxPeriodId,
    },
    { key: "returnType", label: "Type" },
    { key: "status", label: "Status" },
    {
      key: "outputTax",
      label: "Output",
      render: (r) => formatCurrency(Number(r.outputTax || 0)),
    },
    {
      key: "inputTax",
      label: "Input",
      render: (r) => formatCurrency(Number(r.inputTax || 0)),
    },
    {
      key: "netTax",
      label: "Net",
      render: (r) => formatCurrency(Number(r.netTax || 0)),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canUpdate ? (
          <div className="flex flex-wrap gap-2">
            {r.status === "DRAFT" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction("ready", r.id)}
                  className="text-sm text-[var(--brand-primary)] hover:underline"
                >
                  {tt('Mark ready')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction("file", r.id)}
                  className="text-sm text-[var(--brand-primary)] hover:underline"
                >
                  {tt('File')}
                </button>
              </>
            ) : null}
            {r.status === "READY" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction("file", r.id)}
                className="text-sm text-[var(--brand-primary)] hover:underline"
              >
                {tt('File')}
              </button>
            ) : null}
            {r.status === "FILED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  runAction("amend", r.id, {
                    amendmentReason: "Amendment requested from Tax Returns UI",
                  })
                }
                className="text-sm text-[var(--brand-primary)] hover:underline"
              >
                {tt('Amend')}
              </button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Tax returns"
        description="Draft → ready → filed. Filing records status only — it does not auto-journal."
        actions={
          canUpdate ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border border-[var(--border-default)] bg-white px-2 py-2 text-sm"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value="">{tt('Select period…')}</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} ({p.status})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !periodId}
                onClick={createDraft}
                className="rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {tt('New draft return')}
              </button>
            </div>
          ) : null
        }
      />
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      <TaxOpsTable columns={columns} rows={returns} loading={loading} />
    </div>
  );
}
