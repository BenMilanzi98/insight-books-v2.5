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
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import ProductAnalyticsSectionNav from './ProductAnalyticsSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full min-w-[12rem] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

const SECTION_KEYS = {
  funnels: 'funnels',
  cohorts: 'cohorts',
  signals: 'signals',
  reconciliation: 'reconciliation',
  reports: 'reports',
};

/**
 * Wave 4 foundations: funnels / cohorts / signals / recon / export reports.
 * @param {{ kind: 'funnels'|'cohorts'|'signals'|'reconciliation'|'reports' }} props
 */
export default function ProductAnalyticsWave4View({ kind }) {
  const { t } = useI18n();
  const sectionKey = SECTION_KEYS[kind] || kind;
  const [tenantId, setTenantId] = useState('');
  const [funnelCode, setFunnelCode] = useState('commerce.invoice.value');
  const [featureCode, setFeatureCode] = useState('invoices.post');
  const [dataset, setDataset] = useState('overview');
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const endpointFor = useCallback(() => {
    if (kind === 'funnels') {
      const qs = new URLSearchParams();
      if (tenantId.trim()) qs.set('tenantId', tenantId.trim());
      if (funnelCode.trim()) qs.set('funnelCode', funnelCode.trim());
      const q = qs.toString();
      return `/api/admin/intelligence/product-analytics/funnels${q ? `?${q}` : ''}`;
    }
    if (kind === 'cohorts') {
      const qs = new URLSearchParams();
      if (featureCode.trim()) qs.set('featureCode', featureCode.trim());
      const q = qs.toString();
      return `/api/admin/intelligence/product-analytics/cohorts${q ? `?${q}` : ''}`;
    }
    if (kind === 'signals') {
      const qs = new URLSearchParams();
      if (tenantId.trim()) qs.set('tenantId', tenantId.trim());
      if (featureCode.trim()) qs.set('featureCode', featureCode.trim());
      const q = qs.toString();
      return `/api/admin/intelligence/product-analytics/signals${q ? `?${q}` : ''}`;
    }
    if (kind === 'reconciliation') {
      const qs = new URLSearchParams();
      if (tenantId.trim()) qs.set('tenantId', tenantId.trim());
      const q = qs.toString();
      return `/api/admin/intelligence/product-analytics/reconcile${q ? `?${q}` : ''}`;
    }
    const qs = new URLSearchParams({ dataset, format: 'json' });
    if (tenantId.trim()) qs.set('tenantId', tenantId.trim());
    return `/api/admin/intelligence/product-analytics/export?${qs}`;
  }, [kind, tenantId, funnelCode, featureCode, dataset]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(endpointFor(), { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.productAnalytics.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.productAnalytics.loadFailed'));
      }
      setPack(body);
    } catch (e) {
      setError(e.message || t('admin-pages.productAnalytics.loadFailed'));
      setPack(null);
    } finally {
      setLoading(false);
    }
  }, [endpointFor, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runInspect = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    await load();
    setBusy(false);
  };

  const statusBadge =
    pack?.overallStatus ||
    pack?.evaluation?.status ||
    pack?.status ||
    (pack?.definitions ? 'AVAILABLE' : null);

  const associationNote =
    pack?.associationLabel ||
    (Array.isArray(pack?.limitations)
      ? pack.limitations.find((l) => /association/i.test(String(l)))
      : null);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(`admin-pages.productAnalytics.sections.${sectionKey}`)}
        description={t(`admin-pages.productAnalytics.sectionHints.${sectionKey}`)}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading || busy}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <ProductAnalyticsSectionNav />

      {(kind === 'funnels' ||
        kind === 'signals' ||
        kind === 'reconciliation' ||
        kind === 'reports' ||
        kind === 'cohorts') && (
        <form
          onSubmit={runInspect}
          className="mb-6 grid gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          {(kind === 'funnels' || kind === 'signals' || kind === 'reconciliation' || kind === 'reports') && (
            <label className="text-sm text-[var(--admin-text-muted)]">
              <span className="mb-1 block">{t('admin-pages.productAnalytics.tenantId')}</span>
              <input
                className={inputCls}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder={tt('tenant_…')}
              />
            </label>
          )}
          {kind === 'funnels' && (
            <label className="text-sm text-[var(--admin-text-muted)]">
              <span className="mb-1 block">{t('admin-pages.productAnalytics.funnelCode')}</span>
              <input
                className={inputCls}
                value={funnelCode}
                onChange={(e) => setFunnelCode(e.target.value)}
                placeholder={tt('commerce.invoice.value')}
              />
            </label>
          )}
          {(kind === 'cohorts' || kind === 'signals') && (
            <label className="text-sm text-[var(--admin-text-muted)]">
              <span className="mb-1 block">{t('admin-pages.productAnalytics.featureCode')}</span>
              <input
                className={inputCls}
                value={featureCode}
                onChange={(e) => setFeatureCode(e.target.value)}
                placeholder={tt('invoices.post')}
              />
            </label>
          )}
          {kind === 'reports' && (
            <label className="text-sm text-[var(--admin-text-muted)]">
              <span className="mb-1 block">{t('admin-pages.productAnalytics.exportDataset')}</span>
              <select
                className={inputCls}
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
              >
                <option value="overview">{tt('overview')}</option>
                <option value="funnels">{tt('funnels')}</option>
                <option value="signals">{tt('signals')}</option>
                <option value="reconciliation">{tt('reconciliation')}</option>
              </select>
            </label>
          )}
          <div className="flex items-end gap-2">
            <button type="submit" className={btnPrimary} disabled={busy || loading}>
              {t('admin-pages.productAnalytics.inspectAction')}
            </button>
          </div>
        </form>
      )}

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && pack ? (
        <div className="space-y-4">
          {statusBadge ? (
            <AdminStatusBadge
              tone={
                statusBadge === 'FAIL' || statusBadge === 'RECONCILIATION_FAILED'
                  ? 'danger'
                  : statusBadge === 'AVAILABLE' || statusBadge === 'READY'
                    ? 'success'
                    : 'warning'
              }
            >
              {statusBadge}
            </AdminStatusBadge>
          ) : null}

          {associationNote ? (
            <p className="text-xs text-[var(--admin-text-muted)]">{associationNote}</p>
          ) : null}

          {kind === 'funnels' && (
            <>
              <p className="text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.productAnalytics.definitionVersion')}:{' '}
                {pack.definitionVersion || '—'}
              </p>
              <ul className="space-y-2 text-sm">
                {(pack.definitions || []).map((d) => (
                  <li
                    key={d.code}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2"
                  >
                    <div className="font-medium text-[var(--admin-text)]">{d.name}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">
                      {d.code} · {d.featureCode} ·{' '}
                      {d.instrumented ? 'INSTRUMENTED' : 'NOT_INSTRUMENTED'}
                    </div>
                  </li>
                ))}
              </ul>
              {pack.evaluation ? (
                <pre className="overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs">
                  {JSON.stringify(pack.evaluation, null, 2)}
                </pre>
              ) : null}
            </>
          )}

          {kind === 'cohorts' && (
            <>
              {(pack.rows || []).length === 0 ? (
                <AdminEmptyState
                  title={t('admin-pages.productAnalytics.emptyCohorts')}
                  description={t('admin-pages.productAnalytics.emptyCohortsHint')}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[var(--admin-text-muted)]">
                        <th className="py-2 pr-3">{tt('feature')}</th>
                        <th className="py-2 pr-3">{tt('period')}</th>
                        <th className="py-2 pr-3">{tt('tenants')}</th>
                        <th className="py-2 pr-3">{tt('anchors')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pack.rows.map((r) => (
                        <tr key={`${r.featureCode}-${r.period}`} className="border-t border-[var(--admin-border)]">
                          <td className="py-2 pr-3">{r.featureCode}</td>
                          <td className="py-2 pr-3">{r.period}</td>
                          <td className="py-2 pr-3">{r.tenantCount}</td>
                          <td className="py-2 pr-3">{r.anchorCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {kind === 'signals' && (
            <>
              <ul className="mb-4 space-y-1 text-xs text-[var(--admin-text-muted)]">
                {(pack.catalogue || []).map((c) => (
                  <li key={c.code}>
                    {c.code} — {c.title} ({c.severity})
                  </li>
                ))}
              </ul>
              {pack.evaluation?.signals?.length ? (
                <pre className="overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs">
                  {JSON.stringify(pack.evaluation.signals, null, 2)}
                </pre>
              ) : (
                <AdminEmptyState
                  title={t('admin-pages.productAnalytics.emptySignals')}
                  description={t('admin-pages.productAnalytics.emptySignalsHint')}
                />
              )}
            </>
          )}

          {kind === 'reconciliation' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(pack.cards || []).map((card) => (
                <div
                  key={card.id}
                  className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--admin-text)]">
                      {card.label}
                    </span>
                    <AdminStatusBadge
                      tone={
                        card.status === 'READY'
                          ? 'success'
                          : card.status === 'FAIL'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {card.status}
                    </AdminStatusBadge>
                  </div>
                  <div className="text-lg text-[var(--admin-text)]">
                    {card.value == null ? t('admin-pages.productAnalytics.naLabel') : card.value}
                  </div>
                  {card.detail ? (
                    <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{card.detail}</p>
                  ) : null}
                </div>
              ))}
              {pack.blockedByRecon ? (
                <p className="text-sm text-[var(--admin-danger)] sm:col-span-2">
                  {t('admin-pages.productAnalytics.reconBlocked')}
                </p>
              ) : null}
            </div>
          )}

          {kind === 'reports' && (
            <pre className="overflow-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-xs">
              {JSON.stringify(
                {
                  dataset: pack.dataset,
                  exportVersion: pack.exportVersion,
                  portfolioMode: pack.portfolioMode,
                  rowCount: (pack.rows || []).length,
                  limitations: pack.limitations,
                },
                null,
                2
              )}
            </pre>
          )}

          {Array.isArray(pack.limitations) && pack.limitations.length ? (
            <ul className="list-disc pl-5 text-xs text-[var(--admin-text-muted)]">
              {pack.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
