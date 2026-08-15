"use client";
import { tt } from '@/lib/i18n/runtime';
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  History,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import { formatCurrency } from "@/lib/currencyUtils";

export default function SupplierDetailPage() {
  const params = useParams();
  const supplierId = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [summary, setSummary] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState("summary");

  // Load supplier data
  const loadSupplierData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tenantId = localStorage.getItem('tenantId');
      if (!tenantId) {
        throw new Error("Tenant ID not found");
      }

      // Load supplier details
      const supplierRes = await fetch(`/api/suppliers/${supplierId}?tenantId=${tenantId}`);
      const supplierJson = await supplierRes.json();
      if (!supplierRes.ok) throw new Error(supplierJson?.error || "Failed to load supplier");
      setSupplier(supplierJson.supplier);

      // Load financial summary
      const summaryRes = await fetch(`/api/suppliers/${supplierId}/summary?tenantId=${tenantId}`);
      const summaryJson = await summaryRes.json();
      if (summaryRes.ok) {
        setSummary(summaryJson);
      }

      // Load purchase history
      const purchasesRes = await fetch(`/api/suppliers/${supplierId}/summary?tenantId=${tenantId}`); // Reuse for now
      const purchasesJson = await purchasesRes.json();
      if (purchasesRes.ok && purchasesJson?.pendingBills) {
        setPurchases(purchasesJson.pendingBills);
      }

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) {
      loadSupplierData();
    }
  }, [supplierId]);

  // Format date helper
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format currency helper
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat('en-MW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Get risk level badge
  const getRiskBadge = (risk) => {
    const colors = {
      high: "bg-red-100 text-red-700 border-red-200",
      medium: "bg-orange-100 text-orange-700 border-orange-200",
      low: "bg-green-100 text-green-700 border-green-200"
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[risk?.level] || colors.low}`}>
        {risk?.label || "Low Risk"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          {tt('Loading supplier details...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Link href="/suppliers" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft size={18} />
            {tt('Back to Suppliers')}
          </Link>
          <div className="p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Link href="/suppliers" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft size={18} />
            {tt('Back to Suppliers')}
          </Link>
          <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md text-yellow-700">
            {tt('Supplier not found')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="suppliers.view">
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link href="/suppliers" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft size={18} />
              {tt('Back to Suppliers')}
            </Link>
            
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">{supplier.supplierName}</h1>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    supplier.isActive 
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-600 border border-gray-300"
                  }`}>
                    {supplier.isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {supplier.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Supplier Code: {supplier.supplierCode}</p>
              </div>
              
              <button
                onClick={loadSupplierData}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                {tt('Refresh')}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-md text-red-700 flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{tt('Outstanding Balance')}</p>
                    <p className={`text-xl font-bold mt-1 ${summary.summary?.outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(summary.summary?.outstandingBalance || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                    <DollarSign size={20} className="text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{tt('Total Purchases')}</p>
                    <p className="text-xl font-bold mt-1 text-gray-900">
                      {formatCurrency(summary.summary?.totalBills || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <TrendingUp size={20} className="text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{tt('Total Paid')}</p>
                    <p className="text-xl font-bold mt-1 text-green-600">
                      {formatCurrency(summary.summary?.totalPayments || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{tt('Available Credit')}</p>
                    <p className="text-xl font-bold mt-1 text-gray-900">
                      {formatCurrency(summary.summary?.availableCredit || 0)}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <CreditCard size={20} className="text-blue-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex gap-4">
              {['summary', 'aging', 'purchases', 'details'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Summary Tab */}
            {activeTab === 'summary' && summary && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Financial Summary')}</h2>
                
                {/* Aging Analysis */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{tt('Aging Analysis')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 uppercase">{tt('Current')}</p>
                      <p className="text-lg font-bold text-green-700">{formatNumber(summary.aging?.current || 0)}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-yellow-600 uppercase">{tt('31-60 Days')}</p>
                      <p className="text-lg font-bold text-yellow-700">{formatNumber(summary.aging?.days31to60 || 0)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-orange-600 uppercase">{tt('61-90 Days')}</p>
                      <p className="text-lg font-bold text-orange-700">{formatNumber(summary.aging?.days61to90 || 0)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-600 uppercase">{tt('Over 90 Days')}</p>
                      <p className="text-lg font-bold text-red-700">{formatNumber(summary.aging?.over90 || 0)}</p>
                    </div>
                    <div className="bg-gray-100 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-600 uppercase">{tt('Total Outstanding')}</p>
                      <p className="text-lg font-bold text-gray-900">{formatNumber(summary.aging?.totalOutstanding || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Pending Bills */}
                {summary.pendingBills && summary.pendingBills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{tt('Pending Bills')}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Bill #')}</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Date')}</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Due Date')}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Total')}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Paid')}</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Unpaid')}</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {summary.pendingBills.map((bill) => (
                            <tr key={bill.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">{bill.billNumber}</td>
                              <td className="px-3 py-2 text-gray-600">{formatDate(bill.billDate)}</td>
                              <td className="px-3 py-2 text-gray-600">{formatDate(bill.dueDate)}</td>
                              <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(bill.totalAmount || 0)}</td>
                              <td className="px-3 py-2 text-right text-green-600">{formatCurrency(bill.amountPaid || 0)}</td>
                              <td className="px-3 py-2 text-right text-red-600 font-medium">
                                {formatCurrency((bill.totalAmount || 0) - (bill.amountPaid || 0))}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  bill.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                  bill.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {bill.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aging Tab */}
            {activeTab === 'aging' && summary && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Aging Analysis')}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{tt('Outstanding by Age')}</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Current (Not Yet Due)', value: summary.aging?.current || 0, color: 'bg-green-500' },
                        { label: '31-60 Days Past Due', value: summary.aging?.days31to60 || 0, color: 'bg-yellow-500' },
                        { label: '61-90 Days Past Due', value: summary.aging?.days61to90 || 0, color: 'bg-orange-500' },
                        { label: 'Over 90 Days', value: summary.aging?.over90 || 0, color: 'bg-red-500' }
                      ].map((item) => {
                        const percentage = summary.aging?.totalOutstanding > 0 
                          ? ((item.value / summary.aging.totalOutstanding) * 100).toFixed(1)
                          : 0;
                        
                        return (
                          <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-700">{item.label}</span>
                              <span className="text-sm font-medium text-gray-900">{formatNumber(item.value)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${item.color}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{percentage}% of total</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">{tt('Payment Risk Assessment')}</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {getRiskBadge(summary.riskAssessment)}
                      <p className="text-sm text-gray-600 mt-3">
                        {tt("Based on the aging analysis, this supplier's payment risk level has been assessed as")} 
                        <strong> {summary.riskAssessment?.label || 'Low Risk'}</strong>.
                      </p>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Credit Limit: {formatCurrency(supplier.creditLimit || 0)}<br />
                          Current Balance: {formatCurrency(supplier.currentBalance || 0)}<br />
                          Available Credit: {formatNumber(summary.summary?.availableCredit || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Purchases Tab */}
            {activeTab === 'purchases' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Purchase History')}</h2>
                {summary?.pendingBills?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Bill #')}</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Date')}</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{tt('Due Date')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Total')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Paid')}</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{tt('Balance')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {summary.pendingBills.map((bill) => (
                          <tr key={bill.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{bill.billNumber}</td>
                            <td className="px-3 py-2 text-gray-600">{formatDate(bill.billDate)}</td>
                            <td className="px-3 py-2 text-gray-600">{formatDate(bill.dueDate)}</td>
                            <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(bill.totalAmount || 0)}</td>
                            <td className="px-3 py-2 text-right text-green-600">{formatCurrency(bill.amountPaid || 0)}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">
                              {formatCurrency((bill.totalAmount || 0) - (bill.amountPaid || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText size={40} className="mx-auto mb-3 text-gray-300" />
                    <p>{tt('No pending bills found')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{tt('Supplier Details')}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Phone size={16} />
                      {tt('Contact Information')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      {supplier.contactPerson && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-24">{tt('Contact:')}</span>
                          <span className="text-gray-900">{supplier.contactPerson}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-400" />
                          <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">{supplier.email}</a>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" />
                          <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">{supplier.phone}</a>
                        </div>
                      )}
                      {supplier.mobile && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-24">{tt('Mobile:')}</span>
                          <span className="text-gray-900">{supplier.mobile}</span>
                        </div>
                      )}
                      {supplier.website && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 w-24">{tt('Website:')}</span>
                          <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {supplier.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <MapPin size={16} />
                      {tt('Address')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      {supplier.address && (
                        <p className="text-gray-900">{supplier.address}</p>
                      )}
                      {(supplier.city || supplier.country) && (
                        <p className="text-gray-900">
                          {supplier.city}{supplier.city && supplier.country && ', '}{supplier.country}
                        </p>
                      )}
                      {supplier.postalCode && (
                        <p className="text-gray-500">{supplier.postalCode}</p>
                      )}
                      {supplier.taxId && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <span className="text-gray-500">{tt('Tax ID / TIN:')}</span>
                          <span className="ml-2 text-gray-900">{supplier.taxId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Terms */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <CreditCard size={16} />
                      {tt('Financial Terms')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{tt('Payment Terms:')}</span>
                        <span className="text-gray-900">{supplier.paymentTerms || 30} days</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{tt('Currency:')}</span>
                        <span className="text-gray-900">{supplier.currency || 'MWK'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{tt('Credit Limit:')}</span>
                        <span className="text-gray-900">{formatCurrency(supplier.creditLimit || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{tt('Current Balance:')}</span>
                        <span className={`font-medium ${supplier.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(supplier.currentBalance || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Banking */}
                  {(supplier.bankName || supplier.bankAccountNumber || supplier.bankBranch) && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <DollarSign size={16} />
                        {tt('Banking Information')}
                      </h3>
                      <div className="space-y-2 text-sm">
                        {supplier.bankName && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">{tt('Bank:')}</span>
                            <span className="text-gray-900">{supplier.bankName}</span>
                          </div>
                        )}
                        {supplier.bankAccountNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">{tt('Account #:')}</span>
                            <span className="text-gray-900">{supplier.bankAccountNumber}</span>
                          </div>
                        )}
                        {supplier.bankBranch && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">{tt('Branch:')}</span>
                            <span className="text-gray-900">{supplier.bankBranch}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {supplier.notes && (
                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FileText size={16} />
                        {tt('Notes')}
                      </h3>
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{supplier.notes}</p>
                    </div>
                  )}

                  {/* Audit Info */}
                  <div className="md:col-span-2 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Created: {formatDate(supplier.createdAt)} | 
                      Last Updated: {formatDate(supplier.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
