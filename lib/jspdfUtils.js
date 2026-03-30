// lib/jspdfUtils.js
import { jsPDF } from 'jspdf';
// Make sure this import is correct and the package is installed
import 'jspdf-autotable';
import { formatCurrencyForExport, formatAmountForExport, formatDate } from './invoiceCalculations';

/**
 * Generate PDF invoice in the browser
 */
export function generateInvoicePdf(invoice, template, branding) {
  // Parse template content
  let contentObj = {};
  try {
    if (typeof template?.content === 'string') {
      contentObj = JSON.parse(template.content);
    } else if (typeof template?.content === 'object') {
      contentObj = template.content;
    }
  } catch (error) {
    console.error('Error parsing template content:', error);
  }
  
  const { 
    style = 'standard',
    primaryColor = branding?.primaryColor || '#4f46e5',
    showLogo = true,
    showFooter = true
  } = contentObj;

  // Convert color to RGB for jsPDF
  const colorRGB = hexToRgb(primaryColor);
  
  // Create new PDF document (A4 paper size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Check if autoTable is available and provide a fallback if not
  if (typeof doc.autoTable !== 'function') {
    console.error("jspdf-autotable plugin is not loaded properly");
    
    // Create a simpler table as fallback
    return createBasicPDF(doc, invoice, branding, colorRGB, style, showFooter);
  }

  // Rest of the function remains unchanged
  // ...
}

// Add this fallback function for when autoTable is not available
function createBasicPDF(doc, invoice, branding, colorRGB, style, showFooter) {
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // margin in mm
  const contentWidth = pageWidth - (margin * 2);
  
  // Starting position
  let y = margin;
  const x = margin;
  
  // Set default font
  doc.setFont('helvetica');
  
  // Add metadata
  doc.setProperties({
    title: `Invoice ${invoice.invoiceNumber}`,
    subject: `Invoice for ${invoice.client?.name || 'Client'}`,
    creator: 'InsightBooks',
  });
  
  // Header
  doc.setTextColor(colorRGB.r, colorRGB.g, colorRGB.b);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', x, y + 10);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`#${invoice.invoiceNumber}`, x, y + 16);
  
  // Company name on the right
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(branding?.companyName || 'Your Company', pageWidth - margin, y + 10, { align: 'right' });
  const sellerTpin = (branding?.tpin && String(branding.tpin).trim()) || '';
  if (sellerTpin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`TPIN: ${sellerTpin}`, pageWidth - margin, y + 16, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
  }

  y += 25;
  
  // Client and invoice information
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', x, y);
  
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(invoice.client?.name || '', x, y);
  y += 8;
  
  if (invoice.client?.email) {
    doc.text(invoice.client.email, x, y);
    y += 8;
  }
  
  // Invoice details
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details:', x, y);
  y += 8;
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, x, y);
  y += 8;
  
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, x, y);
  y += 8;
  
  doc.text(`Status: ${invoice.status}`, x, y);
  y += 20;
  
  // Simple table header
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, contentWidth, 10, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text('Description', x + 5, y + 7);
  doc.text('Qty', x + 100, y + 7);
  doc.text('Price (MWK)', x + 130, y + 7);
  doc.text('Amount (MWK)', x + contentWidth - 15, y + 7, { align: 'right' });
  
  y += 15;
  
  // Items (numbers only; MWK in headers and totals)
  doc.setFont('helvetica', 'normal');
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  
  items.forEach(item => {
    doc.text(item.description || '', x + 5, y);
    doc.text(item.quantity.toString(), x + 100, y);
    doc.text(formatAmountForExport(item.unitPrice), x + 130, y);
    doc.text(formatAmountForExport(item.quantity * item.unitPrice), 
             x + contentWidth - 15, y, { align: 'right' });
    y += 10;
  });
  
  // Draw a line
  y += 5;
  doc.setDrawColor(220, 220, 220);
  doc.line(x, y, x + contentWidth, y);
  y += 10;
  
  // Totals
  doc.text('Subtotal:', x + contentWidth - 70, y);
  doc.text(formatCurrencyForExport(invoice.subtotal), x + contentWidth - 15, y, { align: 'right' });
  y += 8;
  
  doc.text('Tax:', x + contentWidth - 70, y);
  doc.text(formatCurrencyForExport(invoice.taxAmount), x + contentWidth - 15, y, { align: 'right' });
  y += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colorRGB.r, colorRGB.g, colorRGB.b);
  doc.text('Total:', x + contentWidth - 70, y);
  doc.text(formatCurrencyForExport(invoice.total), x + contentWidth - 15, y, { align: 'right' });
  
  // Notes (custom notes only; thank-you is in footer)
  if (invoice.notes) {
    y += 20;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.notes, x, y + 6);
  }

  // Footer: centered "Thank you for your business!"
  if (showFooter) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    const footerText = branding?.emailFooter || 'Thank you for your business!';
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  return doc;
}

// The hexToRgb function remains the same
function hexToRgb(hex) {
  // Default color if invalid hex
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return { r: 79, g: 70, b: 229 }; // Default color #4f46e5
  }
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 79, g: 70, b: 229 };
}