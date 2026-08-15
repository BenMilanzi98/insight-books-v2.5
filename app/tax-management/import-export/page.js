"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { getPermission } from "@/lib/permissions";

export default function TaxImportExportPage() {
  const [canUpdate, setCanUpdate] = useState(false);
  const [jsonText, setJsonText] = useState(
    JSON.stringify(
      {
        dryRun: true,
        rows: [{ purpose: "VAT_OUTPUT", accountId: "", notes: "example" }],
      },
      null,
      2
    )
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPermission("tax.update").then(setCanUpdate);
  }, []);

  const run = async (dryRun) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonText);
      parsed.dryRun = dryRun;
      const res = await fetch("/api/tax-management/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title="Import / Export"
        description="Controlled tax mapping imports with dry-run by default. Exports use Reports."
      />
      {!canUpdate ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {tt('tax.update is required to import mappings.')}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-[var(--text-secondary)]">
            {tt('Paste JSON for purpose → account mapping rows. Always dry-run first.')}
          </p>
          <textarea
            className="mb-3 h-56 w-full rounded border border-[var(--border-default)] bg-white p-3 font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(true)}
              className="rounded bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {tt('Dry run')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(false)}
              className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {tt('Commit import')}
            </button>
          </div>
        </>
      )}
      {error ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {result ? (
        <pre className="overflow-x-auto rounded border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
