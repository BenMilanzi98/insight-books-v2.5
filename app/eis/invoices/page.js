"use client";
import { useState, useEffect } from 'react';
import {
  FileText, Search, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function EISInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  useEffect(() => { fetchInvoices(); }, [page, statusFilter]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(searchTerm ? { search: searchTerm } : {})
      });
      const response = await fetch(`/api/eis/invoices?${params}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async (invoiceId) => {
    setRefreshingId(invoiceId);
    try {
      const res = await fetch(`/api/eis/invoices/${invoiceId}/status`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(inv =>
          inv.id === invoiceId ? { ...inv, ...data.data } : inv
        ));
      }
    } catch (err) {
      console.error('Status refresh failed:', err);
    } finally {
      setRefreshingId(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'Submitted': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'Error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const statusStyles = {
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Submitted: 'bg-blue-100 text-blue-800',
    Pending: 'bg-yellow-100 text-yellow-800',
    Error: 'bg-red-100 text-red-800'
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MRA EIS Invoices</h1>
        <p className="text-gray-500 mt-1">Track and manage your MRA electronic invoice submissions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or MRA ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Error">Error</option>
          </select>
          <button onClick={fetchInvoices}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-3 text-sm font-medium text-gray-900">No invoices found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Invoices submitted to MRA will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRA ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">MK {(inv.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">MK {(inv.taxAmount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{inv.mraInvoiceId || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{inv.sourceType || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(inv.status)}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusStyles[inv.status] || 'bg-gray-100 text-gray-800'}`}>
                          {inv.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {inv.submittedAt ? new Date(inv.submittedAt).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {['Pending', 'Submitted'].includes(inv.status) && (
                          <button onClick={() => refreshStatus(inv.id)} disabled={refreshingId === inv.id}
                            className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Refresh Status">
                            <RefreshCw className={`h-4 w-4 ${refreshingId === inv.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button onClick={() => setSelectedInvoice(inv)} className="text-gray-500 hover:text-gray-700" title="View Details">
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Page {page} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">EIS Invoice Details</h3>
                <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">
                  &times;
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <Detail label="Invoice Number" value={selectedInvoice.invoiceNumber} />
              <Detail label="Invoice Date" value={new Date(selectedInvoice.invoiceDate).toLocaleDateString()} />
              <Detail label="Total Amount" value={`MK ${(selectedInvoice.totalAmount || 0).toLocaleString()}`} />
              <Detail label="Tax Amount" value={`MK ${(selectedInvoice.taxAmount || 0).toLocaleString()}`} />
              <Detail label="Status" value={selectedInvoice.status} />
              <Detail label="MRA Invoice ID" value={selectedInvoice.mraInvoiceId || '-'} />
              <Detail label="Submission ID" value={selectedInvoice.submissionId || '-'} />
              <Detail label="Source" value={selectedInvoice.sourceType || '-'} />
              <Detail label="Submitted At" value={selectedInvoice.submittedAt ? new Date(selectedInvoice.submittedAt).toLocaleString() : '-'} />
              {selectedInvoice.errorMessage && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Error</p>
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg mt-1">{selectedInvoice.errorMessage}</p>
                </div>
              )}
              <Detail label="Retry Count" value={selectedInvoice.retryCount || 0} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
