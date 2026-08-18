'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminSummaryCard,
  AdminDataTable,
  AdminStatusBadge,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

export default function AnalyticsPipelinePage() {
  const { t } = useI18n();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/analytics-pipeline/health', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load health');
      setHealth(body);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (path, label) => {
    setBusy(label);
    setMessage('');
    setError('');
    try {
      const res = await adminFetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: path.includes('backfill') ? false : undefined, limit: 50 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${label} failed`);
      setMessage(`${label} completed`);
      await load();
    } catch (e) {
      setError(e.message || `${label} failed`);
    } finally {
      setBusy('');
    }
  };

  const h = health?.health;

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.analyticsPipeline.title')}
        description={t('admin-pages.analyticsPipeline.description')}
        actions={
          <button type="button" className={btnGhost} onClick={load} disabled={loading || Boolean(busy)}>
            {tt('Refresh')}
          </button>
        }
      />

      {loading ? <AdminLoadingState label="Loading pipeline health" /> : null}
      {!loading && error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && health && !health.available ? (
        <AdminErrorState
          message={health.error || 'Analytics plane unavailable. Run prisma db push.'}
          onRetry={load}
        />
      ) : null}

      {!loading && h ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <AdminSummaryCard label="Outbox pending" value={h.outbox?.pending ?? 0} tone="warning" />
            <AdminSummaryCard label="Outbox claimed" value={h.outbox?.claimed ?? 0} />
            <AdminSummaryCard
              label="Dead letters"
              value={h.outbox?.dead ?? 0}
              tone={(h.outbox?.dead || 0) > 0 ? tt('danger') : tt('success')}
            />
            <AdminSummaryCard label="Events" value={h.eventCount ?? 0} />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={Boolean(busy)}
              onClick={() => runAction('/api/admin/analytics-pipeline/dispatch', 'Dispatch')}
            >
              {busy === 'Dispatch' ? tt('Dispatching…') : tt('Dispatch outbox')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={Boolean(busy)}
              onClick={() => runAction('/api/admin/analytics-pipeline/consume', 'Consume')}
            >
              {busy === 'Consume' ? tt('Consuming…') : tt('Consume → facts')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={Boolean(busy)}
              onClick={() => runAction('/api/admin/analytics-pipeline/reconcile', 'Reconcile')}
            >
              {busy === 'Reconcile' ? tt('Reconciling…') : tt('Reconcile payments')}
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={Boolean(busy)}
              onClick={() => {
                if (
                  window.confirm(
                    'Enqueue missing PLATFORM_PAYMENT_SUCCEEDED outbox rows from real payments?'
                  )
                ) {
                  runAction('/api/admin/analytics-pipeline/backfill', 'Backfill');
                }
              }}
            >
              {busy === 'Backfill' ? tt('Backfilling…') : tt('Backfill payments')}
            </button>
          </div>

          {message ? (
            <p className="mb-4 text-sm text-[var(--admin-text)]" role="status">
              {message}
            </p>
          ) : null}

          <h2 className="mb-2 text-sm font-semibold text-[var(--admin-text)]">
            {tt('Recent reconciliation')}
          </h2>
          <AdminDataTable
            columns={[
              {
                key: 'check',
                header: 'Check',
                render: (r) => r.checkKey,
              },
              {
                key: 'expected',
                header: 'Expected',
                cellClassName: 'tabular-nums',
                render: (r) => r.expected,
              },
              {
                key: 'actual',
                header: 'Actual',
                cellClassName: 'tabular-nums',
                render: (r) => r.actual,
              },
              {
                key: 'variance',
                header: 'Variance',
                cellClassName: 'tabular-nums',
                render: (r) => r.variance,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <AdminStatusBadge tone={r.status === 'MATCH' ? tt('success') : tt('danger')}>
                    {r.status}
                  </AdminStatusBadge>
                ),
              },
            ]}
            rows={h.lastReconciliation || []}
            rowKey={(r) => r.id}
          />
        </>
      ) : null}
    </AdminPageContainer>
  );
}
