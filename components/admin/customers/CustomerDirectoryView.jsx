'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { customerDetailHref } from '@/lib/admin/customerNav';
import AdminPageContainer from '@/components/admin/AdminPageContainer';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import AdminErrorState from '@/components/admin/AdminErrorState';
import AdminDataTable from '@/components/admin/AdminDataTable';
import AdminFilterBar from '@/components/admin/AdminFilterBar';
import AdminStatusBadge from '@/components/admin/AdminStatusBadge';
import CustomerSectionNav from './CustomerSectionNav';

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--admin-accent)] px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

const CURRENCIES = ['MWK', 'USD', 'ZAR', 'EUR'];
const PAGE_SIZES = [10, 25, 50];

function formatMoney(value, currency) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'MWK',
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${Number(value).toLocaleString()} ${currency || ''}`.trim();
  }
}

export default function CustomerDirectoryView() {
  const { t } = useI18n();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [currency, setCurrency] = useState('MWK');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        currency,
      });
      if (q) qs.set('q', q);
      const res = await adminFetch(
        `/api/admin/intelligence/customers/directory?${qs}`,
        { credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error(body.error || t('admin-pages.customers.forbidden'));
      }
      if (!res.ok) throw new Error(body.error || t('admin-pages.customers.loadFailed'));
      setRows(Array.isArray(body.rows) ? body.rows : []);
      setTotal(typeof body.total === 'number' ? body.total : 0);
    } catch (e) {
      setError(e.message || t('admin-pages.customers.loadFailed'));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, currency, q, t]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const columns = useMemo(
    () => [
      {
        key: 'displayName',
        header: t('admin-pages.customers.directory.columns.name'),
        mobileLabel: t('admin-pages.customers.directory.columns.name'),
        render: (row) => (
          <Link
            href={customerDetailHref(row.tenantId)}
            className="font-medium text-[var(--admin-accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.displayName || row.tenantId}
          </Link>
        ),
      },
      {
        key: 'customerReference',
        header: t('admin-pages.customers.directory.columns.reference'),
        render: (row) => (
          <span className="text-[var(--admin-text-muted)]">
            {row.customerReference || '—'}
          </span>
        ),
      },
      {
        key: 'lifecycleStage',
        header: t('admin-pages.customers.directory.columns.lifecycle'),
        render: (row) => (
          <AdminStatusBadge tone="info">{row.lifecycleStage || '—'}</AdminStatusBadge>
        ),
      },
      {
        key: 'plan',
        header: t('admin-pages.customers.directory.columns.plan'),
        hideOnMobile: true,
        render: (row) => row.plan || '—',
      },
      {
        key: 'mrr',
        header: t('admin-pages.customers.directory.columns.mrr'),
        render: (row) =>
          row.masked
            ? t('admin-pages.customers.masked')
            : formatMoney(row.mrr, row.currency || currency),
      },
      {
        key: 'outstanding',
        header: t('admin-pages.customers.directory.columns.outstanding'),
        hideOnMobile: true,
        render: (row) =>
          row.masked
            ? t('admin-pages.customers.masked')
            : formatMoney(row.outstanding, row.currency || currency),
      },
      {
        key: 'status',
        header: t('admin-pages.customers.directory.columns.status'),
        hideOnMobile: true,
        render: (row) => row.status || '—',
      },
    ],
    [t, currency]
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.customers.sections.directory')}
        description={t('admin-pages.customers.sectionHints.directory')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
              <span className="sr-only">{t('admin-pages.customers.currency')}</span>
              <select
                className="h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setPage(1);
                }}
                aria-label={t('admin-pages.customers.currency')}
              >
                {CURRENCIES.map((ccy) => (
                  <option key={ccy} value={ccy}>
                    {ccy}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={btnGhost} onClick={load} disabled={loading}>
              {t('admin-pages.common.refresh')}
            </button>
          </div>
        }
      />

      <CustomerSectionNav />

      <AdminFilterBar
        search={qInput}
        onSearchChange={setQInput}
        searchPlaceholder={t('admin-pages.customers.directory.searchPlaceholder')}
        actions={
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text-muted)]">
            <span>{t('admin-pages.customers.directory.pageSize')}</span>
            <select
              className="h-10 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm text-[var(--admin-text)]"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 25);
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {loading ? <AdminLoadingState label={t('admin-pages.common.loading')} /> : null}
      {error ? (
        <AdminErrorState title={t('admin-pages.common.unavailable')} message={error} />
      ) : null}

      {!loading && !error ? (
        <>
          <AdminDataTable
            columns={columns}
            rows={rows}
            rowKey="tenantId"
            emptyTitle={t('admin-pages.customers.directory.emptyTitle')}
            emptyDescription={t('admin-pages.customers.directory.emptyHint')}
            onRowClick={(row) => router.push(customerDetailHref(row.tenantId))}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--admin-text-muted)]">
            <p>
              {t('admin-pages.customers.directory.showing', {
                count: rows.length,
                total,
                page,
                totalPages,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={btnGhost}
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('admin-pages.customers.directory.prev')}
              </button>
              <button
                type="button"
                className={page < totalPages ? btnPrimary : btnGhost}
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('admin-pages.customers.directory.next')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </AdminPageContainer>
  );
}
