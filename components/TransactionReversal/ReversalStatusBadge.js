/**
 * Reversal Status Badge Component
 * 
 * Displays visual indicators for reversed transactions
 */

export function ReversalStatusBadge({ transaction, size = 'md', status, isReversed: propIsReversed, reversedAt }) {
  // Support both transaction object and individual props
  const txIsReversal = transaction?.isReversal ?? propIsReversed;
  const txReversedAt = transaction?.reversedAt ?? reversedAt;
  const txStatus = transaction?.status ?? status;

  // Not involved in any reversal
  if (!txIsReversal && !txReversedAt) {
    return null;
  }

  const isReversed = !!txReversedAt;
  const label = isReversed ? 'Reversed' : 'Reversal';
  const color = isReversed ? 'red' : 'blue';
  const bgColor = isReversed ? 'bg-red-100' : 'bg-blue-100';
  const textColor = isReversed ? 'text-red-800' : 'text-blue-800';
  const icon = isReversed ? (
    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${bgColor} ${textColor} ${sizeClasses[size]}`}>
      {icon}
      {label}
    </span>
  );
}

/**
 * Reversal Info Card Component
 * Displays detailed reversal information
 */
export function ReversalInfoCard({ reversal }) {
  if (!reversal) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start">
        <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-900 mb-2">Reversal Details</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-red-700">Reversed At:</span>
              <span className="text-red-900 font-medium">{formatDate(reversal.reversedAt)}</span>
            </div>
            {reversal.reversalReason && (
              <div className="mt-2">
                <span className="text-red-700 block">Reason:</span>
                <p className="text-red-900 mt-1 p-2 bg-red-100 rounded">{reversal.reversalReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reversal Chain Display Component
 * Shows the relationship between original and reversal transactions
 */
export function ReversalChain({ original, reversal, type, taxReversals = [] }) {
  if (!original && !reversal) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

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

  const getReference = (tx) => {
    return tx.invoiceNumber || tx.saleNumber || tx.reference || tx.id;
  };

  // Calculate tax amounts from original transaction
  const originalTaxAmount = original?.taxAmount || 0;

  return (
    <div className="space-y-3">
      {/* Original Transaction */}
      {original && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Original Transaction</span>
            <ReversalStatusBadge transaction={original} size="sm" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Reference:</span>
              <span className="ml-2 font-medium">{getReference(original)}</span>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>
              <span className="ml-2 font-medium">{formatDate(original.date || original.issueDate || original.paymentDate)}</span>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-2 font-medium">{formatCurrency(original.total || original.amount)}</span>
            </div>
          </div>
          {originalTaxAmount > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax Amount:</span>
                <span className="font-medium text-gray-700">{formatCurrency(originalTaxAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Arrow */}
      {original && reversal && (
        <div className="flex justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      )}

      {/* Reversal Transaction */}
      {reversal && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-red-500 uppercase tracking-wide">Reversal Transaction</span>
            <ReversalStatusBadge transaction={reversal} size="sm" />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Reference:</span>
              <span className="ml-2 font-medium">{getReference(reversal)}</span>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>
              <span className="ml-2 font-medium">{formatDate(reversal.reversedAt || reversal.date)}</span>
            </div>
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-2 font-medium text-red-600">{formatCurrency(-(reversal.total || reversal.amount))}</span>
            </div>
          </div>
          {reversal.reversalReason && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <span className="text-xs text-gray-500">Reason:</span>
              <p className="text-sm text-gray-700 mt-1">{reversal.reversalReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Tax Reversals Section */}
      {taxReversals && taxReversals.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Tax Reversals</span>
          </div>
          {taxReversals.map((taxRev, index) => (
            <div key={index} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                <div>
                  <span className="text-gray-500">Tax Account:</span>
                  <span className="ml-2 font-medium text-orange-900">
                    {taxRev.originalTaxTransaction?.taxAccount?.accountName || 
                     taxRev.reversalTaxTransaction?.taxAccount?.accountName || 
                     'Tax Account'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Original Tax:</span>
                  <span className="ml-2 font-medium text-gray-700">
                    {formatCurrency(taxRev.originalTaxTransaction?.taxAmount || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Reversal Reference:</span>
                  <span className="ml-2 font-medium text-orange-900">
                    {taxRev.reversalTaxTransaction?.reference || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Reversed Tax:</span>
                  <span className="ml-2 font-medium text-red-600">
                    {formatCurrency(-(taxRev.reversalTaxTransaction?.reversedTaxAmount || 0))}
                  </span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-orange-200 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Original Tax Transaction:</span>
                  <span className="font-mono">{taxRev.originalTaxTransaction?.reference || taxRev.originalTaxTransaction?.id}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Reversal Tax Transaction:</span>
                  <span className="font-mono">{taxRev.reversalTaxTransaction?.reference || taxRev.reversalTaxTransaction?.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Audit Trail Component for Reversals
 */
export function ReversalAuditTrail({ auditRecords }) {
  if (!auditRecords || auditRecords.length === 0) return null;

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Reversal History</h4>
      <div className="flow-root">
        <ul className="-mb-8">
          {auditRecords.map((record, idx) => (
            <li key={record.id}>
              <div className="relative pb-8">
                {idx !== auditRecords.length - 1 && (
                  <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center ring-8 ring-white">
                      <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm text-gray-500">
                        Reversed <span className="font-medium text-gray-900">{record.originalTransactionType}</span>
                      </p>
                    </div>
                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                      <time dateTime={record.reversedAt}>{formatDate(record.reversedAt)}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
