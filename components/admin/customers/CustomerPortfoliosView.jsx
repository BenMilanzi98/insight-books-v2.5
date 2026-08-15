'use client';
import { tt } from '@/lib/i18n/runtime';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { customerDetailHref } from '@/lib/admin/customerNav';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSectionNav from './CustomerSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
const inputCls =
  'h-10 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text)]';

export default function CustomerPortfoliosView() {
  const { t } = useI18n();
  const [portfolios, setPortfolios] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [members, setMembers] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [unassignedTotal, setUnassignedTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [assignTenantId, setAssignTenantId] = useState('');
  const [assignOwnerAdminId, setAssignOwnerAdminId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  const loadPortfolios = useCallback(async () => {
    const res = await adminFetch('/api/admin/intelligence/customers/portfolios', {
      credentials: 'include',
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 403) {
      throw new Error(body.error || t('admin-pages.customers.forbidden'));
    }
    if (!res.ok) throw new Error(body.error || t('admin-pages.customers.portfolios.loadFailed'));
    const list = Array.isArray(body.portfolios) ? body.portfolios : [];
    setPortfolios(list);
    if (!selectedId && list[0]?.id) setSelectedId(list[0].id);
    return list;
  }, [selectedId, t]);

  const loadMembers = useCallback(
    async (portfolioId) => {
      if (!portfolioId) {
        setMembers([]);
        return;
      }
      const res = await adminFetch(
        `/api/admin/intelligence/customers/portfolios/${encodeURIComponent(portfolioId)}/members`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.portfolios.membersFailed'));
      setMembers(Array.isArray(body.members) ? body.members : []);
    },
    [t]
  );

  const loadUnassigned = useCallback(async () => {
    const res = await adminFetch(
      '/api/admin/intelligence/customers/unassigned?pageSize=10',
      { credentials: 'include' }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUnassigned([]);
      setUnassignedTotal(null);
      return;
    }
    setUnassigned(Array.isArray(body.rows) ? body.rows : []);
    setUnassignedTotal(typeof body.total === 'number' ? body.total : null);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const list = await loadPortfolios();
      const id = selectedId || list[0]?.id || '';
      await Promise.all([loadMembers(id), loadUnassigned()]);
    } catch (e) {
      setError(e.message || t('admin-pages.customers.portfolios.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [loadMembers, loadPortfolios, loadUnassigned, selectedId, t]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMembers(selectedId).catch((e) => {
      setError(e.message || t('admin-pages.customers.portfolios.membersFailed'));
    });
  }, [selectedId, loadMembers, t]);

  async function onCreatePortfolio(e) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await adminFetch('/api/admin/intelligence/customers/portfolios', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode || undefined,
          name: newName,
          description: newDescription || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.portfolios.createFailed'));
      setNewCode('');
      setNewName('');
      setNewDescription('');
      setNotice(t('admin-pages.customers.portfolios.createOk'));
      const list = await loadPortfolios();
      if (body.portfolio?.id) setSelectedId(body.portfolio.id);
      else if (list[0]?.id) setSelectedId(list[0].id);
    } catch (err) {
      setError(err.message || t('admin-pages.customers.portfolios.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(e) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await adminFetch(
        `/api/admin/intelligence/customers/portfolios/${encodeURIComponent(selectedId)}/members`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: assignTenantId,
            ownerAdminId: assignOwnerAdminId || undefined,
            reason: assignReason || undefined,
            isPrimary: true,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.portfolios.assignFailed'));
      setAssignTenantId('');
      setAssignOwnerAdminId('');
      setAssignReason('');
      setNotice(t('admin-pages.customers.portfolios.assignOk'));
      await Promise.all([loadMembers(selectedId), loadUnassigned()]);
    } catch (err) {
      setError(err.message || t('admin-pages.customers.portfolios.assignFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customers.sections.portfolios')}
        description={t('admin-pages.customers.sectionHints.portfolios')}
        actions={
          <button type="button" className={btnGhost} onClick={loadAll} disabled={loading || busy}>
            {t('admin-pages.common.refresh')}
          </button>
        }
      />

      <CustomerSectionNav />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}
      {notice ? (
        <p className="mb-4 text-sm text-[var(--admin-text)]" role="status">
          {notice}
        </p>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customers.portfolios.listTitle')}
            </h2>
            {portfolios.length === 0 ? (
              <AdminEmptyState
                title={t('admin-pages.customers.portfoliosEmptyTitle')}
                description={t('admin-pages.customers.portfolios.emptyHint')}
              />
            ) : (
              <ul className="space-y-2">
                {portfolios.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full rounded-[var(--admin-radius)] border px-3 py-2 text-left text-sm ${
                        selectedId === p.id
                          ? 'border-[var(--admin-accent)] bg-[var(--admin-surface-muted)]'
                          : 'border-[var(--admin-border)] bg-[var(--admin-surface)]'
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--admin-text)]">{p.name}</span>
                        <AdminStatusBadge tone="info">{p.code}</AdminStatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                        {p.ownerAdmin?.name || p.ownerAdminId || '—'}
                        {typeof p.membershipCount === 'number'
                          ? ` · ${p.membershipCount} ${t('admin-pages.customers.portfolios.membersLabel')}`
                          : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={onCreatePortfolio}
              className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
            >
              <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customers.portfolios.createTitle')}
              </h3>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.code')}
                <input
                  className={`${inputCls} mt-1`}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder={tt('CS-EAST')}
                />
              </label>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.name')}
                <input
                  className={`${inputCls} mt-1`}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.description')}
                <input
                  className={`${inputCls} mt-1`}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </label>
              <button type="submit" className={btnPrimary} disabled={busy || !newName.trim()}>
                {t('admin-pages.customers.portfolios.createAction')}
              </button>
              <p className="text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.manageHint')}
              </p>
            </form>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">
              {t('admin-pages.customers.portfolios.membersTitle')}
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.noMembers')}
              </p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={customerDetailHref(m.tenantId)}
                        className="font-medium text-[var(--admin-accent)] underline-offset-2 hover:underline"
                      >
                        {m.tenant?.name || m.tenantId}
                      </Link>
                      {m.isPrimary ? (
                        <AdminStatusBadge tone="success">
                          {t('admin-pages.customers.portfolios.primary')}
                        </AdminStatusBadge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
                      {m.ownerAdminName || m.ownerAdminId}
                      {m.ownerAdminEmail ? ` · ${m.ownerAdminEmail}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={onAssign}
              className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
            >
              <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customers.portfolios.assignTitle')}
              </h3>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.tenantId')}
                <input
                  className={`${inputCls} mt-1`}
                  value={assignTenantId}
                  onChange={(e) => setAssignTenantId(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.ownerAdminId')}
                <input
                  className={`${inputCls} mt-1`}
                  value={assignOwnerAdminId}
                  onChange={(e) => setAssignOwnerAdminId(e.target.value)}
                  placeholder={t('admin-pages.customers.portfolios.ownerAdminHint')}
                />
              </label>
              <label className="block text-xs text-[var(--admin-text-muted)]">
                {t('admin-pages.customers.portfolios.reason')}
                <input
                  className={`${inputCls} mt-1`}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className={btnPrimary}
                disabled={busy || !selectedId || !assignTenantId.trim()}
              >
                {t('admin-pages.customers.portfolios.assignAction')}
              </button>
            </form>

            <div className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4">
              <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                {t('admin-pages.customers.portfolios.unassignedTitle')}
                {typeof unassignedTotal === 'number' ? ` (${unassignedTotal})` : ''}
              </h3>
              {unassigned.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                  {t('admin-pages.customers.portfolios.unassignedEmpty')}
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {unassigned.map((row) => (
                    <li key={row.tenantId}>
                      <Link
                        href={customerDetailHref(row.tenantId)}
                        className="text-[var(--admin-accent)] underline-offset-2 hover:underline"
                      >
                        {row.displayName}
                      </Link>
                      <span className="text-[var(--admin-text-muted)]">
                        {' '}
                        · {row.customerReference}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
