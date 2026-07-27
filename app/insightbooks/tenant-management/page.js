'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Headphones,
  MoreVertical,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
  AdminStatusBadge,
  AdminConfirmationDialog,
  AdminFilterBar,
  AdminDataTable,
  AdminModal,
  AdminField,
} from '@/components/admin';

function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL' || s === 'PENDING' || s === 'PENDING_VERIFICATION') return 'warning';
  if (s === 'SUSPENDED' || s === 'SUSPENSION_PENDING') return 'danger';
  return 'neutral';
}

export default function TenantManagementPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [menuId, setMenuId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`);
      setTenants(Array.isArray(body.tenants) ? body.tenants : []);
    } catch (e) {
      setTenants([]);
      setError(e.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest?.('[data-tenant-menu]')) setMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      const status = String(t.status || '').toLowerCase();
      if (filter !== 'all' && status !== filter && String(t.status) !== filter) {
        const up = String(t.status || '').toUpperCase();
        if (filter === 'active' && up !== 'ACTIVE') return false;
        if (filter === 'suspended' && !up.includes('SUSPEND')) return false;
        if (filter === 'archived' && up !== 'ARCHIVED') return false;
        if (filter === 'trial' && up !== 'TRIAL' && t.subscriptionStatus !== 'trial') return false;
      }
      if (!q) return true;
      return (
        String(t.name || '').toLowerCase().includes(q) ||
        String(t.subdomain || '').toLowerCase().includes(q)
      );
    });
  }, [tenants, search, filter]);

  const counts = useMemo(() => {
    const c = { total: tenants.length, active: 0, suspended: 0, archived: 0 };
    tenants.forEach((t) => {
      const s = String(t.status || '').toUpperCase();
      if (s === 'ACTIVE') c.active += 1;
      else if (s.includes('SUSPEND')) c.suspended += 1;
      else if (s === 'ARCHIVED') c.archived += 1;
    });
    return c;
  }, [tenants]);

  const runLifecycle = async (tenantId, command, reason) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/lifecycle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${command} failed`);
      setConfirm(null);
      setMenuId(null);
      await load();
    } catch (e) {
      setError(e.message || 'Lifecycle action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const startSupportAccess = async (tenant) => {
    const reason = window.prompt(
      `Support access reason for ${tenant.name} (min 8 characters):`
    );
    if (!reason || reason.trim().length < 8) {
      setError('Support access requires a reason of at least 8 characters');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/support-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          reason: reason.trim(),
          durationMinutes: 60,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to start support access');
      setMenuId(null);
      alert('Support access started. A banner will show while the session is active.');
    } catch (e) {
      setError(e.message || 'Support access failed');
    } finally {
      setActionLoading(false);
    }
  };

  const createTenant = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Create failed');
      setShowCreate(false);
      setNewName('');
      await load();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Tenant Management"
        description="Create, activate, suspend, reactivate, and archive tenants. Hard delete is prohibited — archive preserves history."
        actions={
          <>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--action-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create tenant
            </button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Total tenants" value={error ? '—' : counts.total} icon={Building2} error={Boolean(error && !tenants.length)} />
        <AdminSummaryCard label="Active" value={error ? '—' : counts.active} tone="success" />
        <AdminSummaryCard label="Suspended" value={error ? '—' : counts.suspended} tone="warning" />
        <AdminSummaryCard label="Archived" value={error ? '—' : counts.archived} tone="neutral" />
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or subdomain…"
      >
        <AdminField label="Status" htmlFor="tenant-status-filter">
          <AdminField.Select
            id="tenant-status-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading tenants" /> : null}
      {!loading && error ? (
        <AdminErrorState title="Tenant list unavailable" message={error} onRetry={load} />
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <AdminEmptyState
          title="No tenants match"
          description="Adjust filters or create a new tenant."
          action={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 py-2 text-sm text-white"
            >
              Create tenant
            </button>
          }
        />
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <AdminDataTable
          rows={filtered}
          columns={[
            {
              key: 'name',
              header: 'Tenant',
              render: (tenant) => (
                <div>
                  <button
                    type="button"
                    className="text-left font-medium text-[var(--admin-text)] underline-offset-2 hover:underline"
                    onClick={() =>
                      router.push(`/insightbooks/tenants/${tenant.id}/dashboard`)
                    }
                  >
                    {tenant.name}
                  </button>
                  <div className="break-all text-xs text-[var(--admin-text-muted)]">
                    {tenant.subdomain || tenant.id}
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (tenant) => (
                <AdminStatusBadge tone={statusTone(tenant.status)}>
                  {tenant.status || '—'}
                </AdminStatusBadge>
              ),
            },
            {
              key: 'subscriptionStatus',
              header: 'Subscription',
              render: (t) => t.subscriptionStatus || '—',
            },
            {
              key: 'plan',
              header: 'Plan',
              hideOnMobile: true,
              render: (t) => t.plan || t.subscriptionPlan || '—',
            },
            {
              key: 'createdAt',
              header: 'Created',
              hideOnMobile: true,
              render: (t) =>
                t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—',
            },
            {
              key: 'actions',
              header: 'Actions',
              mobileLabel: 'Actions',
              cellClassName: 'text-right',
              render: (tenant) => (
                <div className="relative text-right" data-tenant-menu>
                  <button
                    type="button"
                    aria-label="Actions"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius)] hover:bg-[var(--admin-surface-muted)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId((id) => (id === tenant.id ? null : tenant.id));
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuId === tenant.id ? (
                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white py-1 shadow-lg">
                      <MenuBtn
                        onClick={() =>
                          router.push(`/insightbooks/tenants/${tenant.id}/dashboard`)
                        }
                      >
                        Open dashboard
                      </MenuBtn>
                      <MenuBtn
                        onClick={() =>
                          setConfirm({
                            tenant,
                            command: 'ACTIVATE',
                            title: 'Activate tenant',
                            description: `Activate ${tenant.name}?`,
                          })
                        }
                      >
                        Activate
                      </MenuBtn>
                      <MenuBtn
                        onClick={() =>
                          setConfirm({
                            tenant,
                            command: 'SUSPEND',
                            title: 'Suspend tenant',
                            description: `Suspend ${tenant.name}? A reason is required.`,
                            needReason: true,
                          })
                        }
                      >
                        Suspend
                      </MenuBtn>
                      <MenuBtn
                        onClick={() =>
                          setConfirm({
                            tenant,
                            command: 'REACTIVATE',
                            title: 'Reactivate tenant',
                            description: `Reactivate ${tenant.name}?`,
                          })
                        }
                      >
                        Reactivate
                      </MenuBtn>
                      <MenuBtn
                        onClick={() =>
                          setConfirm({
                            tenant,
                            command: 'ARCHIVE',
                            title: 'Archive tenant',
                            description: `Archive ${tenant.name}? Data is preserved; hard delete is not allowed.`,
                            needReason: true,
                          })
                        }
                      >
                        Archive
                      </MenuBtn>
                      <MenuBtn onClick={() => startSupportAccess(tenant)}>
                        <Headphones className="mr-2 inline h-3.5 w-3.5" />
                        Support access
                      </MenuBtn>
                    </div>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      ) : null}

      <AdminModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create tenant"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-tenant-form"
              disabled={creating}
              className="rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <form id="create-tenant-form" onSubmit={createTenant}>
          <AdminField label="Tenant name" htmlFor="new-tenant-name" required>
            <AdminField.Input
              id="new-tenant-name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </AdminField>
        </form>
      </AdminModal>

      <LifecycleConfirm
        confirm={confirm}
        loading={actionLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) =>
          runLifecycle(confirm.tenant.id, confirm.command, reason)
        }
      />
    </AdminPageContainer>
  );
}

function MenuBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)]"
    >
      {children}
    </button>
  );
}

function LifecycleConfirm({ confirm, loading, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    setReason('');
  }, [confirm?.tenant?.id, confirm?.command]);

  if (!confirm) return null;

  if (!confirm.needReason) {
    return (
      <AdminConfirmationDialog
        open
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.command}
        loading={loading}
        onCancel={onCancel}
        onConfirm={() => onConfirm('')}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lifecycle-title"
        className="w-full max-w-md rounded-[var(--radius-lg)] bg-white p-5 shadow-[var(--shadow-modal)]"
      >
        <h2 id="lifecycle-title" className="text-lg font-semibold">
          {confirm.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{confirm.description}</p>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Reason (required)</span>
          <textarea
            className="w-full rounded border px-2 py-1 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded border px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded bg-[var(--status-danger)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {loading ? 'Working…' : confirm.command}
          </button>
        </div>
      </div>
    </div>
  );
}
