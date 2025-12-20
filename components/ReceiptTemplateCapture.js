// components/ReceiptTemplateCapture.js
import React, { useRef, useState, useEffect } from 'react';
import PrintableReceipt from '@/components/PrintableReceipt';
import { captureInvoiceAsPDF } from '@/lib/invoiceCapture';
import { Loader2 } from 'lucide-react';

const ReceiptTemplateCapture = ({ 
  receiptData, 
  type = 'download',
  onSuccess,
  onError 
}) => {
  const receiptRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCalledSuccess, setHasCalledSuccess] = useState(false);
  
  // Debug logging
  console.log('🔄 ReceiptTemplateCapture render:', {
    receiptData: !!receiptData,
    type,
    isCapturing,
    refCurrent: !!receiptRef.current,
    receiptType: receiptData?.type
  });
  
  // Track ref changes
  useEffect(() => {
    console.log('🔗 Ref changed:', {
      refCurrent: !!receiptRef.current,
      element: receiptRef.current
    });
  }, [receiptRef.current]);
  
  useEffect(() => {
    // Start capture immediately when component mounts with data
    if (receiptData && !isCapturing && !hasCalledSuccess) {
      console.log('🚀 Starting capture process...');
      console.log('🚀 Receipt data:', {
        type: receiptData.type,
        hasPayment: !!receiptData.payment,
        hasInvoice: !!receiptData.invoice,
        hasExpense: !!receiptData.expense
      });
      
      // Small delay to ensure DOM is ready, then start capture
      const timer = setTimeout(() => {
        console.log('⏰ Timer fired, starting capture...');
        console.log('⏰ Ref status:', {
          refCurrent: !!receiptRef.current,
          element: receiptRef.current
        });
        captureReceipt();
      }, 200);
      
      return () => {
        console.log('🧹 Cleaning up timer');
        clearTimeout(timer);
      };
    } else {
      console.log('🚫 Not starting capture:', {
        hasReceiptData: !!receiptData,
        isCapturing,
        hasCalledSuccess
      });
    }
  }, [receiptData, isCapturing, hasCalledSuccess]);
  
  // Cleanup function
  useEffect(() => {
    return () => {
      console.log('🧹 ReceiptTemplateCapture unmounting, cleaning up...');
      setHasCalledSuccess(false);
      setIsCapturing(false);
    };
  }, []);
  
  const captureReceipt = async () => {
    console.log('🎯 Capture function called...');
    console.log('🎯 Ref status at start:', {
      refCurrent: !!receiptRef.current,
      element: receiptRef.current
    });
    
    setIsCapturing(true);
    
    try {
      // Check if ref is available
      if (!receiptRef.current) {
        console.error('❌ Ref is not available at capture start');
        throw new Error('Component reference not available');
      }
      
      console.log('✅ Ref is available, proceeding with capture...');
      
      // Generate filename
      const receiptId = receiptData.payment?.id || receiptData.invoice?.id || receiptData.expense?.id || Date.now();
      const filename = `payment-receipt-${receiptId}.pdf`;
      console.log('📄 Generated filename:', filename);
      
      console.log('📤 Capturing receipt as PDF...');
      // Capture the rendered receipt and create PDF
      await captureInvoiceAsPDF(receiptRef, filename);
      console.log('✅ PDF captured successfully');
      
      // Notify parent of success
      if (onSuccess && !hasCalledSuccess) {
        onSuccess();
        setHasCalledSuccess(true);
      }
    } catch (error) {
      console.error('❌ Failed to capture receipt:', error);
      if (onError) onError(error);
    } finally {
      setIsCapturing(false);
    }
  };
  
  // Only render if we have data
  if (!receiptData) {
    console.log('🚫 Not rendering - missing receipt data');
    return null;
  }
  
  console.log('🎨 Rendering component...');
  
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      <div ref={receiptRef} style={{ width: '210mm', background: 'white', padding: '10mm' }}>
        <PrintableReceipt receiptData={receiptData} />
      </div>
      
      {/* Loading indicator */}
      {isCapturing && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }}>
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-3" />
            <span>Generating PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptTemplateCapture;

