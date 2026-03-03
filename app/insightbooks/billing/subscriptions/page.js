"use client";
import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  Filter, 
  RefreshCw,
  Calendar,
  DollarSign,
  Building,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  FileText,
  CreditCard,
  X
} from 'lucide-react';
import { SUBSCRIPTION_PLANS, EIS_PLANS } from '@/lib/subscriptionConfig';

export default function AdminSubscriptions() {
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
  const [branchSubscriptions, setBranchSubscriptions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [showBranchActivateModal, setShowBranchActivateModal] = useState(false);
  const [showBranchDeactivateModal, setShowBranchDeactivateModal] = useState(false);
  const [selectedBranchSubscription, setSelectedBranchSubscription] = useState(null);
  const [branchFormData, setBranchFormData] = useState({
    tenantId: '',
    branchId: '',
    durationDays: 30,
    amount: '0',
    currency: 'MWK',
    notes: ''
  });
  const subscriptionsPerPage = 15;
  const branchesPerPage = 15;
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [branchPage, setBranchPage] = useState(1);

  useEffect(() => {
    fetchSubscriptions();
    fetchTenants();
    fetchBranchSubscriptions();
    fetchAllBranches();
    fetchEISSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/subscriptions');
      
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
      const response = await fetch('/api/admin/tenants');
      
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

  const fetchBranchSubscriptions = async () => {
    try {
      const response = await fetch('/api/admin/branch-subscriptions', {
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        setBranchSubscriptions(data.branchSubscriptions || []);
      } else {
        console.error('Failed to fetch branch subscriptions');
      }
    } catch (error) {
      console.error('Error fetching branch subscriptions:', error);
    }
  };

  const fetchAllBranches = async () => {
    try {
      const response = await fetch('/api/admin/branches', {
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        setAllBranches(data.branches || []);
      } else {
        console.error('Failed to fetch branches');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
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

      const response = await fetch(`/api/admin/eis-subscriptions?${params}`, {
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

  const fetchBranchesForTenant = async (tenantId) => {
    if (!tenantId) {
      setBranches([]);
      return;
    }

    try {
      const response = await fetch(`/api/admin/branches?tenantId=${tenantId}`, {
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      } else {
        console.error('Failed to fetch branches');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleActivateBranchSubscription = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/branch-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(branchFormData),
      });

      const result = await response.json();

      if (result.success) {
        setShowBranchActivateModal(false);
        resetBranchForm();
        fetchBranchSubscriptions();
        alert('Branch subscription activated successfully!');
      } else {
        alert(`Failed to activate branch subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Activate branch error:', error);
    }
  };

  const handleDeactivateBranchSubscription = async () => {
    try {
      const response = await fetch('/api/admin/branch-subscriptions/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: selectedBranchSubscription?.id
        }),
      });

      const result = await response.json();

      if (result.success) {
        setShowBranchDeactivateModal(false);
        setSelectedBranchSubscription(null);
        fetchBranchSubscriptions();
        alert('Branch subscription deactivated.');
      } else {
        alert(`Failed to deactivate branch subscription: ${result.error}`);
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Deactivate branch error:', error);
    }
  };

  const handleAddSubscription = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/subscriptions', {
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
      const response = await fetch(`/api/admin/subscriptions/update`, {
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
      
      const response = await fetch(`/api/admin/subscriptions/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId: selectedSubscription.id }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not ok. Status:', response.status, 'Body:', errorText);
        alert(`Server error: ${response.status} - ${errorText}`);
        return;
      }

      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Response that failed to parse:', responseText);
        alert('Invalid response from server. Check console for details.');
        return;
      }

      console.log('Parsed result:', result);

      if (result.success) {
        setShowDeleteModal(false);
        setSelectedSubscription(null);
        fetchSubscriptions();
        alert('Subscription deleted successfully!');
      } else {
        alert(`Failed to delete subscription: ${result.error}`);
      }
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

  const resetBranchForm = () => {
    setBranchFormData({
      tenantId: '',
      branchId: '',
      durationDays: 30,
      amount: '0',
      currency: 'MWK',
      notes: ''
    });
    setBranches([]);
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

  const openBranchDeactivateModal = (subscription) => {
    setSelectedBranchSubscription(subscription);
    setShowBranchDeactivateModal(true);
  };

  const openBranchActivateModal = (row) => {
    if (row) {
      const tenantId = row.tenantId || row?.tenant?.id || '';
      const branchId = row.branchId || row?.branch?.id || '';
      setBranchFormData({
        tenantId,
        branchId,
        durationDays: 30,
        amount: row.amount?.toString() || row?.subscription?.amount?.toString() || '0',
        currency: row.currency || row?.subscription?.currency || 'MWK',
        notes: ''
      });
      if (tenantId) {
        fetchBranchesForTenant(tenantId);
      }
    } else {
      resetBranchForm();
    }

    setShowBranchActivateModal(true);
  };

  // EIS Handlers
  const handleActivateEISSubscription = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/eis-subscriptions', {
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
      const response = await fetch('/api/admin/eis-subscriptions/deactivate', {
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

  const getStatusBadge = (status) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
      'Trial': 'bg-blue-100 text-blue-800',
      'Failed': 'bg-red-100 text-red-800',
      'Cancelled': 'bg-gray-100 text-gray-800',
      'Expired': 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTrialBadge = (isTrial) => {
    return isTrial 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-gray-100 text-gray-800';
  };

  const getPlanDisplayName = (plan) => {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    return planConfig ? planConfig.displayName : plan;
  };

  const getBranchDurationLabel = (subscription) => {
    if (!subscription?.startedAt || !subscription?.expiresAt) {
      return 'N/A';
    }

    const start = new Date(subscription.startedAt);
    const end = new Date(subscription.expiresAt);
    const diffMs = end.getTime() - start.getTime();
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return 'N/A';
    }

    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  };

  const filteredSubscriptions = subscriptions.filter(subscription => {
    const matchesSearch = subscription.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.tenant?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.tenant?.subdomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.plan?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const branchSubscriptionLookup = new Map();
  branchSubscriptions.forEach((subscription) => {
    if (!branchSubscriptionLookup.has(subscription.branchId)) {
      branchSubscriptionLookup.set(subscription.branchId, subscription);
    }
  });

  const branchRows = allBranches.length > 0
    ? allBranches.map((branch) => {
        const subscription = branchSubscriptionLookup.get(branch.id) || null;
        return {
          branch,
          subscription,
          tenant: subscription?.tenant || branch.tenant,
          tenantId: subscription?.tenantId || branch.tenantId,
          branchId: branch.id,
          amount: subscription?.amount,
          currency: subscription?.currency
        };
      })
    : branchSubscriptions.map((subscription) => ({
        branch: subscription.branch,
        subscription,
        tenant: subscription.tenant,
        tenantId: subscription.tenantId,
        branchId: subscription.branchId,
        amount: subscription.amount,
        currency: subscription.currency
      }));

  const branchSearch = searchTerm.toLowerCase();
  const filteredBranchRows = branchRows.filter((row) => {
    if (!branchSearch) return true;
    return (
      row.branch?.name?.toLowerCase().includes(branchSearch) ||
      row.tenant?.name?.toLowerCase().includes(branchSearch) ||
      row.tenant?.email?.toLowerCase().includes(branchSearch) ||
      row.tenant?.subdomain?.toLowerCase().includes(branchSearch)
    );
  });

  const subscriptionTotalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / subscriptionsPerPage));
  const branchTotalPages = Math.max(1, Math.ceil(filteredBranchRows.length / branchesPerPage));
  const pagedSubscriptions = filteredSubscriptions.slice(
    (subscriptionPage - 1) * subscriptionsPerPage,
    subscriptionPage * subscriptionsPerPage
  );
  const pagedBranchRows = filteredBranchRows.slice(
    (branchPage - 1) * branchesPerPage,
    branchPage * branchesPerPage
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all system subscriptions, create new ones, and monitor subscription status
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'subscriptions'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('eis')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'eis'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            EIS Subscriptions
          </button>
          {activeTab === 'subscriptions' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Subscription
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'subscriptions' && (
        <>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Total Subscriptions</p>
            <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
            <p className="text-2xl font-bold text-green-600">
              {subscriptions.filter(s => s.isActive).length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Trial Users</p>
            <p className="text-2xl font-bold text-blue-600">
              {subscriptions.filter(s => s.isTrial).length}
            </p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {subscriptions.filter(s => s.status === 'Pending').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by tenant name, email, subdomain, or plan..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSubscriptionPage(1);
                  setBranchPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Active">Active</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
            </select>
            <button
              onClick={fetchSubscriptions}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Subscriptions</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedSubscriptions.length > 0 ? (
                pagedSubscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.tenant?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {subscription.tenant?.subdomain || 'No subdomain'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getPlanDisplayName(subscription.plan)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(subscription.status)}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTrialBadge(subscription.isTrial)}`}>
                        {subscription.isTrial ? 'Trial' : 'Paid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {subscription.currency} {(subscription.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(subscription)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Edit subscription"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(subscription)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete subscription"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {subscriptions.length === 0 ? 'No subscriptions found' : 'No subscriptions match your filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>
            Showing {(subscriptionPage - 1) * subscriptionsPerPage + 1}
            {' '}to{' '}
            {Math.min(subscriptionPage * subscriptionsPerPage, filteredSubscriptions.length)} of{' '}
            {filteredSubscriptions.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSubscriptionPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              disabled={subscriptionPage === 1}
            >
              Prev
            </button>
            <span>
              Page {subscriptionPage} of {subscriptionTotalPages}
            </span>
            <button
              onClick={() => setSubscriptionPage((prev) => Math.min(subscriptionTotalPages, prev + 1))}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              disabled={subscriptionPage === subscriptionTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Branch Subscriptions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Branch Subscriptions</h3>
            <p className="text-sm text-gray-500">Activate branches for a specific duration.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchBranchSubscriptions();
                fetchAllBranches();
              }}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Refresh branch subscriptions"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => openBranchActivateModal()}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Activate Branch
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedBranchRows.length > 0 ? (
                pagedBranchRows.map((row) => (
                  <tr
                    key={row.branch?.id || row.subscription?.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => openBranchActivateModal(row)}
                    title="Click to activate or extend this branch"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {row.tenant?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {row.tenant?.subdomain || 'No subdomain'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {row.branch?.name || row.subscription?.branch?.name || 'Unknown Branch'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(row.subscription?.status || 'Pending')}`}>
                        {row.subscription?.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {row.subscription ? getBranchDurationLabel(row.subscription) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {row.subscription?.currency || row.currency || 'MWK'} {(row.subscription?.amount || row.amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {row.subscription?.expiresAt ? new Date(row.subscription.expiresAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.branch?.isActive || row.subscription?.branch?.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {row.branch?.isActive || row.subscription?.branch?.isActive ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          if (row.subscription) {
                            openBranchDeactivateModal(row.subscription);
                          }
                        }}
                        className={`p-1 ${row.subscription?.isActive ? 'text-red-600 hover:text-red-900' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Deactivate branch subscription"
                        disabled={!row.subscription?.isActive}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No branches found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
          <div>
            Showing {(branchPage - 1) * branchesPerPage + 1}
            {' '}to{' '}
            {Math.min(branchPage * branchesPerPage, filteredBranchRows.length)} of{' '}
            {filteredBranchRows.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBranchPage((prev) => Math.max(1, prev - 1))}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              disabled={branchPage === 1}
            >
              Prev
            </button>
            <span>
              Page {branchPage} of {branchTotalPages}
            </span>
            <button
              onClick={() => setBranchPage((prev) => Math.min(branchTotalPages, prev + 1))}
              className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              disabled={branchPage === branchTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Activate Branch Subscription Modal */}
      {showBranchActivateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Activate Branch Subscription</h3>
                <button
                  onClick={() => setShowBranchActivateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <AlertCircle className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleActivateBranchSubscription} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tenant *
                    </label>
                    <select
                      required
                      value={branchFormData.tenantId}
                      onChange={(e) => {
                        const tenantId = e.target.value;
                        setBranchFormData(prev => ({ ...prev, tenantId, branchId: '' }));
                        fetchBranchesForTenant(tenantId);
                      }}
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
                      Branch *
                    </label>
                    <select
                      required
                      value={branchFormData.branchId}
                      onChange={(e) => setBranchFormData(prev => ({ ...prev, branchId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      disabled={!branchFormData.tenantId}
                    >
                      <option value="">Select a branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} {branch.isActive ? '(active)' : '(inactive)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (days) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={branchFormData.durationDays}
                      onChange={(e) => setBranchFormData(prev => ({ ...prev, durationDays: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={branchFormData.amount}
                      onChange={(e) => setBranchFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={branchFormData.currency}
                      onChange={(e) => setBranchFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="MWK">MWK</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={branchFormData.notes}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Reason or context for this activation..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBranchActivateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Activate Branch
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Branch Subscription Modal */}
      {showBranchDeactivateModal && selectedBranchSubscription && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Deactivate Branch Subscription</h3>
              <p className="text-sm text-gray-500 mb-6">
                Deactivate subscription for{' '}
                <strong>{selectedBranchSubscription.branch?.name || 'Unknown Branch'}</strong>?
                This will deactivate the branch if no other active subscription exists.
              </p>

              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => setShowBranchDeactivateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateBranchSubscription}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        </div>
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
                      {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                        <option key={key} value={key}>{plan.displayName}</option>
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
                      {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                        <option key={key} value={key}>{plan.displayName}</option>
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

      </>
      )}

      {/* EIS Subscriptions Section */}
      {activeTab === 'eis' && (
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
