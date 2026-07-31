'use client';

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
const inputCls =
  'h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

export default function CustomerSuccessPlaybooksView() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/customer-success/playbooks?limit=50', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerSuccess.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.playbooks.loadFailed'));
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.playbooks.loadFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function runPlaybook(playbookId) {
    if (!tenantId.trim()) {
      setMessage(t('admin-pages.customerSuccess.playbooks.tenantRequired'));
      return;
    }
    setBusyId(playbookId);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/customer-success/playbooks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'execute',
          playbookId,
          tenantId: tenantId.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerSuccess.playbooks.executeFailed'));
      const count = Array.isArray(body.tasks) ? body.tasks.length : 0;
      setMessage(
        body.created
          ? `${t('admin-pages.customerSuccess.playbooks.executeOk')} (${count})`
          : `${t('admin-pages.customerSuccess.playbooks.executeIdempotent')} (${count})`
      );
    } catch (e) {
      setMessage(e.message || t('admin-pages.customerSuccess.playbooks.executeFailed'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerSuccess.sections.playbooks')}
        description={t('admin-pages.customerSuccess.sectionHints.playbooks')}
        actions={
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
            <span>{t('admin-pages.customerSuccess.playbooks.tenantId')}</span>
            <input
              className={inputCls}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="tenant-…"
              aria-label={t('admin-pages.customerSuccess.playbooks.tenantId')}
            />
          </label>
        }
      />
      <CustomerSuccessSectionNav />
      {message ? (
        <p className="mb-3 text-sm text-[var(--admin-text-muted)]" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <AdminLoadingState /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <AdminEmptyState
          title={t('admin-pages.customerSuccess.playbooks.emptyTitle')}
          description={t('admin-pages.customerSuccess.playbooks.emptyHint')}
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--admin-radius)] border border-[var(--admin-border)]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--admin-surface-muted)] text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.playbooks.colName')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.playbooks.colVersion')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.playbooks.colSteps')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.playbooks.colStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('admin-pages.customerSuccess.playbooks.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pb) => (
                <tr key={pb.id} className="border-t border-[var(--admin-border)]">
                  <td className="px-3 py-2 text-[var(--admin-text)]">
                    <div className="font-medium">{pb.name}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">{pb.key}</div>
                  </td>
                  <td className="px-3 py-2 text-[var(--admin-text)]">{pb.version}</td>
                  <td className="px-3 py-2 text-[var(--admin-text)]">
                    {Array.isArray(pb.steps) ? pb.steps.length : 0}
                  </td>
                  <td className="px-3 py-2">
                    <AdminStatusBadge tone="info">{pb.status}</AdminStatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={Boolean(busyId)}
                      onClick={() => runPlaybook(pb.id)}
                    >
                      {busyId === pb.id
                        ? t('admin-pages.customerSuccess.playbooks.running')
                        : t('admin-pages.customerSuccess.playbooks.execute')}
                    </button>
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
