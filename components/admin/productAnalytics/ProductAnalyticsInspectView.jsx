'use client';
import { tt } from '@/lib/i18n/runtime';

import { useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import ProductAnalyticsSectionNav from './ProductAnalyticsSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full min-w-[12rem] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

/**
 * Tenant + feature inspect for adoption / activation / first-value (read-only evaluate).
 * @param {{ kind: 'adoption' | 'activation' | 'first-value' }} props
 */
export default function ProductAnalyticsInspectView({ kind }) {
  const { t } = useI18n();
  const [tenantId, setTenantId] = useState('');
  const [featureCode, setFeatureCode] = useState('invoices.post');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const sectionKey =
    kind === 'activation' ? 'activation' : kind === 'first-value' ? 'firstValue' : 'adoption';

  const inspect = async (e) => {
    e?.preventDefault?.();
    const tid = tenantId.trim();
    const fc = featureCode.trim();
    if (!tid || !fc) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      let res;
      if (kind === 'adoption') {
        const qs = new URLSearchParams({ tenantId: tid, featureCode: fc });
        res = await adminFetch(
          `/api/admin/intelligence/product-analytics/adoption?${qs}`,
          { credentials: 'include' }
        );
      } else if (kind === 'first-value') {
        const qs = new URLSearchParams({ tenantId: tid, featureCode: fc });
        res = await adminFetch(
          `/api/admin/intelligence/product-analytics/first-value?${qs}`,
          { credentials: 'include' }
        );
      } else {
        res = await adminFetch('/api/admin/intelligence/product-analytics/evaluate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tid,
            featureCode: fc,
            action: 'activation',
            persist: false,
          }),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.productAnalytics.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.productAnalytics.loadFailed'));
      }
      setResult(body.result || body.fact || body);
    } catch (err) {
      setError(err.message || t('admin-pages.productAnalytics.loadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const status =
    result?.status ||
    result?.state ||
    result?.adoptionState ||
    result?.activationStatus ||
    (kind === 'first-value' && result?.id
      ? 'AVAILABLE'
      : kind === 'first-value' && result && !result.id
        ? 'UNAVAILABLE'
        : null);
  const honestBlocked =
    status === 'NOT_INSTRUMENTED' ||
    status === 'UNAVAILABLE' ||
    status === 'UNKNOWN' ||
    result?.reasonCode === 'not_instrumented';

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t(`admin-pages.productAnalytics.sections.${sectionKey}`)}
        description={t(`admin-pages.productAnalytics.sectionHints.${sectionKey}`)}
      />
      <ProductAnalyticsSectionNav />

      <form
        onSubmit={inspect}
        className="mb-6 grid gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="text-sm text-[var(--admin-text-muted)]">
          <span className="mb-1 block">{t('admin-pages.productAnalytics.tenantId')}</span>
          <input
            className={inputCls}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder={tt('tenant_…')}
            required
          />
        </label>
        <label className="text-sm text-[var(--admin-text-muted)]">
          <span className="mb-1 block">{t('admin-pages.productAnalytics.featureCode')}</span>
          <input
            className={inputCls}
            value={featureCode}
            onChange={(e) => setFeatureCode(e.target.value)}
            placeholder={tt('invoices.post')}
            required
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={btnPrimary} disabled={busy}>
            {t('admin-pages.productAnalytics.inspectAction')}
          </button>
          <button
            type="button"
            className={btnGhost}
            disabled={busy}
            onClick={() => {
              setResult(null);
              setError('');
            }}
          >
            {t('admin-pages.common.cancel')}
          </button>
        </div>
      </form>

      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {result ? (
        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {status ? (
              <AdminStatusBadge tone={honestBlocked ? 'danger' : 'info'}>{status}</AdminStatusBadge>
            ) : null}
            {honestBlocked ? (
              <span className="text-sm text-[var(--admin-danger)]">
                {t('admin-pages.productAnalytics.honestUnavailable')}
              </span>
            ) : null}
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-[var(--admin-text-muted)]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      ) : null}
    </AdminPageContainer>
  );
}
