"use client";

import { useState, useEffect } from "react";
import { DollarSign, Plus, Eye, Edit, Trash2, Calendar, User, RefreshCw, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { formatDate } from "@/lib/dateUtils";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";

export default function SalaryAdvancesManagement() {
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  // Generate reference number
  const generateReference = (date, employeeId) => {
    const dateStr = date ? new Date(date).toISOString().split('T')[0].replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const employeeSuffix = employeeId ? employeeId.substring(0, 4).toUpperCase() : 'EMP';
    return `SAV-${dateStr}-${employeeSuffix}-${randomSuffix}`;
  };

  const [formData, setFormData] = useState({
    employeeId: '',
    amount: '',
    advanceDate: new Date().toISOString().split('T')[0],
    repaymentMonths: 1,
    reference: generateReference(new Date().toISOString().split('T')[0], ''),
    notes: '',
    paymentMethod: ''
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [notification, setNotification] = useState(null);

  // Set default payment method when accounts load
  useEffect(() => {
    if (paymentAccounts.length > 0 && !formData.paymentMethod) {
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      if (defaultAccount) {
        setFormData(prev => ({ ...prev, paymentMethod: defaultAccount.id }));
      }
    }
  }, [paymentAccounts]);

  // Auto-generate reference when employee or date changes
  useEffect(() => {
    if (showCreateModal) {
      const newReference = generateReference(formData.advanceDate, formData.employeeId);
      setFormData(prev => ({ ...prev, reference: newReference }));
    }
  }, [formData.employeeId, formData.advanceDate, showCreateModal]);

  useEffect(() => {
    fetchAdvances();
    fetchEmployees();
  }, [filterStatus]);

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      const response = await fetch(`/api/salary-advances?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch salary advances');
      const data = await response.json();
      setAdvances(data.advances || []);
    } catch (error) {
      console.error('Error fetching salary advances:', error);
      setNotification({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.employeeId || !formData.amount || !formData.advanceDate) {
        setNotification({ type: 'error', message: 'Please fill in all required fields' });
        return;
      }

      const response = await fetch('/api/salary-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          amount: parseFloat(formData.amount),
          advanceDate: formData.advanceDate,
          repaymentMonths: parseInt(formData.repaymentMonths) || 1,
          reference: formData.reference,
          notes: formData.notes,
          paymentMethod: formData.paymentMethod
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create salary advance');
      }

      setNotification({ type: 'success', message: 'Salary advance created successfully' });
      setShowCreateModal(false);
      const newDate = new Date().toISOString().split('T')[0];
      setFormData({
        employeeId: '',
        amount: '',
        advanceDate: newDate,
        repaymentMonths: 1,
        reference: generateReference(newDate, ''),
        notes: '',
        paymentMethod: 'Cash'
      });
      fetchAdvances();
    } catch (error) {
      console.error('Error creating salary advance:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleUpdate = async () => {
    try {
      if (!selectedAdvance) return;

      const response = await fetch(`/api/salary-advances/${selectedAdvance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          notes: formData.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update salary advance');
      }

      setNotification({ type: 'success', message: 'Salary advance updated successfully' });
      setShowEditModal(false);
      setSelectedAdvance(null);
      fetchAdvances();
    } catch (error) {
      console.error('Error updating salary advance:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleDelete = async () => {
    try {
      if (!selectedAdvance) return;

      const response = await fetch(`/api/salary-advances/${selectedAdvance.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete salary advance');
      }

      setNotification({ type: 'success', message: 'Salary advance deleted successfully' });
      setShowDeleteModal(false);
      setSelectedAdvance(null);
      fetchAdvances();
    } catch (error) {
      console.error('Error deleting salary advance:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleViewDetails = async (advance) => {
    try {
      const response = await fetch(`/api/salary-advances/${advance.id}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setSelectedAdvance(data.advance);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleEdit = (advance) => {
    setSelectedAdvance(advance);
    setFormData({
      employeeId: advance.employeeId,
      amount: advance.amount,
      advanceDate: new Date(advance.advanceDate).toISOString().split('T')[0],
      repaymentMonths: advance.repaymentMonths,
      reference: advance.reference || '',
      notes: advance.notes || '',
      status: advance.status
    });
    setShowEditModal(true);
  };

  const totalActive = advances.filter(a => a.status === 'Active').reduce((sum, a) => sum + (a.outstandingAmount || 0), 0);
  const totalCompleted = advances.filter(a => a.status === 'Completed').length;
  const totalActiveCount = advances.filter(a => a.status === 'Active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Salary Advances Management</h1>
        <p className="text-gray-600">Manage employee salary advances and track repayments</p>
      </div>

      {notification && (
        <div className={`mb-4 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Advances</p>
              <p className="text-2xl font-bold text-blue-600">{totalActiveCount}</p>
              <p className="text-sm text-gray-500 mt-1">{formatCurrency(totalActive)} outstanding</p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalActive)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{totalCompleted}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Actions and Filters */}
      <div className="mb-6 flex gap-3 items-center">
        <button
          onClick={() => {
            const newDate = new Date().toISOString().split('T')[0];
            setFormData(prev => ({
              ...prev,
              advanceDate: newDate,
              reference: generateReference(newDate, prev.employeeId || '')
            }));
            setShowCreateModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          New Salary Advance
        </button>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <button
          onClick={fetchAdvances}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {/* Advances Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Deduction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Deducted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : advances.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">No salary advances found</td>
                </tr>
              ) : (
                advances.map((advance) => (
                  <tr key={advance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{advance.employee?.name}</div>
                        <div className="text-sm text-gray-500">{advance.employee?.employeeId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(advance.advanceDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatCurrency(advance.amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(advance.monthlyDeduction || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(advance.totalDeducted || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-orange-600">
                        {formatCurrency(advance.outstandingAmount || 0)}
                      </div>
                      {advance.amount > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round((advance.totalDeducted || 0) / advance.amount * 100)}% repaid
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        advance.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                        advance.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {advance.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(advance)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {advance.status === 'Active' && advance.totalDeducted === 0 && (
                          <>
                            <button
                              onClick={() => handleEdit(advance)}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAdvance(advance);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Salary Advance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId || emp.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Date *</label>
                <input
                  type="date"
                  value={formData.advanceDate}
                  onChange={(e) => setFormData({ ...formData, advanceDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  disabled={isLoadingPaymentAccounts}
                >
                  <option value="">{isLoadingPaymentAccounts ? 'Loading accounts...' : 'Select an account'}</option>
                  {paymentAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} {account.accountType ? `(${account.accountType})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  This will create an expense entry in your accounting records
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Period (Months)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.repaymentMonths}
                  onChange={(e) => {
                    const months = parseInt(e.target.value) || 1;
                    setFormData({ ...formData, repaymentMonths: months });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                {formData.amount && formData.repaymentMonths && (
                  <p className="text-xs text-gray-500 mt-1">
                    Monthly deduction: {formatCurrency(parseFloat(formData.amount) / formData.repaymentMonths)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={formData.reference}
                  readOnly
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 cursor-not-allowed"
                  placeholder="Auto-generated reference"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Reference number is automatically generated
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Advance
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  const newDate = new Date().toISOString().split('T')[0];
                  setFormData({
                    employeeId: '',
                    amount: '',
                    advanceDate: newDate,
                    repaymentMonths: 1,
                    reference: generateReference(newDate, ''),
                    notes: '',
                    paymentMethod: 'Cash'
                  });
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAdvance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Edit Salary Advance</h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Employee: <span className="font-medium">{selectedAdvance.employee?.name}</span></p>
                <p className="text-sm text-gray-600">Amount: <span className="font-medium">{formatCurrency(selectedAdvance.amount)}</span></p>
                {selectedAdvance.totalDeducted > 0 && (
                  <p className="text-xs text-orange-600 mt-2">⚠️ Cannot modify amount after deductions have been made</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Update
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedAdvance(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAdvance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Delete Salary Advance</h2>
            <p className="mb-4 text-gray-600">
              Are you sure you want to delete this salary advance? This action cannot be undone.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg mb-4">
              <p className="text-sm"><strong>Employee:</strong> {selectedAdvance.employee?.name}</p>
              <p className="text-sm"><strong>Amount:</strong> {formatCurrency(selectedAdvance.amount)}</p>
              <p className="text-sm"><strong>Outstanding:</strong> {formatCurrency(selectedAdvance.outstandingAmount)}</p>
            </div>
            {selectedAdvance.totalDeducted > 0 && (
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Cannot delete advance with existing deductions. Mark as cancelled instead.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={selectedAdvance.totalDeducted > 0}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  selectedAdvance.totalDeducted > 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAdvance(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedAdvance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Salary Advance Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Employee</p>
                  <p className="font-medium">{selectedAdvance.employee?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Employee ID</p>
                  <p className="font-medium">{selectedAdvance.employee?.employeeId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Advance Amount</p>
                  <p className="font-medium text-blue-600">{formatCurrency(selectedAdvance.amount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Advance Date</p>
                  <p className="font-medium">{formatDate(selectedAdvance.advanceDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Repayment Period</p>
                  <p className="font-medium">{selectedAdvance.repaymentMonths} months</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monthly Deduction</p>
                  <p className="font-medium">{formatCurrency(selectedAdvance.monthlyDeduction || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Deducted</p>
                  <p className="font-medium text-green-600">{formatCurrency(selectedAdvance.totalDeducted || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="font-medium text-orange-600">{formatCurrency(selectedAdvance.outstandingAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    selectedAdvance.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                    selectedAdvance.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedAdvance.status}
                  </span>
                </div>
                {selectedAdvance.reference && (
                  <div>
                    <p className="text-sm text-gray-600">Reference</p>
                    <p className="font-medium">{selectedAdvance.reference}</p>
                  </div>
                )}
              </div>
              
              {/* Repayment Progress */}
              {selectedAdvance.amount > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Repayment Progress</p>
                    <p className="text-sm text-gray-600">
                      {Math.round((selectedAdvance.totalDeducted || 0) / selectedAdvance.amount * 100)}% Complete
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ((selectedAdvance.totalDeducted || 0) / selectedAdvance.amount) * 100)}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Deducted: {formatCurrency(selectedAdvance.totalDeducted || 0)}</span>
                    <span>Remaining: {formatCurrency(selectedAdvance.outstandingAmount || 0)}</span>
                  </div>
                </div>
              )}
              
              {/* Deduction History */}
              {selectedAdvance.deductions && selectedAdvance.deductions.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Deduction History</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Payroll Period</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedAdvance.deductions.map((deduction, index) => (
                          <tr key={deduction.id || index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatDate(deduction.deductionDate)}
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-green-600">
                              {formatCurrency(deduction.amount || 0)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {deduction.payrollId ? `Payroll: ${deduction.payrollId.substring(0, 8)}...` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setShowDetailsModal(false);
                setSelectedAdvance(null);
              }}
              className="mt-6 w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

