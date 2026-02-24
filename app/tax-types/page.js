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
  TrendingUp,
  Calculator,
  Building2,
  FileText,
  RefreshCw,
  ChevronRight,
  Percent,
  Link as LinkIcon,
  Download,
  RotateCcw
} from "lucide-react";
import { formatCurrency } from "@/lib/currencyUtils";

export default function TaxTypesPage() {
  const [taxTypes, setTaxTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxBalances, setTaxBalances] = useState({});
  const [defaultTaxAccountId, setDefaultTaxAccountId] = useState(null);
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
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [selectedTaxType, setSelectedTaxType] = useState(null);
  const [taxReports, setTaxReports] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reversedTaxes, setReversedTaxes] = useState([]);
  const [totalTaxReversed, setTotalTaxReversed] = useState(0);
  const [loadingReversedTaxes, setLoadingReversedTaxes] = useState(false);
  const [reversedTaxesStart, setReversedTaxesStart] = useState('');
  const [reversedTaxesEnd, setReversedTaxesEnd] = useState('');
  const [exportingReversedTaxes, setExportingReversedTaxes] = useState(false);

  useEffect(() => {
    loadData();
    
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    setReportEndDate(endDate.toISOString().split('T')[0]);
    setReportStartDate(startDate.toISOString().split('T')[0]);
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taxTypesRes, accountsRes, balancesRes, settingsRes] = await Promise.all([
        fetch("/api/tax-types"),
        fetch("/api/tax-types/accounts").catch(() => ({ ok: false })), // Tax-eligible accounts (no finance role required)
        fetch("/api/tax-accounts/balances").catch(() => null),
        fetch("/api/settings/tax").catch(() => null)
      ]);

      if (!taxTypesRes.ok) {
        const errBody = await taxTypesRes.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to load tax types");
      }

      const taxTypesData = await taxTypesRes.json();
      const taxList = Array.isArray(taxTypesData) ? taxTypesData : (taxTypesData.taxTypes || []);
      setTaxTypes(taxList);

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const list = accountsData.accounts ?? accountsData ?? [];
        setAccounts(Array.isArray(list) ? list : []);
      } else {
        setAccounts([]);
      }

      if (balancesRes && balancesRes.ok) {
        const balancesData = await balancesRes.json();
        const balancesMap = {};
        (balancesData.taxAccounts || []).forEach(acc => {
          const id = acc.taxType?.id;
          if (id) {
            balancesMap[id] = {
              totalCollected: acc.totalCollected,
              totalPaid: acc.totalPaid,
              netPayable: acc.netPayable,
              currentBalance: acc.currentBalance,
            };
          }
        });
        setTaxBalances(balancesMap);
      }

      if (settingsRes && settingsRes.ok) {
        const settings = await settingsRes.json();
        setDefaultTaxAccountId(settings.taxOutflowAccountId || null);
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
      accountId: defaultTaxAccountId || "",
      status: "Active"
    });
  };

  const loadReversedTaxes = async () => {
    setLoadingReversedTaxes(true);
    try {
      const params = new URLSearchParams();
      if (reversedTaxesStart) params.append('startDate', reversedTaxesStart);
      if (reversedTaxesEnd) params.append('endDate', reversedTaxesEnd);
      const res = await fetch(`/api/tax-types/reversed-taxes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load reversed taxes');
      const data = await res.json();
      setReversedTaxes(data.reversedTaxes || []);
      setTotalTaxReversed(data.totalTaxReversed || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReversedTaxes(false);
    }
  };

  useEffect(() => {
    loadReversedTaxes();
  }, []);

  const handleExportReversedTaxes = async (format) => {
    setExportingReversedTaxes(true);
    try {
      const params = new URLSearchParams({ format: format === 'pdf' ? 'pdf' : 'xlsx' });
      if (reversedTaxesStart) params.append('startDate', reversedTaxesStart);
      if (reversedTaxesEnd) params.append('endDate', reversedTaxesEnd);
      const res = await fetch(`/api/tax-types/reversed-taxes/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reversed-taxes-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExportingReversedTaxes(false);
    }
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

  const activeTaxCount = taxTypes.filter(t => t.status === "Active").length;
  const totalTaxRate = taxTypes.reduce((sum, t) => sum + (t.taxRate || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tax types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Calculator className="text-white" size={24} />
              </div>
              Tax Management
            </h1>
            <p className="text-gray-500 mt-1">
              Create and manage taxes linked to accounts for automatic tax posting
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/tax-accounts"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-sm"
            >
              <TrendingUp size={18} />
              Tax Accounts
            </a>
            <button
              onClick={() => {
                resetForm();
                setEditingId(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
            >
              <Plus size={18} />
              Add Tax Type
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Tax Types</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{taxTypes.length}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Calculator className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Taxes</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{activeTaxCount}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Tax Rate</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {taxTypes.length > 0 ? (totalTaxRate / taxTypes.length).toFixed(2) : 0}%
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <Percent className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Info className="text-blue-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-blue-800 font-medium">How it works</p>
            <p className="text-sm text-blue-600 mt-1">
              Each tax type is linked to an account (usually a Liability account). <strong>Taxes collected</strong> come from sales and invoices; <strong>taxes paid</strong> come from purchases (purchase orders, expenses, supplier bills). Net payable = collected − paid.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-3">
          <CheckCircle size={20} />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tax types..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[160px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              className="w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-all"
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

      {/* Tax Types Grid */}
      {filteredTaxTypes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="p-4 bg-gray-50 rounded-full inline-block mb-4">
            <Calculator className="text-gray-400" size={48} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tax types found</h3>
          <p className="text-gray-500 mb-6">Create your first tax type to get started</p>
          <button
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Tax Type
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTaxTypes.map((tax) => {
            const balance = taxBalances[tax.id] || {};
            return (
              <div key={tax.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{tax.taxName}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          tax.status === "Active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {tax.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{tax.taxCode}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {tax.calculationType === "Percentage" 
                          ? `${tax.taxRate}%`
                          : formatCurrency(tax.taxRate)}
                      </p>
                      <p className="text-xs text-gray-500">Tax Rate</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    {tax.account && (
                      <div className="flex items-center gap-2 text-sm">
                        <LinkIcon size={14} className="text-gray-400" />
                        <span className="text-gray-600">{tax.account.accountName}</span>
                      </div>
                    )}
                    
                    {balance.totalCollected !== undefined && (
                      <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-600">Taxes collected (sales)</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(balance.totalCollected)}
                        </span>
                      </div>
                    )}
                    {balance.totalPaid !== undefined && (
                      <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-600">Taxes paid (purchases)</span>
                        <span className="font-semibold text-amber-700">
                          {formatCurrency(balance.totalPaid)}
                        </span>
                      </div>
                    )}
                    {balance.netPayable !== undefined && (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-600">Net Payable</span>
                        <span className={`font-semibold ${
                          balance.netPayable >= 0 ? 'text-purple-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(balance.netPayable)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleViewReports(tax)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="View Reports"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(tax)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(tax.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reversed Taxes Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <RotateCcw className="text-amber-600" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reversed Taxes</h2>
              <p className="text-sm text-gray-500">Tax amounts reversed via refunds and their corresponding transactions</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={reversedTaxesStart}
              onChange={(e) => setReversedTaxesStart(e.target.value)}
            />
            <input
              type="date"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={reversedTaxesEnd}
              onChange={(e) => setReversedTaxesEnd(e.target.value)}
            />
            <button
              type="button"
              onClick={loadReversedTaxes}
              disabled={loadingReversedTaxes}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingReversedTaxes ? 'Loading...' : 'Apply'}
            </button>
            <button
              type="button"
              onClick={() => handleExportReversedTaxes('xlsx')}
              disabled={exportingReversedTaxes || reversedTaxes.length === 0}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => handleExportReversedTaxes('pdf')}
              disabled={exportingReversedTaxes || reversedTaxes.length === 0}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>
        {loadingReversedTaxes ? (
          <div className="py-8 text-center text-gray-500">Loading reversed taxes...</div>
        ) : reversedTaxes.length === 0 ? (
          <div className="py-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
            No reversed taxes found for the selected period.
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm font-medium text-gray-700">
              Total tax reversed: <span className="text-amber-600 font-semibold">{formatCurrency(totalTaxReversed)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Transaction</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Tax Reversed</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reversedTaxes.map((row) => (
                    <tr key={`${row.type}-${row.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{row.reference}</td>
                      <td className="px-4 py-2.5 text-gray-700">{row.type}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-amber-700">{formatCurrency(row.taxReversed || 0)}</td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate" title={row.reason}>{row.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {editingId ? "Edit Tax Type" : "Add New Tax Type"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tax ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  placeholder="e.g., TAX001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tax Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={formData.taxName}
                  onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
                  placeholder="e.g., PAYE, VAT, Withholding Tax"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tax Rate <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    placeholder="e.g., 30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
                    value={formData.calculationType}
                    onChange={(e) => setFormData({ ...formData, calculationType: e.target.value })}
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed Amount</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Linked Account
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountCode || account.code} - {account.accountName || account.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1.5">
                  Select a Liability account (default) or Asset account (for WHT)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && selectedTaxType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Tax Reports: {selectedTaxType.taxName}</h2>
                  <p className="text-green-100 mt-1">
                    {selectedTaxType.taxCode} • {selectedTaxType.calculationType === "Percentage" ? `${selectedTaxType.taxRate}%` : formatCurrency(selectedTaxType.taxRate)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowReportsModal(false);
                    setSelectedTaxType(null);
                    setTaxReports(null);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => handleViewReports(selectedTaxType)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center gap-2 text-sm"
                  disabled={loadingReports}
                >
                  <RefreshCw size={16} className={loadingReports ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingReports ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
                </div>
              ) : taxReports ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                      <p className="text-blue-100 text-sm">Products</p>
                      <p className="text-3xl font-bold mt-1">{taxReports.summary.productCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
                      <p className="text-green-100 text-sm">Sales</p>
                      <p className="text-3xl font-bold mt-1">{taxReports.summary.saleCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                      <p className="text-purple-100 text-sm">Tax Collected</p>
                      <p className="text-3xl font-bold mt-1">{formatCurrency(taxReports.summary.totalTaxCollected)}</p>
                    </div>
                  </div>

                  {/* Products Table */}
                  {taxReports.products.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Products Using This Tax ({taxReports.products.length})</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {taxReports.products.map((product) => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 text-sm text-gray-900 font-medium">{product.name}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{product.sku || 'N/A'}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{formatCurrency(product.price)}</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    !product.isDeleted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
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

                  {/* Sales Table */}
                  {taxReports.sales.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-4 border-b bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Sales Using This Tax ({taxReports.sales.length})</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale #</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taxable</th>
                              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {taxReports.sales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-gray-50">
                                <td className="px-5 py-3 text-sm text-gray-900 font-medium">{sale.saleNumber}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{new Date(sale.saleDate).toLocaleDateString()}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{sale.clientName}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{formatCurrency(sale.taxableAmount)}</td>
                                <td className="px-5 py-3 text-sm font-semibold text-purple-600">{formatCurrency(sale.taxAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {taxReports.products.length === 0 && taxReports.sales.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                      <Info className="mx-auto text-gray-400 mb-3" size={48} />
                      <p className="text-gray-500">No data found for this tax type in the selected period</p>
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
