'use client';

import { adminFetch } from '@/lib/admin/adminApi';
import { useI18n } from '@/components/i18n/I18nProvider';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminLoadingState,
  AdminErrorState,
  AdminStatusBadge,
  AdminEmptyState,
} from '@/components/admin';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';
const btnDanger =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--status-danger)] px-3 text-sm font-medium text-white disabled:opacity-50';
const btnWarn =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-amber-700 px-3 text-sm font-medium text-white disabled:opacity-50';
const sectionCls =
  'mb-6 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5';
const inputCls =
  'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-text)]';

function statusTone(status) {
  if (status === 'ENTITLED_PRODUCTION' || status === 'ENTITLED_SANDBOX_ONLY') return 'success';
  if (status === 'SUSPENDED' || status === 'REVOKED') return 'danger';
  return 'neutral';
}

export default function AdminMraEisTenantDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const tenantId = params.tenantId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(`/api/admin/mra-eis/entitlements/${tenantId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action) {
    setError('');
    setMessage('');
    if (!reason.trim() && action !== 'upgrade') {
      setError('Reason is required.');
      return;
    }
    const res = await adminFetch(`/api/admin/mra-eis/entitlements/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({
        action,
        reason: reason.trim() || 'Upgrade to production entitlement',
        expectedVersion: data?.entitlement?.version,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || 'Action failed');
      return;
    }
    setMessage(`Action ${action} completed. History preserved.`);
    setReason('');
    load();
  }

  if (loading) {
    return (
      <AdminPageContainer>
        <AdminLoadingState label="Loading tenant EIS controls" />
      </AdminPageContainer>
    );
  }

  return (
    <AdminPageContainer maxWidth="narrow">
      <AdminPageHeader
        breadcrumb={
          <Link href="/insightbooks/mra-eis" className="underline">
            ← {t('admin-pages.mraEis.tenantDetail.back')}
          </Link>
        }
        title={data?.tenant?.name || tenantId}
        description="Entitlement detail. No credentials are shown. Fiscalization remains blocked until later phases."
      />

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-[var(--admin-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          role="status"
          className="mb-4 rounded-[var(--admin-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      ) : null}

      {!data && error ? (
        <AdminErrorState title="Tenant EIS unavailable" message={error} onRetry={load} />
      ) : null}

      {data ? (
        <>
          <section className={sectionCls}>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Current entitlement</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--admin-text-muted)]">Status</dt>
                <dd className="mt-1">
                  <AdminStatusBadge tone={statusTone(data?.entitlement?.status)}>
                    {data?.entitlement?.status || 'NOT_ENTITLED'}
                  </AdminStatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">Production allowed</dt>
                <dd className="mt-1 font-medium text-[var(--admin-text)]">
                  {data?.entitlement?.productionAllowed ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">Effective from</dt>
                <dd className="mt-1 text-[var(--admin-text)]">
                  {data?.entitlement?.effectiveFrom || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--admin-text-muted)]">Effective until</dt>
                <dd className="mt-1 text-[var(--admin-text)]">
                  {data?.entitlement?.effectiveUntil || 'No expiry'}
                </dd>
              </div>
            </dl>
          </section>

          <section className={sectionCls}>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Readiness / blockers</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--admin-text)]">
              {(data?.capability?.blockers || []).map((b) => (
                <li key={b.code}>
                  <strong>{b.code}</strong> — {b.message}
                  {b.action ? ` (${b.action})` : ''}
                </li>
              ))}
              {(data?.capability?.blockers || []).length === 0 && (
                <li>No blockers for VIEW_EIS.</li>
              )}
            </ul>
          </section>

          <section className="mb-6 rounded-[var(--admin-radius)] border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-amber-950">Control actions</h2>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium text-amber-950">Reason</span>
              <textarea
                className={inputCls}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => runAction('upgrade')}>
                Upgrade to production
              </button>
              <button type="button" className={btnWarn} onClick={() => runAction('suspend')}>
                Suspend
              </button>
              <button type="button" className={btnGhost} onClick={() => runAction('resume')}>
                Resume
              </button>
              <button type="button" className={btnDanger} onClick={() => runAction('revoke')}>
                Revoke
              </button>
            </div>
          </section>

          <section className={sectionCls}>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">Audit history</h2>
            {(data?.audit || []).length === 0 ? (
              <div className="mt-3">
                <AdminEmptyState title="No audit entries" description="Actions will appear here." />
              </div>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(data?.audit || []).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2"
                  >
                    <div className="font-medium text-[var(--admin-text)]">{a.action}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">
                      {a.previousStatus || '—'} → {a.newStatus || '—'} · {a.createdAt}
                    </div>
                    {a.reason ? (
                      <div className="text-xs text-[var(--admin-text-muted)]">{a.reason}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
