"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Plus, 
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  ArrowUpDown,
  Eye,
  X,
  ChevronDown,
  ChevronRight
} from "lucide-react";

const TenantManagementPage = () => {
  const router = useRouter();
  const [tenants, setTenants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "ascending"
  });
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddingTenant, setIsAddingTenant] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTenantForView, setSelectedTenantForView] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [newTenant, setNewTenant] = useState({
    name: '',
    subdomain: '',
    businessEmail: '',
    plan: 'pro'
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  // Add click outside to close actions modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isActionMenuOpen) {
        const actionsButton = event.target.closest('button[aria-label="Actions"]');
        const actionsDropdown = event.target.closest('.absolute.right-0.mt-2');
        
        if (!actionsButton && !actionsDropdown) {
          setIsActionMenuOpen(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionMenuOpen]);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/tenants');
      const data = await response.json();
      
      if (data.success) {
        setTenants(data.tenants);
      } else {
        setError(data.error || 'Failed to fetch tenants');
      }
    } catch (error) {
      setError('Failed to fetch tenant data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTenant = async () => {
    if (!newTenant.name.trim()) {
      setError('Please enter a tenant name');
      return;
    }

    try {
      setIsAddingTenant(true);
      setError('');
      
      const url = selectedTenant 
        ? `/api/admin/tenants/${selectedTenant.id}` 
        : '/api/admin/tenants';
      
      const method = selectedTenant ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTenant.name
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowAddModal(false);
        setSelectedTenant(null);
        setNewTenant({ name: '', subdomain: '', businessEmail: '', plan: 'pro' });
        fetchTenants();
      } else {
        setError(data.error || `Failed to ${selectedTenant ? 'update' : 'create'} tenant`);
      }
    } catch (error) {
      setError(`Failed to ${selectedTenant ? 'update' : 'create'} tenant`);
    } finally {
      setIsAddingTenant(false);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/admin/tenants/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tenantId }),
        });

        const data = await response.json();
        
        if (data.success) {
          fetchTenants();
          setIsActionMenuOpen(null);
        } else {
          setError(data.error || 'Failed to delete tenant');
        }
      } catch (error) {
        setError('Failed to delete tenant');
      }
    }
  };

  const handleMore = (tenantId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tenantId)) {
        newSet.delete(tenantId);
      } else {
        newSet.add(tenantId);
      }
      return newSet;
    });
    setIsActionMenuOpen(null);
  };

  const handleTenantRowClick = (tenant) => {
    router.push(`/admin/tenants/${tenant.id}/dashboard`);
  };

  const handleViewTenant = (tenant) => {
    setSelectedTenantForView(tenant);
    setShowViewModal(true);
    setIsActionMenuOpen(null);
  };

  const handleEditTenant = (tenant) => {
    setSelectedTenant(tenant);
    setNewTenant({
      name: tenant.name,
      subdomain: '',
      businessEmail: '',
      plan: 'pro'
    });
    setShowAddModal(true);
    setIsActionMenuOpen(null);
  }; 

  const handleExportTenants = () => {
    const csvContent = [
      ['Tenant Name', 'Subdomain', 'Plan', 'Status', 'Users', 'Date Created', 'Last Updated'],
      ...tenants.map(tenant => [
        tenant.name,
        tenant.subdomain,
        tenant.plan || 'No Plan',
        tenant.subscriptionStatus,
        tenant.userCount,
        new Date(tenant.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : 'Never'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenants-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  // Filter and sort tenants
  const filteredAndSortedTenants = tenants
    .filter(tenant => {
      if (activeFilter === "all") return true;
      if (activeFilter === "subscription_active") return tenant.subscriptionStatus === "active";
      if (activeFilter === "subscription_trial") return tenant.subscriptionStatus === "trial";
      if (activeFilter === "subscription_inactive") return tenant.subscriptionStatus === "inactive";
      if (activeFilter === "subscription_expired") return tenant.subscriptionStatus === "expired";
      return true;
    })
    .filter(tenant => 
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tenant.plan && tenant.plan.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'ascending') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="status-badge active">Active</span>;
      case 'pending':
        return <span className="status-badge pending">Pending</span>;
      case 'suspended':
        return <span className="status-badge suspended">Suspended</span>;
      default:
        return <span className="status-badge inactive">Inactive</span>;
    }
  };

  // Get subscription status badge
  const getSubscriptionStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="subscription-badge active">Active</span>;
      case 'trial':
        return <span className="subscription-badge trial">Trial</span>;
      case 'pending':
        return <span className="subscription-badge pending">Pending</span>;
      case 'expired':
        return <span className="subscription-badge expired">Expired</span>;
      case 'inactive':
        return <span className="subscription-badge inactive">Inactive</span>;
      default:
        return <span className="subscription-badge inactive">Inactive</span>;
    }
  };

  // Get plan badge
  const getPlanBadge = (plan) => {
    if (!plan) {
      return <span className="plan-badge basic">No Plan</span>;
    }
    
    switch (plan.toLowerCase()) {
      case 'pro':
      case '1year':
        return <span className="plan-badge professional">1 Year Plan</span>;
      case '3months':
        return <span className="plan-badge professional">3 Months Plan</span>;
      case '1month':
        return <span className="plan-badge professional">1 Month Plan</span>;
      case 'trial':
        return <span className="plan-badge trial">Trial</span>;
      default:
        return <span className="plan-badge basic">Pro Plan</span>;
    }
  }; 

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="text-red-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading tenants</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <button 
              onClick={fetchTenants}
              className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all tenants and their subscriptions
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => t.subscriptionStatus === 'active').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Trial Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => t.subscriptionStatus === 'trial').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => t.subscriptionStatus === 'inactive').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid Plans</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => t.plan !== 'trial' && t.plan !== 'Trial').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => t.subscriptionStatus === 'expired').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "all"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("subscription_active")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "subscription_active"
                    ? "bg-green-100 text-green-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveFilter("subscription_trial")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "subscription_trial"
                    ? "bg-orange-100 text-orange-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Trial
              </button>
              <button
                onClick={() => setActiveFilter("subscription_inactive")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "subscription_inactive"
                    ? "bg-gray-100 text-gray-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Inactive
              </button>
              <button
                onClick={() => setActiveFilter("subscription_expired")}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeFilter === "subscription_expired"
                    ? "bg-red-100 text-red-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Expired
              </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={fetchTenants}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button 
              onClick={handleExportTenants}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md" 
              title="Export"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Results Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing <span className="font-medium">{filteredAndSortedTenants.length}</span> of <span className="font-medium">{tenants.length}</span> tenants
              {searchTerm && (
                <span> matching "<span className="font-medium">{searchTerm}</span>"</span>
              )}
              {activeFilter !== 'all' && (
                <span> with status "<span className="font-medium">{activeFilter}</span>"</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("name")}>
                  <div className="flex items-center">
                    Tenant
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("plan")}>
                  <div className="flex items-center">
                    Plan
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("subscriptionStatus")}>
                  <div className="flex items-center">
                    Status
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("userCount")}>
                  <div className="flex items-center">
                    Users
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("createdAt")}>
                  <div className="flex items-center">
                    Date Created
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("updatedAt")}>
                  <div className="flex items-center">
                    Last Updated
                    <ArrowUpDown className="ml-1 h-4 w-4" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedTenants.length > 0 ? (
                filteredAndSortedTenants.map((tenant) => (
                  <React.Fragment key={tenant.id}>
                    <tr 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleTenantRowClick(tenant)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {tenant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                            <div className="text-sm text-gray-500">{tenant.subdomain}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPlanBadge(tenant.plan)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSubscriptionStatusBadge(tenant.subscriptionStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tenant.userCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setIsActionMenuOpen(tenant.id)}
                            className="text-gray-400 hover:text-gray-600"
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          
                          {isActionMenuOpen === tenant.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
                              <button
                                onClick={() => handleViewTenant(tenant)}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </button>
                              <button
                                onClick={() => {
                                  handleEditTenant(tenant);
                                  setIsActionMenuOpen(null);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleMore(tenant.id)}
                                className="flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 w-full text-left"
                              >
                                {expandedRows.has(tenant.id) ? (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                    Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="h-4 w-4 mr-2" />
                                    More
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  handleDeleteTenant(tenant.id);
                                  setIsActionMenuOpen(null);
                                }}
                                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Row Content */}
                    {expandedRows.has(tenant.id) && (
                      <tr className="bg-gray-50">
                        <td colSpan="7" className="px-6 py-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Basic Information */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900 text-sm">Basic Information</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Subdomain:</span>
                                    <span className="font-medium">{tenant.subdomain}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Business Email:</span>
                                    <span className="font-medium">{tenant.email || 'Not set'}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Subscription Details */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900 text-sm">Subscription Details</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Plan:</span>
                                    <span>{getPlanBadge(tenant.plan)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Subscription Status:</span>
                                    <span>{getSubscriptionStatusBadge(tenant.subscriptionStatus)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Users:</span>
                                    <span className="font-medium">{tenant.userCount}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Timestamps */}
                              <div className="space-y-3">
                                <h4 className="font-medium text-gray-900 text-sm">Timestamps</h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Created:</span>
                                    <span className="font-medium">
                                      {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Last Updated:</span>
                                    <span className="font-medium">
                                      {tenant.updatedAt ? 
                                        new Date(tenant.updatedAt).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        }) : 
                                        'Never'
                                      }
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Additional Details */}
                            <div className="border-t pt-4">
                              <h4 className="font-medium text-gray-900 text-sm mb-3">Additional Details</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Logo URL:</span>
                                  <span className="font-medium">{tenant.logoUrl || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Primary Color:</span>
                                  <span className="font-medium">{tenant.primaryColor || 'Default'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Secondary Color:</span>
                                  <span className="font-medium">{tenant.secondaryColor || 'Default'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Subscription Ends:</span>
                                  <span className="font-medium">
                                    {tenant.subscriptionEndsAt ? 
                                      new Date(tenant.subscriptionEndsAt).toLocaleDateString() : 
                                      'N/A'
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {searchTerm || activeFilter !== 'all' ? 'No tenants match your filters' : 'No tenants found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredAndSortedTenants.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border border-gray-200 rounded-lg">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredAndSortedTenants.length}</span> of{' '}
                <span className="font-medium">{tenants.length}</span> results
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedTenant ? 'Edit Tenant Name' : 'Add New Tenant'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Name
                  </label>
                  <input
                    type="text"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter tenant name"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedTenant(null);
                    setNewTenant({ name: '', subdomain: '', businessEmail: '', plan: 'pro' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTenant}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                  disabled={isAddingTenant}
                >
                  {isAddingTenant ? (selectedTenant ? 'Updating...' : 'Adding...') : (selectedTenant ? 'Update Tenant' : 'Add Tenant')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Tenant Modal */}
      {showViewModal && selectedTenantForView && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-6 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Tenant Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Basic Information</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.name}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.subdomain}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.email}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      {getStatusBadge(selectedTenantForView.status)}
                    </div>
                  </div>
                </div>
                
                {/* Subscription & Plan Information */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Subscription & Plan</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Plan</label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      {getPlanBadge(selectedTenantForView.plan)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Status</label>
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                      {getSubscriptionStatusBadge(selectedTenantForView.subscriptionStatus)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Count</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.userCount} users
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Created</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {new Date(selectedTenantForView.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  {selectedTenantForView.subscriptionEndsAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Ends</label>
                      <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                        {new Date(selectedTenantForView.subscriptionEndsAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  
                  {selectedTenantForView.trialEndsAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Trial Ends</label>
                      <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                        {new Date(selectedTenantForView.trialEndsAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Additional Details */}
              <div className="mt-6 space-y-4">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Additional Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.logoUrl || 'No logo set'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.primaryColor || 'Default'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                    <p className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm">
                      {selectedTenantForView.secondaryColor || 'Default'}
                    </p>
                  </div>
                </div>
                
                {/* Subscription Status Explanation */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <h5 className="text-sm font-medium text-blue-800 mb-2">Subscription Status Explanation:</h5>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• <strong>Active:</strong> Tenant has an active, paid subscription</li>
                    <li>• <strong>Trial:</strong> Tenant is on a trial period</li>
                    <li>• <strong>Pending:</strong> Payment is pending or being processed</li>
                    <li>• <strong>Expired:</strong> Subscription has expired</li>
                    <li>• <strong>Inactive:</strong> No active subscription found</li>
                  </ul>
                  <p className="text-xs text-blue-600 mt-2">
                    Note: A tenant can be "Active" (status) but have an "Inactive" subscription if they haven't completed payment setup yet.
                  </p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn-primary {
          @apply inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500;
        }
        
        .status-badge {
          @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
        }
        
        .status-badge.active {
          @apply bg-green-100 text-green-800;
        }
        
        .status-badge.pending {
          @apply bg-yellow-100 text-yellow-800;
        }
        
        .status-badge.suspended {
          @apply bg-red-100 text-red-800;
        }
        
        .status-badge.inactive {
          @apply bg-gray-100 text-gray-800;
        }
        
        .plan-badge {
          @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
        }
        
        .plan-badge.professional {
          @apply bg-indigo-100 text-indigo-800;
        }
        
        .plan-badge.basic {
          @apply bg-indigo-100 text-indigo-800;
        }
        
        .plan-badge.trial {
          @apply bg-orange-100 text-orange-800;
        }

        .subscription-badge {
          @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
        }

        .subscription-badge.active {
          @apply bg-green-100 text-green-800;
        }

        .subscription-badge.trial {
          @apply bg-orange-100 text-orange-800;
        }

        .subscription-badge.pending {
          @apply bg-yellow-100 text-yellow-800;
        }

        .subscription-badge.expired {
          @apply bg-red-100 text-red-800;
        }

        .subscription-badge.inactive {
          @apply bg-gray-100 text-gray-800;
        }
      `}</style>
    </div>
  );
};

export default TenantManagementPage; 