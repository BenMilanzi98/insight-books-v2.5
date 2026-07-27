'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
} from '@/components/admin';

export default function EmailSuppressionPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('manual');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/email/suppression', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load');
      setRows(body.suppressions || []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/email/suppression', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason, source: 'manual' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to suppress');
      setEmail('');
      await load();
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Email suppression"
        description="Bounced, complained, or manually suppressed addresses. Retries skip suppressed recipients."
        actions={
          <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <form
        onSubmit={add}
        className="mb-6 flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-white p-4 sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            required
            type="email"
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="text-sm sm:w-48">
          <span className="mb-1 block font-medium">Reason</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="manual">manual</option>
            <option value="bounce">bounce</option>
            <option value="complaint">complaint</option>
            <option value="invalid">invalid</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded bg-[var(--action-primary)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Saving…' : 'Suppress'}
        </button>
      </form>

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState title="No suppressions" description="Suppressed addresses will appear here." />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="break-all px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.reason}</td>
                  <td className="px-4 py-3">{r.source}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
