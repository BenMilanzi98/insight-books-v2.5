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
  User
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
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

  useEffect(() => {
    fetchSubscriptions();
    fetchTenants();
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

  const getStatusBadge = (status) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Active': 'bg-green-100 text-green-800',
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

  const filteredSubscriptions = subscriptions.filter(subscription => {
    const matchesSearch = subscription.tenant?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.tenant?.subdomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.plan?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all system subscriptions, create new ones, and monitor subscription status
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subscription
        </button>
      </div>

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
                placeholder="Search by tenant name, subdomain, or plan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              {filteredSubscriptions.length > 0 ? (
                filteredSubscriptions.map((subscription) => (
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
      </div>

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
