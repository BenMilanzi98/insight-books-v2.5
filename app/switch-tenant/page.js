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
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your businesses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search and Add Section */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Business
          </button>
        </div>

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTenants.map((tenant) => (
            <div
              key={tenant.id}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                currentTenantId === tenant.id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      currentTenantId === tenant.id 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">{tenant.name}</h3>
                      <p className="text-sm text-gray-500">Business</p>
                    </div>
                  </div>
                  {currentTenantId === tenant.id && (
                    <div className="flex items-center space-x-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                      <Check className="w-3 h-3" />
                      <span>Active</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleTenantSelect(tenant)}
                    disabled={currentTenantId === tenant.id || isSwitching}
                    className={`flex-1 mr-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentTenantId === tenant.id
                        ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSwitching && currentTenantId !== tenant.id ? 'Switching...' : 'Switch to'}
                  </button>
                  <button
                    onClick={() => {
                      setTenantToDelete(tenant);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete business"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTenants.length === 0 && (
          <div className="text-center py-12">
            <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No businesses found' : 'No businesses yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Get started by creating your first business'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add New Business</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Enter business name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTenant()}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTenant}
                  disabled={!newTenantName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center space-x-3 p-6 border-b">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Business</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{tenantToDelete.name}</span>? 
                This action cannot be undone and will permanently remove all associated data.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTenant}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Business
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
