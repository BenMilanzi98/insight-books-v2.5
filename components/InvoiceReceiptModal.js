import React, { useRef } from "react";
import PrintableInvoice from "./PrintableInvoice";
import { X } from "lucide-react";

const InvoiceReceiptModal = ({ isOpen, invoice, template, branding, onClose }) => {
  const printRef = useRef();

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-y-auto animate-fadeInUp">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Invoice Created</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <PrintableInvoice
            invoice={invoice}
            template={template}
            branding={branding}
          />
        </div>
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              // Find the hidden print button in PrintableInvoice and click it
              const printBtn = document.getElementById("trigger-print-button");
              if (printBtn) printBtn.click();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceReceiptModal; 