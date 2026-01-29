"use client";

import { useState, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Info,
  Eye,
  Calendar,
  TrendingUp,
  Package,
  ShoppingCart
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";
import PermissionGuard from "@/components/PermissionGuard";
import { getPermission } from "@/lib/permissions";

export default function TaxTypesPage() {
  const [taxTypes, setTaxTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxBalances, setTaxBalances] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [formData, setFormData] = useState({
    taxId: "",
    taxName: "",
    taxCode: "",
    taxRate: "",
    calculationType: "Percentage",
    accountId: "",
    status: "Active"
  });
  const [hasAccess, setHasAccess] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [selectedTaxType, setSelectedTaxType] = useState(null);
  const [taxReports, setTaxReports] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  useEffect(() => {
    checkPermissions();
    loadData();
    
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    setReportEndDate(endDate.toISOString().split('T')[0]);
    setReportStartDate(startDate.toISOString().split('T')[0]);
  }, []);

  const checkPermissions = async () => {
    const [accountingView, reportsView, taxView, accountingCreate, accountingUpdate, accountingDelete] = await Promise.all([
      getPermission("accounting.view"),
      getPermission("reports.view"),
      getPermission("tax.view"),
      getPermission("accounting.create"),
      getPermission("accounting.update"),
      getPermission("accounting.delete"),
    ]);
    
    setHasAccess(accountingView || reportsView || taxView);
    setCanCreate(accountingCreate || accountingView || reportsView);
    setCanUpdate(accountingUpdate || accountingView || reportsView);
    setCanDelete(accountingDelete || accountingView || reportsView);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taxTypesRes, accountsRes, balancesRes] = await Promise.all([
        fetch("/api/tax-types"),
        fetch("/api/chart-of-accounts"),
        fetch("/api/tax-accounts/balances").catch(() => null) // Optional, don't fail if it errors
      ]);

      if (!taxTypesRes.ok) throw new Error("Failed to load tax types");
      if (!accountsRes.ok) throw new Error("Failed to load accounts");

      const taxTypesData = await taxTypesRes.json();
      const accountsData = await accountsRes.json();

      setTaxTypes(taxTypesData);
      
      const filteredAccounts = (accountsData.accounts || accountsData).filter(
        acc => acc.accountType === "Liability" || acc.accountType === "Asset"
      );
      setAccounts(filteredAccounts);

      // Load balances if available
      if (balancesRes && balancesRes.ok) {
        const balancesData = await balancesRes.json();
        const balancesMap = {};
        balancesData.taxAccounts?.forEach(acc => {
          balancesMap[acc.taxType.id] = {
            totalCollected: acc.totalCollected,
            totalPaid: acc.totalPaid,
            netPayable: acc.netPayable,
            currentBalance: acc.currentBalance,
          };
        });
        setTaxBalances(balancesMap);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const url = editingId 
        ? `/api/tax-types/${editingId}`
        : "/api/tax-types";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          taxRate: parseFloat(formData.taxRate)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save tax type");
      }

      setSuccess(editingId ? "Tax type updated successfully" : "Tax type created successfully");
      setShowAddModal(false);
      setEditingId(null);
      resetForm();
      loadData();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this tax type?")) return;

    try {
      const response = await fetch(`/api/tax-types/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Failed to delete tax type");

      setSuccess("Tax type deleted successfully");
      loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (taxType) => {
    setFormData({
      taxId: taxType.taxId,
      taxName: taxType.taxName,
      taxCode: taxType.taxCode,
      taxRate: taxType.taxRate.toString(),
      calculationType: taxType.calculationType,
      accountId: taxType.accountId,
      status: taxType.status
    });
    setEditingId(taxType.id);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      taxId: "",
      taxName: "",
      taxCode: "",
      taxRate: "",
      calculationType: "Percentage",
      accountId: "",
      status: "Active"
    });
  };

  const handleViewReports = async (tax) => {
    setSelectedTaxType(tax);
    setShowReportsModal(true);
    setLoadingReports(true);
    setTaxReports(null);
    
    try {
      const params = new URLSearchParams();
      if (reportStartDate) params.append('startDate', reportStartDate);
      if (reportEndDate) params.append('endDate', reportEndDate);
      
      const response = await fetch(`/api/tax-types/${tax.id}/reports?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load tax reports');
      
      const data = await response.json();
      setTaxReports(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReports(false);
    }
  };

  const filteredTaxTypes = taxTypes.filter(tax => {
    const matchesSearch = 
      tax.taxName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.taxCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tax.taxId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || tax.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">You don't have permission to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Types Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage tax types linked to accounts for automatic tax posting
            </p>
          </div>
        <div className="flex gap-2">
          <a
            href="/tax-accounts"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <TrendingUp size={20} />
            Tax Accounts Dashboard
          </a>
          {canCreate && (
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setShowAddModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Add Tax Type
            </button>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <div className="flex">
            <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>How it works:</strong> Each tax type is linked to an account (usually a Liability account). 
                When taxes are calculated from transactions (payroll, sales, expenses), they are automatically posted 
                to the linked account. Taxes are not income or expenses - they are liabilities (money owed) or assets (prepaid tax/WHT receivable).
              </p>
            </div>
          </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search tax types..."
                className="border border-gray-300 pl-10 pr-4 py-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <select
                className="border border-gray-300 pl-10 pr-8 py-2 rounded appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Payable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTaxTypes.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No tax types found. Create your first tax type to get started.
                  </td>
                </tr>
              ) : (
                filteredTaxTypes.map((tax) => {
                  const balance = taxBalances[tax.id] || {};
                  return (
                    <tr key={tax.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tax.taxId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {tax.taxName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tax.taxCode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tax.calculationType === "Percentage" 
                          ? `${tax.taxRate}%`
                          : formatCurrency(tax.taxRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tax.account?.accountName || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {balance.currentBalance !== undefined 
                          ? formatCurrency(balance.currentBalance)
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {balance.netPayable !== undefined ? (
                          <span className={`font-semibold ${
                            balance.netPayable >= 0 ? 'text-purple-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(balance.netPayable)}
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tax.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {tax.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewReports(tax)}
                            className="text-green-600 hover:text-green-900"
                            title="View Reports"
                          >
                            <Eye size={18} />
                          </button>
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(tax)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(tax.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    {editingId ? "Edit Tax Type" : "Add New Tax Type"}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax ID *
                      </label>
                      <input
                        type="text"
                        required
                        className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        placeholder="e.g., TAX001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax Code *
                      </label>
                      <input
                        type="text"
                        required
                        className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.taxCode}
                        onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                        placeholder="e.g., PAYE, VAT16.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.taxName}
                      onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                      placeholder="e.g., PAYE, VAT, Withholding Tax"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tax Rate *
                      </label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.taxRate}
                        onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                        placeholder="e.g., 30 or 16.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Calculation Type *
                      </label>
                      <select
                        required
                        className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.calculationType}
                        onChange={(e) => setFormData({ ...formData, calculationType: e.target.value })}
                      >
                        <option value="Percentage">Percentage</option>
                        <option value="Fixed">Fixed Amount</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account *
                    </label>
                    <select
                      required
                      className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.accountId}
                      onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    >
                      <option value="">Select an account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountCode || account.code} - {account.accountName || account.name} ({account.accountType || account.type})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select a Liability account (default) or Asset account (for WHT)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      required
                      className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingId(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save size={18} />
                    {editingId ? "Update" : "Create"} Tax Type
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* Tax Reports Modal */}
      {showReportsModal && selectedTaxType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">Tax Reports: {selectedTaxType.taxName}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tax Code: {selectedTaxType.taxCode} | Rate: {selectedTaxType.calculationType === "Percentage" ? `${selectedTaxType.taxRate}%` : formatCurrency(selectedTaxType.taxRate)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReportsModal(false);
                    setSelectedTaxType(null);
                    setTaxReports(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Date Range Filter */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => handleViewReports(selectedTaxType)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  disabled={loadingReports}
                >
                  <Search size={18} />
                  {loadingReports ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="p-6">
              {loadingReports ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : taxReports ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="text-blue-600" size={20} />
                        <h3 className="text-sm font-medium text-gray-700">Products</h3>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{taxReports.summary.productCount}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="text-green-600" size={20} />
                        <h3 className="text-sm font-medium text-gray-700">Sales</h3>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{taxReports.summary.saleCount}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="text-purple-600" size={20} />
                        <h3 className="text-sm font-medium text-gray-700">Tax Collected</h3>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">{formatCurrency(taxReports.summary.totalTaxCollected)}</p>
                    </div>
                  </div>

                  {/* Products Using This Tax */}
                  {taxReports.products.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Package size={20} />
                        Products Using This Tax ({taxReports.products.length})
                      </h3>
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {taxReports.products.map((product) => (
                              <tr key={product.id}>
                                <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{product.sku || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(product.price)}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    !product.isDeleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {product.isDeleted ? 'Deleted' : 'Active'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sales Using This Tax */}
                  {taxReports.sales.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <ShoppingCart size={20} />
                        Sales Using This Tax ({taxReports.sales.length})
                      </h3>
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale #</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taxable Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {taxReports.sales.map((sale) => (
                              <tr key={sale.id}>
                                <td className="px-4 py-3 text-sm text-gray-900">{sale.saleNumber}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{new Date(sale.saleDate).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{sale.clientName}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{sale.productName}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(sale.taxableAmount)}</td>
                                <td className="px-4 py-3 text-sm font-medium text-purple-600">{formatCurrency(sale.taxAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {taxReports.products.length === 0 && taxReports.sales.length === 0 && (
                    <div className="text-center py-12">
                      <Info className="mx-auto text-gray-400 mb-4" size={48} />
                      <p className="text-gray-500">No data found for this tax type in the selected period.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Click "Refresh" to load reports</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
