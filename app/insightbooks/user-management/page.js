'use client';
import { tt } from '@/lib/i18n/runtime';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Calendar, CheckCircle, Copy, KeyRound, Lock, Pencil, Plus,
  RefreshCw, Trash2, Unlock, UserPlus, Users, X,
} from 'lucide-react';
import {
  AdminPageContainer, AdminPageHeader, AdminSummaryCard, AdminFilterBar,
  AdminDataTable, AdminStatusBadge, AdminLoadingState, AdminErrorState,
  AdminEmptyState, AdminModal, AdminField, AdminConfirmationDialog,
} from '@/components/admin';

const PAGE_SIZE = 10;

async function fetchRolesForTenant(tenantId) {
  if (!tenantId) return [];
  try {
    const res = await adminFetch(`/api/admin/roles?tenantId=${encodeURIComponent(tenantId)}`, {
      cache: 'no-store', credentials: 'include',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.roles) ? data.roles : [];
  } catch {
    return [];
  }
}

function statusTone(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'active') return 'success';
  if (v === 'pending') return 'warning';
  if (v === 'inactive' || v === 'locked' || v === 'suspended') return 'danger';
  return 'neutral';
}

function roleTone(r) {
  const v = String(r || '').toLowerCase();
  if (v === 'admin') return 'danger';
  if (v === 'manager') return 'info';
  if (v === 'user') return 'success';
  return 'neutral';
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function Flash({ tone = 'danger', children, onDismiss }) {
  const cls = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-[var(--admin-radius)] border px-4 py-3 text-sm ${cls}`} role="status">
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={tt('Dismiss')}>
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function IconBtn({ title, children, onClick, disabled }) {
  return (
    <button
      type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-text)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary = 'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

export default function UserManagementPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const fetchUsers = useCallback(async (page = 1, search = '', role = 'all', status = 'all') => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (role !== 'all') params.set('role', role);
      if (status !== 'all') params.set('status', status);
      const res = await adminFetch(`/api/admin/users?${params}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to load users (${res.status})`);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setTotalUsers(data.pagination?.totalUsers ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setCurrentPage(page);
    } catch (err) {
      setUsers([]);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const res = await adminFetch('/api/admin/users/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('stats unavailable');
      setStats(await res.json());
    } catch {
      setStats(null);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1, '', 'all', 'all');
    fetchStats();
    (async () => {
      try {
        const res = await adminFetch('/api/admin/tenants', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setTenants(Array.isArray(data.tenants) ? data.tenants : []);
      } catch {
        setTenants([]);
      }
    })();
  }, [fetchUsers, fetchStats]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(1, searchTerm, selectedRole, selectedStatus), 300);
    return () => clearTimeout(t);
  }, [searchTerm, selectedRole, selectedStatus, fetchUsers]);

  const refresh = () => {
    fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus);
    fetchStats();
  };

  const showSuccess = (msg, ms = 4000) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), ms);
  };

  const handleCreateUser = async (userData) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          tenantId: userData.primaryTenantId || userData.tenantId,
          password: userData.password || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      setShowCreate(false);
      showSuccess(
        data.temporaryPassword
          ? `User created. Temporary password: ${data.temporaryPassword} — share securely.`
          : 'User created successfully',
        data.temporaryPassword ? 15000 : 4000
      );
      refresh();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (userData) => {
    if (!editUser) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/users/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          ...userData,
          tenantId: userData.tenantId || userData.tenant,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `Update failed (${res.status})`);
      setEditUser(null);
      showSuccess('User updated successfully');
      refresh();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setActionLoading(true);
    setError('');
    try {
      if (confirm.type === 'delete') {
        const res = await adminFetch('/api/admin/users/delete', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: confirm.user.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `Delete failed (${res.status})`);
        showSuccess('User deleted successfully');
      } else {
        const { user, action } = confirm;
        const res = await adminFetch('/api/admin/users/actions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, userId: user.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed to ${action} user`);
        if (data.newPassword || data.temporaryPassword) {
          throw new Error('Security violation: password must not be returned to the browser');
        }
        showSuccess(data.message || `User ${action} completed`);
      }
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const summaryValue = (path) => {
    if (statsLoading) return '…';
    if (statsError || !stats) return '—';
    return path.split('.').reduce((cur, p) => cur?.[p], stats) ?? '—';
  };

  const ask = (user, action, title, description) =>
    setConfirm({ type: 'security', action, user, title, description });

  const columns = useMemo(() => [
    {
      key: 'user', header: 'User',
      render: (u) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-[var(--admin-text)]">{u.name}</div>
          <div className="truncate text-xs text-[var(--admin-text-muted)]">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      render: (u) => (
        <AdminStatusBadge tone={roleTone(u.role)}>
          {u.role ? String(u.role).charAt(0).toUpperCase() + String(u.role).slice(1) : '—'}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (u) => (
        <AdminStatusBadge tone={statusTone(u.status)}>
          {u.status ? String(u.status).charAt(0).toUpperCase() + String(u.status).slice(1) : '—'}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'tenant', header: 'Tenant', hideOnMobile: true,
      render: (u) => <span className="text-[var(--admin-text)]">{u.tenant || '—'}</span>,
    },
    {
      key: 'activity', header: 'Activity', hideOnMobile: true,
      render: (u) => (
        <div className="text-xs text-[var(--admin-text-muted)]">
          <div>Last: {fmtDateTime(u.lastLogin)}</div>
          <div>Joined {fmtDate(u.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: (u) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconBtn title={tt('Edit')} onClick={() => setEditUser(u)}><Pencil className="h-4 w-4" /></IconBtn>
          <IconBtn title={tt('Lock')} disabled={actionLoading} onClick={() => ask(u, 'lock', 'Lock user', `Lock ${u.email}?`)}>
            <Lock className="h-4 w-4" />
          </IconBtn>
          <IconBtn title={tt('Unlock')} disabled={actionLoading} onClick={() => ask(u, 'unlock', 'Unlock user', `Unlock ${u.email}?`)}>
            <Unlock className="h-4 w-4" />
          </IconBtn>
          <IconBtn title={tt('Require password reset')} disabled={actionLoading} onClick={() => ask(u, 'resetPassword', 'Require password reset', `Require a password reset for ${u.email}?`)}>
            <KeyRound className="h-4 w-4" />
          </IconBtn>
          <IconBtn title={tt('Delete')} onClick={() => setConfirm({ type: 'delete', user: u, title: 'Delete user', description: `Delete ${u.name}? This cannot be undone.` })}>
            <Trash2 className="h-4 w-4 text-[var(--admin-danger)]" />
          </IconBtn>
        </div>
      ),
    },
  ], [actionLoading]);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.users.title')}
        description="Create, update, and secure users across tenants."
        actions={
          <>
            <button type="button" onClick={refresh} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> {tt('Refresh')}
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
              <UserPlus className="h-4 w-4" aria-hidden /> {tt('Add user')}
            </button>
          </>
        }
      />

      {notice ? <Flash tone="success" onDismiss={() => setNotice('')}>{notice}</Flash> : null}
      {error ? <Flash onDismiss={() => setError('')}>{error}</Flash> : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard label="Total users" value={summaryValue('overview.totalUsers')} icon={Users} error={statsError} />
        <AdminSummaryCard label="Active" value={summaryValue('overview.activeUsers')} tone="success" icon={CheckCircle} error={statsError} />
        <AdminSummaryCard label="Tenants" value={summaryValue('overview.uniqueTenants')} icon={Building2} error={statsError} />
        <AdminSummaryCard label="New this month" value={summaryValue('growth.usersThisMonth')} icon={Calendar} error={statsError} />
      </div>

      <AdminFilterBar search={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder="Search name or email…">
        <AdminField label="Role" htmlFor="filter-role">
          <AdminField.Select id="filter-role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            <option value="all">{tt('All roles')}</option>
            <option value="admin">{tt('Admin')}</option>
            <option value="manager">{tt('Manager')}</option>
            <option value="user">{tt('User')}</option>
          </AdminField.Select>
        </AdminField>
        <AdminField label="Status" htmlFor="filter-status">
          <AdminField.Select id="filter-status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="all">{tt('All statuses')}</option>
            <option value="active">{tt('Active')}</option>
            <option value="inactive">{tt('Inactive')}</option>
            <option value="pending">{tt('Pending')}</option>
          </AdminField.Select>
        </AdminField>
      </AdminFilterBar>

      {loading ? <AdminLoadingState label="Loading users" /> : null}
      {!loading && error && users.length === 0 ? (
        <AdminErrorState title={tt('User list unavailable')} message={error} onRetry={() => fetchUsers(currentPage, searchTerm, selectedRole, selectedStatus)} />
      ) : null}
      {!loading && !error && users.length === 0 ? (
        <AdminEmptyState
          title={tt('No users found')}
          description="Adjust filters or create a new user."
          icon={Users}
          action={
            <button type="button" onClick={() => setShowCreate(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" aria-hidden /> {tt('Add user')}
            </button>
          }
        />
      ) : null}
      {!loading && users.length > 0 ? (
        <>
          <AdminDataTable columns={columns} rows={users} rowKey="id" />
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--admin-text-muted)]">
              Showing{' '}
              <span className="font-medium text-[var(--admin-text)]">
                {totalUsers === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
              </span>
              {' '}to{' '}
              <span className="font-medium text-[var(--admin-text)]">{Math.min(currentPage * PAGE_SIZE, totalUsers)}</span>
              {' '}of <span className="font-medium text-[var(--admin-text)]">{totalUsers}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage <= 1} onClick={() => fetchUsers(currentPage - 1, searchTerm, selectedRole, selectedStatus)} className={btnGhost}>{tt('Previous')}</button>
              <span className="text-sm text-[var(--admin-text-muted)]">Page {currentPage} / {totalPages}</span>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => fetchUsers(currentPage + 1, searchTerm, selectedRole, selectedStatus)} className={btnGhost}>{tt('Next')}</button>
            </div>
          </div>
        </>
      ) : null}

      <UserFormModal mode="create" open={showCreate} tenants={tenants} loading={actionLoading} onClose={() => setShowCreate(false)} onSubmit={handleCreateUser} />
      <UserFormModal mode="edit" open={Boolean(editUser)} user={editUser} tenants={tenants} loading={actionLoading} onClose={() => setEditUser(null)} onSubmit={handleEditUser} onActivated={refresh} />

      <AdminConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.title || 'Confirm'}
        description={confirm?.description}
        confirmLabel={confirm?.type === 'delete' ? tt('Delete') : tt('Confirm')}
        tone={confirm?.type === 'delete' || confirm?.action === 'lock' ? tt('danger') : tt('primary')}
        loading={actionLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </AdminPageContainer>
  );
}

function MembershipEditor({ rows, setRows, primaryIndex, setPrimaryIndex, tenants, rolesCache, ensureRolesLoaded }) {
  return (
    <div className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--admin-text)]">{tt('Business access')}</p>
        <button type="button" className="text-sm font-medium text-[var(--action-primary)]" onClick={() => setRows((p) => [...p, { tenantId: '', roleId: '' }])}>
          + Add business
        </button>
      </div>
      <p className="text-xs text-[var(--admin-text-muted)]">{tt('Roles load per business. Mark one primary login business.')}</p>
      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--admin-text)]">
            <input type="radio" name="primaryBiz" checked={primaryIndex === idx} onChange={() => setPrimaryIndex(idx)} />
            {tt('Primary login business')}
          </label>
          <AdminField.Select
            value={row.tenantId} required={idx === 0}
            onChange={(e) => {
              const tid = e.target.value;
              setRows((p) => p.map((r, i) => (i === idx ? { tenantId: tid, roleId: '' } : r)));
              if (tid) ensureRolesLoaded(tid);
            }}
          >
            <option value="">{tt('Select business')}</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.subdomain})</option>)}
          </AdminField.Select>
          <AdminField.Select
            value={row.roleId} required={idx === 0} disabled={!row.tenantId}
            onChange={(e) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, roleId: e.target.value } : r)))}
          >
            <option value="">{!row.tenantId ? tt('Select business first') : tt('Select role')}</option>
            {(rolesCache[row.tenantId] || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </AdminField.Select>
          {rows.length > 1 ? (
            <button
              type="button" className="text-xs text-[var(--admin-danger)]"
              onClick={() => {
                setRows((p) => p.filter((_, i) => i !== idx));
                setPrimaryIndex((p) => (p === idx ? Math.max(0, idx - 1) : p > idx ? p - 1 : p));
              }}
            >
              {tt('Remove row')}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function UserFormModal({ mode, open, user, tenants, loading, onClose, onSubmit, onActivated }) {
  const isEdit = mode === 'edit';
  const [rows, setRows] = useState([{ tenantId: '', roleId: '' }]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [rolesCache, setRolesCache] = useState({});
  const [formError, setFormError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationMessage, setActivationMessage] = useState('');
  const [departments, setDepartments] = useState([]);
  const [verification, setVerification] = useState({ isEmailVerified: false, otpCode: null, otpExpiry: null });
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', status: 'active', password: '', department: '' });
  const primaryTenantId = rows[primaryIndex]?.tenantId || '';

  const ensureRolesLoaded = useCallback(async (tenantId) => {
    if (!tenantId) return;
    const list = await fetchRolesForTenant(tenantId);
    setRolesCache((prev) => (prev[tenantId] ? prev : { ...prev, [tenantId]: list }));
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormError('');
    setActivationMessage('');
    if (!isEdit) {
      setRows([{ tenantId: '', roleId: '' }]);
      setPrimaryIndex(0);
      setRolesCache({});
      setFormData({ name: '', email: '', phone: '', status: 'active', password: '', department: '' });
      setVerification({ isEmailVerified: false, otpCode: null, otpExpiry: null });
      return;
    }
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load user');
        if (cancelled) return;
        const d = data.user;
        setFormData({ name: d.name || '', email: d.email || '', phone: d.phone || '', status: d.status || 'active', password: '', department: d.department || '' });
        setVerification({ isEmailVerified: Boolean(d.isEmailVerified), otpCode: d.otpCode || null, otpExpiry: d.otpExpiry || null });
        const mems = d.memberships?.length
          ? d.memberships.map((m) => ({ tenantId: m.tenantId, roleId: m.roleId }))
          : [{ tenantId: d.tenantId || '', roleId: d.roleId || '' }];
        setRows(mems.length ? mems : [{ tenantId: '', roleId: '' }]);
        const pIdx = mems.findIndex((m) => m.tenantId === d.primaryTenantId);
        setPrimaryIndex(pIdx >= 0 ? pIdx : 0);
        mems.forEach((m) => m.tenantId && ensureRolesLoaded(m.tenantId));
      } catch (e) {
        if (!cancelled) setFormError(e.message || 'Load failed');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, isEdit, user?.id, ensureRolesLoaded]);

  useEffect(() => {
    rows.forEach((row) => { if (row.tenantId) ensureRolesLoaded(row.tenantId); });
  }, [rows, ensureRolesLoaded]);

  useEffect(() => {
    if (!open || isEdit || !primaryTenantId) {
      if (!primaryTenantId) setDepartments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/departments?tenantId=${encodeURIComponent(primaryTenantId)}`, { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => []);
        if (!cancelled) setDepartments(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, isEdit, primaryTenantId]);

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const filled = rows.filter((r) => r.tenantId && r.roleId);
    if (!formData.name || !formData.email || filled.length === 0) {
      setFormError('Name, email, and at least one business with a role are required');
      return;
    }
    const primaryRow = rows[primaryIndex];
    if (!primaryRow?.tenantId || !primaryRow?.roleId) {
      setFormError('Primary business row must have both business and role');
      return;
    }
    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      status: formData.status,
      memberships: filled.map((r) => ({ tenantId: r.tenantId, roleId: r.roleId })),
      primaryTenantId: primaryRow.tenantId,
      tenantId: primaryRow.tenantId,
      role: primaryRow.roleId,
    };
    if (!isEdit) {
      payload.password = formData.password || undefined;
      payload.department = formData.department || undefined;
    }
    onSubmit(payload);
  };

  const handleManualActivation = async () => {
    if (!user?.id) return;
    setActivationLoading(true);
    setActivationMessage('');
    setFormError('');
    try {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/manual-activation`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to manually activate user');
      setVerification({ isEmailVerified: true, otpCode: null, otpExpiry: null });
      setFormData((p) => ({ ...p, status: data.user?.status || 'active' }));
      setActivationMessage('Account manually activated.');
      onActivated?.();
    } catch (e) {
      setFormError(e.message || 'Manual activation failed');
    } finally {
      setActivationLoading(false);
    }
  };

  const otpExpired = verification.otpExpiry && new Date(verification.otpExpiry).getTime() < Date.now();

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEdit ? tt('Edit user') : tt('Create user')}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={loading} className={btnGhost}>{tt('Cancel')}</button>
          <button type="submit" form="user-form" disabled={loading || detailLoading} className={btnPrimary}>
            {loading ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? tt('Update user') : tt('Create user')}
          </button>
        </>
      }
    >
      {detailLoading ? <AdminLoadingState label="Loading user" rows={4} /> : null}
      {formError ? <p className="mb-3 text-sm text-[var(--admin-danger)]" role="alert">{formError}</p> : null}
      {!detailLoading ? (
        <form id="user-form" onSubmit={submit} className="space-y-4">
          <AdminField label="Name" htmlFor="user-name" required>
            <AdminField.Input id="user-name" required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
          </AdminField>
          <AdminField label="Email" htmlFor="user-email" required>
            <AdminField.Input id="user-email" type="email" required value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
          </AdminField>
          <AdminField label="Phone" htmlFor="user-phone">
            <AdminField.Input id="user-phone" type="tel" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
          </AdminField>
          {!isEdit ? (
            <AdminField label="Password" htmlFor="user-password" hint="Leave blank to auto-generate a 6-character temporary password.">
              <AdminField.Input id="user-password" type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder={tt('Optional')} />
            </AdminField>
          ) : null}
          <AdminField label="Status" htmlFor="user-status">
            <AdminField.Select id="user-status" value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">{tt('Active')}</option>
              <option value="inactive">{tt('Inactive')}</option>
              <option value="pending">{tt('Pending')}</option>
            </AdminField.Select>
          </AdminField>

          {isEdit ? (
            <div className="space-y-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--admin-text)]">{tt('Email verification')}</p>
                  <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{tt('For when verification email was not received.')}</p>
                </div>
                <AdminStatusBadge tone={verification.isEmailVerified ? tt('success') : tt('warning')}>
                  {verification.isEmailVerified ? tt('Verified') : tt('Not verified')}
                </AdminStatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3">
                <div>
                  <p className="text-xs font-medium uppercase text-[var(--admin-text-muted)]">{tt('Current OTP')}</p>
                  <p className="mt-1 font-mono text-lg tracking-widest text-[var(--admin-text)]">{verification.otpCode || 'No active OTP'}</p>
                  <p className={`mt-1 text-xs ${otpExpired ? 'text-[var(--admin-danger)]' : 'text-[var(--admin-text-muted)]'}`}>
                    {verification.otpExpiry ? `${otpExpired ? tt('Expired') : tt('Expires')}: ${fmtDateTime(verification.otpExpiry)}` : 'No OTP expiry recorded.'}
                  </p>
                </div>
                {verification.otpCode ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(verification.otpCode));
                        setActivationMessage('OTP copied.');
                      } catch {
                        setActivationMessage('Could not copy automatically.');
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" /> {tt('Copy')}
                  </button>
                ) : null}
              </div>
              {activationMessage ? <p className="text-sm text-[var(--status-success)]">{activationMessage}</p> : null}
              <button
                type="button"
                disabled={activationLoading || verification.isEmailVerified}
                onClick={handleManualActivation}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--status-success)] px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {activationLoading ? tt('Activating…') : tt('Manually activate account')}
              </button>
            </div>
          ) : null}

          <MembershipEditor
            rows={rows} setRows={setRows}
            primaryIndex={primaryIndex} setPrimaryIndex={setPrimaryIndex}
            tenants={tenants} rolesCache={rolesCache} ensureRolesLoaded={ensureRolesLoaded}
          />

          {!isEdit ? (
            <AdminField label="Department" htmlFor="user-dept" hint={!primaryTenantId ? 'Select a primary business first' : undefined}>
              <AdminField.Select
                id="user-dept"
                disabled={!primaryTenantId}
                value={formData.department || ''}
                onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
              >
                <option value="">{tt('No department')}</option>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </AdminField.Select>
            </AdminField>
          ) : null}
        </form>
      ) : null}
    </AdminModal>
  );
}
