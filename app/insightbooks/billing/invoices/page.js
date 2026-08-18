'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminFilterBar,
  AdminField,
  AdminDataTable,
} from '@/components/admin';

const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white hover:opacity-95';

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'PAID') return 'success';
  if (s === 'PARTIALLY_PAID' || s === 'ISSUED' || s === 'PENDING') return 'warning';
  if (s === 'OVERDUE' || s === 'VOID' || s === 'CANCELLED') return 'danger';
  return 'neutral';
}

function formatMoney(amount, currency = 'MWK') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} —`;
  return `${currency} ${n.toLocaleString()}`;
}

export default function AdminPlatformInvoicesPage() {
  const { t } = useI18n();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await adminFetch(`/api/admin/platform-billing/invoices${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to load invoices (${res.status})`);
      }
      setInvoices(Array.isArray(body.invoices) ? body.invoices : []);
    } catch (e) {
      setInvoices([]);
      setError(e.message || 'Failed to load platform invoices');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      return (
        String(inv.invoiceNumber || '')
          .toLowerCase()
          .includes(q) ||
        String(inv.tenantId || '')
          .toLowerCase()
          .includes(q) ||
        String(inv.status || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [invoices, search]);

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => String(i.status).toUpperCase() === 'PAID').length;
    const outstanding = invoices.filter((i) => Number(i.outstanding) > 0).length;
    const overdue = invoices.filter((i) => String(i.status).toUpperCase() === 'OVERDUE').length;
    return {
      total: invoices.length,
      paid,
      outstanding,
      overdue,
    };
  }, [invoices]);

  const columns = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        header: 'Invoice',
        render: (inv) => (
          <span className="font-medium text-[var(--admin-text)]">{inv.invoiceNumber}</span>
        ),
      },
      {
        key: 'tenantId',
        header: 'Tenant',
        render: (inv) => (
          <span className="break-all text-[var(--admin-text-muted)]">{inv.tenantId}</span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        cellClassName: 'tabular-nums',
        render: (inv) => formatMoney(inv.total, inv.currency),
      },
      {
        key: 'outstanding',
        header: 'Outstanding',
        cellClassName: 'tabular-nums',
        render: (inv) => formatMoney(inv.outstanding, inv.currency),
      },
      {
        key: 'status',
        header: 'Status',
        render: (inv) => (
          <AdminStatusBadge tone={statusTone(inv.status)}>{inv.status}</AdminStatusBadge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (inv) => (inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.billing.invoices.title')}
        description="SaaS platform invoices for tenant subscriptions. Separate from tenant AR invoices."
        actions={
          <button type="button" onClick={load} className={btnPrimary}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {tt('Refresh')}
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSummaryCard label="Total" value={stats.total} icon={FileText} />
        <AdminSummaryCard label="Paid" value={stats.paid} tone="success" />
        <AdminSummaryCard label="With balance" value={stats.outstanding} tone="warning" />
        <AdminSummaryCard label="Overdue" value={stats.overdue} tone="danger" />
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by invoice #, tenant id, or status"
      >
        <AdminField label="Status" htmlFor="invoice-status-filter">
          <AdminField.Select
            id="invoice-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{tt('All statuses')}</option>
            <option value="DRAFT">{tt('Draft')}</option>
            <option value="ISSUED">{tt('Issued')}</option>
            <option value="PARTIALLY_PAID">{tt('Partially paid')}</option>
            <option value="PAID">{tt('Paid')}</option>
            <option value="OVERDUE">{tt('Overdue')}</option>
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading platform invoices" /> : null}
      {!loading && error ? (
        <AdminErrorState title={tt('Unable to load invoices')} message={error} onRetry={load} />
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title={tt('No platform invoices')}
          description="Create platform invoices via the billing API. Tenant AR invoices are not shown here."
        />
      ) : null}
      {!loading && !error && filtered.length > 0 ? (
        <AdminDataTable columns={columns} rows={filtered} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
