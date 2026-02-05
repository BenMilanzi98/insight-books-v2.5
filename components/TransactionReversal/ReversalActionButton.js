/**
 * Reversal Action Button Component
 * 
 * Button and menu items for triggering transaction reversals
 */

import { useState } from 'react';

export function ReversalActionButton({ transaction, transactionType, variant = 'button', size = 'md', disabled = false, onReverse }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (onReverse) {
      onReverse(transaction);
    }
  };

  // Don't show if transaction is already reversed
  // Check for isReversed (expense/invoice) or isReversal (journal entry) for compatibility
  if (transaction?.isReversed || transaction?.isReversal || transaction?.reversedTransactionId) {
    return null;
  }

  // Don't show if transaction type is not reversible
  const nonReversibleTypes = ['draft', 'voided', 'cancelled'];
  if (nonReversibleTypes.includes(transaction?.status)) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  if (variant === 'menu-item') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className={`${iconSizes[size]} mr-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Reverse Transaction
      </button>
    );
  }

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleClick}
          disabled={disabled}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reverse Transaction"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        {showTooltip && (
          <div className="absolute right-0 bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">
            Reverse Transaction
          </div>
        )}
      </div>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]}`}
    >
      <svg className={`${iconSizes[size]} mr-1.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Reverse
    </button>
  );
}

/**
 * Dropdown menu item for reversals
 */
export function ReversalMenuItem({ transaction, transactionType, onClick }) {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    // The parent component should open the modal
  };

  // Check if reversible - check for isReversed (expense/invoice) or isReversal (journal entry) for compatibility
  const isReversible = !transaction?.isReversed && 
                        !transaction?.isReversal &&
                        !transaction?.reversedTransactionId &&
                        !['draft', 'voided', 'cancelled'].includes(transaction?.status);

  return (
    <button
      onClick={handleClick}
      disabled={!isReversible}
      className={`w-full flex items-center px-4 py-2 text-sm ${
        isReversible 
          ? 'text-red-600 hover:bg-red-50' 
          : 'text-gray-400 cursor-not-allowed'
      }`}
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Reverse Transaction
      {!isReversible && transaction?.reversedTransactionId && (
        <span className="ml-2 text-xs text-gray-400">(Already Reversed)</span>
      )}
    </button>
  );
}

/**
 * Bulk reversal button for selecting multiple transactions
 */
export function BulkReversalButton({ selectedIds, transactionType, disabled = false }) {
  const count = selectedIds?.length || 0;

  const handleClick = () => {
    // This would open a bulk reversal modal
    console.log('Bulk reversal for', count, transactionType, selectedIds);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || count === 0}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      Reverse Selected ({count})
    </button>
  );
}

/**
 * Table row action for reversals
 */
export function ReversalTableAction({ transaction, transactionType }) {
  const [showMenu, setShowMenu] = useState(false);

  const isReversible = !transaction?.isReversed && 
                        !transaction?.isReversal &&
                        !transaction?.reversedTransactionId &&
                        !['draft', 'voided', 'cancelled'].includes(transaction?.status);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <ReversalMenuItem 
              transaction={transaction} 
              transactionType={transactionType}
              onClick={() => setShowMenu(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
