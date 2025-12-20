// lib/invoiceCapture.js
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Captures the rendered invoice template and converts it to a PDF
 * @param {React.RefObject} elementRef - React ref to the invoice element
 * @param {string} filename - Name for the downloaded file
 * @returns {Promise<boolean>} Success indicator
 */
/**
 * Add inline styles to elements to ensure compatibility with html2canvas
 * @param {HTMLElement} rootElement - The root DOM element
 */
function addCompatibleStyles(rootElement) {
  // Define color mappings for Tailwind classes that might use modern color formats
  const colorMappings = {
    // Primary colors
    'text-blue-500': '#3b82f6',
    'text-blue-600': '#2563eb',
    'text-blue-700': '#1d4ed8',
    'bg-blue-500': '#3b82f6',
    'bg-blue-600': '#2563eb',
    'bg-blue-700': '#1d4ed8',
    'bg-blue-50': '#eff6ff',
    'bg-blue-100': '#dbeafe',
    
    // Gray colors
    'text-gray-500': '#6b7280',
    'text-gray-600': '#4b5563',
    'text-gray-700': '#374151',
    'bg-gray-50': '#f9fafb',
    'bg-gray-100': '#f3f4f6',
    
    // Green colors
    'text-green-500': '#10b981',
    'text-green-600': '#059669',
    'bg-green-50': '#ecfdf5',
    'bg-green-100': '#d1fae5',
    
    // Red colors
    'text-red-500': '#ef4444',
    'text-red-600': '#dc2626',
    'bg-red-50': '#fef2f2',
    'bg-red-100': '#fee2e2',
    
    // Yellow colors
    'text-yellow-500': '#f59e0b',
    'text-yellow-600': '#d97706',
    'bg-yellow-50': '#fffbeb',
    'bg-yellow-100': '#fef3c7',
  };
  
  try {
    // Process all elements
    const elements = rootElement.querySelectorAll('*');
    elements.forEach(el => {
      // Check for Tailwind classes
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ');
        classes.forEach(className => {
          // If the class has a color mapping, apply it as inline style
          if (colorMappings[className]) {
            if (className.startsWith('text-')) {
              el.style.color = colorMappings[className];
            } else if (className.startsWith('bg-')) {
              el.style.backgroundColor = colorMappings[className];
            }
          }
        });
      }
    });
  } catch (error) {
    console.warn('Error adding compatible styles:', error);
  }
}

/**
 * Handles modern color formats by replacing them with compatible alternatives
 * @param {HTMLElement} element - The DOM element to process
 */
function handleModernColors(element) {
  try {
    // Process the element and all its children recursively
    if (!element) return;
    
    // Get all elements in the tree
    const elements = element.querySelectorAll('*');
    elements.forEach(el => {
      // Get the computed style
      try {
        const styles = window.getComputedStyle(el);
        
        // List of style properties to check
        const colorProps = [
          'color', 'backgroundColor', 'borderColor', 
          'borderTopColor', 'borderRightColor', 
          'borderBottomColor', 'borderLeftColor'
        ];
        
        // For each property, check if it contains modern color syntax
        colorProps.forEach(prop => {
          const value = styles[prop];
          if (value && (
              value.includes('oklch') || 
              value.includes('lab') ||
              value.includes('lch') ||
              value.includes('hsl') ||
              value.includes('hwb'))) {
            
            // Convert to a safe color
            // For text, use black; for backgrounds, use white; for borders, use gray
            if (prop === 'color') {
              el.style[prop] = '#000000';
            } else if (prop === 'backgroundColor') {
              el.style[prop] = '#ffffff';
            } else if (prop.includes('border')) {
              el.style[prop] = '#cccccc';
            }
          }
        });
      } catch (styleError) {
        // Ignore errors reading styles
        console.warn('Could not process styles for element', styleError);
      }
    });
  } catch (error) {
    console.warn('Error handling modern colors:', error);
    // Continue even if there's an error
  }
}

let captureInProgress = false;

