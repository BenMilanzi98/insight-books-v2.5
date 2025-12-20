// components/PrintableInvoice.js
"use client";

import React, { useRef } from 'react';
import InvoiceTemplatePreview from '@/components/InvoiceTemplatePreview';
import { useReactToPrint } from 'react-to-print';

const PrintableInvoice = ({ invoice, template, branding, onPrintComplete }) => {
  const printRef = useRef();
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Invoice-${invoice.invoiceNumber}`,
    onAfterPrint: onPrintComplete,
    pageStyle: `
      @page {
        size: A4;
        margin: 0.5in;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
      }
    `
  });

  return (
    <div>
      <div ref={printRef} className="print-container">
        <InvoiceTemplatePreview
          invoice={invoice}
          template={template}
          branding={branding}
          isPrint={true}
        />
      </div>
      <button 
        onClick={handlePrint}
        className="hidden"
        id="trigger-print-button"
      >
        Print
      </button>
    </div>
  );
};

export default PrintableInvoice;