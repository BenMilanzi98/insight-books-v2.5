'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/admin/adminApi';
import { MARKETING_CAMPAIGN_TYPES } from '@/lib/admin/marketing';
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

function statusTone(status) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
      return 'neutral';
    case 'PAUSED':
      return 'warning';
    case 'COMPLETED':
      return 'info';
    case 'ARCHIVED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function MarketingCampaignsView() {
  const [items, setItems] = useState([]);
  const [channels, setChannels] = useState([]);
  const [sources, setSources] = useState([]);
  const [mediums, setMediums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    objective: '',
    campaignType: 'LEAD_GENERATION',
    channelId: '',
    sourceId: '',
    mediumId: '',
  });

  const loadTaxonomy = useCallback(async () => {
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
      if (chRes.ok) setChannels(Array.isArray(chBody.items) ? chBody.items : []);
      if (srcRes.ok) setSources(Array.isArray(srcBody.items) ? srcBody.items : []);
      if (medRes.ok) setMediums(Array.isArray(medBody.items) ? medBody.items : []);
    } catch {
      // Taxonomy optional for list view
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/marketing/campaigns', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error(body.error || 'Insufficient privileges.');
      if (!res.ok) throw new Error(body.error || 'Failed to load campaigns.');
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || 'Failed to load campaigns.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadTaxonomy();
  }, [load, loadTaxonomy]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError('');
    try {
      const res = await adminFetch('/api/admin/marketing/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          objective: form.objective || undefined,
          campaignType: form.campaignType,
          channelId: form.channelId || null,
          sourceId: form.sourceId || null,
          mediumId: form.mediumId || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create campaign.');
      setForm({
        name: '',
        objective: '',
        campaignType: 'LEAD_GENERATION',
        channelId: '',
        sourceId: '',
        mediumId: '',
      });
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create campaign.');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      key: 'campaignNumber',
      header: 'Number',
      cell: (row) => (
        <Link
          href={`/insightbooks/marketing/campaigns?highlight=${encodeURIComponent(row.campaignNumber)}`}
          className="font-medium text-[var(--action-primary)] hover:underline"
        >
          {row.campaignNumber}
        </Link>
      ),
    },
    { key: 'name', header: 'Name', cell: (row) => row.name },
    { key: 'type', header: 'Type', cell: (row) => row.campaignType },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge>
      ),
    },
    {
      key: 'taxonomy',
      header: 'Channel / Source / Medium',
      cell: (row) =>
        [row.channel?.code, row.source?.code, row.medium?.code].filter(Boolean).join(' · ') || '—',
    },
  ];

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={tt('Marketing campaigns')}
        description="Governed campaigns with MKT numbering. Distinct from Affiliate referrals and Product Analytics."
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {tt('Refresh')}
          </button>
        }
      />

      <MarketingSectionNav />

      <section className="mb-8 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="mb-4 text-sm font-semibold text-[var(--admin-text)]">{tt('Create campaign')}</h2>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <AdminField label="Name" htmlFor="mkt-campaign-name" required>
            <AdminField.Input
              id="mkt-campaign-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </AdminField>
          <AdminField label="Objective" htmlFor="mkt-campaign-objective">
            <AdminField.Input
              id="mkt-campaign-objective"
              value={form.objective}
              onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
            />
          </AdminField>
          <AdminField label="Type" htmlFor="mkt-campaign-type">
            <AdminField.Select
              id="mkt-campaign-type"
              value={form.campaignType}
              onChange={(e) => setForm((f) => ({ ...f, campaignType: e.target.value }))}
            >
              {MARKETING_CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdminField.Select>
          </AdminField>
          <AdminField label="Channel" htmlFor="mkt-campaign-channel">
            <AdminField.Select
              id="mkt-campaign-channel"
              value={form.channelId}
              onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
            >
              <option value="">— Optional —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </AdminField.Select>
          </AdminField>
          <AdminField label="Source" htmlFor="mkt-campaign-source">
            <AdminField.Select
              id="mkt-campaign-source"
              value={form.sourceId}
              onChange={(e) => setForm((f) => ({ ...f, sourceId: e.target.value }))}
            >
              <option value="">— Optional —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </AdminField.Select>
          </AdminField>
          <AdminField label="Medium" htmlFor="mkt-campaign-medium">
            <AdminField.Select
              id="mkt-campaign-medium"
              value={form.mediumId}
              onChange={(e) => setForm((f) => ({ ...f, mediumId: e.target.value }))}
            >
              <option value="">— Optional —</option>
              {mediums.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </AdminField.Select>
          </AdminField>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={creating}>
              {creating ? tt('Creating…') : tt('Create campaign')}
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
          title={tt('No campaigns yet')}
          description="Create a campaign above or seed taxonomy defaults first."
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <AdminDataTable columns={columns} rows={items} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
