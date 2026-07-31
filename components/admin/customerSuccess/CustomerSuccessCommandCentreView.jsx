'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import {
  CS_SECTIONS,
  CS_PERMISSIONS,
} from '@/lib/admin/customerSuccessNav';
import { adminHasPermission } from '@/lib/admin/permissions';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSuccessSectionNav from './CustomerSuccessSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const selectCls =
  'h-10 min-w-[14rem] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]';

function readinessTone(readiness) {
  if (readiness === 'live') return 'success';
  if (readiness === 'stub') return 'info';
  return 'danger';
}

export default function CustomerSuccessCommandCentreView() {
  const { t } = useI18n();
  const [admin, setAdmin] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [portfolioId, setPortfolioId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, portRes] = await Promise.all([
        fetch('/api/admin/auth/me', { credentials: 'include' }),
        adminFetch('/api/admin/intelligence/customers/portfolios', {
          credentials: 'include',
        }),
      ]);

      if (meRes.ok) {
        const meBody = await meRes.json().catch(() => ({}));
        setAdmin(meBody.admin || null);
      }

      const portBody = await portRes.json().catch(() => ({}));
      if (portRes.status === 403) {
        // Portfolios may require customers.read; shell still loads with empty filter.
        setPortfolios([]);
      } else if (!portRes.ok) {
        throw new Error(portBody.error || t('admin-pages.customerSuccess.portfolioLoadFailed'));
      } else {
        const list = Array.isArray(portBody.portfolios) ? portBody.portfolios : [];
        setPortfolios(list);
      }
    } catch (e) {
      setError(e.message || t('admin-pages.customerSuccess.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const canReadCs = admin
    ? adminHasPermission(admin, CS_PERMISSIONS.read) || admin.role === 'Super Admin'
    : false;

  const sectionCards = useMemo(() => {
    return CS_SECTIONS.filter((s) => s.id !== 'command-centre').map((section) => {
      const allowed = admin
        ? adminHasPermission(admin, section.permission) || admin.role === 'Super Admin'
        : false;
      return { section, allowed };
    });
  }, [admin]);

  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId) || null;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customerSuccess.title')}
        description={t('admin-pages.customerSuccess.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />

      <CustomerSuccessSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error && admin && !canReadCs ? (
        <AdminErrorState
          title={t('admin-pages.common.unavailable')}
          message={t('admin-pages.customerSuccess.forbidden')}
        />
      ) : null}

      {!loading && !error && canReadCs ? (
        <div className="space-y-8">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--admin-text)]">
                {t('admin-pages.customerSuccess.portfolioFilter')}
              </span>
              <select
                className={selectCls}
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                aria-label={t('admin-pages.customerSuccess.portfolioFilter')}
              >
                <option value="">{t('admin-pages.customerSuccess.portfolioAll')}</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.code || p.id}
                  </option>
                ))}
              </select>
            </label>
            {portfolios.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.customerSuccess.noPortfolios')}
              </p>
            ) : null}
            {selectedPortfolio ? (
              <p className="mt-2 text-xs text-[var(--admin-text-muted)]">
                {selectedPortfolio.code ? `${selectedPortfolio.code} · ` : ''}
                {selectedPortfolio.id}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customerSuccess.sectionCards')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sectionCards.map(({ section, allowed }) => {
                const label = section.labelKey ? t(section.labelKey) : section.label;
                const hint = section.hintKey ? t(section.hintKey) : '';
                const readinessLabel = t(
                  `admin-pages.customerSuccess.readiness.${section.readiness}`
                );

                if (!allowed) {
                  return (
                    <article
                      key={section.id}
                      className="rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4 opacity-80"
                      aria-disabled="true"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[var(--admin-text)]">{label}</h3>
                        <AdminStatusBadge tone="danger">
                          {t('admin-pages.customerSuccess.gated')}
                        </AdminStatusBadge>
                      </div>
                      <p className="text-sm text-[var(--admin-text-muted)]">{hint}</p>
                      <p className="mt-2 text-[10px] text-[var(--admin-text-muted)]">
                        {section.permission}
                      </p>
                    </article>
                  );
                }

                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:bg-[var(--admin-surface-muted)]"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--admin-text)]">{label}</h3>
                      <AdminStatusBadge tone={readinessTone(section.readiness)}>
                        {readinessLabel}
                      </AdminStatusBadge>
                    </div>
                    <p className="text-sm text-[var(--admin-text-muted)]">{hint}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
