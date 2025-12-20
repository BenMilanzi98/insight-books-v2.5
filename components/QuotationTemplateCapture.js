// components/QuotationTemplateCapture.js
import React, { useRef, useState, useEffect } from 'react';
import QuotationTemplatePreview from '@/components/QuotationTemplatePreview';
import { exportRenderedQuotationAsPDF, saveRenderedQuotationAsPDF } from '@/app/services/quotationService';
import { Loader2 } from 'lucide-react';

const QuotationTemplateCapture = ({ 
  quotation, 
  template, 
  branding, 
  type, 
  onSuccess,
  onError 
}) => {
  const quotationRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasCalledSuccess, setHasCalledSuccess] = useState(false); // Add flag to prevent multiple success calls
  
  // Debug logging
  console.log('🔄 QuotationTemplateCapture render:', {
    quotation: !!quotation,
    template: !!template,
    branding: !!branding,
    isCapturing,
    refCurrent: !!quotationRef.current,
    quotationId: quotation?.id,
    quotationNumber: quotation?.quotationNumber
  });
  
  // Track ref changes
  useEffect(() => {
    console.log('🔗 Ref changed:', {
      refCurrent: !!quotationRef.current,
      element: quotationRef.current
    });
  }, [quotationRef.current]);
  
  useEffect(() => {
    // Start capture immediately when component mounts with data
    if (quotation && template && branding && !isCapturing && !hasCalledSuccess) {
      console.log('🚀 Starting capture process...');
      console.log('🚀 Component data:', {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        templateId: template?.id,
        brandingName: branding?.name
      });
      
      // Small delay to ensure DOM is ready, then start capture
      const timer = setTimeout(() => {
        console.log('⏰ Timer fired, starting capture...');
        console.log('⏰ Ref status:', {
          refCurrent: !!quotationRef.current,
          element: quotationRef.current
        });
        captureQuotation();
      }, 100);
      
      return () => {
        console.log('🧹 Cleaning up timer');
        clearTimeout(timer);
      };
    } else {
      console.log('🚫 Not starting capture:', {
        hasQuotation: !!quotation,
        hasTemplate: !!template,
        hasBranding: !!branding,
        isCapturing,
        hasCalledSuccess
      });
    }
  }, [quotation, template, branding, isCapturing, hasCalledSuccess]);
  
  // Cleanup function
  useEffect(() => {
    return () => {
      console.log('🧹 QuotationTemplateCapture unmounting, cleaning up...');
      setHasCalledSuccess(false);
      setIsCapturing(false);
    };
  }, []);
  
  const captureQuotation = async () => {
    console.log('🎯 Capture function called...');
    console.log('🎯 Ref status at start:', {
      refCurrent: !!quotationRef.current,
      element: quotationRef.current
    });
    
    setIsCapturing(true);
    
    try {
      // Check if ref is available
      if (!quotationRef.current) {
        console.error('❌ Ref is not available at capture start');
        throw new Error('Component reference not available');
      }
      
      console.log('✅ Ref is available, proceeding with capture...');
      
      // Generate filename from quotation ID for consistent file checking
      const filename = `quotation-${quotation.id}.pdf`;
      console.log('📄 Generated filename:', filename);
      
      if(type==="save"){
        console.log('💾 Saving quotation as PDF...');
        // Capture the rendered quotation and save PDF
        await saveRenderedQuotationAsPDF(quotationRef, filename);
        console.log('✅ PDF saved successfully');
      }else{
        console.log('📤 Exporting quotation as PDF...');
        // Capture the rendered quotation and create PDF
        await exportRenderedQuotationAsPDF(quotationRef, filename);
        console.log('✅ PDF exported successfully');
      }
      
      // Notify parent of success
      if (onSuccess && !hasCalledSuccess) {
        onSuccess();
        setHasCalledSuccess(true);
      }
    } catch (error) {
      console.error('❌ Failed to capture quotation:', error);
      if (onError) onError(error);
    } finally {
      setIsCapturing(false);
    }
  };
  
  // Only render if we have data
  if (!quotation || !template || !branding) {
    console.log('🚫 Not rendering - missing data');
    return null;
  }
  
  console.log('🎨 Rendering component...');
  
  return (
    <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
      <div ref={quotationRef} style={{ width: '210mm', background: 'white', padding: '10mm' }}>
        <QuotationTemplatePreview
          quotation={quotation}
          template={template}
          branding={branding}
          isPrint={true}
        />
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

export default QuotationTemplateCapture;