// lib/invoice-pdf-generator.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyForExport, formatAmountForExport, formatDate } from './invoiceCalculations';

/**
 * Convert hex color to RGB object
 */
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

/**
 * Generate PDF invoice in the browser
 * 
 * @param {Object} invoice - Invoice data
 * @param {Object} template - Template configuration
 * @param {Object} branding - Company branding information
 * @returns {jsPDF} PDF document
 */
export function generateInvoicePdf(invoice, template, branding) {
  // Parse template content
  const content = typeof template?.content === 'string' 
    ? JSON.parse(template.content) 
    : template?.content || {};
    
  const { 
    style = 'standard',
    primaryColor = branding?.primaryColor || '#4f46e5',
    showLogo = true,
    showFooter = true
  } = content;

  // Convert color to RGB for jsPDF
  const colorRGB = hexToRgb(primaryColor);
  
  // Create new PDF document (A4 paper size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set default font
  doc.setFont('helvetica');
  
  // Add metadata
  doc.setProperties({
    title: `Invoice ${invoice.invoiceNumber}`,
    subject: `Invoice for ${invoice.client?.name || 'Client'}`,
    creator: 'InsightBooks',
  });
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20; // margin in mm
  const contentWidth = pageWidth - (margin * 2);
  
  // Starting position
  let y = margin;
  const x = margin;
  
  // Draw header based on template style
  switch (style) {
    case 'professional':
      // Header background
      doc.setFillColor(colorRGB.r, colorRGB.g, colorRGB.b);
      doc.rect(x, y, contentWidth, 25, 'F');
      
      // Invoice title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', x + 5, y + 10);
      
      // Invoice number
      doc.setFontSize(12);
      doc.text(`#${invoice.invoiceNumber}`, x + 5, y + 18);
      
      // Company name on the right (instead of logo which requires async image loading)
      doc.setFontSize(16);
      doc.text(branding?.companyName || 'Your Company', pageWidth - margin - 5, y + 15, { align: 'right' });
      
      y += 30; // Move down after header
      break;
      
    case 'minimal':
      // Simple header
      doc.setTextColor(colorRGB.r, colorRGB.g, colorRGB.b);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #${invoice.invoiceNumber}`, x, y + 10);
      
      // Issue date
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text(`Issued: ${formatDate(invoice.issueDate)}`, x, y + 16);
      
      // Company name
      doc.setFontSize(14);
      doc.text(branding?.companyName || 'Your Company', pageWidth - margin, y + 10, { align: 'right' });
      
      // Divider line
      y += 20;
      doc.setDrawColor(220, 220, 220);
      doc.line(x, y, pageWidth - margin, y);
      y += 10;
      break;
      
    case 'standard':
    default:
      // Standard header with company name and invoice info side by side
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
      
      y += 25;
      break;
  }
  
  // Client and invoice information
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', x, y);
  
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(invoice.client?.name || '', x, y);
  y += 5;
  
  if (invoice.client?.contactPerson) {
    doc.text(`Attn: ${invoice.client.contactPerson}`, x, y);
    y += 5;
  }
  
  if (invoice.client?.address) {
    doc.text(invoice.client.address, x, y);
    y += 5;
  }
  
  doc.text(invoice.client?.email || '', x, y);
  y += 5;
  
  if (invoice.client?.phone) {
    doc.text(`Phone: ${invoice.client.phone}`, x, y);
    y += 5;
  }
  
  // Invoice details (on the right side)
  const detailsX = pageWidth / 2;
  const detailsY = y - 20; // Align with the start of client info
  
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details:', detailsX, detailsY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, detailsX, detailsY + 6);
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, detailsX, detailsY + 11);
  doc.text(`Status: ${invoice.status}`, detailsX, detailsY + 16);
  if (branding?.tpin) {
    doc.text(`TPIN: ${branding.tpin}`, detailsX, detailsY + 21);
  }
  
  // Add some spacing
  y += 15;
  
  // Invoice title centered above the items table
  const invoiceTitle = (invoice.title && String(invoice.title).trim()) ? String(invoice.title).trim() : 'Invoice';
  doc.setTextColor(colorRGB.r, colorRGB.g, colorRGB.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceTitle, pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  // Invoice items table (MWK only in headers and totals; line items as numbers)
  const tableColumns = [
    { header: 'Description', dataKey: 'description' },
    { header: 'Qty', dataKey: 'quantity' },
    { header: 'Unit Price (MWK)', dataKey: 'unitPrice' },
    { header: 'Tax Rate', dataKey: 'taxRate' },
    { header: 'Amount (MWK)', dataKey: 'amount' }
  ];
  
  const tableRows = invoice.items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: formatAmountForExport(item.unitPrice),
    taxRate: `${item.taxRate}%`,
    amount: formatAmountForExport(item.quantity * item.unitPrice)
  }));
  
  // Add the table
  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(col => col.header)],
    body: tableRows.map(row => tableColumns.map(col => row[col.dataKey])),
    headStyles: {
      fillColor: style === 'minimal' ? [255, 255, 255] : [240, 240, 240],
      textColor: style === 'minimal' ? [100, 100, 100] : [50, 50, 50],
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [220, 220, 220]
    },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      lineWidth: 0.1,
      lineColor: [220, 220, 220]
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' }
    }
  });
  
  // Get the y position after the table
  y = doc.lastAutoTable.finalY + 10;
  
  // Add totals
  const totalsWidth = 70;
  const totalsX = pageWidth - margin - totalsWidth;
  
  // Background for totals section if professional style
  if (style === 'professional') {
    doc.setFillColor(colorRGB.r, colorRGB.g, colorRGB.b, 0.1);
    doc.rect(totalsX, y, totalsWidth, 25, 'F');
  }
  
  // Subtotal
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsX + 5, y + 5);
  doc.text(formatCurrencyForExport(invoice.subtotal), totalsX + totalsWidth - 5, y + 5, { align: 'right' });
  
  // Tax
  doc.text('Tax:', totalsX + 5, y + 12);
  doc.text(formatCurrencyForExport(invoice.taxAmount), totalsX + totalsWidth - 5, y + 12, { align: 'right' });
  
  // Divider line
  doc.setDrawColor(180, 180, 180);
  doc.line(totalsX + 5, y + 15, totalsX + totalsWidth - 5, y + 15);
  
  // Total
  doc.setTextColor(colorRGB.r, colorRGB.g, colorRGB.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', totalsX + 5, y + 22);
  doc.text(formatCurrencyForExport(invoice.total), totalsX + totalsWidth - 5, y + 22, { align: 'right' });
  
  // Payment Information (if payments exist)
  if (invoice.paymentInfo && (invoice.paymentInfo.totalPaid > 0 || invoice.paymentInfo.outstandingAmount > 0)) {
    y += 8;
    
    // Payment info background
    if (style === 'professional') {
      doc.setFillColor(240, 248, 255); // Light blue background
      doc.rect(totalsX, y, totalsWidth, 20, 'F');
    }
    
    // Total Paid
    doc.setTextColor(34, 197, 94); // Green color
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Paid:', totalsX + 5, y + 5);
    doc.text(formatCurrencyForExport(invoice.paymentInfo.totalPaid), totalsX + totalsWidth - 5, y + 5, { align: 'right' });
    
    // Outstanding Amount
    doc.setTextColor(239, 68, 68); // Red color
    doc.text('Outstanding:', totalsX + 5, y + 12);
    doc.text(formatCurrencyForExport(invoice.paymentInfo.outstandingAmount), totalsX + totalsWidth - 5, y + 12, { align: 'right' });
    
    // Status
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    const status = invoice.paymentInfo.isFullyPaid ? 'Fully Paid' : 
                   invoice.paymentInfo.isPartiallyPaid ? 'Partially Paid' : 'Unpaid';
    doc.text(`Status: ${status}`, totalsX + 5, y + 18);
    
    y += 25;
  }
  
  // Notes section (custom notes and payment breakdown only; no default thank-you here)
  if (invoice.notes || (invoice.paymentInfo && invoice.paymentInfo.isPartiallyPaid && invoice.payments?.length > 0)) {
    y += 10;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', x, y);
    doc.setFont('helvetica', 'normal');
    let notesText = invoice.notes || '';
    if (invoice.paymentInfo && invoice.paymentInfo.isPartiallyPaid && invoice.payments && invoice.payments.length > 0) {
      if (notesText) notesText += '\n\n';
      notesText += 'Payment Breakdown:';
      invoice.payments.forEach((payment, index) => {
        const paymentDate = new Date(payment.paymentDate).toLocaleDateString();
        notesText += `\n${index + 1}. ${formatCurrencyForExport(payment.amount)} - ${payment.paymentMethod} (${paymentDate})`;
        if (payment.reference) notesText += ` - Ref: ${payment.reference}`;
      });
      notesText += `\n\nTotal Paid: ${formatCurrencyForExport(invoice.paymentInfo.totalPaid)}`;
      notesText += `\nOutstanding: ${formatCurrencyForExport(invoice.paymentInfo.outstandingAmount)}`;
    }
    if (notesText) doc.text(notesText, x, y + 6);
  }

  // Footer: phone and bank, then centered "Thank you for your business!"
  if (showFooter) {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    const footerPhone = (invoice?.footerPhoneOverride != null && invoice?.footerPhoneOverride !== '') ? invoice.footerPhoneOverride : (branding?.businessPhone || branding?.phone || '');
    const footerBankDetails = (invoice?.footerBankDetailsOverride != null && invoice?.footerBankDetailsOverride !== '') ? invoice.footerBankDetailsOverride : (branding?.defaultBankDetails || '');
    let fy = pageHeight - 20;
    if (footerPhone.trim()) {
      doc.text(`Tel: ${footerPhone.trim()}`, x, fy, { align: 'left' });
      fy -= 4;
    }
    if (footerBankDetails.trim()) {
      const bankLines = doc.splitTextToSize(footerBankDetails.trim(), contentWidth);
      bankLines.forEach((line) => {
        doc.text(line, x, fy, { align: 'left' });
        fy -= 4;
      });
    }
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const thankYouText = branding?.emailFooter || 'Thank you for your business!';
    doc.text(thankYouText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }
  
  return doc;
}

/**
 * Download an invoice as PDF
 */
export async function downloadInvoice(invoice, template, branding) {
  try {
    // Generate PDF using jsPDF
    const doc = generateInvoicePdf(invoice, template, branding);
    
    // Download PDF
    doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
    
    return true;
  } catch (error) {
    console.error(`Error generating invoice PDF:`, error);
    throw error;
  }
}