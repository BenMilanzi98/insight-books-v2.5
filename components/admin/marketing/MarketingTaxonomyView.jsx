'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminDataTable from '@/components/admin/AdminDataTable';
import AdminField from '@/components/admin/AdminField';
import AdminTabs from '@/components/admin/AdminTabs';
import MarketingSectionNav from './MarketingSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

const TABS = [
  { id: 'channels', label: 'Channels' },
  { id: 'sources', label: 'Sources' },
  { id: 'mediums', label: 'Mediums' },
];

export default function MarketingTaxonomyView() {
  const [tab, setTab] = useState('channels');
  const [channels, setChannels] = useState([]);
  const [sources, setSources] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', channelId: '', sourceId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [chRes, srcRes, medRes] = await Promise.all([
        adminFetch('/api/admin/marketing/taxonomy/channels', { credentials: 'include' }),
        adminFetch('/api/admin/marketing/taxonomy/sources', { credentials: 'include' }),
        adminFetch('/api/admin/marketing/taxonomy/mediums', { credentials: 'include' }),
      ]);
      const [chBody, srcBody, medBody] = await Promise.all([
        chRes.json().catch(() => ({})),
        srcRes.json().catch(() => ({})),
        medRes.json().catch(() => ({})),
      ]);
      if (res403(chRes, srcRes, medRes)) {
        throw new Error('Insufficient privileges.');
      }
      if (!chRes.ok || !srcRes.ok || !medRes.ok) {
        throw new Error('Failed to load taxonomy.');
      }
      setChannels(Array.isArray(chBody.items) ? chBody.items : []);
      setSources(Array.isArray(srcBody.items) ? srcBody.items : []);
      setMediums(Array.isArray(medBody.items) ? medBody.items : []);
    } catch (e) {
      setError(e.message || 'Failed to load taxonomy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    setFormError('');
    try {
      const res = await adminFetch('/api/admin/marketing/taxonomy/seed', {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to seed defaults.');
      await load();
    } catch (e) {
      setFormError(e.message || 'Failed to seed defaults.');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      let url = '/api/admin/marketing/taxonomy/channels';
      let payload = { code: form.code, name: form.name };
      if (tab === 'sources') {
        url = '/api/admin/marketing/taxonomy/sources';
        payload = { code: form.code, name: form.name, channelId: form.channelId || null };
      } else if (tab === 'mediums') {
        url = '/api/admin/marketing/taxonomy/mediums';
        payload = { code: form.code, name: form.name, sourceId: form.sourceId || null };
      }
      const res = await adminFetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create item.');
      setForm({ code: '', name: '', channelId: '', sourceId: '' });
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create item.');
    } finally {
      setSaving(false);
    }
  };

  const channelColumns = [
    { key: 'code', header: 'Code', cell: (r) => r.code },
    { key: 'name', header: 'Name', cell: (r) => r.name },
    { key: 'status', header: 'Status', cell: (r) => r.status },
  ];
  const sourceColumns = [
    { key: 'code', header: 'Code', cell: (r) => r.code },
    { key: 'name', header: 'Name', cell: (r) => r.name },
    { key: 'channel', header: 'Channel', cell: (r) => r.channel?.code || '—' },
    { key: 'status', header: 'Status', cell: (r) => r.status },
  ];
  const mediumColumns = [
    { key: 'code', header: 'Code', cell: (r) => r.code },
    { key: 'name', header: 'Name', cell: (r) => r.name },
    { key: 'source', header: 'Source', cell: (r) => r.source?.code || '—' },
    { key: 'status', header: 'Status', cell: (r) => r.status },
  ];

  const rows =
    tab === 'channels' ? channels : tab === 'sources' ? sources : mediums;
  const columns =
    tab === 'channels' ? channelColumns : tab === 'sources' ? sourceColumns : mediumColumns;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Marketing taxonomy"
        description="Governed Channel / Source / Medium catalogues. CRM Lead source strings remain separate evidence."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Seeding…' : 'Seed defaults'}
            </button>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>
        }
      />

      <MarketingSectionNav />

      <AdminTabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-4" />

      <section className="mb-8 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="mb-4 text-sm font-semibold text-[var(--admin-text)]">
          Create {tab.slice(0, -1)}
        </h2>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <AdminField label="Code" htmlFor="tax-code" required>
            <AdminField.Input
              id="tax-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Name" htmlFor="tax-name" required>
            <AdminField.Input
              id="tax-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </AdminField>
          {tab === 'sources' ? (
            <AdminField label="Channel" htmlFor="tax-channel">
              <AdminField.Select
                id="tax-channel"
                value={form.channelId}
                onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
              >
                <option value="">— Optional —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </AdminField.Select>
            </AdminField>
          ) : null}
          {tab === 'mediums' ? (
            <AdminField label="Source" htmlFor="tax-source">
              <AdminField.Select
                id="tax-source"
                value={form.sourceId}
                onChange={(e) => setForm((f) => ({ ...f, sourceId: e.target.value }))}
              >
                <option value="">— Optional —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </AdminField.Select>
            </AdminField>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
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
      {!loading && !error && rows.length === 0 ? (
        <AdminEmptyState
          title={`No ${tab} yet`}
          description='Use "Seed defaults" or create entries above.'
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <AdminDataTable columns={columns} rows={rows} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}

function res403(...responses) {
  return responses.some((r) => r.status === 403);
}
