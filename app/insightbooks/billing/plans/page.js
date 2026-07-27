'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
} from '@/components/admin';

export default function AdminBillingPlansPage() {
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    planCode: '',
    name: '',
    basePrice: '',
    currency: 'MWK',
    billingFrequency: 'month',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/plans', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load plans');
      setLatest(body.latest || body.plans || []);
    } catch (e) {
      setError(e.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createVersion = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform-billing/plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          basePrice: Number(form.basePrice),
          forceNewVersion: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create plan version');
      setShowForm(false);
      setForm({
        planCode: '',
        name: '',
        basePrice: '',
        currency: 'MWK',
        billingFrequency: 'month',
      });
      await load();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Subscription Plans"
        description="Versioned platform plans. Price changes create a new version — existing subscriptions keep agreed pricing until changed explicitly."
        actions={
          <>
            <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded bg-[var(--action-primary)] px-3 py-2 text-sm text-white"
            >
              <Plus className="h-4 w-4" /> New version
            </button>
          </>
        }
      />

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && latest.length === 0 ? (
        <AdminEmptyState title="No plans" description="Plans will seed from the catalog on first load." />
      ) : null}

      {!loading && !error && latest.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{p.planCode}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">v{p.version}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.currency} {Number(p.basePrice).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{p.billingFrequency}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {p.status}
                    </AdminStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form onSubmit={createVersion} className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-lg font-semibold">Create plan version</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Creating a new version supersedes the previous ACTIVE version for that plan code.
            </p>
            {['planCode', 'name', 'basePrice'].map((key) => (
              <label key={key} className="mt-3 block text-sm">
                <span className="mb-1 block font-medium capitalize">{key}</span>
                <input
                  required
                  className="w-full rounded border px-3 py-2"
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </label>
            ))}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-[var(--action-primary)] px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Create version'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
