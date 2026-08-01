'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import MetricCard from '@/components/admin/intelligence/MetricCard';
import MarketingSectionNav from './MarketingSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

const METRIC_LABELS = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  sessions: 'Sessions',
  spend: 'Marketing spend',
  cpl: 'Cost per lead (CPL)',
  cac: 'Customer acquisition cost (CAC)',
  roas: 'Return on ad spend (ROAS)',
  attributed_leads: 'Attributed leads',
  attributed_revenue: 'Attributed revenue',
};

function toMetricCard(m) {
  if (!m) return null;
  return {
    code: m.code,
    status: m.status || 'UNAVAILABLE',
    value: null,
    label: METRIC_LABELS[m.code] || m.code,
    reasonMessage: m.reason || 'Not available in Wave 1.',
  };
}

export default function MarketingOverviewView() {
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/marketing/overview', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || 'Insufficient privileges for Marketing.');
      }
      if (!res.ok) throw new Error(body.error || 'Failed to load marketing overview.');
      setPack(body);
    } catch (e) {
      setError(e.message || 'Failed to load marketing overview.');
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const metricList = (Array.isArray(pack?.metrics) ? pack.metrics : [])
    .map(toMetricCard)
    .filter(Boolean);
  const campaignCounts = pack?.campaignCounts || {};
  const taxonomyCounts = pack?.taxonomyCounts || {};
  const campaignTotal = Object.values(campaignCounts).reduce(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Marketing"
        description="Campaign governance, taxonomy, and acquisition evidence. Attribution spend and funnels arrive in later waves."
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            Refresh
          </button>
        }
      />

      <MarketingSectionNav />

      {loading ? <AdminLoadingState label="Loading marketing overview…" /> : null}
      {error ? <AdminErrorState title="Unavailable" message={error} onRetry={load} /> : null}

      {!loading && !error && pack ? (
        <div className="space-y-8">
          <div
            className="rounded-[var(--admin-radius)] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
            role="status"
          >
            <p className="font-medium">Wave 1 — foundations only</p>
            <p className="mt-1 text-sky-800">
              Attribution, spend facts, and acquisition funnels are planned for later waves.
              Affiliate commissions and Product Analytics funnels are distinct domains — not shown
              here.
            </p>
          </div>

          <p className="text-xs text-[var(--admin-text-muted)]">
            Catalogue: {pack.catalogueVersion}
            {pack.readiness ? ` · ${pack.readiness}` : ''}
          </p>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              Performance KPIs
            </h2>
            <p className="mb-3 text-sm text-[var(--admin-text-muted)]">
              KPIs show Unavailable until spend and attribution data exist — never fabricated zeros.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricList.map((m) => (
                <MetricCard key={m.code} metric={m} />
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">Campaign counts</h2>
              {!pack.campaignCountsAvailable ? (
                <p className="mt-2 text-sm text-[var(--admin-text-muted)]">Counts unavailable.</p>
              ) : (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[var(--admin-text-muted)]">Total</dt>
                    <dd className="font-semibold tabular-nums">{campaignTotal}</dd>
                  </div>
                  {['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((status) => (
                    <div key={status}>
                      <dt className="text-[var(--admin-text-muted)]">{status}</dt>
                      <dd className="font-semibold tabular-nums">{campaignCounts[status] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">Taxonomy counts</h2>
              {!pack.taxonomyCountsAvailable ? (
                <p className="mt-2 text-sm text-[var(--admin-text-muted)]">Counts unavailable.</p>
              ) : (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[var(--admin-text-muted)]">Channels</dt>
                    <dd className="font-semibold tabular-nums">{taxonomyCounts.channels ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-text-muted)]">Sources</dt>
                    <dd className="font-semibold tabular-nums">{taxonomyCounts.sources ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-text-muted)]">Mediums</dt>
                    <dd className="font-semibold tabular-nums">{taxonomyCounts.mediums ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--admin-text-muted)]">Normalisation rules</dt>
                    <dd className="font-semibold tabular-nums">
                      {taxonomyCounts.normalisationRules ?? 0}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
