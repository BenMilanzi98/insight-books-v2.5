"use client";
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useState } from "react";
import PageHeader from "@/components/shell/PageHeader";
import { getPermission } from "@/lib/permissions";

export default function TaxSettingsHubPage() {
  const [mappings, setMappings] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [canUpdate, setCanUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [form, setForm] = useState({
    purpose: "VAT_OUTPUT",
    accountId: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mapRes, acctRes] = await Promise.all([
        fetch("/api/tax-management/mappings"),
        fetch("/api/tax-types/accounts").catch(() => null),
      ]);
      if (!mapRes.ok) {
        const body = await mapRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load mappings");
      }
      const mapData = await mapRes.json();
      setMappings(mapData.mappings || []);
      setPurposes(mapData.purposes || []);
      if (acctRes?.ok) {
        const acctData = await acctRes.json();
        setAccounts(acctData.accounts || acctData || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPermission("tax.update").then(setCanUpdate);
    load();
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.purpose || !form.accountId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/tax-management/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Save failed");
      setSuccess("Mapping saved.");
      setForm((f) => ({ ...f, notes: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-2">
      <PageHeader
        title={tt('Tax settings')}
        description="Purpose → chart of accounts mappings used by tax posting (Wave 3)."
      />

      {error ? (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {canUpdate ? (
        <form
          onSubmit={onSave}
          className="mb-6 grid gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-muted)] p-4 md:grid-cols-4"
        >
          <label className="text-sm">
            <span className="mb-1 block text-[var(--text-secondary)]">{tt('Purpose')}</span>
            <select
              className="w-full rounded border border-[var(--border-default)] bg-white px-2 py-2"
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            >
              {(purposes.length ? purposes : ["VAT_OUTPUT", "VAT_INPUT", "TAX_PAYABLE"]).map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-[var(--text-secondary)]">{tt('Account')}</span>
            <select
              className="w-full rounded border border-[var(--border-default)] bg-white px-2 py-2"
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              required
            >
              <option value="">{tt('Select account…')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code ? `${a.code} — ` : ""}
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-[var(--radius-sm)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? tt('Saving…') : tt('Save mapping')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-2 font-medium">{tt('Purpose')}</th>
              <th className="px-4 py-2 font-medium">{tt('Account')}</th>
              <th className="px-4 py-2 font-medium">{tt('Effective from')}</th>
              <th className="px-4 py-2 font-medium">{tt('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-[var(--text-secondary)]" colSpan={4}>
                  {tt('Loading…')}
                </td>
              </tr>
            ) : mappings.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--text-secondary)]" colSpan={4}>
                  {tt('No purpose mappings yet. Until configured, posting falls back to TaxType.accountId and fixed 2041/2045 accounts.')}
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border-default)]">
                  <td className="px-4 py-2 font-medium">{m.purpose}</td>
                  <td className="px-4 py-2">
                    {m.account?.code ? `${m.account.code} — ` : ""}
                    {m.account?.name || m.accountId}
                  </td>
                  <td className="px-4 py-2">
                    {m.effectiveFrom
                      ? new Date(m.effectiveFrom).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">{m.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