export async function captureInvoiceAsPDF(elementRef, filename = 'invoice.pdf') {
  // If capture is already in progress, don't start another one
  if (captureInProgress) return false;
  
  captureInProgress = true;
  
  try {
    console.log('🔍 Capture process started, checking ref...');
    console.log('🔍 elementRef:', elementRef);
    console.log('🔍 elementRef.current:', elementRef?.current);
    
    if (!elementRef || !elementRef.current) {
      captureInProgress = false;
      throw new Error('Invoice element reference not found');
    }
    
    console.log('✅ Ref is available, proceeding with capture...');
    console.log('✅ Element dimensions:', {
      scrollWidth: elementRef.current.scrollWidth,
      scrollHeight: elementRef.current.scrollHeight,
      offsetWidth: elementRef.current.offsetWidth,
      offsetHeight: elementRef.current.offsetHeight
    });
    
    // Capture immediately without any waiting
    console.log('📸 Starting immediate capture...');
    
    // Add inline styles to replace any problematic Tailwind styles
    addCompatibleStyles(elementRef.current);
    
    // First, modify any modern color formats in the DOM tree to ensure compatibility
    handleModernColors(elementRef.current);
    
    // Get element dimensions safely
    const element = elementRef.current;
    const scrollWidth = element.scrollWidth || element.offsetWidth || 800;
    const scrollHeight = element.scrollHeight || element.offsetHeight || 600;
    
    console.log('📐 Using dimensions:', { scrollWidth, scrollHeight });
    
    // Use html2canvas to capture the element as an image
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Allow images from other domains
      logging: false, // Disable logging to reduce noise
      backgroundColor: '#FFFFFF',
      windowWidth: scrollWidth,
      windowHeight: scrollHeight,
      allowTaint: true, // Allow cross-origin images
      foreignObjectRendering: false, // Disable for better compatibility
      onclone: (documentClone) => {
        // Process the clone to handle any CSS variables or modern color formats
        const elements = documentClone.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const style = window.getComputedStyle(el);
          const bgColor = style.backgroundColor;
          const color = style.color;
          
          // Replace any oklch or other modern colors with fallbacks
          if (bgColor.includes('oklch') || bgColor.includes('lab')) {
            el.style.backgroundColor = '#f8f9fa'; // Light gray fallback
          }
          
          if (color.includes('oklch') || color.includes('lab')) {
            el.style.color = '#333333'; // Dark gray fallback
          }
        }
      }
    });
    
    console.log('Invoice captured as canvas, converting to PDF...');
    console.log('📐 Canvas dimensions:', { width: canvas.width, height: canvas.height });
    
    // Validate canvas data
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas generation failed - invalid dimensions');
    }
    
    // Test canvas data URL generation
    let imgData;
    try {
      console.log('🖼️ Converting canvas to data URL...');
      imgData = canvas.toDataURL('image/png', 0.95);
      console.log('🖼️ Data URL length:', imgData.length);
      
      if (!imgData || imgData === 'data:,') {
        throw new Error('Canvas to data URL conversion failed');
      }
      console.log('✅ Canvas to data URL conversion successful');
    } catch (canvasError) {
      console.error('Canvas to data URL error:', canvasError);
      throw new Error('Failed to convert canvas to image data');
    }
    
    // Create PDF (A4 format)
    console.log('📄 Creating PDF...');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    console.log('✅ PDF object created');
    
    // Calculate dimensions and positioning to fit invoice on page
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    console.log('📐 PDF dimensions:', { imgWidth, imgHeight, pageHeight });
    
    let heightLeft = imgHeight;
    let position = 0;
    
    try {
      console.log('📄 Adding first page to PDF...');
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      console.log('✅ First page added, height left:', heightLeft);
      
      // Add additional pages if content overflows
      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        console.log('📄 Additional page added, height left:', heightLeft);
      }
      
      console.log('📄 Generating PDF blob...');
      const pdfBlob = pdf.output('blob');
      console.log('📄 PDF blob created, size:', pdfBlob.size);
      
      // Check if this is a receipt (no server upload needed)
      const isReceipt = filename.includes('payment-receipt-') || filename.includes('receipt-');
      
      if (!isReceipt) {
        // Only upload invoices and quotations to server
        const formData = new FormData();
        
        // Determine upload endpoint based on filename
        let uploadEndpoint = '/api/invoices/upload';
        if (filename.includes('quotation-')) {
          uploadEndpoint = '/api/quotations/upload';
        }
        
        // Extract ID from filename (e.g., "invoice-123.pdf" -> "123")
        const idMatch = filename.match(/(?:invoice|quotation)-([^.]+)\.pdf/);
        if (!idMatch) {
          throw new Error('Invalid filename format. Expected: invoice-{id}.pdf or quotation-{id}.pdf');
        }
        const id = idMatch[1];
        console.log('🆔 Extracted ID from filename:', id);
        
        // For invoices and quotations, use the ID for consistent file checking
        // The filename should match what the check endpoint expects: invoice-{id}.pdf or quotation-{id}.pdf
        let uploadFilename = filename;
        
        formData.append('file', pdfBlob, uploadFilename);
        formData.append('filename', uploadFilename);
        formData.append('id', id); // Add the ID parameter
        
        console.log('📤 Uploading to endpoint:', uploadEndpoint);
        console.log('📤 Upload filename:', uploadFilename);
        console.log('📤 Upload ID:', id);

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        console.log('📤 PDF upload response:', result);
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${result.error || response.statusText}`);
        }
        
        console.log('✅ PDF uploaded successfully');
      } else {
        console.log('📄 Receipt PDF - skipping server upload');
      }
      // Save the PDF
      try {
        console.log('📥 Attempting to save PDF with filename:', filename);
        pdf.save(filename);
        console.log('✅ PDF save() called successfully');
      } catch (saveError) {
        console.error('❌ PDF save() failed:', saveError);
      }
      
      // Also create a download link as a fallback
      try {
        console.log('📥 Creating fallback download link...');
        const pdfBlob = pdf.output('blob');
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('✅ Download link triggered as fallback');
      } catch (downloadError) {
        console.warn('Fallback download failed:', downloadError);
      }
      
      console.log('✅ PDF created and uploaded successfully');
      
      // Reset the capture flag after a short delay to prevent rapid clicks from causing issues
      setTimeout(() => {
        captureInProgress = false;
      }, 1000);
      
      return true;
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      throw new Error('Failed to generate PDF from image data');
    }
  } catch (error) {
    console.error('Error capturing invoice as PDF:', error);
    captureInProgress = false;
    throw error;
  }
}

export async function saveInvoiceAsPDF(elementRef, filename = 'invoice.pdf') {
  // If capture is already in progress, don't start another one
  if (captureInProgress) return false;
  
  captureInProgress = true;
  
  try {
    console.log('🔍 Save process started, checking ref...');
    console.log('🔍 elementRef:', elementRef);
    console.log('🔍 elementRef.current:', elementRef?.current);
    
    if (!elementRef || !elementRef.current) {
      captureInProgress = false;
      throw new Error('Invoice element reference not found');
    }
    
    console.log('✅ Ref is available, proceeding with save...');
    console.log('✅ Element dimensions:', {
      scrollWidth: elementRef.current.scrollWidth,
      scrollHeight: elementRef.current.scrollHeight,
      offsetWidth: elementRef.current.offsetWidth,
      offsetHeight: elementRef.current.offsetHeight
    });
    
    // Capture immediately without any waiting
    console.log('📸 Starting immediate save capture...');
    
    // Add inline styles to replace any problematic Tailwind styles
    addCompatibleStyles(elementRef.current);
    
    // First, modify any modern color formats in the DOM tree to ensure compatibility
    handleModernColors(elementRef.current);
    
    // Get element dimensions safely
    const element = elementRef.current;
    const scrollWidth = element.scrollWidth || element.offsetWidth || 800;
    const scrollHeight = element.scrollHeight || element.offsetHeight || 600;
    
    console.log('📐 Using dimensions:', { scrollWidth, scrollHeight });
    
    // Use html2canvas to capture the element as an image
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true, // Allow images from other domains
      logging: false, // Disable logging to reduce noise
      backgroundColor: '#FFFFFF',
      windowWidth: scrollWidth,
      windowHeight: scrollHeight,
      allowTaint: true, // Allow cross-origin images
      foreignObjectRendering: false, // Disable for better compatibility
      onclone: (documentClone) => {
        // Process the clone to handle any CSS variables or modern color formats
        const elements = documentClone.getElementsByTagName('*');
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const style = window.getComputedStyle(el);
          const bgColor = style.backgroundColor;
          const color = style.color;
          
          // Replace any oklch or other modern colors with fallbacks
          if (bgColor.includes('oklch') || bgColor.includes('lab')) {
            el.style.backgroundColor = '#f8f9fa'; // Light gray fallback
          }
          
          if (color.includes('oklch') || color.includes('lab')) {
            el.style.color = '#333333'; // Dark gray fallback
          }
        }
      }
    });
    
    console.log('Invoice captured as canvas, converting to PDF...');
    console.log('📐 Canvas dimensions:', { width: canvas.width, height: canvas.height });
    
    // Validate canvas data
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas generation failed - invalid dimensions');
    }
    
    // Test canvas data URL generation
    let imgData;
    try {
      console.log('🖼️ Converting canvas to data URL...');
      imgData = canvas.toDataURL('image/png', 0.95);
      console.log('🖼️ Data URL length:', imgData.length);
      
      if (!imgData || imgData === 'data:,') {
        throw new Error('Canvas to data URL conversion failed');
      }
      console.log('✅ Canvas to data URL conversion successful');
    } catch (canvasError) {
      console.error('Canvas to data URL error:', canvasError);
      throw new Error('Failed to convert canvas to image data');
    }
    
    // Create PDF (A4 format)
    console.log('📄 Creating PDF...');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });
    console.log('✅ PDF object created');
    
    // Calculate dimensions and positioning to fit invoice on page
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    console.log('📐 PDF dimensions:', { imgWidth, imgHeight, pageHeight });
    
    let heightLeft = imgHeight;
    let position = 0;
    
    try {
      console.log('📄 Adding first page to PDF...');
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      console.log('✅ First page added, height left:', heightLeft);
      
      // Add additional pages if content overflows
      while (heightLeft > 0) {
        position = position - pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        console.log('📄 Additional page added, height left:', heightLeft);
      }
      
      console.log('📄 Generating PDF blob...');
      const pdfBlob = pdf.output('blob');
      console.log('📄 PDF blob created, size:', pdfBlob.size);
      
      // Check if this is a receipt (no server upload needed)
      const isReceipt = filename.includes('payment-receipt-') || filename.includes('receipt-');
      
      if (!isReceipt) {
        // Only upload invoices and quotations to server
        const formData = new FormData();
        
        // Determine upload endpoint based on filename
        let uploadEndpoint = '/api/invoices/upload';
        if (filename.includes('quotation-')) {
          uploadEndpoint = '/api/quotations/upload';
        }
        
        // Extract ID from filename (e.g., "invoice-123.pdf" -> "123")
        const idMatch = filename.match(/(?:invoice|quotation)-([^.]+)\.pdf/);
        if (!idMatch) {
          throw new Error('Invalid filename format. Expected: invoice-{id}.pdf or quotation-{id}.pdf');
        }
        const id = idMatch[1];
        console.log('🆔 Extracted ID from filename:', id);
        
        // For invoices and quotations, use the ID for consistent file checking
        // The filename should match what the check endpoint expects: invoice-{id}.pdf or quotation-{id}.pdf
        let uploadFilename = filename;
        
        formData.append('file', pdfBlob, uploadFilename);
        formData.append('filename', uploadFilename);
        formData.append('id', id); // Add the ID parameter
        
        console.log('📤 Uploading to endpoint:', uploadEndpoint);
        console.log('📤 Upload filename:', uploadFilename);
        console.log('📤 Upload ID:', id);

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        console.log('📤 PDF upload response:', result);
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${result.error || response.statusText}`);
        }
        
        console.log('✅ PDF uploaded successfully');
      } else {
        console.log('📄 Receipt PDF - skipping server upload');
      }
      // Save the PDF
      try {
        console.log('📥 Attempting to save PDF with filename:', filename);
        pdf.save(filename);
        console.log('✅ PDF save() called successfully');
      } catch (saveError) {
        console.error('❌ PDF save() failed:', saveError);
      }
      
      // Also create a download link as a fallback
      try {
        console.log('📥 Creating fallback download link...');
        const pdfBlob = pdf.output('blob');
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        console.log('✅ Download link triggered as fallback');
      } catch (downloadError) {
        console.warn('Fallback download failed:', downloadError);
      }
      
      console.log('✅ PDF created and uploaded successfully');
      
      // Reset the capture flag after a short delay to prevent rapid clicks from causing issues
      setTimeout(() => {
        captureInProgress = false;
      }, 1000);
      
      return true;
    } catch (pdfError) {
      console.error('PDF generation error:', pdfError);
      throw new Error('Failed to generate PDF from image data');
    }
  } catch (error) {
    console.error('Error capturing invoice as PDF:', error);
    captureInProgress = false;
    throw error;
  }
}

/**
 * Downloads invoice data and prepares it for rendering and capture
 */
export async function downloadInvoiceAsImage(invoiceId, templateId = null) {
  try {
    // Include templateId if provided
    const queryParams = templateId ? `?templateId=${encodeURIComponent(templateId)}` : '';
    
    const response = await fetch(`/api/invoices/${invoiceId}/download${queryParams}`);
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      
      throw new Error(`Error downloading invoice: ${errorMessage}`);
    }
    
    // Return the data for rendering in a component that will be captured
    return await response.json();
  } catch (error) {
    console.error(`Error preparing invoice data ${invoiceId}:`, error);
    throw error;
  }
}