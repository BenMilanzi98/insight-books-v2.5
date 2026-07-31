'use client';

import { adminFetch } from '@/lib/admin/adminApi';
import { useI18n } from '@/components/i18n/I18nProvider';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminSummaryCard,
  AdminStatusBadge,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';

/**
 * Phase 18 — System Administrator EIS Administration Centre.
 */
export default function SystemMraEisAdminCentrePage() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/mra-eis/centre?environment=PRODUCTION',
        { credentials: 'include' }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error?.message || json.error || 'Failed to load platform overview'
        );
      }
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overview = data?.overview;
  const ctx = data?.context;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href="/insightbooks/mra-eis" className="underline">
              Platform MRA EIS
            </Link>
            {' / '}
            Administration Centre
          </>
        }
        title={t('admin-pages.mraEis.centre.title')}
        description={t('admin-pages.mraEis.centre.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      {ctx ? (
        <section
          aria-label="Platform EIS context"
          className="mb-6 flex flex-wrap items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm"
        >
          <AdminStatusBadge tone="danger">{ctx.environmentLabel}</AdminStatusBadge>
          <span className="text-[var(--admin-text-muted)]">
            Freshness <strong className="text-[var(--admin-text)]">{ctx.dataFreshness}</strong>
          </span>
        </section>
      ) : null}

      {loading ? <AdminLoadingState label="Loading platform overview" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Overview unavailable" message={error} onRetry={load} />
      ) : null}

      {!loading && !error ? (
        <>
          {overview ? (
            <section aria-labelledby="plat-overview">
              <h2
                id="plat-overview"
                className="text-base font-semibold text-[var(--admin-text)]"
              >
                Platform overview
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                Freshness {overview.freshness}. Cross-tenant drill-down requires permission.
              </p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(overview.cards || []).map((c) => (
                  <li key={c.key}>
                    <AdminSummaryCard
                      label={c.label}
                      value={c.value}
                      error={Boolean(c.error)}
                      tone={c.error ? 'danger' : 'neutral'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </AdminPageContainer>
  );
}
