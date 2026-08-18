import { tt } from '@/lib/i18n/runtime';
/**
 * Transaction Reversal Modal
 * 
 * UI component for executing transaction reversals with:
 * - Transaction summary display
 * - Impact preview
 * - Mandatory reason input
 * - Confirmation workflow
 */

import { useState, useEffect } from 'react';
import { useTransactionReversal, useReversalEligibility, useReversalImpact, useReversalExecution } from '@/hooks/useTransactionReversal';

export default function ReversalModal({ 
  isOpen: propIsOpen, 
  onClose: propOnClose, 
  transaction: propTransaction, 
  transactionType: propTransactionType,
  onReversalSuccess 
}) {
  // Use internal hook for state management
  const {
    isOpen: hookIsOpen,
    transaction: hookTransaction,
    transactionType: hookTransactionType,
    step,
    reversalReason,
    setReversalReason,
    preview,
    error,
    result,
    openModal,
    closeModal,
    goToReasonStep,
    setStep
  } = useTransactionReversal();

  // Use props if provided, otherwise use hook state
  const isOpen = propIsOpen !== undefined ? propIsOpen : hookIsOpen;
  const transaction = propTransaction !== undefined ? propTransaction : hookTransaction;
  const transactionType = propTransactionType !== undefined ? propTransactionType : hookTransactionType;

  // Sync props with hook state
  useEffect(() => {
    if (propIsOpen && propTransaction && propTransactionType) {
      openModal(propTransaction, propTransactionType);
    } else if (propIsOpen === false && hookIsOpen) {
      closeModal();
    }
  }, [propIsOpen, propTransaction, propTransactionType, openModal, closeModal, hookIsOpen]);

  // Handle close with prop callback
  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    }
    closeModal();
  };

  const { eligibility, loading: eligibilityLoading, checkEligibility } = useReversalEligibility();
  const { impact, loading: impactLoading, fetchImpact } = useReversalImpact();
  const { executing, error: executionError, executeReversal } = useReversalExecution();

  // Handle reversal success callback (skip auto-close when awaiting approval)
  useEffect(() => {
    if (result && step === 'complete' && onReversalSuccess && !result.pendingApproval) {
      const timer = setTimeout(() => {
        onReversalSuccess();
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [result, step, onReversalSuccess]);

  // Normalize transaction type to match API expectations (capitalize first letter)
  const normalizeTransactionType = (type) => {
    if (!type) return type;
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Check eligibility when modal opens
  useEffect(() => {
    if (isOpen && transaction && transactionType) {
      const normalizedType = normalizeTransactionType(transactionType);
      checkEligibility(transaction.id, normalizedType);
      fetchImpact(transaction.id, normalizedType);
    }
  }, [isOpen, transaction, transactionType, checkEligibility, fetchImpact]);

  const handleConfirmReversal = async () => {
    try {
      const normalizedType = normalizeTransactionType(transactionType);
      const data = await executeReversal(transaction.id, normalizedType, reversalReason);
      setResult(data);
      setStep('complete');
    } catch (err) {
      // Error is handled by the hook
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) {
      return 'MWK 0.00';
    }
    const formattedNumber = new Intl.NumberFormat('en-MW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(amount));
    return `MWK ${formattedNumber}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTypeLabel = (type) => {
    const labels = {
      Invoice: 'Invoice',
      Expense: 'Expense',
      Payment: 'Payment',
      Sale: 'Sale',
      SupplierPayment: 'Supplier Payment',
      Transaction: 'Journal Entry'
    };
    return labels[type] || type;
  };

  const isEligible = eligibility?.isEligible && !executionError;
  const reasonError = reversalReason.length > 0 && reversalReason.length < 10 
    ? 'Reason must be at least 10 characters' 
    : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Reverse {getTypeLabel(transactionType)}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Step 1: Confirmation */}
          {step === 'confirm' && (
            <div>
              {/* Transaction Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">{tt('Transaction Summary')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{tt('Reference:')}</span>
                    <span className="ml-2 font-medium">
                      {transaction?.invoiceNumber || transaction?.saleNumber || transaction?.reference || transaction?.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{tt('Date:')}</span>
                    <span className="ml-2 font-medium">
                      {formatDate(transaction?.date || transaction?.issueDate || transaction?.paymentDate || transaction?.saleDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{tt('Amount:')}</span>
                    <span className="ml-2 font-medium text-red-600">
                      {formatCurrency(transaction?.total || transaction?.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{tt('Status:')}</span>
                    <span className="ml-2 font-medium capitalize">
                      {transaction?.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact Preview with Amount Comparison */}
              {impactLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : impact && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <h3 className="font-medium text-amber-900 mb-3">{tt('Reversal Amount Preview')}</h3>
                  
                  {/* Amount Comparison Card */}
                  <div className="bg-white rounded-lg border border-amber-200 p-4 mb-3">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Original Amount */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{tt('Original Amount')}</p>
                        <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-gray-700 sm:text-2xl">
                          {formatCurrency(impact.originalAmount)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Positive (Debit)</p>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                      
                      {/* Reversal Amount */}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{tt('Reversal Amount')}</p>
                        <p className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-red-600 sm:text-2xl">
                          {formatCurrency(impact.reversalAmount)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Negative (Credit)</p>
                      </div>
                    </div>
                    
                    {/* Net Effect */}
                    <div className="mt-4 pt-3 border-t border-amber-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-700">{tt('Net Effect on Accounts:')}</span>
                        <span className={`text-lg font-bold ${impact.netEffect === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                          {formatCurrency(impact.netEffect)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{tt('All accounts will balance to zero')}</p>
                    </div>
                  </div>
                  
                  {/* Affected Components - Tax Reversals */}
                  {impact.affectedTaxes && impact.affectedTaxes.length > 0 && (
                    <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-orange-800">{tt('Tax Reversals:')}</p>
                      </div>
                      <div className="space-y-2">
                        {impact.affectedTaxes.map((tax, idx) => (
                          <div key={idx} className="bg-white rounded border border-orange-200 p-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700">
                                {tax.taxAccountName || tax.type || 'Tax Account'}
                              </span>
                              <span className="text-sm font-bold text-red-600">
                                {formatCurrency(tax.reversal)}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <div>
                                <span>{tt('Original:')}</span>
                                <span className="ml-1 font-medium">{formatCurrency(tax.original)}</span>
                              </div>
                              <div>
                                <span>{tt('Reversal:')}</span>
                                <span className="ml-1 font-medium text-red-600">{formatCurrency(tax.reversal)}</span>
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {tt('Net Effect:')} <span className="font-medium text-green-600">{formatCurrency(tax.net)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-orange-200 text-xs text-orange-700">
                        <p>✓ Tax account entries will be reversed with opposite debit/credit amounts</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Warnings */}
                  {impact.warnings?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {impact.warnings.map((warning, idx) => (
                        <div key={idx} className="flex items-start text-amber-700 text-sm">
                          <svg className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{warning.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error Messages */}
              {executionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center text-red-700">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{executionError}</span>
                  </div>
                </div>
              )}

              {/* Warning Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">{tt('Important Accounting Notes:')}</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>{tt('This action cannot be undone')}</li>
                      <li>{tt('A reversal transaction will be created with opposite entries')}</li>
                      <li>{tt('All related journal entries will be reversed')}</li>
                      <li>{tt('The original transaction remains for audit purposes')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  {tt('Cancel')}
                </button>
                <button
                  onClick={goToReasonStep}
                  disabled={!isEligible}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tt('Continue')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Reason Input */}
          {step === 'reason' && (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">{tt('Transaction to Reverse')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{tt('Reference:')}</span>
                    <span className="ml-2 font-medium">
                      {transaction?.invoiceNumber || transaction?.saleNumber || transaction?.reference || transaction?.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">{tt('Amount:')}</span>
                    <span className="ml-2 font-medium text-red-600">
                      {formatCurrency(transaction?.total || transaction?.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="reversalReason" className="block text-sm font-medium text-gray-700 mb-2">
                  {tt('Reversal Reason')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reversalReason"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Please provide a detailed reason for this reversal (minimum 10 characters)..."
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    reasonError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={4}
                />
                {reasonError && (
                  <p className="mt-1 text-sm text-red-500">{reasonError}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {reversalReason.length}/1000 characters (minimum 10)
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleClose}
                  disabled={executing}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {tt('Cancel')}
                </button>
                <button
                  onClick={handleConfirmReversal}
                  disabled={reversalReason.length < 10 || executing}
                  className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {executing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {tt('Processing...')}
                    </>
                  ) : (
                    'Confirm Reversal'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && (
            <div className="text-center py-6">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
                result?.pendingApproval ? 'bg-amber-100' : 'bg-green-100'
              }`}>
                <svg
                  className={`h-6 w-6 ${result?.pendingApproval ? 'text-amber-600' : 'text-green-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {result?.pendingApproval ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  )}
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {result?.pendingApproval ? tt('Submitted for Approval') : tt('Reversal Successful')}
              </h3>
              <p className="text-gray-500 mb-6">
                {result?.pendingApproval
                  ? (result.message ||
                    'A separate user must approve this reversal before it posts to the ledger.')
                  : `The ${getTypeLabel(transactionType).toLowerCase()} has been reversed successfully.`}
              </p>
              {result?.pendingApproval && result?.register?.id ? (
                <p className="text-xs text-gray-400 mb-4 font-mono">Request ID: {result.register.id}</p>
              ) : null}
              
              {/* Reversal Summary */}
              {result?.reversal && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-2xl mx-auto space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{tt('Reversal Reference')}</p>
                      <p className="font-medium text-gray-900">
                        {result.reversal.invoiceNumber || result.reversal.saleNumber || result.reversal.reference || result.reversal.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{tt('Reversal Amount')}</p>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(-(result.reversal.total || result.reversal.amount || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{tt('Date')}</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(result.reversal.reversedAt || result.reversal.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{tt('Original Amount')}</p>
                      <p className="font-medium text-gray-700">
                        {formatCurrency(result.originalTransaction?.total || result.originalTransaction?.amount || 0)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Tax Reversals */}
                  {result.taxReversals && result.taxReversals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-red-200">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-orange-800 uppercase tracking-wide">{tt('Tax Reversals Completed')}</p>
                      </div>
                      <div className="space-y-2">
                        {result.taxReversals.map((taxRev, idx) => (
                          <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">{tt('Tax Account:')}</span>
                                <span className="ml-2 font-medium text-orange-900">
                                  {taxRev.taxAccountName || 'Tax Account'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">{tt('Tax Amount Reversed:')}</span>
                                <span className="ml-2 font-bold text-red-600">
                                  {formatCurrency(-taxRev.taxAmount)}
                                </span>
                              </div>
                              <div className="col-span-2 text-xs text-gray-500 mt-1">
                                <div className="flex justify-between">
                                  <span>{tt('Original Tax Transaction:')}</span>
                                  <span className="font-mono">{taxRev.originalTaxTransactionId?.substring(0, 12)}...</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span>{tt('Reversal Tax Transaction:')}</span>
                                  <span className="font-mono">{taxRev.reversalTaxTransactionId?.substring(0, 12)}...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-orange-700 bg-orange-100 rounded p-2">
                        ✓ All tax entries have been reversed with opposite debit/credit amounts
                      </div>
                    </div>
                  )}
                  
                  {/* Reason */}
                  {result.reversal.reversalReason && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs text-gray-500 uppercase">{tt('Reason')}</p>
                      <p className="text-sm text-gray-700 mt-1">{result.reversal.reversalReason}</p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleClose}
                className="mt-6 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {tt('Close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
