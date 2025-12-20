"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, FileText } from 'lucide-react';

export default function VoidInvoiceModal({ 
  invoice, 
  isOpen, 
  onClose, 
  onVoid, 
  loading = false 
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a reason for voiding this invoice (minimum 3 characters)');
      return;
    }

    try {
      await onVoid(invoice.id, reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      setError(error.message || 'Failed to void invoice');
    }
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                Void Invoice
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
            <div className="text-sm text-gray-600">
              <p><strong>Client:</strong> {invoice?.client?.name}</p>
                              <p><strong>Amount:</strong> MWK {invoice?.total?.toFixed(2)}</p>
              <p><strong>Status:</strong> 
                <span className={`ml-1 px-2 py-1 text-xs rounded-full ${
                  invoice?.status === 'paid' ? 'bg-green-100 text-green-800' :
                  invoice?.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {invoice?.status}
                </span>
              </p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  ⚠️ This action cannot be undone
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>Voiding this invoice will:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Mark the invoice as void</li>
                    <li>Prevent any further payments</li>
                    <li>Record the void reason for audit purposes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Voiding *
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                placeholder="Explain why this invoice needs to be voided..."
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum 3 characters required
              </p>
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
                disabled={loading || !reason.trim() || reason.trim().length < 3}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Voiding...
                  </div>
                ) : (
                  'Void Invoice'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
