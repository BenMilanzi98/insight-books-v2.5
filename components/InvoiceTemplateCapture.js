// components/InvoiceTemplateCapture.js
import React, { useRef, useState, useEffect } from 'react';
import InvoiceTemplatePreview from '@/components/InvoiceTemplatePreview';
import { exportRenderedInvoiceAsPDF, saveRenderedInvoiceAsPDF } from '@/app/services/invoiceService';
import { Loader2 } from 'lucide-react';

const InvoiceTemplateCapture = ({ 
  invoice, 
  template, 
  branding, 
  type, 
  onSuccess,
  onError 
}) => {
  const invoiceRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCalledSuccess, setHasCalledSuccess] = useState(false); // Add flag to prevent multiple success calls
  
  useEffect(() => {
    // If we have all the necessary data, automatically start the capture process
    if (invoice && template && branding && !isCapturing && !hasCalledSuccess) {
      captureInvoice();
    }
  }, [invoice, template, branding, isCapturing, hasCalledSuccess]);
  
  // Cleanup function
  useEffect(() => {
    return () => {
      console.log('🧹 InvoiceTemplateCapture unmounting, cleaning up...');
      setHasCalledSuccess(false);
      setIsCapturing(false);
    };
  }, []);
  
  const captureInvoice = async () => {
    setIsCapturing(true);
    
    try {
      // Wait a moment to ensure the invoice is fully rendered
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate filename from invoice ID for consistent file checking
      const filename = `invoice-${invoice.id}.pdf`;
      
      if(type==="save"){
        // Capture the rendered invoice and save PDF
        await saveRenderedInvoiceAsPDF(invoiceRef, filename);
      }else{
        // Capture the rendered invoice and create PDF
        await exportRenderedInvoiceAsPDF(invoiceRef, filename);
      }
      
      // Notify parent of success
      if (onSuccess && !hasCalledSuccess) {
        onSuccess();
        setHasCalledSuccess(true);
      }
    } catch (error) {
      console.error('Failed to capture invoice:', error);
      if (onError) onError(error);
    } finally {
      setIsCapturing(false);
    }
  };
  
  // If not capturing, don't render anything (or render a hidden div)
  if (!isCapturing) {
    return null;
  }
  
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      <div ref={invoiceRef} style={{ width: '210mm', background: 'white', padding: '10mm' }}>
        <InvoiceTemplatePreview
          template={template}
          branding={branding}
          invoice={invoice}
          isPrint={true}
        />
      </div>
      
      {/* Optional loading indicator */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }}>
        <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
          <span>Generating PDF...</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplateCapture;