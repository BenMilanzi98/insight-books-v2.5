'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import MetricCard from '@/components/admin/intelligence/MetricCard';
import RevenueSectionNav from './RevenueSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

const CURRENCIES = ['MWK', 'USD', 'ZAR', 'EUR'];

const OVERVIEW_GROUPS = [
  {
    titleKey: 'admin-pages.revenue.areas.recurring',
    codes: [
      'revenue.mrr.estimated_total',
      'revenue.mrr.estimated_core',
      'revenue.mrr.estimated_mra_eis',
      'revenue.arr.estimated',
      'revenue.arpa',
      'revenue.mrr.cross_currency_total',
    ],
  },
  {
    titleKey: 'admin-pages.revenue.areas.movements',
    codes: [
      'revenue.mrr.bridge.opening',
      'revenue.mrr.bridge.closing',
      'revenue.mrr.bridge.new',
      'revenue.mrr.bridge.expansion',
      'revenue.mrr.bridge.contraction',
      'revenue.mrr.bridge.churned',
      'revenue.mrr.bridge.reactivation',
      'revenue.mrr.bridge.net_new',
    ],
  },
  {
    titleKey: 'admin-pages.revenue.areas.commercial',
    codes: [
      'revenue.payments.collected_period',
      'revenue.tenants.active_paid',
      'revenue.subscriptions.active',
    ],
  },
];

/**
 * Shared Revenue Intelligence view (Phase 6 Wave 2–4).
 * Fetches overview / recurring / reconciliation / section packs; never coerces null to 0.
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   endpoint?: 'overview'|'recurring'|'reconciliation',
 *   apiPath?: string|null,
 *   metricCodes?: string[]|null,
 *   stub?: boolean,
 *   stubNote?: string|null,
 *   showGroups?: boolean,
 *   showExport?: boolean,
 * }} props
 */
