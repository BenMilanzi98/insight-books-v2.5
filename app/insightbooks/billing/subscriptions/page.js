'use client';

import { useI18n } from '@/components/i18n/I18nProvider';
import { adminFetch } from '@/lib/admin/adminApi';
import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search,
  RefreshCw,
  AlertCircle,
  CreditCard,
  X
} from 'lucide-react';
import { PUBLIC_SUBSCRIPTION_PLANS, SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';
import {
  AdminPageContainer,
  AdminPageHeader,
  AdminSummaryCard,
  AdminFilterBar,
  AdminField,
  AdminDataTable,
  AdminStatusBadge,
  AdminLoadingState,
  AdminErrorState,
  AdminEmptyState,
} from '@/components/admin';

const SHOW_EIS_SUBSCRIPTION_UI = false;

const btnGhost =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] disabled:opacity-50';
const btnPrimary =
  'inline-flex h-10 items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--action-primary)] px-3 text-sm font-medium text-white disabled:opacity-50';

function statusTone(status) {
  const s = String(status || '');
  if (s === 'Active' || s === 'Trial') return 'success';
  if (s === 'Pending') return 'warning';
  if (s === 'Failed' || s === 'Expired' || s === 'Cancelled') return 'danger';
  return 'neutral';
}

export default function AdminSubscriptions() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [subscriptions, setSubscriptions] = useState([]);
  const [eisSubscriptions, setEisSubscriptions] = useState([]);
  const [eisStats, setEisStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    monthly: 0,
    yearly: 0,
    monthlyActive: 0,
    yearlyActive: 0,
    totalRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eisStatusFilter, setEisStatusFilter] = useState('all');
  const [eisPlanFilter, setEisPlanFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEISActivateModal, setShowEISActivateModal] = useState(false);
  const [showEISDeactivateModal, setShowEISDeactivateModal] = useState(false);
  const [showEISViewModal, setShowEISViewModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [eisFormData, setEisFormData] = useState({
    tenantId: '',
    plan: 'eis-monthly',
    amount: '',
    currency: 'MWK',
    status: 'Active',
    isActive: true,
    expiresAt: '',
    paymentMethod: 'bank',
    notes: ''
  });
  const [deactivateReason, setDeactivateReason] = useState('');
  const [formData, setFormData] = useState({
    tenantId: '',
    plan: '1month',
    amount: '',
    currency: 'MWK',
    status: 'Pending',
    isActive: false,
    isTrial: false,
    trialStartDate: '',
    trialEndDate: '',
    expiresAt: '',
    paymentMethod: '',
    notes: ''
  });
  const [tenants, setTenants] = useState([]);
  const subscriptionsPerPage = 15;
  const [subscriptionPage, setSubscriptionPage] = useState(1);

  useEffect(() => {
    fetchSubscriptions();
    fetchTenants();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await adminFetch('/api/admin/subscriptions');
      
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      } else {
        setError('Failed to fetch subscriptions');
      }
    } catch (error) {
      setError('Network error');
      console.error('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await adminFetch('/api/admin/tenants');
      
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      } else {
        console.error('Failed to fetch tenants');
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchEISSubscriptions = async () => {
    try {
      const params = new URLSearchParams();
      if (eisStatusFilter !== 'all') {
        params.append('status', eisStatusFilter);
      }
      if (eisPlanFilter !== 'all') {
        params.append('planType', eisPlanFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await adminFetch(`/api/admin/eis-subscriptions?${params}`, {
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        setEisSubscriptions(data.subscriptions || []);
        setEisStats(data.stats || {
          total: 0,
          active: 0,
          expired: 0,
          monthly: 0,
          yearly: 0,
          monthlyActive: 0,
          yearlyActive: 0,
          totalRevenue: 0
        });
      } else {
        console.error('Failed to fetch EIS subscriptions');
      }
    } catch (error) {
      console.error('Error fetching EIS subscriptions:', error);
    }
  };

  const handleAddSubscription = async (e) => {
    e.preventDefault();
    
    try {
      const response = await adminFetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setShowAddModal(false);
        resetForm();
        fetchSubscriptions();
        alert('Subscription created successfully!');
      } else {
        alert(`Failed to create subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Create error:', error);
    }
  };

  const handleEditSubscription = async (e) => {
    e.preventDefault();
    
    try {
      const response = await adminFetch(`/api/admin/subscriptions/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: selectedSubscription.id,
          ...formData
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowEditModal(false);
        resetForm();
        fetchSubscriptions();
        alert('Subscription updated successfully!');
      } else {
        alert(`Failed to update subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Update error:', error);
    }
  };

  const handleDeleteSubscription = async () => {
    try {
      console.log('Attempting to delete subscription:', selectedSubscription.id);
      
      const response = await adminFetch(`/api/admin/subscriptions/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId: selectedSubscription.id }),
      });

      console.log('Response status:', response.status);

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.success === false) {
        const message = result?.error || `Server error: ${response.status}`;
        console.error('Delete subscription failed:', message, result);
        alert(typeof message === 'string' ? message : 'Failed to delete subscription');
        return;
      }

      setShowDeleteModal(false);
      setSelectedSubscription(null);
      fetchSubscriptions();
      alert('Subscription deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Network error. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      tenantId: '',
      plan: '1month',
      amount: '',
      currency: 'MWK',
      status: 'Pending',
      isActive: false,
      isTrial: false,
      trialStartDate: '',
      trialEndDate: '',
      expiresAt: '',
      paymentMethod: '',
      notes: ''
    });
  };

  const openEditModal = (subscription) => {
    setSelectedSubscription(subscription);
    setFormData({
      tenantId: subscription.tenantId || '',
      plan: subscription.plan || '1month',
      amount: subscription.amount?.toString() || '',
      currency: subscription.currency || 'MWK',
      status: subscription.status || 'Pending',
      isActive: subscription.isActive || false,
      isTrial: subscription.isTrial || false,
      trialStartDate: subscription.trialStartDate ? new Date(subscription.trialStartDate).toISOString().split('T')[0] : '',
      trialEndDate: subscription.trialEndDate ? new Date(subscription.trialEndDate).toISOString().split('T')[0] : '',
      expiresAt: subscription.expiresAt ? new Date(subscription.expiresAt).toISOString().split('T')[0] : '',
      paymentMethod: subscription.paymentMethod || '',
      notes: subscription.notes || ''
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (subscription) => {
    setSelectedSubscription(subscription);
    setShowDeleteModal(true);
  };

  // EIS Handlers
  const handleActivateEISSubscription = async (e) => {
    e.preventDefault();

    try {
      const response = await adminFetch('/api/admin/eis-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eisFormData),
      });

      const result = await response.json();

      if (result.success) {
        setShowEISActivateModal(false);
        resetEISForm();
        fetchEISSubscriptions();
        alert('EIS Subscription activated successfully!');
      } else {
        alert(`Failed to activate EIS subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Activate EIS error:', error);
    }
  };

  const handleDeactivateEISSubscription = async () => {
    try {
      const response = await adminFetch('/api/admin/eis-subscriptions/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: selectedSubscription?.id,
          deactivateReason
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowEISDeactivateModal(false);
        setSelectedSubscription(null);
        setDeactivateReason('');
        fetchEISSubscriptions();
        alert('EIS Subscription deactivated successfully!');
      } else {
        alert(`Failed to deactivate EIS subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Deactivate EIS error:', error);
    }
  };

  const resetEISForm = () => {
    setEisFormData({
      tenantId: '',
      plan: 'eis-monthly',
      amount: '',
      currency: 'MWK',
      status: 'Active',
      isActive: true,
      expiresAt: '',
      paymentMethod: 'bank',
      notes: ''
    });
  };

  const openEISActivateModal = () => {
    resetEISForm();
    setShowEISActivateModal(true);
  };

  const openEISViewModal = (subscription) => {
    setSelectedSubscription(subscription);
    setShowEISViewModal(true);
  };

  const openEISDeactivateModal = (subscription) => {
    setSelectedSubscription(subscription);
    setDeactivateReason('');
    setShowEISDeactivateModal(true);
  };

  const getPlanDisplayName = (plan) => {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    return planConfig ? planConfig.displayName : plan;
  };

  const filteredSubscriptions = subscriptions.filter(subscription => {
    const matchesSearch = subscription.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.tenant?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.tenant?.subdomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.plan?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const subscriptionTotalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / subscriptionsPerPage));
  const pagedSubscriptions = filteredSubscriptions.slice(
    (subscriptionPage - 1) * subscriptionsPerPage,
    subscriptionPage * subscriptionsPerPage
  );

  const columns = useMemo(() => [
    {
      key: 'tenant',
      header: 'Tenant',
      render: (subscription) => (
        <div>
          <div className="font-medium text-[var(--admin-text)]">
            {subscription.tenant?.name || 'Unknown'}
          </div>
          <div className="text-xs text-[var(--admin-text-muted)]">
            {subscription.tenant?.subdomain || 'No subdomain'}
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (subscription) => getPlanDisplayName(subscription.plan),
    },
    {
      key: 'status',
      header: 'Status',
      render: (subscription) => (
        <AdminStatusBadge tone={statusTone(subscription.status)}>
          {subscription.status}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'isTrial',
      header: 'Trial',
      render: (subscription) => (
        <AdminStatusBadge tone={subscription.isTrial ? 'info' : 'neutral'}>
          {subscription.isTrial ? 'Trial' : 'Paid'}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cellClassName: 'tabular-nums',
      render: (subscription) =>
        `${subscription.currency} ${(subscription.amount || 0).toLocaleString()}`,
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (subscription) =>
        subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'N/A',
    },
    {
      key: 'actions',
      header: 'Actions',
      hideOnMobile: false,
      render: (subscription) => (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => openEditModal(subscription)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-text)]"
            title="Edit subscription"
            aria-label="Edit subscription"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openDeleteModal(subscription)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-danger)] hover:bg-[var(--admin-surface-muted)]"
            title="Delete subscription"
            aria-label="Delete subscription"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], []);

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t('admin-pages.billing.subscriptions.title')}
        description="Manage all system subscriptions, create new ones, and monitor subscription status"
        actions={
          <>
            {SHOW_EIS_SUBSCRIPTION_UI ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('subscriptions')}
                  className={activeTab === 'subscriptions' ? btnPrimary : btnGhost}
                >
                  Subscriptions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('eis')}
                  className={activeTab === 'eis' ? btnPrimary : btnGhost}
                >
                  EIS Subscriptions
                </button>
              </>
            ) : null}
            <button type="button" onClick={fetchSubscriptions} className={btnGhost}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </button>
            {activeTab === 'subscriptions' ? (
              <button type="button" onClick={() => setShowAddModal(true)} className={btnPrimary}>
                <Plus className="h-4 w-4" aria-hidden /> Add Subscription
              </button>
            ) : null}
          </>
        }
      />

      {isLoading ? <AdminLoadingState label="Loading subscriptions" /> : null}
      {!isLoading && error ? (
        <AdminErrorState message={error} onRetry={fetchSubscriptions} />
      ) : null}

      {!isLoading && activeTab === 'subscriptions' && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminSummaryCard label="Total Subscriptions" value={subscriptions.length} icon={CreditCard} />
            <AdminSummaryCard
              label="Active Subscriptions"
              value={subscriptions.filter((s) => s.isActive).length}
              tone="success"
            />
            <AdminSummaryCard
              label="Trial Users"
              value={subscriptions.filter((s) => s.isTrial).length}
            />
            <AdminSummaryCard
              label="Pending"
              value={subscriptions.filter((s) => s.status === 'Pending').length}
              tone="warning"
            />
          </div>

          <AdminFilterBar
            search={searchTerm}
            onSearchChange={(v) => {
              setSearchTerm(v);
              setSubscriptionPage(1);
            }}
            searchPlaceholder="Search by tenant name, email, subdomain, or plan…"
          >
            <AdminField label="Status" htmlFor="sub-status-filter">
              <AdminField.Select
                id="sub-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setSubscriptionPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
              </AdminField.Select>
            </AdminField>
          </AdminFilterBar>

          {!error && pagedSubscriptions.length === 0 ? (
            <AdminEmptyState
              title={subscriptions.length === 0 ? 'No subscriptions found' : 'No subscriptions match your filters'}
              description="Adjust filters or add a new subscription."
              action={
                <button type="button" onClick={() => setShowAddModal(true)} className={btnPrimary}>
                  <Plus className="h-4 w-4" aria-hidden /> Add Subscription
                </button>
              }
            />
          ) : null}

          {!error && pagedSubscriptions.length > 0 ? (
            <>
              <AdminDataTable columns={columns} rows={pagedSubscriptions} rowKey="id" />
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--admin-border)] pt-4 text-sm text-[var(--admin-text-muted)] sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing{' '}
                  <span className="font-medium text-[var(--admin-text)]">
                    {filteredSubscriptions.length === 0
                      ? 0
                      : (subscriptionPage - 1) * subscriptionsPerPage + 1}
                  </span>
                  {' '}to{' '}
                  <span className="font-medium text-[var(--admin-text)]">
                    {Math.min(subscriptionPage * subscriptionsPerPage, filteredSubscriptions.length)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium text-[var(--admin-text)]">{filteredSubscriptions.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSubscriptionPage((prev) => Math.max(1, prev - 1))}
                    className={btnGhost}
                    disabled={subscriptionPage === 1}
                  >
                    Prev
                  </button>
                  <span>
                    Page {subscriptionPage} of {subscriptionTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubscriptionPage((prev) => Math.min(subscriptionTotalPages, prev + 1))}
                    className={btnGhost}
                    disabled={subscriptionPage === subscriptionTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Subscription</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddSubscription} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tenant *
                    </label>
                    <select
                      required
                      value={formData.tenantId}
                      onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select a tenant</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.subdomain})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan *
                    </label>
                    <select
                      required
                      value={formData.plan}
                      onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.displayName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="30000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="MWK">MWK</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Active">Active</option>
                      <option value="Failed">Failed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select payment method</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.trialStartDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, trialStartDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial End Date
                    </label>
                    <input
                      type="date"
                      value={formData.trialEndDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, trialEndDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires At
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isTrial}
                        onChange={(e) => setFormData(prev => ({ ...prev, isTrial: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Trial</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Additional notes about this subscription..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Create Subscription
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {showEditModal && selectedSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Subscription</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleEditSubscription} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Tenant *
                     </label>
                     <select
                       required
                       value={formData.tenantId}
                       onChange={(e) => setFormData(prev => ({ ...prev, tenantId: e.target.value }))}
                       className="w-full border border-gray-300 rounded-md px-3 py-2"
                     >
                       <option value="">Select a tenant</option>
                       {tenants.map((tenant) => (
                         <option key={tenant.id} value={tenant.id}>
                           {tenant.name} ({tenant.subdomain})
                         </option>
                       ))}
                     </select>
                   </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Plan *
                    </label>
                    <select
                      required
                      value={formData.plan}
                      onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      {PUBLIC_SUBSCRIPTION_PLANS.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.displayName}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="30000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="MWK">MWK</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Active">Active</option>
                      <option value="Failed">Failed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select payment method</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.trialStartDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, trialStartDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trial End Date
                    </label>
                    <input
                      type="date"
                      value={formData.trialEndDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, trialEndDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires At
                    </label>
                    <input
                      type="date"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isTrial}
                        onChange={(e) => setFormData(prev => ({ ...prev, isTrial: e.target.checked }))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Trial</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Additional notes about this subscription..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Update Subscription
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Subscription</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete the subscription for{' '}
                <strong>{selectedSubscription.tenant?.name || 'Unknown Tenant'}</strong>?
                This action cannot be undone.
              </p>
              
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSubscription}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EIS Subscriptions Section */}
      {SHOW_EIS_SUBSCRIPTION_UI && activeTab === 'eis' && (
        <div className="space-y-6">
          {/* EIS Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-lg text-white">
              <div className="text-center">
                <p className="text-sm font-medium text-indigo-100">Total EIS</p>
                <p className="text-3xl font-bold">{eisStats.total}</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-lg text-white">
              <div className="text-center">
                <p className="text-sm font-medium text-green-100">Active</p>
                <p className="text-3xl font-bold">{eisStats.active}</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-lg text-white">
              <div className="text-center">
                <p className="text-sm font-medium text-amber-100">Monthly</p>
                <p className="text-3xl font-bold">{eisStats.monthlyActive}</p>
                <p className="text-xs text-amber-100">of {eisStats.monthly} total</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-lg text-white">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-100">Yearly</p>
                <p className="text-3xl font-bold">{eisStats.yearlyActive}</p>
                <p className="text-xs text-blue-100">of {eisStats.yearly} total</p>
              </div>
            </div>
          </div>

          {/* EIS Filters and Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by tenant name, subdomain, TPIN..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      fetchEISSubscriptions();
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={eisStatusFilter}
                  onChange={(e) => {
                    setEisStatusFilter(e.target.value);
                    fetchEISSubscriptions();
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                </select>
                <select
                  value={eisPlanFilter}
                  onChange={(e) => {
                    setEisPlanFilter(e.target.value);
                    fetchEISSubscriptions();
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Plans</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <button
                  onClick={fetchEISSubscriptions}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* EIS Subscriptions Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-medium text-gray-900">EIS Subscriptions</h3>
                <p className="text-sm text-gray-500">MRA Electronic Invoice System subscriptions</p>
              </div>
              <button
                onClick={openEISActivateModal}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Activate EIS
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TPIN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {eisSubscriptions.length > 0 ? (
                    eisSubscriptions.map((subscription) => (
                      <tr key={subscription.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{subscription.tenant?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{subscription.tenant?.subdomain || 'No subdomain'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${subscription.planType === 'monthly' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {subscription.planType === 'monthly' ? 'Monthly' : 'Yearly'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(subscription.status)}`}>
                            {subscription.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{subscription.currency} {(subscription.amount || 0).toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{subscription.tenant?.tpin || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{subscription.startedAt ? new Date(subscription.startedAt).toLocaleDateString() : '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button onClick={() => openEISViewModal(subscription)} className="text-indigo-600 hover:text-indigo-900 p-1" title="View details">
                              <Eye className="h-4 w-4" />
                            </button>
                            {subscription.isActive && (
                              <button onClick={() => openEISDeactivateModal(subscription)} className="text-red-600 hover:text-red-900 p-1" title="Deactivate">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-gray-500">No EIS subscriptions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EIS Activate Modal */}
      {showEISActivateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Activate EIS Subscription</h3>
                <button onClick={() => setShowEISActivateModal(false)} className="text-gray-400 hover:text-gray-600">
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleActivateEISSubscription} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant *</label>
                    <select required value={eisFormData.tenantId} onChange={(e) => setEisFormData(prev => ({ ...prev, tenantId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2">
                      <option value="">Select a tenant</option>
                      {tenants.map((tenant) => (<option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.subdomain})</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                    <select required value={eisFormData.plan} onChange={(e) => setEisFormData(prev => ({ ...prev, plan: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2">
                      <option value="eis-monthly">EIS Monthly (MK150,000/month)</option>
                      <option value="eis-yearly">EIS Yearly (MK950,000/year)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input type="number" value={eisFormData.amount} onChange={(e) => setEisFormData(prev => ({ ...prev, amount: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="150000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                    <select value={eisFormData.paymentMethod} onChange={(e) => setEisFormData(prev => ({ ...prev, paymentMethod: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2">
                      <option value="bank">Bank Transfer</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={eisFormData.notes} onChange={(e) => setEisFormData(prev => ({ ...prev, notes: e.target.value }))} rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Reason for activation..." />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowEISActivateModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Activate EIS</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EIS Deactivate Modal */}
      {showEISDeactivateModal && selectedSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Deactivate EIS Subscription</h3>
              <p className="text-sm text-gray-500 mb-4">Deactivate EIS for <strong>{selectedSubscription.tenant?.name || 'Unknown Tenant'}</strong>?</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Reason (optional)</label>
                <textarea value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="Reason for deactivation..." />
              </div>
              <div className="flex justify-center space-x-3">
                <button onClick={() => setShowEISDeactivateModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                <button onClick={handleDeactivateEISSubscription} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">Deactivate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EIS View Modal */}
      {showEISViewModal && selectedSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">EIS Subscription Details</h3>
                <button onClick={() => setShowEISViewModal(false)} className="text-gray-400 hover:text-gray-600">
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-gray-500">Tenant</p><p className="font-medium">{selectedSubscription.tenant?.name}</p></div>
                  <div><p className="text-sm text-gray-500">Subdomain</p><p className="font-medium">{selectedSubscription.tenant?.subdomain}</p></div>
                  <div><p className="text-sm text-gray-500">TPIN</p><p className="font-medium">{selectedSubscription.tenant?.tpin || '-'}</p></div>
                  <div><p className="text-sm text-gray-500">Plan</p><p className="font-medium">{selectedSubscription.planType === 'monthly' ? 'Monthly' : 'Yearly'}</p></div>
                  <div><p className="text-sm text-gray-500">Status</p><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedSubscription.status)}`}>{selectedSubscription.status}</span></div>
                  <div><p className="text-sm text-gray-500">Amount</p><p className="font-medium">{selectedSubscription.currency} {(selectedSubscription.amount || 0).toLocaleString()}</p></div>
                  <div><p className="text-sm text-gray-500">Started</p><p className="font-medium">{selectedSubscription.startedAt ? new Date(selectedSubscription.startedAt).toLocaleDateString() : '-'}</p></div>
                  <div><p className="text-sm text-gray-500">Expires</p><p className="font-medium">{selectedSubscription.expiresAt ? new Date(selectedSubscription.expiresAt).toLocaleDateString() : 'N/A'}</p></div>
                </div>
                {selectedSubscription.txRef && (<div><p className="text-sm text-gray-500">Transaction Ref</p><p className="font-medium text-xs">{selectedSubscription.txRef}</p></div>)}
              </div>
              <div className="flex justify-end mt-6">
                <button onClick={() => setShowEISViewModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </AdminPageContainer>
  );
}
