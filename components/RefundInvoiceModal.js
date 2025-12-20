"use client";

import React, { useState, useEffect } from 'react';
import { X, DollarSign, AlertTriangle, FileText, Calculator } from 'lucide-react';

export default function RefundInvoiceModal({ 
  invoice, 
  isOpen, 
  onClose, 
  onRefund, 
  loading = false 
}) {
  const [formData, setFormData] = useState({
    refundAmount: '',
    refundReason: '',
    refundMethod: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [availableForRefund, setAvailableForRefund] = useState(0);
  
  useEffect(() => {
    if (invoice && isOpen) {
      // Calculate available amount for refund
      const totalPaid = invoice.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const totalRefunded = invoice.refunds?.reduce((sum, refund) => sum + refund.refundAmount, 0) || 0;
      const available = totalPaid - totalRefunded;
      setAvailableForRefund(available);
      
      // Pre-fill refund amount with available amount
      setFormData(prev => ({
        ...prev,
        refundAmount: available > 0 ? available.toFixed(2) : '0.00'
      }));
    }
  }, [invoice, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.refundAmount || parseFloat(formData.refundAmount) <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

          if (parseFloat(formData.refundAmount) > availableForRefund) {
        setError(`Refund amount cannot exceed available amount (MWK ${availableForRefund.toFixed(2)})`);
        return;
      }

    if (!formData.refundReason.trim() || formData.refundReason.trim().length < 3) {
      setError('Please provide a reason for the refund (minimum 3 characters)');
      return;
    }

    if (!formData.refundMethod) {
      setError('Please select a refund method');
      return;
    }

    try {
      await onRefund(
        invoice.id, 
        parseFloat(formData.refundAmount),
        formData.refundReason.trim(),
        formData.refundMethod,
        formData.notes.trim() || null
      );
      setFormData({ refundAmount: '', refundReason: '', refundMethod: '', notes: '' });
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to process refund');
    }
  };

  const handleClose = () => {
    setFormData({ refundAmount: '', refundReason: '', refundMethod: '', notes: '' });
    setError('');
    onClose();
  };

  const refundMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_note', label: 'Credit Note' },
    { value: 'check', label: 'Check' },
    { value: 'credit_card_refund', label: 'Credit Card Refund' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-[950px] shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Process Refund
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Invoice Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <FileText className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Invoice #{invoice?.invoiceNumber}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Client:</strong> {invoice?.client?.name}</p>
                              <p><strong>Invoice Total:</strong> MWK {invoice?.total?.toFixed(2)}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                  invoice?.status === 'paid' ? 'bg-green-100 text-green-800' :
                  invoice?.status === 'partially_refunded' ? 'bg-yellow-100 text-yellow-800' :
                  invoice?.status === 'refunded' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {invoice?.status}
                </span>
              </p>
                              <p><strong>Available for Refund:</strong> 
                  <span className="font-semibold text-green-600 ml-1">
                    MWK {availableForRefund.toFixed(2)}
                  </span>
                </p>
            </div>
          </div>

          {/* Payment Summary */}
          {invoice?.payments && invoice.payments.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <div className="flex items-center mb-2">
                <Calculator className="h-4 w-4 text-blue-500 mr-2" />
                <h4 className="text-sm font-medium text-blue-800">Payment Summary</h4>
              </div>
              <div className="text-sm text-blue-700">
                <p><strong>Total Paid:</strong> MWK {invoice.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}</p>
                <p><strong>Total Refunded:</strong> MWK {(invoice.refunds?.reduce((sum, r) => sum + r.refundAmount, 0) || 0).toFixed(2)}</p>
                <p><strong>Available for Refund:</strong> <span className="font-semibold">MWK {availableForRefund.toFixed(2)}</span></p>
              </div>
            </div>
          )}



          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="refundAmount" className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Amount *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">MWK</span>
                  </div>
                  <input
                    type="number"
                    id="refundAmount"
                    name="refundAmount"
                    step="0.01"
                    min="0.01"
                    max={availableForRefund}
                    value={formData.refundAmount}
                    onChange={handleInputChange}
                    className="pl-7 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    required
                    disabled={loading}
                    style={{paddingLeft: '55px'}}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Max: MWK {availableForRefund.toFixed(2)}
                </p>
              </div>

              <div>
                <label htmlFor="refundMethod" className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Method *
                </label>
                <select
                  id="refundMethod"
                  name="refundMethod"
                  value={formData.refundMethod}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={loading}
                >
                  <option value="">Select method</option>
                  {refundMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="refundReason" className="block text-sm font-medium text-gray-700 mb-2">
                Refund Reason *
              </label>
              <textarea
                id="refundReason"
                name="refundReason"
                rows={3}
                value={formData.refundReason}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Explain why this refund is being processed..."
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 3 characters required
              </p>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional information about this refund..."
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.refundAmount || !formData.refundReason || !formData.refundMethod}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  'Process Refund'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
