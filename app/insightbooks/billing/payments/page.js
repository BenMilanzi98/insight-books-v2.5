'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
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
  if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'PAID') return 'success';
  if (s === 'PENDING' || s === 'PROCESSING') return 'warning';
  if (s === 'FAILED' || s === 'CANCELLED') return 'danger';
  return 'neutral';
}

function formatMoney(amount, currency = 'MWK') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} —`;
  return `${currency} ${n.toLocaleString()}`;
}

export default function AdminPlatformPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await fetch(`/api/admin/platform-billing/payments${qs}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to load payments (${res.status})`);
      }
      setPayments(Array.isArray(body.payments) ? body.payments : []);
    } catch (e) {
      setPayments([]);
      setError(e.message || 'Failed to load platform payments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => {
      return (
        String(p.paymentNumber || '')
          .toLowerCase()
          .includes(q) ||
        String(p.tenantId || '')
          .toLowerCase()
          .includes(q) ||
        String(p.gatewayReference || '')
          .toLowerCase()
          .includes(q) ||
        String(p.method || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [payments, search]);

  const stats = useMemo(() => {
    const completed = payments.filter((p) =>
      ['COMPLETED', 'SUCCESS', 'PAID'].includes(String(p.status).toUpperCase())
    ).length;
    const pending = payments.filter((p) =>
      ['PENDING', 'PROCESSING'].includes(String(p.status).toUpperCase())
    ).length;
    const failed = payments.filter((p) =>
      ['FAILED', 'CANCELLED'].includes(String(p.status).toUpperCase())
    ).length;
    const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return { total: payments.length, completed, pending, failed, totalAmount };
  }, [payments]);

  const columns = useMemo(
    () => [
      {
        key: 'paymentNumber',
        header: 'Payment',
        render: (p) => (
          <div>
            <div className="font-medium text-[var(--admin-text)]">{p.paymentNumber}</div>
            {p.gatewayReference ? (
              <div className="text-xs text-[var(--admin-text-muted)]">Ref: {p.gatewayReference}</div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'tenantId',
        header: 'Tenant',
        render: (p) => (
          <span className="break-all text-[var(--admin-text-muted)]">{p.tenantId}</span>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        cellClassName: 'tabular-nums',
        render: (p) => formatMoney(p.amount, p.currency),
      },
      {
        key: 'method',
        header: 'Method / Gateway',
        render: (p) => [p.method, p.gateway].filter(Boolean).join(' / ') || '—',
      },
      {
        key: 'status',
        header: 'Status',
        render: (p) => (
          <AdminStatusBadge tone={statusTone(p.status)}>{p.status}</AdminStatusBadge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Date',
        render: (p) => (p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'),
      },
    ],
    []
  );

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Platform payments"
        description="SaaS platform payment records with gateway idempotency. Separate from tenant AR payments."
        actions={
          <button type="button" onClick={load} className={btnPrimary}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminSummaryCard label="Total payments" value={stats.total} icon={CreditCard} />
        <AdminSummaryCard label="Completed" value={stats.completed} tone="success" />
        <AdminSummaryCard label="Pending" value={stats.pending} tone="warning" />
        <AdminSummaryCard
          label="Volume"
          value={formatMoney(stats.totalAmount)}
          hint={`${stats.failed} failed`}
          tone={stats.failed ? 'danger' : 'neutral'}
        />
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by payment #, tenant, reference, or method"
      >
        <AdminField label="Status" htmlFor="payment-status-filter">
          <AdminField.Select
            id="payment-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading platform payments" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Unable to load payments" message={error} onRetry={load} />
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <AdminEmptyState
          icon={CreditCard}
          title="No platform payments"
          description="Record platform payments via the billing API. Tenant AR payments are not shown here."
        />
      ) : null}
      {!loading && !error && filtered.length > 0 ? (
        <AdminDataTable columns={columns} rows={filtered} rowKey="id" />
      ) : null}
    </AdminPageContainer>
  );
}
