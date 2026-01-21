'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, Check, Building, Plus, Trash2 } from 'lucide-react';

export default function TenantSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  const [newTenantName, setNewTenantName] = useState('');

  useEffect(() => {
    const fetchTenants = async () => {
      const res = await fetch('/api/tenant/list');
      const data = await res.json();
      setTenants(data.tenants);
      setCurrentTenantId(data.currentTenantId);
    };
    fetchTenants();
  }, []);

  const handleTenantSelect = async (tenant) => {
    if (tenant.id === currentTenantId) {
      setIsOpen(false);
      return;
    }
    const res = await fetch('/api/tenant/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id })
    });
    if (res.ok) {
      setCurrentTenantId(tenant.id);
      setIsOpen(false);
      window.location.href = '/dashboard';
    }
  };

  const handleAddTenant = async () => {
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
  };

  const handleDeleteTenant = async () => {
    await fetch('/api/tenant/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenantToDelete.id })
    });
    setTenants(tenants.filter((t) => t.id !== tenantToDelete.id));
    setShowDeleteModal(false);
    if (currentTenantId === tenantToDelete.id) {
      if (tenants.length > 1) {
        const newTenant = tenants.find((t) => t.id !== tenantToDelete.id);
        await handleTenantSelect(newTenant);
      } else {
        setCurrentTenantId(null);
      }
    }
  };

  return (
    <div className="relative inline-block w-72">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded border border-gray-600 px-3 py-2 text-white bg-gray-800 hover:bg-gray-700"
      >
        <div className="flex items-center gap-2">
          <Building size={16} />
          <span className="truncate">
            {tenants.find(t => t.id === currentTenantId)?.name || 'Select Business'}
          </span>
        </div>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full bg-gray-900 border border-gray-700 rounded shadow-sm z-10">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              onClick={() => handleTenantSelect(tenant)}
              className={`flex justify-between items-center px-3 py-2 text-sm cursor-pointer ${
                currentTenantId === tenant.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-200'
              }`}
            >
              <div className="flex gap-2 items-center">
                <Building size={14} />
                <span>{tenant.name}</span>
              </div>
              <div className="flex gap-1 items-center">
                {currentTenantId === tenant.id && <Check size={14} />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTenantToDelete(tenant);
                    setShowDeleteModal(true);
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-gray-800 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Business</span>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-20">
          <div className="bg-gray-900 p-4 rounded w-80 border border-gray-700">
            <h3 className="text-white text-sm mb-2">Add New Business</h3>
            <input
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 text-white p-2 mb-3"
              placeholder="Business Name"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="text-gray-300 hover:text-white text-sm">
                Cancel
              </button>
              <button onClick={handleAddTenant} className="text-blue-400 hover:text-blue-600 text-sm">
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-20">
          <div className="bg-gray-900 p-4 rounded w-80 border border-gray-700">
            <h3 className="text-white text-sm mb-3">Delete <span className="text-red-400">{tenantToDelete?.name}</span>?</h3>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-300 hover:text-white text-sm">
                Cancel
              </button>
              <button onClick={handleDeleteTenant} className="text-red-400 hover:text-red-600 text-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}