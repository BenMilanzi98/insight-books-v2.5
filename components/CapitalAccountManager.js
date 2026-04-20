"use client";
import { useState, useEffect } from "react";
import { AlertCircle, Check, DollarSign, ArrowRightLeft, TrendingUp, Wallet, Clock, ArrowUpRight, ArrowDownRight, Edit, Trash2, Save, X, PlusCircle, Building2, Banknote } from "lucide-react";
import { paymentMethods } from "@/lib/paymentMethods";

const CapitalAccountManager = ({ onboarding = false }) => {
  const [capitalAccount, setCapitalAccount] = useState(null);
  /** Actual payment accounts from /payments/management with real balances */
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
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

  const [showContributionModal, setShowContributionModal] = useState(false);
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [contributionData, setContributionData] = useState({
    type: "cash",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    description: "",
    cashAccountId: "",
    assetName: "",
    assetType: "",
    assetAccountId: ""
  });
  const [contributions, setContributions] = useState([]);
  const [contributionSummary, setContributionSummary] = useState({ totalCashContributions: 0, totalAssetContributions: 0, totalCapital: 0 });
  const [assetAccounts, setAssetAccounts] = useState([]);

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

  // Reset transfer states when modal opens
  useEffect(() => {
    if (showTransferModal) {
      setIsTransferring(false);
      setTransferSuccess(false);
      setSuccessMessage("");
      setError(null);
    }
  }, [showTransferModal]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch capital account data
      const capitalResponse = await fetch('/api/capital-account');
      if (capitalResponse.ok) {
        const capitalData = await capitalResponse.json();
        const ca = capitalData.capitalAccount
          ? {
              ...capitalData.capitalAccount,
              ownerContributedCapital: capitalData.ownerContributedCapital ?? 0,
            }
          : null;
        setCapitalAccount(ca);
        setRecentTransfers(capitalData.recentTransfers || []);
        setBalanceHistory(capitalData.balanceHistory || []);
        
        // Initialize edit data
        if (ca) {
          setEditData({
            name: ca.name,
            code: ca.code || ca.accountCode || "",
            isActive: ca.isActive
          });
        }
      }

      // Fetch actual payment accounts with balances (same as /payments and /payments/management)
      const balancesResponse = await fetch('/api/payment-accounts/balances');
      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json();
        setPaymentAccounts(balancesData.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContributions = async () => {
    try {
      const res = await fetch('/api/capital-account/contributions');
      if (res.ok) {
        const data = await res.json();
        setContributions(data.contributions || []);
        setContributionSummary(data.summary || { totalCashContributions: 0, totalAssetContributions: 0, totalCapital: 0 });
      }
    } catch (e) {
      console.error('Error fetching contributions:', e);
    }
  };

  const fetchAssetAccounts = async () => {
    try {
      const res = await fetch('/api/chart-of-accounts');
      if (res.ok) {
        const data = await res.json();
        const accounts = data.accounts || data || [];
        setAssetAccounts(accounts.filter(a => (a.type || a.accountType || '').toUpperCase() === 'ASSET'));
      }
    } catch (e) {
      console.error('Error fetching asset accounts:', e);
    }
  };

  useEffect(() => { fetchContributions(); fetchAssetAccounts(); }, []);

  const handleSubmitContribution = async () => {
    const amount = parseFloat(contributionData.amount);
    if (!amount || amount <= 0) {
      setError('Contribution amount must be greater than zero');
      return;
    }
    setIsSubmittingContribution(true);
    setError(null);
    try {
      const payload = {
        type: contributionData.type,
        amount,
        date: contributionData.date,
        description: contributionData.description || (contributionData.type === 'cash' ? 'Cash capital contribution' : `Asset contribution — ${contributionData.assetName || contributionData.assetType}`),
      };
      if (contributionData.type === 'cash' && contributionData.cashAccountId) {
        payload.cashAccountId = contributionData.cashAccountId;
      }
      if (contributionData.type === 'asset') {
        if (!contributionData.assetType && !contributionData.assetAccountId) {
          setError('Please select an asset type or asset account');
          setIsSubmittingContribution(false);
          return;
        }
        payload.assetName = contributionData.assetName;
        payload.assetType = contributionData.assetType;
        if (contributionData.assetAccountId) payload.assetAccountId = contributionData.assetAccountId;
      }
      const res = await fetch('/api/capital-account/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowContributionModal(false);
        setContributionData({ type: 'cash', amount: '', date: new Date().toISOString().split('T')[0], description: '', cashAccountId: '', assetName: '', assetType: '', assetAccountId: '' });
        fetchData();
        fetchContributions();
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to record contribution');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  const getBalance = (accountIdOrKey) => {
    const byId = paymentAccounts.find((a) => a.id === accountIdOrKey);
    if (byId != null) return typeof byId.balance === 'number' ? byId.balance : parseFloat(byId.balance) || 0;
    const byKey = paymentAccounts.find((a) => a.name && String(a.name).toLowerCase().replace(/\s+/g, '_') === accountIdOrKey);
    if (byKey != null) return typeof byKey.balance === 'number' ? byKey.balance : parseFloat(byKey.balance) || 0;
    return 0;
  };
  const getAccountName = (accountIdOrKey) =>
    paymentAccounts.find((a) => a.id === accountIdOrKey)?.name ??
    paymentMethods.find((m) => m.key === accountIdOrKey)?.name ??
    accountIdOrKey;

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

    setIsTransferring(true);
    setError(null);
    setTransferSuccess(false);

    try {
      // Create a transfer via the payments API
      const transfer = {
        amount: amount,
        paymentDate: transferData.date,
        type: 'transfer',
        sourceAccount: capitalAccount.id,
        destinationAccount: transferData.destinationAccount,
        reference: `CAP-${Date.now()}`,
        notes: transferData.description || ""
      };

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transfer)
      });

      if (response.ok) {
        const destinationName = getAccountName(transferData.destinationAccount);
        setTransferSuccess(true);
        setSuccessMessage(`Successfully transferred MWK ${amount.toLocaleString()} to ${destinationName}`);
        
        // Wait a bit to show success message, then close modal and refresh
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferSuccess(false);
          setSuccessMessage("");
          setTransferData({
            amount: "",
            destinationAccount: "",
            description: "",
            date: new Date().toISOString().split('T')[0]
          });
          fetchData(); // Refresh data
          setError(null);
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        let message = errorData.error || 'Failed to create transfer';
        // Format "Available: X, Required: Y" for readability
        const match = message.match(/Available: ([\d.]+), Required: ([\d.]+)/);
        if (match) {
          const available = parseFloat(match[1]);
          const required = parseFloat(match[2]);
          message = `Insufficient balance in source account. Available: ${formatCurrency(available)}, Required: ${formatCurrency(required)}`;
        }
        throw new Error(message);
      }
    } catch (error) {
      if (error?.message && !error.message.includes('Insufficient balance')) {
        console.error('Error creating transfer:', error);
      }
      setError(error?.message || 'Failed to create transfer');
      setIsTransferring(false);
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
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading capital account...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 flex items-center gap-2 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0" />
        {error}
      </div>
    );
  }

  const isSystemCapital =
    capitalAccount?.accountCode === "3100" ||
    String(capitalAccount?.code || "") === "3100" ||
    capitalAccount?.accountCode === "500000" ||
    String(capitalAccount?.code || "") === "500000";

  const completeCapitalOnboarding = async () => {
    try {
      setError(null);
      const res = await fetch("/api/tenant/onboarding/complete-capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not continue");
      window.location.href = "/payments/management?onboarding=1";
    } catch (e) {
      setError(e?.message || "Failed to continue setup");
    }
  };

  return (
    <div className="space-y-6">
      {onboarding && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm shadow-sm">
          <p className="font-medium">Required setup — capital</p>
          <p className="mt-1 text-amber-900/90">
            Set your opening capital (initial balance or contributions) and review distributions. When finished, continue to{" "}
            <strong>Payment accounts</strong> in the next step.
          </p>
          <button
            type="button"
            onClick={completeCapitalOnboarding}
            className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-white text-sm font-medium hover:bg-amber-700"
          >
            I have configured capital — continue to payment accounts
          </button>
        </div>
      )}
      {/* Capital Account Overview */}
      <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-indigo-600" />
            Capital Account
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              disabled={isSystemCapital}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="h-4 w-4" />
              Edit Account
            </button>
            <button
              type="button"
              onClick={() => setShowContributionModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Add Contribution
            </button>
            <button
              type="button"
              onClick={() => setShowInitialBalanceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-600 text-white font-medium hover:bg-slate-700 transition-colors"
            >
              <DollarSign className="h-4 w-4" />
              Set Initial Balance
            </button>
            <button
              type="button"
              onClick={() => {
                setIsTransferring(false);
                setTransferSuccess(false);
                setSuccessMessage("");
                setError(null);
                setShowTransferModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transfer Funds
            </button>
            <a
              href="/capital-account/transfers"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              View Transfers
            </a>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSystemCapital}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className={`p-5 rounded-xl ${(capitalAccount?.balance || 0) <= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-indigo-50 border border-indigo-100'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium uppercase tracking-wider ${(capitalAccount?.balance || 0) <= 0 ? 'text-amber-600' : 'text-indigo-600'}`}>
                  Current Balance
                </p>
                <p className={`text-2xl font-bold mt-1 ${(capitalAccount?.balance || 0) <= 0 ? 'text-amber-900' : 'text-indigo-900'}`}>
                  {formatCurrency(capitalAccount?.balance || 0)}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  Cumulative contributed capital:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(capitalAccount?.ownerContributedCapital ?? 0)}
                  </span>
                  <span className="block text-slate-500 mt-0.5">
                    (Transfers to payment accounts do not reduce this figure; it increases when you add contributions.)
                  </span>
                </p>
                {(capitalAccount?.balance || 0) <= 0 && (
                  <p className="text-xs text-amber-700 mt-2">Available transfer balance is empty — add capital or contributions first</p>
                )}
              </div>
              <div className={`p-3 rounded-xl ${(capitalAccount?.balance || 0) <= 0 ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                <TrendingUp className={`h-8 w-8 ${(capitalAccount?.balance || 0) <= 0 ? 'text-amber-600' : 'text-indigo-600'}`} />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Account Status</p>
                <p className="text-lg font-bold text-emerald-900 mt-1">{capitalAccount?.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-violet-50 border border-violet-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-600 uppercase tracking-wider">Account Code</p>
                <p className="text-lg font-bold text-violet-900 mt-1">{capitalAccount?.code || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-xl bg-violet-100">
                <Wallet className="h-8 w-8 text-violet-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transfers */}
      {recentTransfers.length > 0 && (
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              Recent Transfers
            </h3>
            <a href="/capital-account/transfers" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              View all transfers →
            </a>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-indigo-50/30 transition-colors">
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
        <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Balance History (Last 30 Days)
          </h3>
          <div className="h-64 flex items-end justify-between gap-1">
            {balanceHistory.map((record, index) => {
              const maxBalance = Math.max(...balanceHistory.map(r => r.balance));
              const height = maxBalance > 0 ? (record.balance / maxBalance) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-indigo-500 rounded-t transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                  <div className="text-xs text-slate-500 mt-2 text-center truncate w-full">{formatDate(record.date)}</div>
                  <div className="text-xs font-medium text-slate-700 mt-1">{formatCurrency(record.balance)}</div>
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
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-4 sm:px-6 lg:px-8">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => {
                if (!isTransferring) {
                  setShowTransferModal(false);
                  setTransferSuccess(false);
                  setSuccessMessage("");
                  setError(null);
                  setIsTransferring(false);
                }
              }}
            ></div>
            
            {/* Modal container */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all">
              {/* Transfer animation overlay */}
              {isTransferring && (
                <div className="absolute inset-0 bg-white/95 rounded-lg flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ArrowRightLeft className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 animate-pulse" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm sm:text-base font-medium text-gray-700">Transferring funds...</p>
                  <p className="mt-2 text-xs sm:text-sm text-gray-500 text-center px-4">Please wait while we process your transfer</p>
                </div>
              )}

              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-200">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Transfer from Capital Account</h3>
                <button
                  onClick={() => {
                    if (!isTransferring) {
                      setShowTransferModal(false);
                      setTransferSuccess(false);
                      setSuccessMessage("");
                      setError(null);
                      setIsTransferring(false);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1 disabled:opacity-50"
                  disabled={isTransferring}
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </div>

              {/* Scrollable content area */}
              <div className="px-4 py-4 sm:px-6 sm:py-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Source Account */}
                <div className="mb-4 sm:mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source Account</label>
                  <div className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <div className="text-sm sm:text-base font-medium text-gray-900 break-words">
                      {capitalAccount?.code} - {capitalAccount?.name} ({capitalAccount?.type})
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                      Current Balance: MWK {formatCurrency(capitalAccount?.balance || 0)}
                    </div>
                    {transferData.amount && (
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        New Balance: MWK {formatCurrency((capitalAccount?.balance || 0) - parseFloat(transferData.amount))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="mb-4 sm:mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount (MWK) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    placeholder="Enter amount"
                    min="0"
                    step="0.01"
                    disabled={isTransferring || transferSuccess}
                  />
                  {transferData.amount && parseFloat(transferData.amount) > (capitalAccount?.balance || 0) && (
                    <p className="text-xs sm:text-sm text-red-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Insufficient balance. Available: MWK {formatCurrency(capitalAccount?.balance || 0)}
                    </p>
                  )}
                </div>

                {/* Destination Account */}
                <div className="mb-4 sm:mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destination Account <span className="text-red-500">*</span></label>
                  <select
                    value={transferData.destinationAccount}
                    onChange={(e) => setTransferData({...transferData, destinationAccount: e.target.value})}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white"
                    disabled={isTransferring || transferSuccess}
                  >
                    <option value="">Select destination account</option>
                    {paymentAccounts
                      .filter((a) => a.isActive !== false)
                      .map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} - Balance: MWK {formatCurrency(typeof acc.balance === 'number' ? acc.balance : parseFloat(acc.balance) || 0)}
                        </option>
                      ))
                    }
                  </select>
                  {transferData.destinationAccount && (
                    <div className="mt-2 text-xs sm:text-sm text-gray-600 space-y-1">
                      <div>Current Balance: MWK {formatCurrency(getBalance(transferData.destinationAccount))}</div>
                      <div>New Balance: MWK {formatCurrency(getBalance(transferData.destinationAccount) + parseFloat(transferData.amount || 0))}</div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="mb-4 sm:mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-gray-500 font-normal text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={transferData.description}
                    onChange={(e) => setTransferData({...transferData, description: e.target.value})}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    placeholder="Transfer description (optional)"
                    disabled={isTransferring || transferSuccess}
                  />
                </div>

                {/* Date */}
                <div className="mb-4 sm:mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={transferData.date}
                    onChange={(e) => setTransferData({...transferData, date: e.target.value})}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    disabled={isTransferring || transferSuccess}
                  />
                </div>

                {/* Transfer Summary */}
                {transferData.amount && transferData.destinationAccount && (
                  <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm sm:text-base font-semibold text-blue-900 mb-2 sm:mb-3">Transfer Summary</h4>
                    <div className="text-xs sm:text-sm text-blue-800 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">From:</span>
                        <span>{capitalAccount?.name} (Capital Account)</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">To:</span>
                        <span>{getAccountName(transferData.destinationAccount)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">Amount:</span>
                        <span>MWK {formatCurrency(parseFloat(transferData.amount))}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">Date:</span>
                        <span>{formatDate(transferData.date)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="font-medium">Description:</span>
                        <span>{transferData.description || 'No description'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {transferSuccess && (
                  <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-start sm:items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-green-900 break-words">{successMessage}</p>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && !transferSuccess && (
                  <div className="mb-4 sm:mb-5 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start sm:items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm sm:text-base text-red-800 break-words">{error}</p>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      setShowTransferModal(false);
                      setTransferSuccess(false);
                      setSuccessMessage("");
                      setError(null);
                      setIsTransferring(false);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-sm sm:text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    disabled={isTransferring}
                  >
                    {transferSuccess ? 'Close' : 'Cancel'}
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={isTransferring || transferSuccess || !transferData.amount || !transferData.destinationAccount}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {isTransferring ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Transferring...</span>
                      </>
                    ) : transferSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Success</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>Transfer</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Capital Summary View */}
      <div className="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
          Capital Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Cash Contributions</p>
            <p className="text-xl font-bold text-emerald-900 mt-1">{formatCurrency(contributionSummary.totalCashContributions)}</p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wider">Asset Contributions</p>
            <p className="text-xl font-bold text-blue-900 mt-1">{formatCurrency(contributionSummary.totalAssetContributions)}</p>
          </div>
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="text-sm font-medium text-indigo-600 uppercase tracking-wider">Contributed capital</p>
            <p className="text-xl font-bold text-indigo-900 mt-1">
              {formatCurrency(
                contributionSummary.ownerContributedCapital != null
                  ? contributionSummary.ownerContributedCapital
                  : contributionSummary.totalCapital
              )}
            </p>
            <p className="text-xs text-indigo-700/80 mt-1">Increases with new contributions; not reduced by transfers to payment accounts.</p>
          </div>
        </div>
        {contributions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Description</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">GL (under 3100)</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-600">Account Debited</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-600">Amount</th>
                  <th className="text-right py-2 px-3 font-semibold text-slate-600">Running Total</th>
                </tr>
              </thead>
              <tbody>
                {contributions.reduce((acc, c) => {
                  const runningTotal = (acc.length > 0 ? acc[acc.length - 1].runningTotal : 0) + (c.amount || 0);
                  acc.push({ ...c, runningTotal });
                  return acc;
                }, []).map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-700">{formatDate(c.date)}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.type === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {c.type === 'cash' ? <Banknote className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {c.type === 'cash' ? 'Cash' : 'Asset'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{c.description}</td>
                    <td className="py-2 px-3 font-mono text-xs text-violet-700">{c.coaAccountCode || "—"}</td>
                    <td className="py-2 px-3 text-slate-500">{c.debitAccountName}</td>
                    <td className="py-2 px-3 text-right font-medium text-slate-800">{formatCurrency(c.amount)}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-700">{formatCurrency(c.runningTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-6">No capital contributions recorded yet.</p>
        )}
      </div>

      {/* Contribution Modal */}
      {showContributionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowContributionModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Record Capital Contribution</h3>
              <button type="button" onClick={() => setShowContributionModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contribution Type</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setContributionData(d => ({ ...d, type: 'cash' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${contributionData.type === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <Banknote className="h-5 w-5" /> Cash
                  </button>
                  <button type="button" onClick={() => setContributionData(d => ({ ...d, type: 'asset' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${contributionData.type === 'asset' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <Building2 className="h-5 w-5" /> Asset
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (MWK)</label>
                <input type="number" min="0" step="0.01" value={contributionData.amount}
                  onChange={(e) => setContributionData(d => ({ ...d, amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={contributionData.date}
                  onChange={(e) => setContributionData(d => ({ ...d, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              {contributionData.type === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cash / Bank Account (optional)</label>
                  <select value={contributionData.cashAccountId}
                    onChange={(e) => setContributionData(d => ({ ...d, cashAccountId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="">Auto-detect</option>
                    {paymentAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {contributionData.type === 'asset' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                    <input type="text" value={contributionData.assetName}
                      onChange={(e) => setContributionData(d => ({ ...d, assetName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Office Computer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type</label>
                    <select value={contributionData.assetType}
                      onChange={(e) => setContributionData(d => ({ ...d, assetType: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Select type...</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Motor Vehicle">Motor Vehicle</option>
                      <option value="Furniture">Furniture &amp; Fixtures</option>
                      <option value="Computer">Computer &amp; Electronics</option>
                      <option value="Machinery">Machinery</option>
                      <option value="Software">Software / Intangible</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Account (optional override)</label>
                    <select value={contributionData.assetAccountId}
                      onChange={(e) => setContributionData(d => ({ ...d, assetAccountId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Auto-detect from type</option>
                      {assetAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input type="text" value={contributionData.description}
                  onChange={(e) => setContributionData(d => ({ ...d, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Owner invested cash into business" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
              <button type="button" onClick={() => setShowContributionModal(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium">Cancel</button>
              <button type="button" onClick={handleSubmitContribution} disabled={isSubmittingContribution}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {isSubmittingContribution ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Recording...</>
                ) : (
                  <><PlusCircle className="h-4 w-4" /> Record Contribution</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CapitalAccountManager; 