'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminDataTable,
  AdminField,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

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

  const columns = useMemo(
    () => [
      {
        key: 'email',
        header: 'Email',
        render: (r) => <span className="break-all text-[var(--admin-text)]">{r.email}</span>,
      },
      {
        key: 'reason',
        header: 'Reason',
      },
      {
        key: 'source',
        header: 'Source',
      },
      {
        key: 'createdAt',
        header: 'Added',
        render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Email suppression"
        description="Bounced, complained, or manually suppressed addresses. Retries skip suppressed recipients."
        actions={
          <button type="button" onClick={load} className={btnGhost}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
          </button>
        }
      />

      <form
        onSubmit={add}
        className="mb-6 grid grid-cols-1 gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <AdminField label="Email" htmlFor="suppress-email" required>
          <AdminField.Input
            id="suppress-email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AdminField>
        <AdminField label="Reason" htmlFor="suppress-reason">
          <AdminField.Select
            id="suppress-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="manual">manual</option>
            <option value="bounce">bounce</option>
            <option value="complaint">complaint</option>
            <option value="invalid">invalid</option>
          </AdminField.Select>
        </AdminField>
        <button type="submit" disabled={saving} className={btnPrimary}>
          <Plus className="h-4 w-4" aria-hidden />
          {saving ? 'Saving…' : 'Suppress'}
        </button>
      </form>

      {loading ? <AdminLoadingState label="Loading suppressions" /> : null}
      {!loading && error && rows.length === 0 ? (
        <AdminErrorState message={error} onRetry={load} />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState title="No suppressions" description="Suppressed addresses will appear here." />
      ) : null}
      {!loading && rows.length > 0 ? <AdminDataTable columns={columns} rows={rows} rowKey="id" /> : null}
    </AdminPageContainer>
  );
}
