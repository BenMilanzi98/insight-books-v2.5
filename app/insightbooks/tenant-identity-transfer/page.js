"use client";
import { tt } from '@/lib/i18n/runtime';

import { useState } from "react";

export default function TenantIdentityTransferPage() {
  const [tab, setTab] = useState("export");
  const [mode, setMode] = useState("active");
  const [tenantId, setTenantId] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [preview, setPreview] = useState([]);
  const [pkg, setPkg] = useState(null);
  const [importText, setImportText] = useState("");
  const [dryRun, setDryRun] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runExport = async (previewOnly) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tenant-identity/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          tenantId: tenantId.trim() || undefined,
          subdomain: subdomain.trim() || undefined,
          previewOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "Export failed");
      setPreview(data.package?.preview || []);
      if (!previewOnly) {
        setPkg(data.package);
        const blob = new Blob([JSON.stringify(data.package, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tenant-identity-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        setPkg(null);
      }
    } catch (e) {
      setError(e.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const parseImportPackage = () => {
    try {
      return JSON.parse(importText);
    } catch {
      throw new Error("Invalid JSON");
    }
  };

  const runDryRun = async () => {
    setLoading(true);
    setError("");
    setDryRun(null);
    setImportResult(null);
    try {
      const parsed = parseImportPackage();
      const res = await fetch("/api/admin/tenant-identity/import/dry-run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dry-run failed");
      setDryRun(data);
    } catch (e) {
      setError(e.message || "Dry-run failed");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setLoading(true);
    setError("");
    setImportResult(null);
    try {
      const parsed = parseImportPackage();
      const res = await fetch("/api/admin/tenant-identity/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportResult(data);
      setDryRun(data);
    } catch (e) {
      setError(e.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{tt('Tenant Identity Transfer')}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Export or import tenants, users (with password hashes), roles, memberships, and
          subscription history. Business data is not included.
        </p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2">
          {tt('Packages contain bcrypt password hashes. Treat downloaded files as confidential.')}
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {["export", "import"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "export" ? "Export" : "Import"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {tab === "export" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={mode === "active"}
                onChange={() => setMode("active")}
              />
              Active tenants (paid-active subscription)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={mode === "paid_inactive"}
                onChange={() => setMode("paid_inactive")}
              />
              {tt('Paid before but inactive')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="mode"
                checked={mode === "specific"}
                onChange={() => setMode("specific")}
              />
              {tt('Specific tenant')}
            </label>
          </div>

          {mode === "specific" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{tt('Tenant ID')}</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder={tt('cuid…')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{tt('Subdomain')}</label>
                <input
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder={tt('acme')}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => runExport(true)}
              className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {tt('Preview')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => runExport(false)}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {tt('Download JSON')}
            </button>
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">{tt('Name')}</th>
                    <th className="py-2 pr-3">{tt('Subdomain')}</th>
                    <th className="py-2 pr-3">{tt('Sub status')}</th>
                    <th className="py-2 pr-3">{tt('Paid before')}</th>
                    <th className="py-2 pr-3">{tt('Users')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{t.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{t.subdomain}</td>
                      <td className="py-2 pr-3">{t.subscriptionStatus}</td>
                      <td className="py-2 pr-3">{t.paidBefore ? "yes" : "no"}</td>
                      <td className="py-2 pr-3">{t.userCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pkg && (
            <p className="text-xs text-emerald-700">
              Downloaded package with {pkg.tenants?.length || 0} tenant(s).
            </p>
          )}
        </div>
      )}

      {tab === "import" && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {tt('Package JSON')}
            </label>
            <textarea
              className="w-full h-48 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={tt('Paste insightbooks-tenant-identity-v1 JSON…')}
            />
            <input
              type="file"
              accept="application/json,.json"
              className="mt-2 text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportText(await file.text());
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !importText.trim()}
              onClick={runDryRun}
              className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {tt('Dry-run')}
            </button>
            <button
              type="button"
              disabled={loading || !importText.trim()}
              onClick={runImport}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {tt('Commit import')}
            </button>
          </div>

          {(dryRun || importResult) && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-2">
              <p className="font-medium">
                Summary: create {dryRun?.summary?.create ?? 0}, skip{" "}
                {dryRun?.summary?.skip ?? 0}, invalid {dryRun?.summary?.invalid ?? 0}
                {dryRun?.dryRun ? " (dry-run)" : " (committed)"}
              </p>
              <ul className="space-y-1 max-h-56 overflow-y-auto">
                {(dryRun?.tenants || []).map((t) => (
                  <li key={t.tenantId} className="text-xs">
                    <span className="font-mono">{t.subdomain}</span> — {t.outcome}
                    {t.reason ? `: ${t.reason}` : ""}
                  </li>
                ))}
              </ul>
              {Array.isArray(dryRun?.errors) && dryRun.errors.length > 0 && (
                <ul className="text-xs text-rose-700 space-y-1">
                  {dryRun.errors.map((e, i) => (
                    <li key={i}>
                      {e.path ? `${e.path}: ` : ""}
                      {e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
