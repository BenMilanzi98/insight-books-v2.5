"use client";
import { useState, useEffect } from "react";
import { AlertCircle, Check, DollarSign, ArrowRightLeft, TrendingUp, Wallet, Clock, ArrowUpRight, ArrowDownRight, Edit, Trash2, Save, X } from "lucide-react";
import { paymentMethods } from "@/lib/paymentMethods";

const CapitalAccountManager = () => {
  const [capitalAccount, setCapitalAccount] = useState(null);
  const [paymentMethodBalances, setPaymentMethodBalances] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [editData, setEditData] = useState({
    name: "",
    code: "",
    isActive: true
  });
  const [transferData, setTransferData] = useState({
    amount: "",
    destinationAccount: "",
    description: "",
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch capital account and payment method balances
  useEffect(() => {
    fetchData();
    
    // Check if we should show transfer modal from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showTransferModal') === 'true') {
      setShowTransferModal(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch capital account data
      const capitalResponse = await fetch('/api/capital-account');
      if (capitalResponse.ok) {
        const capitalData = await capitalResponse.json();
        setCapitalAccount(capitalData.capitalAccount);
        setRecentTransfers(capitalData.recentTransfers || []);
        setBalanceHistory(capitalData.balanceHistory || []);
        
        // Initialize edit data
        setEditData({
          name: capitalData.capitalAccount.name,
          code: capitalData.capitalAccount.code,
          isActive: capitalData.capitalAccount.isActive
        });
      }

      // Fetch payment method balances (same as PaymentModal)
      const balancesResponse = await fetch('/api/payments/account-balances');
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        setPaymentMethodBalances(balancesData.balances || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  const getBalance = (key) => paymentMethodBalances.find((b) => b.account === key)?.balance ?? 0;

  const handleSetInitialBalance = async () => {
    if (!initialBalance || parseFloat(initialBalance) <= 0) {
      setError('Please enter a valid initial balance');
      return;
    }

    try {
      setError(null); // Clear any previous errors
      
      const response = await fetch('/api/capital-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalance })
      });

      if (response.ok) {
        setShowInitialBalanceModal(false);
        setInitialBalance("");
        fetchData(); // Refresh data
        setError(null);
      } else {
        const errorData = await response.json();
        // Provide more user-friendly error messages
        let errorMessage = errorData.error || 'Failed to set initial balance';
        
        if (errorMessage.includes('cash account')) {
          errorMessage = 'Unable to find a suitable cash account. The system will create one automatically. Please try again.';
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error setting initial balance:', error);
      setError(error.message);
    }
  };

  const handleEditAccount = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/capital-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        setShowEditModal(false);
        fetchData(); // Refresh data
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update capital account');
      }
    } catch (error) {
      console.error('Error updating capital account:', error);
      setError(error.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/capital-account', {
        method: 'DELETE'
      });

      if (response.ok) {
        setShowDeleteConfirm(false);
        // Redirect to chart of accounts since capital account is deleted
        window.location.href = '/chart-of-accounts';
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete capital account');
      }
    } catch (error) {
      console.error('Error deleting capital account:', error);
      setError(error.message);
    }
  };

  const handleTransfer = async () => {
    if (!transferData.amount || !transferData.destinationAccount) {
      setError('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(transferData.amount);
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > (capitalAccount?.balance || 0)) {
      setError('Insufficient capital balance. You can only transfer up to the current balance.');
      return;
    }

    // Additional check: if balance is already 0 or negative, don't allow transfers
    if ((capitalAccount?.balance || 0) <= 0) {
      setError('Capital account is empty. Please add funds before making transfers.');
      return;
    }

    try {
      // Create a transfer via the payments API
      const transfer = {
        amount: amount,
        paymentDate: transferData.date,
        type: 'transfer',
        sourceAccount: capitalAccount.id,
        destinationAccount: transferData.destinationAccount,
        reference: `CAP-${Date.now()}`,
        notes: transferData.description
      };

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer)
      });

      if (response.ok) {
        setShowTransferModal(false);
        setTransferData({
          amount: "",
          destinationAccount: "",
          description: "",
          date: new Date().toISOString().split('T')[0]
        });
        fetchData(); // Refresh data
        setError(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transfer');
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      setError(error.message);
    }
  };

  const formatCurrency = (amount) => {
    // Ensure we never show negative values - show 0 instead
    const displayAmount = Math.max(0, amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(displayAmount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-md">
        <p className="flex items-center">
          <AlertCircle className="mr-2 h-5 w-5" />
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Capital Account Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Wallet className="mr-2 h-6 w-6 text-blue-600" />
            Capital Account
          </h2>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Account
            </button>
            <button
              onClick={() => setShowInitialBalanceModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Set Initial Balance
            </button>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transfer Funds
            </button>
            <a
              href="/capital-account/transfers"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              View Transfers
            </a>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-4 rounded-lg ${(capitalAccount?.balance || 0) <= 0 ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-blue-50'}`}>
            <div className="flex items-center">
              <TrendingUp className={`h-8 w-8 ${(capitalAccount?.balance || 0) <= 0 ? 'text-yellow-600' : 'text-blue-600'}`} />
              <div className="ml-3">
                <p className={`text-sm font-medium ${(capitalAccount?.balance || 0) <= 0 ? 'text-yellow-600' : 'text-blue-600'}`}>
                  Current Balance
                </p>
                <p className={`text-2xl font-bold ${(capitalAccount?.balance || 0) <= 0 ? 'text-yellow-900' : 'text-blue-900'}`}>
                  {formatCurrency(capitalAccount?.balance || 0)}
                </p>
                {(capitalAccount?.balance || 0) <= 0 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    💡 Account is empty - ready for top-up
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Check className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Account Status</p>
                <p className="text-lg font-semibold text-green-900">
                  {capitalAccount?.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Wallet className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Account Code</p>
                <p className="text-lg font-semibold text-purple-900">
                  {capitalAccount?.code || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transfers */}
      {recentTransfers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ArrowRightLeft className="mr-2 h-5 w-5 text-blue-600" />
              Recent Transfers
            </h3>
            <a
              href="/capital-account/transfers"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Transfers →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Reference</th>
                  <th className="p-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {recentTransfers.map((transfer) => (
                  <tr key={transfer.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="p-3">{formatDate(transfer.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transfer.type === 'outgoing' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transfer.type === 'outgoing' ? (
                          <span className="flex items-center">
                            <ArrowDownRight size={12} className="mr-1" />
                            Outgoing
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <ArrowUpRight size={12} className="mr-1" />
                            Incoming
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{formatCurrency(transfer.amount)}</td>
                    <td className="p-3">{transfer.reference}</td>
                    <td className="p-3">{transfer.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Balance History Chart */}
      {balanceHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
            Balance History (Last 30 Days)
          </h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {balanceHistory.map((record, index) => {
              const maxBalance = Math.max(...balanceHistory.map(r => r.balance));
              const height = maxBalance > 0 ? (record.balance / maxBalance) * 100 : 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className="text-xs text-gray-500 mt-2 text-center">
                    {formatDate(record.date)}
                  </div>
                  <div className="text-xs font-medium text-gray-700 mt-1">
                    {formatCurrency(record.balance)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Capital Account</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Account Name</label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({...editData, name: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter account name"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Account Code</label>
              <input
                type="text"
                value={editData.code}
                onChange={(e) => setEditData({...editData, code: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter account code"
              />
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={editData.isActive}
                onChange={(e) => setEditData({...editData, isActive: e.target.checked})}
                className="mr-2"
              />
              <label htmlFor="isActive">Active</label>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleEditAccount}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Capital Account</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this capital account? This action cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Note:</strong> You can only delete a capital account if it has no balance and has not been used in any transactions.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initial Balance Modal */}
      {showInitialBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Set Initial Capital Balance</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a journal entry crediting your Capital Account and debiting your Cash Account. 
              If no Cash Account exists, one will be created automatically.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Initial Balance (MWK)</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter initial balance"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowInitialBalanceModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSetInitialBalance}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Set Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Transfer from Capital Account</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Source Account</label>
              <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-50">
                <div className="text-sm font-medium text-gray-900">
                  {capitalAccount?.code} - {capitalAccount?.name} ({capitalAccount?.type})
                </div>
                <div className="text-sm text-gray-600">
                  Current Balance: MWK {formatCurrency(capitalAccount?.balance || 0)}
                </div>
                {transferData.amount && (
                  <div className="text-sm text-gray-600">
                    New Balance: MWK {formatCurrency((capitalAccount?.balance || 0) - parseFloat(transferData.amount))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Amount (MWK)</label>
              <input
                type="number"
                value={transferData.amount}
                onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
              {transferData.amount && parseFloat(transferData.amount) > (capitalAccount?.balance || 0) && (
                <p className="text-sm text-red-600 mt-1">
                  Insufficient balance. Available: MWK {formatCurrency(capitalAccount?.balance || 0)}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Destination Account</label>
              <select
                value={transferData.destinationAccount}
                onChange={(e) => setTransferData({...transferData, destinationAccount: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select destination account</option>
                {paymentMethods
                  .map(method => (
                    <option key={method.key} value={method.key}>
                      {method.name} - Balance: MWK {formatCurrency(getBalance(method.key))}
                    </option>
                  ))
                }
              </select>
              {transferData.destinationAccount && (
                <p className="text-sm text-gray-500 mt-1">
                  Current Balance: MWK {formatCurrency(getBalance(transferData.destinationAccount))} | 
                  New Balance: MWK {formatCurrency(getBalance(transferData.destinationAccount) + parseFloat(transferData.amount || 0))}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Description <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={transferData.description}
                onChange={(e) => setTransferData({...transferData, description: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Transfer description (optional)"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Date</label>
              <input
                type="date"
                value={transferData.date}
                onChange={(e) => setTransferData({...transferData, date: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Transfer Summary */}
            {transferData.amount && transferData.destinationAccount && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Transfer Summary</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>From: {capitalAccount?.name} (Capital Account)</div>
                  <div>To: {paymentMethods.find(method => method.key === transferData.destinationAccount)?.name}</div>
                  <div>Amount: MWK {formatCurrency(parseFloat(transferData.amount))}</div>
                  <div>Date: {new Date(transferData.date).toLocaleDateString('en-US')}</div>
                  <div>Description: {transferData.description || 'No description'}</div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapitalAccountManager; 