export default function RevenueKpiView({
  title,
  description,
  endpoint = 'overview',
  apiPath = null,
  metricCodes = null,
  stub = false,
  stubNote = null,
  showGroups = false,
  showExport = false,
}) {
  const { t } = useI18n();
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(!stub);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState('MWK');

  const load = useCallback(async () => {
    if (stub) {
      setLoading(false);
      setPack(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        days: String(days),
        currency,
      });
      let path;
      if (apiPath) {
        const base = apiPath.includes('?') ? apiPath.split('?')[0] : apiPath;
        path = `${base}?${qs}`;
      } else if (endpoint === 'recurring') {
        path = `/api/admin/intelligence/revenue/recurring?${qs}`;
      } else if (endpoint === 'reconciliation') {
        path = `/api/admin/intelligence/revenue/reconciliation?${qs}`;
      } else {
        path = `/api/admin/intelligence/revenue/overview?${qs}`;
      }
      const res = await adminFetch(path, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.revenue.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.revenue.loadFailed'));
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.revenue.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [stub, days, currency, endpoint, apiPath, t]);

  useEffect(() => {
    load();
  }, [load]);

  const exportPack = async (format) => {
    try {
      const qs = new URLSearchParams({
        format,
        days: String(days),
        currency,
      });
      const res = await adminFetch(`/api/admin/intelligence/revenue/export?${qs}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || t('admin-pages.revenue.exportFailed'));
      }
      if (format === 'csv') {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'revenue-kpis.csv';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const body = await res.json();
      const blob = new Blob([JSON.stringify(body, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'revenue-kpis.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || t('admin-pages.revenue.exportFailed'));
    }
  };

  const metrics = pack?.metrics || {};
  let metricList = Object.values(metrics).filter(
    (m) => m && (typeof m.value !== 'object' || m.value === null)
  );
  if (metricCodes?.length) {
    metricList = metricCodes.map((code) => metrics[code]).filter(Boolean);
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={title}
        description={description}
        actions={
          stub ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
                <span className="sr-only">{t('admin-pages.revenue.currency')}</span>
                <select
                  className="h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  aria-label={t('admin-pages.revenue.currency')}
                >
                  {CURRENCIES.map((ccy) => (
                    <option key={ccy} value={ccy}>
                      {ccy}
                    </option>
                  ))}
                </select>
              </label>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={days === d ? btnPrimary : btnGhost}
                  onClick={() => setDays(d)}
                >
                  {d}d
                </button>
              ))}
              {showExport ? (
                <>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => exportPack('json')}
                    disabled={loading}
                  >
                    {t('admin-pages.revenue.exportJson')}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => exportPack('csv')}
                    disabled={loading}
                  >
                    {t('admin-pages.revenue.exportCsv')}
                  </button>
                </>
              ) : null}
              <button type="button" className={btnGhost} onClick={load} disabled={loading}>
                {t('admin-pages.common.refresh')}
              </button>
            </div>
          )
        }
      />

      <RevenueSectionNav />

      {stub ? (
        <AdminEmptyState
          title={t('admin-pages.revenue.stubTitle')}
          description={
            stubNote || t('admin-pages.revenue.stubHint')
          }
        />
      ) : null}

      {!stub && loading ? (
        <AdminLoadingState label={t('admin-pages.common.loading')} />
      ) : null}
      {!stub && error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!stub && !loading && !error && pack ? (
        <>
          {pack.catalogueVersion ? (
            <p className="mb-4 text-xs text-[var(--admin-text-muted)]">
              {t('admin-pages.revenue.catalogue')}: {pack.catalogueVersion}
              {pack.generatedAt
                ? ` · ${t('admin-pages.revenue.generated')} ${new Date(pack.generatedAt).toLocaleString()}`
                : ''}
              {currency ? ` · ${currency}` : ''}
            </p>
          ) : null}

          {endpoint === 'reconciliation' ? (
            <section className="mb-6 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <h2 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.revenue.reconStatusTitle')}
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.revenue.reconStatusHint')}
              </p>
              {pack.reconciliation?.notes?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--admin-text-muted)]">
                  {pack.reconciliation.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
              {pack.snapshotKeys || pack.reconciliation?.metricKeys ? (
                <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                  {t('admin-pages.revenue.snapshotKeys')}:{' '}
                  {Array.isArray(pack.snapshotKeys)
                    ? pack.snapshotKeys.join(', ')
                    : pack.reconciliation?.metricKeys
                      ? JSON.stringify(pack.reconciliation.metricKeys)
                      : JSON.stringify(pack.snapshotKeys)}
                </p>
              ) : null}
              {pack.attention?.length ? (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                    {t('admin-pages.revenue.reconAttention')}
                  </h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {pack.attention.map((item) => (
                      <li key={`${item.code}-${item.title}`}>
                        <a
                          href={item.href || '/insightbooks/intelligence/revenue/overview'}
                          className="text-[var(--admin-accent)] hover:underline"
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <pre className="mt-3 max-h-48 overflow-auto rounded border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-text)]">
                {JSON.stringify(
                  {
                    success: pack.success,
                    catalogueVersion: pack.catalogueVersion,
                    snapshotKeys: pack.snapshotKeys,
                    reconciliation: pack.reconciliation,
                    reconstruct: pack.reconstruct,
                    attention: pack.attention,
                  },
                  null,
                  2
                )}
              </pre>
            </section>
          ) : null}

          {pack.label === 'deterministic renewal exposure' || pack.multipliers ? (
            <p className="mb-4 text-sm text-[var(--admin-text-muted)]">
              {t('admin-pages.revenue.forecastDisclaimer')}
            </p>
          ) : null}

          {pack.topContributors?.length ? (
            <section className="mb-6 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">
                      {t('admin-pages.revenue.contributor')}
                    </th>
                    <th className="px-3 py-2 font-medium">MRR</th>
                    <th className="px-3 py-2 font-medium">{tt('Share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.topContributors.map((row) => (
                    <tr key={row.tenantId} className="border-t border-[var(--admin-border)]">
                      <td className="px-3 py-2 text-[var(--admin-text)]">{row.rank}</td>
                      <td className="px-3 py-2 text-[var(--admin-text)]">
                        {row.label || row.tenantId}
                        {row.masked ? (
                          <span className="ml-2 text-xs text-[var(--admin-text-muted)]">
                            ({t('admin-pages.revenue.masked')})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-[var(--admin-text)]">{row.mrr}</td>
                      <td className="px-3 py-2 text-[var(--admin-text)]">
                        {row.share != null ? `${Math.round(row.share * 1000) / 10}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {showGroups && !metricCodes ? (
            OVERVIEW_GROUPS.map((group) => {
              const cards = group.codes.map((code) => metrics[code]).filter(Boolean);
              if (!cards.length) return null;
              return (
                <section key={group.titleKey} className="mb-8">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
                    {t(group.titleKey)}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map((m) => (
                      <MetricCard key={m.code} metric={m} />
                    ))}
                  </div>
                </section>
              );
            })
          ) : metricList.length === 0 ? (
            <AdminEmptyState
              title={t('admin-pages.revenue.emptySection')}
              description={t('admin-pages.revenue.emptySectionHint')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricList.map((m) => (
                <MetricCard key={m.code} metric={m} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
