import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, FileText, DollarSign, CheckCircle, Clock, Download, Receipt, Printer } from 'lucide-react';
import ReceiptTemplateCapture from '@/components/ReceiptTemplateCapture';

const PaymentHistory = ({ invoiceId, onPaymentAdded }) => {
  const [payments, setPayments] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [captureReceiptData, setCaptureReceiptData] = useState(null);
  const [isCapturingReceipt, setIsCapturingReceipt] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      fetchPaymentHistory();
    }
  }, [invoiceId]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
        const response = await fetch(`/api/invoices/partial-payment?invoiceId=${invoiceId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }

      const data = await response.json();
      setPayments(data.payments || []);
      setInvoice(data.invoice);
      setError('');
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount);
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
    switch (method.toLowerCase()) {
      case 'cash':
        return <DollarSign className="h-4 w-4" />;
      case 'bank_transfer':
        return <CreditCard className="h-4 w-4" />;
      case 'mobile_money':
        return <CreditCard className="h-4 w-4" />;
      case 'check':
        return <FileText className="h-4 w-4" />;
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const getPaymentMethodName = (method) => {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'Cash';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'mobile_money':
        return 'Mobile Money';
      case 'check':
        return 'Check';
      case 'credit_card':
        return 'Credit Card';
      default:
        return method;
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Generate individual payment receipt
  const generateIndividualReceipt = async (payment) => {
    try {
      setIsCapturingReceipt(true);
      const response = await fetch('/api/payments/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId: payment.id,
          type: 'individual',
          invoiceId: invoiceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate receipt');
      }

      const data = await response.json();
      // Set receipt data to trigger client-side PDF generation
      setCaptureReceiptData(data.receipt);
    } catch (error) {
      console.error('Error generating individual receipt:', error);
      alert('Failed to generate receipt. Please try again.');
      setIsCapturingReceipt(false);
    }
  };

  // Generate combined receipt for all payments
  const generateCombinedReceipt = async () => {
    try {
      setIsCapturingReceipt(true);
      const response = await fetch('/api/payments/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoiceId,
          type: 'combined'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate combined receipt');
      }

      const data = await response.json();
      // Set receipt data to trigger client-side PDF generation
      setCaptureReceiptData(data.receipt);
    } catch (error) {
      console.error('Error generating combined receipt:', error);
      alert('Failed to generate combined receipt. Please try again.');
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchPaymentHistory}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
            <p className="text-sm text-gray-600">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} received
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {invoice && (
              <div className="text-right">
                <div className="text-sm text-gray-600">Remaining Balance</div>
                <div className="text-lg font-semibold text-red-600">
                  {formatCurrency(invoice.remainingBalance || 0)}
                </div>
              </div>
            )}
            {payments.length > 0 && (
              <button
                onClick={generateCombinedReceipt}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Receipt className="h-4 w-4" />
                <span>Download All Receipts</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      {invoice && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-600">Total Amount</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(invoice.total)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Amount Paid</div>
              <div className="font-semibold text-green-600">
                {formatCurrency(invoice.totalPaid || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Progress</div>
              <div className="font-semibold text-blue-600">
                {Math.round(((invoice.totalPaid || 0) / invoice.total) * 100)}%
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(((invoice.totalPaid || 0) / invoice.total) * 100, 100)}%`
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Payments List */}
      <div className="p-6">
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No payments received yet</p>
            <p className="text-sm">Payments will appear here once received</p>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment, index) => {
              const isFullPayment = payments.length === 1 && payment.amount >= (invoice?.total || 0);
              const isPartialPayment = payments.length > 1 || payment.amount < (invoice?.total || 0);
              
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {getPaymentMethodIcon(payment.paymentMethod)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(payment.amount)}
                        </span>
                        {getStatusIcon(payment.status)}
                        {isFullPayment && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Full Payment
                          </span>
                        )}
                        {isPartialPayment && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Partial Payment
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getPaymentMethodName(payment.paymentMethod)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(payment.paymentDate)}
                      </div>
                      {invoice && (
                        <div className="text-xs text-gray-500 mt-1">
                          Payment of {formatCurrency(payment.amount)} from invoice total of {formatCurrency(invoice.total)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      {payment.reference && (
                        <div className="text-sm text-gray-600">
                          Ref: {payment.reference}
                        </div>
                      )}
                      {payment.notes && (
                        <div className="text-xs text-gray-500 max-w-32 truncate" title={payment.notes}>
                          {payment.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => generateIndividualReceipt(payment)}
                      className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              );
            })}
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

export default PaymentHistory;
