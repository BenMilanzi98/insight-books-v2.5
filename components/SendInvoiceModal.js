import React, { useState } from 'react';
import { X, Send, Mail, AlertCircle, Loader2 } from 'lucide-react';

const SendInvoiceModal = ({ isOpen, onClose, invoice, isSending, companyName, onMessageSubmit }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Pass the custom message back to the parent component
    if (onMessageSubmit) {
      onMessageSubmit(message);
    }
    // Close the modal
    onClose();
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Send Invoice to Client</h3>
          <button
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={onClose}
            disabled={isSending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                <Mail className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Invoice will be included in email</p>
                  <p className="text-sm text-blue-600">Invoice #{invoice.invoiceNumber} will be formatted and embedded in the email</p>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>To:</strong> {invoice.client?.name} ({invoice.client?.email})
                </p>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Subject:</strong> Invoice #{invoice.invoiceNumber} from {companyName}
                </p>
              </div>
              
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Message (Optional)
              </label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows="5"
                placeholder="Include any additional information for your client..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              ></textarea>
            </div>
            
            {!invoice.client?.email && (
              <div className="mb-4 flex items-start p-3 bg-red-50 rounded-md border border-red-100">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5 mr-2" />
                <div>
                  <p className="font-medium text-red-800">Missing Email Address</p>
                  <p className="text-sm text-red-600">This client does not have an email address. Please update the client information first.</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
              onClick={onClose}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-flex items-center"
              disabled={isSending || !invoice.client?.email}
            >
              {isSending ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="-ml-1 mr-2 h-4 w-4" />
                  Send Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendInvoiceModal;