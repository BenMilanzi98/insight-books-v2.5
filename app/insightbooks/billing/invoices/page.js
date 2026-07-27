'use client';

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
} from '@/components/admin';

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
      const res = await fetch(`/api/admin/platform-billing/invoices${qs}`, {
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

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Platform invoices"
        description="SaaS platform invoices for tenant subscriptions. Separate from tenant AR invoices."
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
        <AdminSummaryCard label="Total" value={stats.total} icon={FileText} />
        <AdminSummaryCard label="Paid" value={stats.paid} tone="success" />
        <AdminSummaryCard label="With balance" value={stats.outstanding} tone="warning" />
        <AdminSummaryCard label="Overdue" value={stats.overdue} tone="danger" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice #, tenant id, or status"
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {loading ? <AdminLoadingState label="Loading platform invoices" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Unable to load invoices" message={error} onRetry={load} />
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title="No platform invoices"
          description="Create platform invoices via the billing API. Tenant AR invoices are not shown here."
        />
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)]">
          <table className="min-w-full divide-y divide-[var(--border-default)] text-sm">
            <thead className="bg-[var(--surface-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Total
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{inv.tenantId}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(inv.total, inv.currency)}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatMoney(inv.outstanding, inv.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge tone={statusTone(inv.status)}>
                      {inv.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}
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
