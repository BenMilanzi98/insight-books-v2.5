'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminField from '@/components/admin/AdminField';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import MarketingSectionNav from './MarketingSectionNav';

const btnPrimary =
  'inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

export default function MarketingLeadSourcesView() {
  const [leadId, setLeadId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState(null);

  const handleFetch = async (e) => {
    e.preventDefault();
    const id = leadId.trim();
    if (!id) return;

    setLoading(true);
    setError('');
    setEvidence(null);
    try {
      const res = await adminFetch(
        `/api/admin/marketing/lead-sources/${encodeURIComponent(id)}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error(body.error || 'Insufficient privileges.');
      if (res.status === 404) throw new Error(body.error || 'Lead not found.');
      if (!res.ok) throw new Error(body.error || 'Failed to load lead source evidence.');
      setEvidence(body);
    } catch (err) {
      setError(err.message || 'Failed to load lead source evidence.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="CRM lead sources"
        description="Read-only evidence from CRM Lead and capture records. CRM Lead Source is the source of truth — not replaced by Marketing taxonomy."
      />

      <MarketingSectionNav />

      <div
        className="mb-6 rounded-[var(--admin-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        role="note"
      >
        <strong>CRM Lead Source (source of truth)</strong>
        <p className="mt-1 text-emerald-800">
          {tt('Marketing taxonomy mapping is separate. This view shows authoritative CRM capture evidence only.')}
        </p>
      </div>

      <form onSubmit={handleFetch} className="mb-8 flex flex-wrap items-end gap-3">
        <AdminField label="Lead ID or number" htmlFor="lead-id" className="min-w-[16rem] flex-1">
          <AdminField.Input
            id="lead-id"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            placeholder={tt('e.g. LEAD-2026-000001 or cuid')}
          />
        </AdminField>
        <button type="submit" className={btnPrimary} disabled={loading || !leadId.trim()}>
          {loading ? 'Loading…' : 'Load evidence'}
        </button>
      </form>

      {loading ? <AdminLoadingState label="Loading CRM evidence…" /> : null}
      {error ? <AdminErrorState message={error} /> : null}

      {evidence?.lead ? (
        <div className="space-y-6">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">{tt('Lead')}</h2>
              <AdminStatusBadge tone="info">CRM Lead Source (source of truth)</AdminStatusBadge>
            </div>
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Number')}</dt>
                <dd className="font-medium">{evidence.lead.leadNumber}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Title')}</dt>
                <dd>{evidence.lead.title}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Source')}</dt>
                <dd>{evidence.lead.source || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Channel')}</dt>
                <dd>{evidence.lead.channel || '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Status')}</dt>
                <dd>{evidence.lead.status}</dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">{tt('Created')}</dt>
                <dd>
                  {evidence.lead.createdAt
                    ? new Date(evidence.lead.createdAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
            </dl>
            {evidence.sourceOfTruth === 'crm' ? (
              <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
                {tt('Marketing taxonomy mapping is separate. This view shows authoritative CRM capture evidence only.')}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              Capture records ({evidence.captureRecords?.length || 0})
            </h2>
            {!evidence.captureRecords?.length ? (
              <p className="text-sm text-[var(--admin-text-muted)]">{tt('No capture records for this lead.')}</p>
            ) : (
              <ul className="space-y-3">
                {evidence.captureRecords.map((cap) => (
                  <li
                    key={cap.id}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm"
                  >
                    <div className="flex flex-wrap gap-4">
                      <span>
                        <span className="text-[var(--admin-text-muted)]">{tt('Source code:')} </span>
                        {cap.sourceCode}
                      </span>
                      <span>
                        <span className="text-[var(--admin-text-muted)]">{tt('Channel:')} </span>
                        {cap.channel}
                      </span>
                      <span>
                        <span className="text-[var(--admin-text-muted)]">{tt('Consent:')} </span>
                        {cap.consentStatus}
                      </span>
                      <span>
                        <span className="text-[var(--admin-text-muted)]">{tt('At:')} </span>
                        {cap.createdAt ? new Date(cap.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
