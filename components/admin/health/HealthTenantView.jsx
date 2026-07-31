'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import HealthSectionNav from './HealthSectionNav';
import HealthEvaluationPanel from './HealthEvaluationPanel';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

export default function HealthTenantView() {
  const { t } = useI18n();
  const params = useParams();
  const tenantId = params?.tenantId ? String(params.tenantId) : '';
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      setError(t('admin-pages.customerHealth.tenantId'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/intelligence/customer-health/${encodeURIComponent(tenantId)}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customerHealth.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customerHealth.loadFailed'));
      setEvaluation(body.evaluation || null);
    } catch (e) {
      setError(e.message || t('admin-pages.customerHealth.loadFailed'));
      setEvaluation(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerHealth.title')}
        description={t('admin-pages.customerHealth.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />
      <HealthSectionNav />
      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}
      {!loading && !error && evaluation ? (
        <HealthEvaluationPanel evaluation={evaluation} />
      ) : null}
    </AdminPageContainer>
  );
}
