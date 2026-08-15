"use client";
import { tt } from '@/lib/i18n/runtime';

import React, { useState } from 'react';
import { X, DollarSign, AlertTriangle, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { MIN_AUDIT_REASON_LENGTH } from '@/lib/auditReasonConstants';

export default function RefundSaleModal({
  sale,
  isOpen,
  onClose,
  onRefund,
  loading = false
}) {
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const availableForRefund = sale?.rawTotal != null ? Number(sale.rawTotal) : (sale?.total != null ? Number(sale.total) : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!refundReason.trim() || refundReason.trim().length < MIN_AUDIT_REASON_LENGTH) {
      setError(
        `Please provide a reason for the refund (minimum ${MIN_AUDIT_REASON_LENGTH} characters for audit)`
      );
      return;
    }

    if (!refundMethod) {
      setError('Please select a refund method');
      return;
    }

    try {
      await onRefund(sale.id, refundReason.trim(), refundMethod);
      setRefundReason('');
      setRefundMethod('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to process refund');
    }
  };

  const handleClose = () => {
    setRefundReason('');
    setRefundMethod('');
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
      <div className="relative top-20 mx-auto p-5 border w-[95%] max-w-[500px] shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 ml-3">
                {tt('Process Refund')}
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

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <Receipt className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Sale #{sale?.saleNumber}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>{tt('Customer:')}</strong> {sale?.client ?? 'Walk-in'}</p>
              <p><strong>{tt('Sale Total:')}</strong> {formatCurrency(availableForRefund)}</p>
              <p><strong>{tt('Refund Amount:')}</strong> <span className="font-semibold text-green-600">{formatCurrency(availableForRefund)}</span> (full refund)</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="refundMethod" className="block text-sm font-medium text-gray-700 mb-2">
                {tt('Refund Method *')}
              </label>
              <select
                id="refundMethod"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              >
                <option value="">{tt('Select method')}</option>
                {refundMethods.map(method => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="refundReason" className="block text-sm font-medium text-gray-700 mb-2">
                {tt('Refund Reason *')}
              </label>
              <textarea
                id="refundReason"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder={tt('Explain why this refund is being processed...')}
                required
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum {MIN_AUDIT_REASON_LENGTH} characters required (audit / GL reversal)
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{tt('Error')}</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {tt('Cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  !refundMethod ||
                  refundReason.trim().length < MIN_AUDIT_REASON_LENGTH
                }
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {tt('Processing...')}
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
