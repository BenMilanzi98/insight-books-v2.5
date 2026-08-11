import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, FileText, DollarSign, CheckCircle, Clock, Download, Receipt, Printer } from 'lucide-react';
import ReceiptTemplateCapture from '@/components/ReceiptTemplateCapture';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

function isSyntheticCogsExpenseId(expenseId) {
  return typeof expenseId === 'string' && expenseId.startsWith('cogs-');
}

const ExpensePaymentHistory = ({ expenseId, onPaymentAdded }) => {
  const [payments, setPayments] = useState([]);
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [captureReceiptData, setCaptureReceiptData] = useState(null);
  const [isCapturingReceipt, setIsCapturingReceipt] = useState(false);

  useEffect(() => {
    if (!expenseId) return;
    // COGS register rows are synthetic GL views — no Expense payment records.
    if (isSyntheticCogsExpenseId(expenseId)) {
      setPayments([]);
      setExpense(null);
      setError('');
      setLoading(false);
      return;
    }
    fetchPaymentHistory();
  }, [expenseId]);

  const fetchPaymentHistory = async () => {
    if (isSyntheticCogsExpenseId(expenseId)) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/expenses/partial-payment?expenseId=${expenseId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }

      const data = await response.json();
      setPayments(data.payments || []);
      setExpense(data.expense);
      setError('');
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    // Handle null/undefined
    if (amount === null || amount === undefined) {
      console.warn('Null/undefined amount for formatting:', amount);
      return 'MWK 0.00';
    }
    
    const numericAmount = parseMoney(amount);
    
    // Handle NaN or invalid amounts
    if (!Number.isFinite(numericAmount)) {
      console.warn('Invalid amount for formatting:', amount, 'parsed as:', numericAmount);
      return 'MWK 0.00';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(numericAmount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return <DollarSign className="h-4 w-4" />;
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="h-4 w-4" />;
      case 'bank_transfer':
        return <FileText className="h-4 w-4" />;
      case 'check':
        return <FileText className="h-4 w-4" />;
      case 'paypal':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodName = (payment) => {
    if (payment?.paymentMethodName) return payment.paymentMethodName;
    const method = payment?.paymentMethod || payment;
    if (!method || typeof method !== 'string') return '—';
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Cash';
      case 'credit_card':
        return 'Credit Card';
      case 'debit_card':
        return 'Debit Card';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'check':
        return 'Check';
      case 'paypal':
        return 'PayPal';
      case 'other':
        return 'Other';
      default:
        return method.length > 20 ? 'Unknown method' : method;
    }
  };

  const downloadReceipt = async (paymentId, type = 'individual') => {
    try {
      console.log('Starting download for payment:', paymentId);
      setIsCapturingReceipt(true);
      
      const response = await fetch(`/api/payments/receipt?paymentId=${paymentId}&expenseId=${expenseId}&type=${type}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download receipt');
      }

      const data = await response.json();
      // Set receipt data to trigger client-side PDF generation
      setCaptureReceiptData(data.receipt);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt. Please try again.');
      setIsCapturingReceipt(false);
    }
  };

  const downloadAllReceipts = async () => {
    try {
      console.log('Starting download all receipts for expense:', expenseId);
      setIsCapturingReceipt(true);
      
      const response = await fetch(`/api/payments/receipt?expenseId=${expenseId}&type=combined`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to download combined receipt');
      }

      const data = await response.json();
      // Set receipt data to trigger client-side PDF generation
      setCaptureReceiptData(data.receipt);
    } catch (error) {
      console.error('Error downloading combined receipt:', error);
      alert('Failed to download combined receipt. Please try again.');
      setIsCapturingReceipt(false);
    }
  };

  // Handle receipt capture success
  const handleReceiptCaptureSuccess = () => {
    console.log('✅ Receipt PDF generated successfully');
    setIsCapturingReceipt(false);
    setCaptureReceiptData(null);
  };

  // Handle receipt capture error
  const handleReceiptCaptureError = (error) => {
    console.error('❌ Receipt PDF generation failed:', error);
    setIsCapturingReceipt(false);
    setCaptureReceiptData(null);
    alert('Failed to generate receipt PDF. Please try again.');
  };

  const calculateProgress = () => {
    if (!expense) return 0;
    const totalPaid = payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
    const expenseAmount = parseMoney(expense.amount);
    
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return 0;
    }
    
    return Math.min((totalPaid / expenseAmount) * 100, 100);
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
  };

  const getRemainingBalance = () => {
    if (!expense) return 0;
    const expenseAmount = parseMoney(expense.amount);
    const totalPaid = getTotalPaid();
    
    if (!Number.isFinite(expenseAmount)) {
      return 0;
    }
    
    return Math.max(0, subtractMoney(expenseAmount, totalPaid));
  };

  const isFullyPaid = () => {
    return getRemainingBalance() <= 0;
  };

  if (isSyntheticCogsExpenseId(expenseId)) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium text-gray-700">No payment history for COGS</p>
        <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
          Cost of goods sold entries come from inventory journals when items are sold.
          They are not paid like supplier expenses.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading payment history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">{error}</div>
        <button
          onClick={fetchPaymentHistory}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-8 text-gray-500">
        Expense not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-gray-900 sm:text-2xl">{formatCurrency(expense.amount)}</div>
            <div className="text-sm text-gray-600">Total Amount</div>
          </div>
          <div className="text-center">
            <div className="min-w-0 break-words text-xl font-bold leading-tight tabular-nums text-green-600 sm:text-2xl">{formatCurrency(getTotalPaid())}</div>
            <div className="text-sm text-gray-600">Total Paid</div>
          </div>
          <div className="text-center">
            <div className={`min-w-0 break-words text-xl font-bold leading-tight tabular-nums sm:text-2xl ${getRemainingBalance() > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(getRemainingBalance())}
            </div>
            <div className="text-sm text-gray-600">Remaining Balance</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Payment Progress</span>
            <span>{calculateProgress().toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                isFullyPaid() ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${calculateProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* Status */}
        <div className="text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isFullyPaid() 
              ? 'bg-green-100 text-green-800' 
              : getTotalPaid() > 0 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-red-100 text-red-800'
          }`}>
            {isFullyPaid() ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Fully Paid
              </>
            ) : getTotalPaid() > 0 ? (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Partially Paid
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-1" />
                Pending Payment
              </>
            )}
          </span>
        </div>
      </div>

      {/* Download All Receipts Button */}
      {payments.length > 0 && payments.some(p => p.id !== 'legacy-payment') && (
        <div className="flex justify-end">
          <button
            onClick={downloadAllReceipts}
            disabled={isCapturingReceipt}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCapturingReceipt ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download All Receipts
              </>
            )}
          </button>
        </div>
      )}

      {/* Payment History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
        
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No payments recorded yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Payments will appear here once they are added to this expense
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment, index) => (
              <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        {getPaymentMethodIcon(payment.paymentMethod)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          Payment #{index + 1}
                        </h4>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {payment.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {getPaymentMethodName(payment)} • {formatDateTime(payment.paymentDate)}
                      </div>
                      {payment.reference && (
                        <div className="text-xs text-gray-500">
                          Reference: {payment.reference}
                        </div>
                      )}
                      {payment.notes && (
                        <div className="text-xs text-gray-500 mt-1">
                          {payment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </div>
                    </div>
                    
                    {payment.id !== 'legacy-payment' ? (
                      <button
                        onClick={() => downloadReceipt(payment.id, 'individual')}
                        disabled={isCapturingReceipt}
                        className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download Receipt"
                      >
                      {isCapturingReceipt ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1"></div>
                          <span className="text-xs">Loading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Receipt
                        </>
                      )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 bg-gray-50 text-gray-500 text-sm font-medium rounded-md cursor-not-allowed" title="Receipt not available for legacy payments">
                        <Receipt className="h-4 w-4 mr-1" />
                        Legacy
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt PDF Capture Component (hidden, renders off-screen) */}
      {captureReceiptData && (
        <ReceiptTemplateCapture
          receiptData={captureReceiptData}
          type="download"
          onSuccess={handleReceiptCaptureSuccess}
          onError={handleReceiptCaptureError}
        />
      )}

      {/* Loading indicator */}
      {isCapturingReceipt && !captureReceiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <p>Preparing receipt for download...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensePaymentHistory;
