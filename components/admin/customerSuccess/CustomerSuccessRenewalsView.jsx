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
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

export default function CustomerSuccessRenewalsView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [periodKey, setPeriodKey] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/renewals?limit=50', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerSuccess.renewals.loadFailed'));
      }
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.renewals.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openWorkspace = async () => {
    if (!tenantId.trim()) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/renewals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          tenantId: tenantId.trim(),
          periodKey: periodKey.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || t('admin-pages.customerSuccess.renewals.openFailed'));
      }
      setNotice(t('admin-pages.customerSuccess.renewals.openOk'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setOutcome = async (workspaceId, outcome) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/renewals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outcome', workspaceId, outcome }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.error ||
            body.reason ||
            t('admin-pages.customerSuccess.renewals.outcomeFailed')
        );
      }
      setNotice(t('admin-pages.customerSuccess.renewals.outcomeOk'));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerSuccess.sections.renewals')}
        description={t('admin-pages.customerSuccess.sectionHints.renewals')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <CustomerSuccessSectionNav />
      <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
        {t('admin-pages.customerSuccess.renewals.evidenceHint')}
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm text-[var(--admin-text-muted)]">
          <span className="mb-1 block">{t('admin-pages.customerSuccess.cases.colTenant')}</span>
          <input
            className={inputCls}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder={tt('tenantId')}
          />
        </label>
        <label className="text-sm text-[var(--admin-text-muted)]">
          <span className="mb-1 block">{t('admin-pages.customerSuccess.renewals.period')}</span>
          <input
            className={inputCls}
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            placeholder={tt('YYYY-MM')}
          />
        </label>
        <button type="button" className={btnPrimary} disabled={busy} onClick={openWorkspace}>
          {t('admin-pages.customerSuccess.renewals.open')}
        </button>
      </div>

      {notice ? (
        <p className="mt-3 text-sm text-[var(--admin-accent)]" role="status">
          {notice}
        </p>
      ) : null}
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.renewals.emptyTitle')}
          description={t('admin-pages.customerSuccess.renewals.emptyHint')}
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.colTenant')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.renewals.period')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.cases.status')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.renewals.outcome')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.renewals.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2 font-mono text-xs">{row.tenantId}</td>
                  <td className="px-3 py-2">{row.periodKey}</td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone="info" label={row.status} />
                  </td>
                  <td className="px-3 py-2">{row.outcome || '—'}</td>
                  <td className="px-3 py-2">
                    {!row.outcome ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={btnGhost}
                          disabled={busy}
                          onClick={() => setOutcome(row.id, 'RENEWED')}
                        >
                          RENEWED
                        </button>
                        <button
                          type="button"
                          className={btnGhost}
                          disabled={busy}
                          onClick={() => setOutcome(row.id, 'CHURNED')}
                        >
                          CHURNED
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
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
