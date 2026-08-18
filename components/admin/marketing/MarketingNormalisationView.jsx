'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminDataTable from '@/components/admin/AdminDataTable';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import AdminField from '@/components/admin/AdminField';
import MarketingSectionNav from './MarketingSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const btnSmall =
  'inline-flex h-8 items-center rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-2 text-xs hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

function ruleTone(status) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'neutral';
  return 'warning';
}

export default function MarketingNormalisationView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    ruleCode: '',
    rawSourcePattern: '',
    rawMediumPattern: '',
    channelCode: '',
    sourceCode: '',
    mediumCode: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/marketing/normalisation/rules', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error(body.error || 'Insufficient privileges.');
      if (!res.ok) throw new Error(body.error || 'Failed to load rules.');
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || 'Failed to load rules.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const res = await adminFetch('/api/admin/marketing/normalisation/rules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create rule.');
      setForm({
        ruleCode: '',
        rawSourcePattern: '',
        rawMediumPattern: '',
        channelCode: '',
        sourceCode: '',
        mediumCode: '',
      });
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    setActivatingId(id);
    try {
      const res = await adminFetch(`/api/admin/marketing/normalisation/rules/${id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to activate rule.');
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to activate rule.');
    } finally {
      setActivatingId('');
    }
  };

  const columns = [
    { key: 'ruleCode', header: 'Rule', cell: (r) => `${r.ruleCode} v${r.version}` },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <AdminStatusBadge tone={ruleTone(r.status)}>{r.status}</AdminStatusBadge>,
    },
    { key: 'pattern', header: 'Raw source', cell: (r) => r.rawSourcePattern },
    {
      key: 'mapping',
      header: 'Maps to',
      cell: (r) => `${r.channelCode} / ${r.sourceCode} / ${r.mediumCode}`,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.status === 'DRAFT' ? (
          <button
            type="button"
            className={btnSmall}
            disabled={activatingId === r.id}
            onClick={() => handleActivate(r.id)}
          >
            {activatingId === r.id ? tt('Activating…') : tt('Activate')}
          </button>
        ) : null,
    },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={tt('Source normalisation')}
        description="Versioned rules map raw CRM capture strings to governed taxonomy. ACTIVE rules are immutable."
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {tt('Refresh')}
          </button>
        }
      />

      <MarketingSectionNav />

      <section className="mb-8 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="mb-4 text-sm font-semibold text-[var(--admin-text)]">{tt('Create DRAFT rule')}</h2>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <AdminField label="Rule code" htmlFor="rule-code" required>
            <AdminField.Input
              id="rule-code"
              value={form.ruleCode}
              onChange={(e) => setForm((f) => ({ ...f, ruleCode: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Raw source pattern" htmlFor="rule-raw-source" required>
            <AdminField.Input
              id="rule-raw-source"
              value={form.rawSourcePattern}
              onChange={(e) => setForm((f) => ({ ...f, rawSourcePattern: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Raw medium pattern" htmlFor="rule-raw-medium">
            <AdminField.Input
              id="rule-raw-medium"
              value={form.rawMediumPattern}
              onChange={(e) => setForm((f) => ({ ...f, rawMediumPattern: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Channel code" htmlFor="rule-channel" required>
            <AdminField.Input
              id="rule-channel"
              value={form.channelCode}
              onChange={(e) => setForm((f) => ({ ...f, channelCode: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Source code" htmlFor="rule-source" required>
            <AdminField.Input
              id="rule-source"
              value={form.sourceCode}
              onChange={(e) => setForm((f) => ({ ...f, sourceCode: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Medium code" htmlFor="rule-medium" required>
            <AdminField.Input
              id="rule-medium"
              value={form.mediumCode}
              onChange={(e) => setForm((f) => ({ ...f, mediumCode: e.target.value }))}
              required
            />
          </AdminField>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? tt('Saving…') : tt('Create DRAFT')}
            </button>
            {formError ? (
              <p className="text-sm text-[var(--admin-danger)]" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={tt('No normalisation rules')}
          description="Create a DRAFT rule to map CRM raw source strings to taxonomy codes."
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <AdminDataTable columns={columns} rows={items} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
