"use client";

import React, { useState, useEffect } from "react";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  RefreshCw,
  CreditCard,
  DollarSign,
  Landmark,
  Smartphone,
  FileText,
  AlertCircle,
  Settings,
  Plus,
  X,
  Building2,
  Loader
} from "lucide-react";
import { useRouter } from "next/navigation";
import PaymentModal from "@/components/PaymentModal";
import { syncPayments, fetchPayments, getPaymentStatistics, exportPayments, updatePaymentStatus } from "../services/paymentService";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";
import { getPaymentMethodColor, getPaymentMethodIcon, getPaymentMethodName } from "@/lib/paymentMethods";
import { formatDate as formatDateDDMMYYYY } from "@/lib/dateUtils";

const PaymentProcessingPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("recent");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalPayments: 0,
    totalAmount: 0,
    byStatus: {
      completed: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 }
    },
    byMethod: {}
  });
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [accountBalances, setAccountBalances] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [notification, setNotification] = useState(null);
  const [pagePermissions, setPagePermissions] = useState({  
    canCreatePayments: false,
    canDeletePayments:false, 
    canExportPayments:false,  
    canUpdatePayments:false, 
  });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountFormData, setAccountFormData] = useState({
    name: '',
    accountType: 'Cash',
    reference: '',
    isActive: true
  });       
  
  useEffect(() => {
    const fetchPermissions = async () => {  
      const canCreatePayments = await getPermission("payments.create");
      const canDeletePayments = await getPermission("payments.delete");
      const canExportPayments = await getPermission("payments.export");  
      const canUpdatePayments = await getPermission("payments.update"); 
  
      setPagePermissions({ 
        canCreatePayments,
        canDeletePayments, 
        canExportPayments,  
        canUpdatePayments, 
        });
    };
  
    fetchPermissions();
  }, []);
  // Load payment accounts and balances
  const loadPaymentAccounts = async () => {
    try {
      // Load payment accounts with balances in one call
      const response = await fetch('/api/payment-accounts/balances');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.accounts) {
          setPaymentAccounts(data.accounts);
          
          // Create balances map
          const balancesMap = {};
          data.accounts.forEach(account => {
            balancesMap[account.id] = account.balance || 0;
          });
          setAccountBalances(balancesMap);
        }
      } else {
        // Fallback: load accounts separately
        const accountsResponse = await fetch('/api/payment-accounts?activeOnly=true');
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          if (accountsData.success) {
            setPaymentAccounts(accountsData.paymentAccounts || []);
            // Initialize balances to 0
            const balancesMap = {};
            accountsData.paymentAccounts.forEach(account => {
              balancesMap[account.id] = 0;
            });
            setAccountBalances(balancesMap);
          }
        }
      }
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  // Load payments and statistics on initial render and when filters change
  useEffect(() => {
    loadPayments();
    loadStatistics();
    loadPaymentAccounts();
  }, [activeTab, selectedPaymentMethod, currentPage]);
  
  // Load payments from the API
  const loadPayments = async () => {
    try {
      setLoading(true);
      
      // Map active tab to status parameter
      let status = null;
      if (activeTab === "pending") status = "Pending";
      if (activeTab === "completed") status = "Completed";
      if (activeTab === "failed") status = "Failed";
      
      // Map payment method - selectedPaymentMethod is now an account ID
      let method = null;
      if (selectedPaymentMethod !== "all") {
        // Find the account name from the account ID
        const selectedAccount = paymentAccounts.find(acc => acc.id === selectedPaymentMethod);
        method = selectedAccount ? selectedAccount.name : selectedPaymentMethod;
      }
      
      // Fetch payments with filters
      const result = await fetchPayments({
        page: currentPage,
        limit: 10,
        status,
        method,
        search: searchQuery !== "" ? searchQuery : null
      });
      
      setPayments(result.payments || []);
      setTotalPages(result.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error loading payments:", error);
      showNotification("Error loading payments. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };
  
  // Load payment statistics from the API
  const loadStatistics = async () => {
    try {
      const stats = await getPaymentStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  };
  
  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    loadPayments();
  };
  
  // Handle payment method filter change
  const handleMethodFilterChange = (e) => {
    setSelectedPaymentMethod(e.target.value);
    setCurrentPage(1);
  };
  
  // Handle export
  const handleExport = async () => {
    try {
      // Map active tab to status parameter
      let status = null;
      if (activeTab === "pending") status = "Pending";
      if (activeTab === "completed") status = "Completed";
      if (activeTab === "failed") status = "Failed";
      
      // Map payment method - selectedPaymentMethod is now an account ID
      let method = null;
      if (selectedPaymentMethod !== "all") {
        // Find the account name from the account ID
        const selectedAccount = paymentAccounts.find(acc => acc.id === selectedPaymentMethod);
        method = selectedAccount ? selectedAccount.name : selectedPaymentMethod;
      }
      
      await exportPayments({
        status,
        method,
        search: searchQuery !== "" ? searchQuery : null
      });
      
      showNotification("Payments exported successfully", "success");
    } catch (error) {
      console.error("Error exporting payments:", error);
      showNotification("Error exporting payments", "error");
    }
  };
  
  // Handle sync payments
  const handleSyncPayments = async () => {
    try {
      setSyncingPayments(true);
      const result = await syncPayments();
      
      if (result.syncedPayments > 0) {
        showNotification(`Successfully synced ${result.syncedPayments} payments`, "success");
      } else {
        showNotification("No new payments found to sync", "info");
      }
      
      // Reload payments and statistics
      await loadPayments();
      await loadStatistics();
      await loadPaymentAccounts();
    } catch (error) {
      console.error("Error syncing payments:", error);
      showNotification("Error syncing payments. Please try again.", "error");
    } finally {
      setSyncingPayments(false);
    }
  };
  
  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  // Handle payment submission from modal
  const handlePaymentSubmit = async (paymentData) => {
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }
      
      showNotification("Payment recorded successfully", "success");
      
      // Reload payments and statistics
      await loadPayments();
      await loadStatistics();
      await loadPaymentAccounts();
    } catch (error) {
      console.error("Error creating payment:", error);
      showNotification(error.message || "Error recording payment", "error");
      throw error; // Re-throw to handle in the modal
    }
  };
  
  // Show notification helper
  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Account types for the modal
  const ACCOUNT_TYPES = [
    { value: 'Cash', label: 'Cash', icon: DollarSign },
    { value: 'Bank', label: 'Bank', icon: Building2 },
    { value: 'Mobile Money', label: 'Mobile Money', icon: Smartphone },
    { value: 'Wallet', label: 'Wallet', icon: CreditCard },
    { value: 'POS Terminal', label: 'POS Terminal', icon: CreditCard }
  ];

  // Handle account form submission
  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setIsSavingAccount(true);
    setNotification(null);

    try {
      const response = await fetch('/api/payment-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountFormData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment account');
      }

      showNotification('Payment account created successfully', 'success');
      setShowAccountModal(false);
      resetAccountForm();
      await loadPaymentAccounts();
    } catch (err) {
      showNotification(err.message || 'Error creating payment account', 'error');
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Reset account form
  const resetAccountForm = () => {
    setAccountFormData({
      name: '',
      accountType: 'Cash',
      reference: '',
      isActive: true
    });
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // Status badge component
  const StatusBadge = ({ status }) => {
    let badgeClass = "";
    let icon = null;
    
    switch (status) {
      case "Completed":
        badgeClass = "bg-green-100 text-green-800";
        icon = <CheckCircle size={14} className="mr-1" />;
        break;
      case "Pending":
        badgeClass = "bg-yellow-100 text-yellow-800";
        icon = <Clock size={14} className="mr-1" />;
        break;
      case "Failed":
        badgeClass = "bg-red-100 text-red-800";
        icon = <XCircle size={14} className="mr-1" />;
        break;
      default:
        badgeClass = "bg-gray-100 text-gray-800";
        icon = <AlertCircle size={14} className="mr-1" />;
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs flex items-center ${badgeClass}`}>
        {icon}
        {status}
      </span>
    );
  };

  // Payment method icon component
  const PaymentMethodIcon = ({ method }) => {
    switch (method) {
      case "Bank Transfer":
        return <Landmark size={16} className="mr-2 text-blue-500" />;
      case "Card Payment":
        return <CreditCard size={16} className="mr-2 text-purple-500" />;
      case "Mobile Money":
        return <Smartphone size={16} className="mr-2 text-green-500" />;
      case "PayChangu":
        return <DollarSign size={16} className="mr-2 text-orange-500" />;
      case "Cash":
        return <DollarSign size={16} className="mr-2 text-green-500" />;
      case "Check":
        return <FileText size={16} className="mr-2 text-blue-500" />;
      default:
        return <CreditCard size={16} className="mr-2 text-gray-500" />;
    }
  };

  return (
    <PermissionGuard permission="payments.view">
    <div>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-md ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' :
          notification.type === 'error' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <CheckCircle size={16} className="mr-2" />}
            {notification.type === 'error' && <XCircle size={16} className="mr-2" />}
            {notification.type === 'info' && <AlertCircle size={16} className="mr-2" />}
            <p>{notification.message}</p>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Payment Processing</h1>
        <div className="flex space-x-2">
          <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center hover:bg-gray-50"
            onClick={() => router.push('/payments/management')}
          >
            <Settings size={16} className="mr-2" />
            Manage Payment Accounts
          </button>
        {pagePermissions.canCreatePayments &&(   <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700"
            onClick={() => setIsModalOpen(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            Record Payment
          </button>)}
          <button 
            className="px-4 py-2 border border-gray-300 bg-white rounded-md flex items-center hover:bg-gray-50"
            onClick={handleSyncPayments}
            disabled={syncingPayments}
          >
            <RefreshCw size={16} className={`mr-2 ${syncingPayments ? 'animate-spin' : ''}`} />
            {syncingPayments ? 'Syncing...' : 'Sync Payments'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <DollarSign size={24} className="text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-bold">
                {formatCurrency(statistics.totalAmount || 0)}
              </div>
              <div className="text-sm text-gray-500">Total Payments</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.totalPayments || 0} payments processed
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold">
                {formatCurrency(statistics.byStatus?.completed?.amount || 0)}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.byStatus?.completed?.count || 0} successful payments
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-yellow-100 p-3 mr-4">
              <Clock size={24} className="text-yellow-600" />
            </div>
            <div>
              <div className="text-lg font-bold">
                {formatCurrency(statistics.byStatus?.pending?.amount || 0)}
              </div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.byStatus?.pending?.count || 0} payment{statistics.byStatus?.pending?.count !== 1 ? 's' : ''} pending
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center mb-4">
            <div className="rounded-full bg-red-100 p-3 mr-4">
              <XCircle size={24} className="text-red-600" />
            </div>
            <div>
              <div className="text-lg font-bold">
                {formatCurrency(statistics.byStatus?.failed?.amount || 0)}
              </div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {statistics.byStatus?.failed?.count || 0} failed payment{statistics.byStatus?.failed?.count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex p-4 border-b border-gray-200">
          <button 
            className={`px-4 py-2 rounded-md mr-2 ${activeTab === "recent" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => {
              setActiveTab("recent");
              setCurrentPage(1);
            }}
          >
            Recent
          </button>
          <button 
            className={`px-4 py-2 rounded-md mr-2 ${activeTab === "pending" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => {
              setActiveTab("pending");
              setCurrentPage(1);
            }}
          >
            Pending
          </button>
          <button 
            className={`px-4 py-2 rounded-md mr-2 ${activeTab === "completed" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => {
              setActiveTab("completed");
              setCurrentPage(1);
            }}
          >
            Completed
          </button>
          <button 
            className={`px-4 py-2 rounded-md mr-2 ${activeTab === "failed" ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100"}`}
            onClick={() => {
              setActiveTab("failed");
              setCurrentPage(1);
            }}
          >
            Failed
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="w-1/3">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search payments..." 
                  className="w-full p-2 pl-10 border border-gray-200 rounded-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-2.5">
                  <Search size={16} className="text-gray-400" />
                </div>
              </div>
            </form>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <select 
                className="appearance-none px-4 py-2 border border-gray-200 rounded-md bg-white pr-10"
                value={selectedPaymentMethod}
                onChange={handleMethodFilterChange}
              >
                <option value="all">All Payment Methods</option>
                {paymentAccounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-2.5 pointer-events-none">
                <ChevronDown size={16} className="text-gray-500" />
              </div>
            </div>
            <div>
            {pagePermissions.canExportPayments &&(  <button 
                className="px-4 py-2 border border-gray-200 rounded-md bg-white flex items-center hover:bg-gray-50"
                onClick={handleExport}
              >
                <Download size={16} className="mr-2 text-gray-500" />
                <span className="text-sm text-gray-700">Export</span>
              </button>)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-500">Loading payments...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No payments found.</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or create a new payment.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                      {payment.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {payment.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateDDMMYYYY(payment.paymentDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.client?.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {payment.invoiceNumber || payment.invoice?.invoiceNumber || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {payment.paymentMethod ? (
                          <>
                            {React.cloneElement(getPaymentMethodIcon(payment.paymentMethod), { className: `w-4 h-4 mr-2 text-${getPaymentMethodColor(payment.paymentMethod)}-500` })}
                            {payment.paymentMethod}
                          </>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {payment.destinationAccount ? (
                          <>
                            {React.cloneElement(getPaymentMethodIcon(payment.destinationAccount), { className: `w-4 h-4 mr-2 text-${getPaymentMethodColor(payment.destinationAccount)}-500` })}
                            {payment.destinationAccount}
                          </>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {payment.reference || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {payment.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-700">
            {payments.length > 0 ? (
              <>
                Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to <span className="font-medium">{Math.min(currentPage * 10, (currentPage - 1) * 10 + payments.length)}</span> of <span className="font-medium">{totalPages * 10}</span> payments
              </>
            ) : (
              "No payments to display"
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex space-x-2">
              <button 
                className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50 hover:bg-gray-50" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Calculate page numbers to show
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                  }
                  if (currentPage > totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  }
                }
                
                return pageNum <= totalPages ? (
                  <button 
                    key={pageNum}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === pageNum 
                        ? 'border-blue-500 bg-blue-50 text-blue-600' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                ) : null;
              })}
              <button 
                className="px-3 py-1 border border-gray-200 rounded-md bg-white text-sm disabled:opacity-50 hover:bg-gray-50"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Payment Method Distribution</h2>
          <button
            onClick={() => setShowAccountModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md flex items-center hover:bg-blue-700 text-sm"
          >
            <Plus size={16} className="mr-1.5" />
            Add Account
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {paymentAccounts.length > 0 ? (
            paymentAccounts.map(account => {
              const balance = accountBalances[account.id] || 0;
              
              // Get icon based on account type
              let Icon = DollarSign;
              let bgColor = 'bg-gray-50';
              let textColor = 'text-gray-500';
              
              if (account.accountType === 'Cash') {
                Icon = DollarSign;
                bgColor = 'bg-green-50';
                textColor = 'text-green-500';
              } else if (account.accountType === 'Bank') {
                Icon = Landmark;
                bgColor = 'bg-blue-50';
                textColor = 'text-blue-500';
              } else if (account.accountType === 'Mobile Money') {
                Icon = Smartphone;
                bgColor = 'bg-purple-50';
                textColor = 'text-purple-500';
              } else if (account.accountType === 'Wallet' || account.accountType === 'POS Terminal') {
                Icon = CreditCard;
                bgColor = 'bg-orange-50';
                textColor = 'text-orange-500';
              }
              
              return (
                <div key={account.id} className={`${bgColor} p-4 rounded-lg`}>
                  <div className="flex items-center mb-2">
                    <Icon size={18} className={`mr-2 ${textColor}`} />
                    <span className="font-medium">{account.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Available Balance</div>
                  <div className={`text-xl font-bold ${textColor}`}>
                    {formatCurrency(balance)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center text-gray-500 py-8">
              No payment accounts found. <a href="/payments/management" className="text-blue-600 hover:underline">Create one</a>
            </div>
          )}
          {/*<div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <Landmark size={18} className="text-blue-500 mr-2" />
              <span className="font-medium">Bank Transfer</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(statistics.byMethod?.bank_transfer?.amount || 0)}
            </div>
            <div className="text-sm text-gray-500">
              {statistics.byMethod?.bank_transfer?.count || 0} transaction{(statistics.byMethod?.bank_transfer?.count || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          
           <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <CreditCard size={18} className="text-purple-500 mr-2" />
              <span className="font-medium">Card Payment</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(statistics.byMethod?.card_payment?.amount || 0)}
            </div>
            <div className="text-sm text-gray-500">
              {statistics.byMethod?.card_payment?.count || 0} transaction{(statistics.byMethod?.card_payment?.count || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <Smartphone size={18} className="text-green-500 mr-2" />
              <span className="font-medium">Mobile Money</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(statistics.byMethod?.mobile_money?.amount || 0)}
            </div>
            <div className="text-sm text-gray-500">
              {statistics.byMethod?.mobile_money?.count || 0} transaction{(statistics.byMethod?.mobile_money?.count || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <DollarSign size={18} className="text-orange-500 mr-2" />
              <span className="font-medium">PayChangu</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrency(statistics.byMethod?.paychangu?.amount || 0)}
            </div>
            <div className="text-sm text-gray-500">
              {statistics.byMethod?.paychangu?.count || 0} transaction{(statistics.byMethod?.paychangu?.count || 0) !== 1 ? 's' : ''}
            </div>
          </div> */}
        </div>
      </div>
      
      {/* Payment Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        mode="create"
      />

      {/* Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Create Payment Account
              </h2>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  resetAccountForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={accountFormData.name}
                  onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="e.g., Bank Transfer, Airtel Money, Mpamba"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  value={accountFormData.accountType}
                  onChange={(e) => setAccountFormData({ ...accountFormData, accountType: e.target.value })}
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
                  value={accountFormData.reference}
                  onChange={(e) => setAccountFormData({ ...accountFormData, reference: e.target.value })}
                  placeholder="Account number, wallet ID, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={accountFormData.isActive}
                  onChange={(e) => setAccountFormData({ ...accountFormData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountModal(false);
                    resetAccountForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isSavingAccount}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                  disabled={isSavingAccount}
                >
                  {isSavingAccount ? (
                    <>
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="mr-2" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
};

export default PaymentProcessingPage;