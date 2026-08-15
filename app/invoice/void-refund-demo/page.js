"use client";
import { tt } from '@/lib/i18n/runtime';

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, FileText, DollarSign } from 'lucide-react';
import VoidInvoiceModal from '@/components/VoidInvoiceModal';
import RefundInvoiceModal from '@/components/RefundInvoiceModal';

export default function VoidRefundDemoPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Load sample invoices for demo
    loadSampleInvoices();
  }, []);

  const loadSampleInvoices = () => {
    // Sample data for demonstration
    const sampleInvoices = [
      {
        id: 'demo-1',
        invoiceNumber: 'INV-001',
        client: { name: 'Acme Corp', email: 'billing@acme.com' },
        total: 1500.00,
        status: 'sent',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        payments: [],
        refunds: []
      },
      {
        id: 'demo-2',
        invoiceNumber: 'INV-002',
        client: { name: 'Tech Solutions', email: 'accounts@techsolutions.com' },
        total: 2500.00,
        status: 'paid',
        issueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        payments: [{ amount: 2500.00, status: 'Completed' }],
        refunds: []
      },
      {
        id: 'demo-3',
        invoiceNumber: 'INV-003',
        client: { name: 'Global Industries', email: 'finance@global.com' },
        total: 3200.00,
        status: 'partially_refunded',
        issueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        payments: [{ amount: 3200.00, status: 'Completed' }],
        refunds: [{ refundAmount: 800.00 }]
      },
      {
        id: 'demo-4',
        invoiceNumber: 'INV-004',
        client: { name: 'Startup Inc', email: 'billing@startup.com' },
        total: 800.00,
        status: 'void',
        issueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        payments: [],
        refunds: [],
        voidReason: 'Client requested cancellation',
        voidedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      }
    ];
    
    setInvoices(sampleInvoices);
    setLoading(false);
  };

  const handleVoidInvoice = async (invoiceId, reason) => {
    try {
      setIsProcessingAction(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local state
      setInvoices(prev => prev.map(inv => 
        inv.id === invoiceId 
          ? { ...inv, status: 'void', voidReason: reason, voidedAt: new Date() }
          : inv
      ));
      
      setSuccessMessage('Invoice voided successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error voiding invoice:', error);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRefundInvoice = async (invoiceId, refundAmount, refundReason, refundMethod, notes) => {
    try {
      setIsProcessingAction(true);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local state
      setInvoices(prev => prev.map(inv => {
        if (inv.id === invoiceId) {
          const totalRefunded = (inv.refunds?.reduce((sum, r) => sum + r.refundAmount, 0) || 0) + refundAmount;
          const totalPaid = inv.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
          
          return {
            ...inv,
            status: totalRefunded >= totalPaid ? 'refunded' : 'partially_refunded',
            refunds: [...(inv.refunds || []), { refundAmount, refundReason, refundMethod, notes }]
          };
        }
        return inv;
      }));
      
      setSuccessMessage('Refund processed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error processing refund:', error);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const openVoidModal = (invoice) => {
    setSelectedInvoice(invoice);
    setVoidModalOpen(true);
  };

  const openRefundModal = (invoice) => {
    setSelectedInvoice(invoice);
    setRefundModalOpen(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      void: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
      partially_refunded: 'bg-yellow-100 text-yellow-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.draft}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {tt('Invoice Void & Refund Demo')}
        </h1>
        <p className="text-gray-600 text-lg">
          This page demonstrates the void and refund functionality for invoices. 
          You can test voiding invoices that haven't been paid and processing refunds for paid invoices.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-8 w-8 text-blue-600 mr-3" />
            <h3 className="text-lg font-semibold text-blue-800">{tt('Void Invoices')}</h3>
          </div>
          <p className="text-blue-700 text-sm">
            {tt("Void invoices that haven't been paid yet. This is useful for correcting mistakes, duplicate invoices, or client cancellations.")}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-8 w-8 text-green-600 mr-3" />
            <h3 className="text-lg font-semibold text-green-800">{tt('Process Refunds')}</h3>
          </div>
          <p className="text-green-700 text-sm">
            {tt('Process full or partial refunds for paid invoices. Supports multiple refund methods and maintains detailed audit trails.')}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <FileText className="h-8 w-8 text-blue-600 mr-3" />
            <h3 className="text-lg font-semibold text-blue-800">{tt('Audit Trail')}</h3>
          </div>
          <p className="text-blue-700 text-sm">
            {tt('Every void and refund action is logged with detailed information including reasons, timestamps, and user details for compliance.')}
          </p>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{tt('Sample Invoices')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {tt('Click the action buttons to test void and refund functionality')}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Invoice')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Client')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Amount')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tt('Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(invoice.issueDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.client.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invoice.client.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    MWK {invoice.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {/* Void Button */}
                      {invoice.status !== 'void' && invoice.status !== 'refunded' && 
                       invoice.status !== 'partially_refunded' && 
                       !invoice.payments?.some(p => p.status === 'Completed') && (
                        <button
                          onClick={() => openVoidModal(invoice)}
                          className="text-orange-600 hover:text-orange-900 bg-orange-100 hover:bg-orange-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          title="Void Invoice"
                        >
                          {tt('Void')}
                        </button>
                      )}
                      
                      {/* Refund Button */}
                      {invoice.status !== 'void' && invoice.status !== 'draft' && 
                       invoice.payments?.some(p => p.status === 'Completed') && (
                        <button
                          onClick={() => openRefundModal(invoice)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          title="Process Refund"
                        >
                          {tt('Refund')}
                        </button>
                      )}
                      
                                             {/* Status Info */}
                       {invoice.status === 'void' && (
                         <div className="text-xs text-gray-500">
                           <div>Voided: {new Date(invoice.voidedAt).toLocaleDateString()}</div>
                           <div>Reason: {invoice.voidReason}</div>
                         </div>
                       )}
                       
                       {invoice.status === 'partially_refunded' && (
                         <div className="text-xs text-gray-500">
                           <div>Refunded: MWK {invoice.refunds?.reduce((sum, r) => sum + r.refundAmount, 0).toFixed(2)}</div>
                         </div>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <VoidInvoiceModal
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        invoice={selectedInvoice}
        onVoid={handleVoidInvoice}
        loading={isProcessingAction}
      />

      <RefundInvoiceModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        invoice={selectedInvoice}
        onRefund={handleRefundInvoice}
        loading={isProcessingAction}
      />
    </div>
  );
}
