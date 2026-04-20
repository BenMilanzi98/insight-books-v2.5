"use client";

import { useState, useEffect } from "react";
import { DollarSign, Calculator, Plus, Eye, TrendingUp, Calendar, User, RefreshCw, Download, Trash2, X, Loader } from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import { formatDate, todayYmdLocal } from "@/lib/dateUtils";
import { usePaymentAccounts } from "@/hooks/usePaymentAccounts";

export default function GratuityManagement() {
  const { paymentAccounts, isLoading: isLoadingPaymentAccounts } = usePaymentAccounts();
  const [gratuityAccounts, setGratuityAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    accrualRate: 5, // Default 5% per month (percentage points)
    notes: ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentDate: todayYmdLocal(),
    paymentMethod: '',
    reference: '',
    notes: ''
  });

  // Set default payment method when accounts load
  useEffect(() => {
    if (paymentAccounts.length > 0 && !paymentData.paymentMethod) {
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      if (defaultAccount) {
        setPaymentData(prev => ({ ...prev, paymentMethod: defaultAccount.id }));
      }
    }
  }, [paymentAccounts]);
  const [notification, setNotification] = useState(null);

  const toPercentPoints = (rate) => {
    const n = Number(rate);
    if (!Number.isFinite(n)) return 0;
    // Backward compat: 0.05 => 5
    if (n > 0 && n <= 1) return n * 100;
    return n;
  };

  useEffect(() => {
    fetchGratuityAccounts();
    fetchEmployees();
  }, []);

  const fetchGratuityAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gratuity');
      if (!response.ok) throw new Error('Failed to fetch gratuity accounts');
      const data = await response.json();
      setGratuityAccounts(data.gratuityAccounts || []);
    } catch (error) {
      console.error('Error fetching gratuity accounts:', error);
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

  const handleCreateOrUpdate = async () => {
    try {
      if (!formData.employeeId) {
        setNotification({ type: 'error', message: 'Please select an employee' });
        return;
      }

      const response = await fetch('/api/gratuity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          accrualRate: parseFloat(formData.accrualRate),
          recalculate: true,
          notes: formData.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create/update gratuity account');
      }

      const data = await response.json();
      setNotification({ type: 'success', message: 'Gratuity account updated successfully' });
      setShowCreateModal(false);
      setFormData({ employeeId: '', accrualRate: 5, notes: '' });
      fetchGratuityAccounts();
    } catch (error) {
      console.error('Error creating/updating gratuity account:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleRecordPayment = async () => {
    try {
      if (!selectedAccount || !paymentData.amount || !paymentData.paymentDate) {
        setNotification({ type: 'error', message: 'Please fill in all required fields' });
        return;
      }

      const response = await fetch('/api/gratuity/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gratuityAccountId: selectedAccount.id,
          amount: parseFloat(paymentData.amount),
          paymentDate: paymentData.paymentDate,
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference,
          notes: paymentData.notes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      setNotification({ type: 'success', message: 'Payment recorded successfully' });
      setShowPaymentModal(false);
      const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      setPaymentData({ amount: '', paymentDate: todayYmdLocal(), paymentMethod: defaultAccount?.id || '', reference: '', notes: '' });
      fetchGratuityAccounts();
    } catch (error) {
      console.error('Error recording payment:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const handleViewDetails = async (account) => {
    try {
      const response = await fetch(`/api/gratuity/${account.id}`);
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setSelectedAccount(data.gratuityAccount);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      setNotification({ type: 'error', message: error.message });
    }
  };

  const totalOutstanding = gratuityAccounts.reduce((sum, acc) => sum + (acc.outstandingAmount || 0), 0);
  const totalAccrued = gratuityAccounts.reduce((sum, acc) => sum + (acc.totalAccrued || 0), 0);
  const totalPaid = gratuityAccounts.reduce((sum, acc) => sum + (acc.totalPaid || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gratuity Management</h1>
        <p className="text-gray-600">Track and manage employee gratuity accruals and payments</p>
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
              <p className="text-sm text-gray-600 mb-1">Total Accrued</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAccrued)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p>
            </div>
            <Calculator className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Create/Update Gratuity Account
        </button>
        <button
          onClick={fetchGratuityAccounts}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {/* Gratuity Accounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accrual Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Accrued</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Calculated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                </tr>
              ) : gratuityAccounts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">No gratuity accounts found</td>
                </tr>
              ) : (
                gratuityAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.employee?.name}</div>
                        <div className="text-sm text-gray-500">{account.employee?.employeeId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {toPercentPoints(account.accrualRate).toFixed(2)}% per month
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatCurrency(account.totalAccrued || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(account.totalPaid || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {formatCurrency(account.outstandingAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {account.lastCalculatedAt ? formatDate(account.lastCalculatedAt) : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(account)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowPaymentModal(true);
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="Record Payment"
                        >
                          <DollarSign size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowClearModal(true);
                          }}
                          className="text-orange-600 hover:text-orange-900"
                          title="Clear Account"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Account"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Update Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Create/Update Gratuity Account</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Accrual Rate (per month, default: 5%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.accrualRate}
                  onChange={(e) => setFormData({ ...formData, accrualRate: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {Number(formData.accrualRate || 0).toFixed(2)}% of gross salary per month
                  {Number(formData.accrualRate || 0) > 0 && (
                    <span className="block mt-1">
                      Example: For 500,000 MWK salary, {(500000 * (Number(formData.accrualRate || 0) / 100)).toLocaleString()} MWK will accumulate each month
                    </span>
                  )}
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
                onClick={handleCreateOrUpdate}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ employeeId: '', accrualRate: 5, notes: '' });
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Record Gratuity Payment</h2>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Employee: <span className="font-medium">{selectedAccount.employee?.name}</span></p>
              <p className="text-sm text-gray-600">Outstanding: <span className="font-medium text-orange-600">{formatCurrency(selectedAccount.outstandingAmount || 0)}</span></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Payment reference number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows="3"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRecordPayment}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Record Payment
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedAccount(null);
                  const defaultAccount = paymentAccounts.find(acc => acc.accountType === 'Cash' && acc.isActive) || paymentAccounts[0];
      setPaymentData({ amount: '', paymentDate: todayYmdLocal(), paymentMethod: defaultAccount?.id || '', reference: '', notes: '' });
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
      {showDetailsModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Gratuity Account Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Employee</p>
                  <p className="font-medium">{selectedAccount.employee?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Employee ID</p>
                  <p className="font-medium">{selectedAccount.employee?.employeeId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Accrual Rate</p>
                  <p className="font-medium">{toPercentPoints(selectedAccount.accrualRate).toFixed(2)}% per month</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Accrued</p>
                  <p className="font-medium text-blue-600">{formatCurrency(selectedAccount.totalAccrued || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Paid</p>
                  <p className="font-medium text-green-600">{formatCurrency(selectedAccount.totalPaid || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding</p>
                  <p className="font-medium text-orange-600">{formatCurrency(selectedAccount.outstandingAmount || 0)}</p>
                </div>
              </div>
              {selectedAccount.payments && selectedAccount.payments.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-3">Payment History</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedAccount.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-2 text-sm">{formatDate(payment.paymentDate)}</td>
                            <td className="px-4 py-2 text-sm font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">{payment.reference || '-'}</td>
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
                setSelectedAccount(null);
              }}
              className="mt-6 w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-red-600">Delete Gratuity Account</h2>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete the gratuity account for <strong>{selectedAccount.employee?.name}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will permanently delete the account and all associated payment records. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/gratuity/${selectedAccount.id}`, {
                      method: 'DELETE'
                    });
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to delete gratuity account');
                    }
                    setNotification({ type: 'success', message: 'Gratuity account deleted successfully' });
                    setShowDeleteModal(false);
                    setSelectedAccount(null);
                    fetchGratuityAccounts();
                  } catch (error) {
                    console.error('Error deleting gratuity account:', error);
                    setNotification({ type: 'error', message: error.message });
                  }
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 text-orange-600">Clear Gratuity Account</h2>
            <div className="mb-4">
              <p className="text-gray-700 mb-2">
                Are you sure you want to clear the gratuity account for <strong>{selectedAccount.employee?.name}</strong>?
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-orange-800 mb-2">
                  <strong>This will:</strong>
                </p>
                <ul className="text-sm text-orange-800 list-disc list-inside space-y-1">
                  <li>Reset total accrued to 0</li>
                  <li>Reset total paid to 0</li>
                  <li>Reset outstanding amount to 0</li>
                  <li>Keep the account and accrual rate unchanged</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/gratuity/${selectedAccount.id}/clear`, {
                      method: 'POST'
                    });
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Failed to clear gratuity account');
                    }
                    setNotification({ type: 'success', message: 'Gratuity account cleared successfully' });
                    setShowClearModal(false);
                    setSelectedAccount(null);
                    fetchGratuityAccounts();
                  } catch (error) {
                    console.error('Error clearing gratuity account:', error);
                    setNotification({ type: 'error', message: error.message });
                  }
                }}
                className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
              >
                Clear Account
              </button>
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setSelectedAccount(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

