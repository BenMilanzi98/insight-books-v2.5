"use client";
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Edit2, Trash2, DollarSign, CreditCard, Smartphone, Building2, X, Save, Loader, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const ACCOUNT_TYPES = [
  { value: 'Cash', label: 'Cash', icon: DollarSign },
  { value: 'Bank', label: 'Bank', icon: Building2 },
  { value: 'Mobile Money', label: 'Mobile Money', icon: Smartphone },
  { value: 'Wallet', label: 'Wallet', icon: CreditCard },
  { value: 'POS Terminal', label: 'POS Terminal', icon: CreditCard }
];

function PaymentManagementPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get('onboarding') === '1';
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    accountType: 'Cash',
    reference: '',
    isActive: true
  });

  // Load payment accounts
  const loadPaymentAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Prefer balances endpoint so custom accounts show actual balances
      const response = await fetch('/api/payment-accounts/balances');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPaymentAccounts(data.accounts || []);
          return;
        }
      }

      // Fallback: load accounts without balances
      const fallback = await fetch('/api/payment-accounts');
      if (!fallback.ok) throw new Error('Failed to load payment accounts');
      const fallbackData = await fallback.json();
      if (fallbackData.success) setPaymentAccounts(fallbackData.paymentAccounts || []);
    } catch (err) {
      setError(err.message);
      console.error('Error loading payment accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentAccounts();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = editingAccount 
        ? `/api/payment-accounts/${editingAccount.id}`
        : '/api/payment-accounts';
      
      const method = editingAccount ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save payment account');
      }

      setSuccess(editingAccount ? 'Payment account updated successfully' : 'Payment account created successfully');
      setShowModal(false);
      resetForm();
      loadPaymentAccounts();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (account) => {
    if (!confirm(`Are you sure you want to ${account.isActive ? 'deactivate' : 'delete'} "${account.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/payment-accounts/${account.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete payment account');
      }

      setSuccess(data.message || 'Payment account deleted successfully');
      loadPaymentAccounts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle edit
  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      accountType: account.accountType,
      reference: account.reference || '',
      isActive: account.isActive
    });
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      accountType: 'Cash',
      reference: '',
      isActive: true
    });
    setEditingAccount(null);
  };

  // Open create modal
  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Get account type icon
  const getAccountTypeIcon = (accountType) => {
    const type = ACCOUNT_TYPES.find(t => t.value === accountType);
    return type ? type.icon : DollarSign;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(amount || 0));
  };

  const completePaymentsOnboarding = async () => {
    try {
      setError(null);
      const res = await fetch('/api/tenant/onboarding/complete-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not complete this step');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {onboarding && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm">
            <p className="font-medium">Required setup — payment accounts</p>
            <p className="mt-1 text-amber-900/90">
              Create the payment methods you will use (cash, bank, mobile money, etc.) and link them to your chart of accounts where prompted.
            </p>
            <button
              type="button"
              onClick={completePaymentsOnboarding}
              className="mt-3 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-white text-sm font-medium hover:bg-amber-700"
            >
              I have configured payment accounts — go to dashboard
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/payments')}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Payment Processing
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Accounts Management</h1>
          <p className="text-gray-600">Create and manage payment accounts for your business</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        {/* Actions Bar */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Payment Account
          </button>
        </div>

        {/* Payment Accounts List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        ) : paymentAccounts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment Accounts</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first payment account</p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Payment Account
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentAccounts.map((account) => {
                  const Icon = getAccountTypeIcon(account.accountType);
                  return (
                    <tr key={account.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Icon className="w-5 h-5 text-gray-400 mr-3" />
                          <span className="text-sm font-medium text-gray-900">{account.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{account.accountType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(account.balance || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{account.reference || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          account.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {account.isSystem && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            System
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(account)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={account.isSystem}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(account)}
                            className="text-red-600 hover:text-red-900"
                            disabled={account.isSystem}
                            title={account.isSystem ? 'System accounts cannot be deleted' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingAccount ? 'Edit Payment Account' : 'Create Payment Account'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={editingAccount?.isSystem}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type *
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {ACCOUNT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Account number, wallet ID, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={editingAccount?.isSystem}
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader className="animate-spin w-4 h-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingAccount ? 'Update' : 'Create'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 text-sm">Loading…</div>}>
      <PaymentManagementPageInner />
    </Suspense>
  );
}
