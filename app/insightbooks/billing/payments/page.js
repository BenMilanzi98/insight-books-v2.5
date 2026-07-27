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
} from '@/components/admin';

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

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Platform payments"
        description="SaaS platform payment records with gateway idempotency. Separate from tenant AR payments."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--action-primary-hover)]"
          >
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by payment #, tenant, reference, or method"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

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
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)]">
          <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Payment
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Method / Gateway
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">
                      {p.paymentNumber}
                    </div>
                    {p.gatewayReference ? (
                      <div className="text-xs text-[var(--text-muted)]">
                        Ref: {p.gatewayReference}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{p.tenantId}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {[p.method, p.gateway].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge tone={statusTone(p.status)}>{p.status}</AdminStatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
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
