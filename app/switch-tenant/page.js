"use client";
import { useState, useEffect } from 'react';
import { 
  Building, 
  Plus, 
  Trash2, 
  Check, 
  ArrowRight, 
  Search,
  X,
  AlertTriangle,
  Clock,
  Crown,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import PermissionGuard from '@/components/PermissionGuard';

export default function SwitchTenantPage() {
  const [tenants, setTenants] = useState([]);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [newTenantName, setNewTenantName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await fetch('/api/tenant/list');
        const data = await res.json();
        setTenants(data.tenants || []);
        setCurrentTenantId(data.currentTenantId);
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const handleTenantSelect = async (tenant) => {
    if (tenant.id === currentTenantId || isSwitching) return;
    
    setIsSwitching(true);
    try {
      const res = await fetch('/api/tenant/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id })
      });
      
      if (res.ok) {
        setCurrentTenantId(tenant.id);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleAddTenant = async () => {
    if (!newTenantName.trim()) return;
    
    try {
      const res = await fetch('/api/tenant/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTenantName })
      });
      const data = await res.json();
      
      if (res.ok) {
        setTenants([...tenants, data.tenant]);
        setShowAddModal(false);
        setNewTenantName('');
      }
    } catch (error) {
      console.error('Error adding tenant:', error);
    }
  };

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return;
    
    try {
      await fetch('/api/tenant/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenantToDelete.id })
      });
      
      setTenants(tenants.filter((t) => t.id !== tenantToDelete.id));
      setShowDeleteModal(false);
      
      if (currentTenantId === tenantToDelete.id && tenants.length > 1) {
        const newTenant = tenants.find((t) => t.id !== tenantToDelete.id);
        if (newTenant) {
          await handleTenantSelect(newTenant);
        }
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
    }
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your businesses...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="system.switchTenant">
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Your Businesses</h1>
          <p className="text-gray-600 text-sm sm:text-base">Switch between your businesses or create a new one</p>
        </div>

        {/* Search and Add Section */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base font-medium"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Add New Business
          </button>
        </div>

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredTenants.map((tenant) => {
            const subscription = tenant.subscription || {};
            const isExpired = subscription.isExpired;
            const daysRemaining = subscription.daysRemaining || 0;
            const isTrial = subscription.isTrial;

            return (
              <div
                key={tenant.id}
                className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  currentTenantId === tenant.id 
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-blue-300'
                } ${isExpired ? 'opacity-90' : ''}`}
              >
                <div className="p-5 sm:p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`p-2.5 sm:p-3 rounded-lg flex-shrink-0 ${
                        currentTenantId === tenant.id 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Building className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate text-base sm:text-lg">{tenant.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-500">Business</p>
                      </div>
                    </div>
                    {currentTenantId === tenant.id && (
                      <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2">
                        <Check className="w-3 h-3" />
                        <span className="hidden sm:inline">Active</span>
                      </div>
                    )}
                  </div>

                  {/* Subscription Status */}
                  <div className={`mb-4 p-3 rounded-lg border ${
                    isExpired 
                      ? 'bg-red-50 border-red-200' 
                      : daysRemaining <= 7 
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {isExpired ? (
                          <>
                            <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${
                              isExpired ? 'text-red-600' : 'text-amber-600'
                            }`} />
                            <span className={`text-xs sm:text-sm font-medium ${
                              isExpired ? 'text-red-700' : 'text-amber-700'
                            }`}>
                              Expired
                            </span>
                          </>
                        ) : (
                          <>
                            {isTrial ? (
                              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                            ) : (
                              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                            )}
                            <span className={`text-xs sm:text-sm font-medium ${
                              daysRemaining <= 7 ? 'text-amber-700' : 'text-green-700'
                            }`}>
                              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                            </span>
                          </>
                        )}
                      </div>
                      {isTrial && !isExpired && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                          Trial
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleTenantSelect(tenant)}
                      disabled={currentTenantId === tenant.id || isSwitching}
                      className={`flex-1 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        currentTenantId === tenant.id
                          ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                      }`}
                    >
                      {isSwitching && currentTenantId !== tenant.id ? (
                        <span className="flex items-center justify-center">
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                          Switching...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          {currentTenantId === tenant.id ? 'Current' : 'Switch to'}
                          {currentTenantId !== tenant.id && <ArrowRight className="w-4 h-4 ml-1" />}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setTenantToDelete(tenant);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Delete business"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredTenants.length === 0 && (
          <div className="text-center py-12 sm:py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-full mb-6">
              <Building className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No businesses found' : 'No businesses yet'}
            </h3>
            <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base max-w-md mx-auto">
              {searchTerm 
                ? 'Try adjusting your search terms to find what you\'re looking for' 
                : 'Get started by creating your first business to manage your operations'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base font-medium"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Business
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Business Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Add New Business</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Enter business name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTenant()}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-gray-700 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50 text-sm sm:text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTenant}
                  disabled={!newTenantName.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base font-medium"
                >
                  Create Business
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && tenantToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center space-x-3 p-5 sm:p-6 border-b border-gray-200">
              <div className="p-2.5 bg-red-100 rounded-lg flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Delete Business</h3>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-gray-600 mb-5 sm:mb-6 text-sm sm:text-base leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{tenantToDelete.name}</span>? 
                This action cannot be undone and will permanently remove all associated data.
              </p>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2.5 text-gray-700 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50 text-sm sm:text-base font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTenant}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base font-medium"
                >
                  Delete Business
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
