// lib/server-pdf.js
import puppeteer from 'puppeteer';
import { formatCurrencyForExport, formatAmountForExport, formatDate } from './invoiceCalculations';

/**
 * Generate a PDF from an invoice using a specific template
 * 
 * @param {Object} invoice - The invoice data
 * @param {Object} template - The template configuration
 * @param {Object} branding - The branding settings
 * @returns {Promise<Buffer>} - A promise that resolves to a PDF buffer
 */
export async function generatePdf(invoice, template, branding) {
  try {
    // Parse template content
    const content = typeof template?.content === 'string' 
      ? JSON.parse(template.content) 
      : template?.content || {};
      
    const { 
      style = 'standard', 
      showLogo = true, 
      showFooter = true 
    } = content;
    
    // Use the primary color from template content or branding settings
    const primaryColor = content.primaryColor || branding?.primaryColor || '#4f46e5';
    
    // Generate HTML for the invoice based on template style
    const invoiceHtml = generateInvoiceHtml(invoice, style, primaryColor, branding, showLogo, showFooter);

    // Create a full HTML document with proper styles
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            @page {
              margin: 0.5in;
              size: A4;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              margin: 0;
              padding: 0;
            }
            ${getTemplateStyles(style, primaryColor)}
          </style>
        </head>
        <body>
          ${invoiceHtml}
        </body>
      </html>
    `;

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for rendering
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in'
      }
    });
    
    await browser.close();
    
    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}

/**
 * Get CSS styles for the template
 */
function getTemplateStyles(style, primaryColor) {
  switch (style) {
    case 'professional':
      return `
        .professional-header { background-color: ${primaryColor}; }
        .professional-text { color: ${primaryColor}; }
        .professional-bg-light { background-color: ${primaryColor}15; }
      `;
    case 'minimal':
      return `
        .minimal-text { color: ${primaryColor}; }
      `;
    case 'standard':
    default:
      return `
        .standard-text { color: ${primaryColor}; }
      `;
  }
}

/**
 * Generate HTML for an invoice based on template style
 */
function generateInvoiceHtml(invoice, style, primaryColor, branding, showLogo, showFooter) {
  // Format values for display
  const formattedSubtotal = formatCurrencyForExport(invoice.subtotal);
  const formattedTax = formatCurrencyForExport(invoice.taxAmount);
  const formattedTotal = formatCurrencyForExport(invoice.total);
  const issueDate = formatDate(invoice.issueDate);
  const dueDate = formatDate(invoice.dueDate);
  
  // Generate items HTML (numbers only per line; MWK in headers and totals)
  const itemsHtml = invoice.items?.map(item => {
    const formattedUnitPrice = formatAmountForExport(item.unitPrice);
    const formattedAmount = formatAmountForExport(item.quantity * item.unitPrice);
    
    return `
      <tr>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.description}</td>
        <td class="px-6 py-4 text-sm text-gray-500 text-center">${item.quantity}</td>
        <td class="px-6 py-4 text-sm text-gray-500 text-right">${formattedUnitPrice}</td>
        <td class="px-6 py-4 text-sm text-gray-500 text-center">${item.taxRate}%</td>
        <td class="px-6 py-4 text-sm text-gray-500 text-right">${formattedAmount}</td>
      </tr>
    `;
  }).join('') || '';
  
  // Client info
  const clientName = invoice.client?.name || '';
  const clientContactPerson = invoice.client?.contactPerson ? 
    `<p>Attn: ${invoice.client.contactPerson}</p>` : '';
  const clientAddress = invoice.client?.address && invoice.client.address !== '' ? 
    `<p>${invoice.client.address}</p>` : '';
  const clientEmail = invoice.client?.email || '';
  const clientPhone = invoice.client?.phone && invoice.client.phone !== '' ? 
    `<p>Phone: ${invoice.client.phone}</p>` : '';
    
  // Company logo
  let logoHtml = '';
  if (showLogo && branding?.logoUrl) {
    logoHtml = `<img src="${branding.logoUrl}" alt="${branding.companyName || 'Company Logo'}" style="max-height: 90px; max-width: 250px; object-fit: contain;">`;
  } else {
    logoHtml = `<div style="font-size: 1.5rem; font-weight: bold;">${branding?.companyName || 'Your Company'}</div>`;
  }
  
  // Footer: phone and bank (document override or default from settings), then email footer text
  const footerPhone = (invoice?.footerPhoneOverride != null && invoice?.footerPhoneOverride !== '') ? invoice.footerPhoneOverride : (branding?.businessPhone || '');
  const footerBankDetails = (invoice?.footerBankDetailsOverride != null && invoice?.footerBankDetailsOverride !== '') ? invoice.footerBankDetailsOverride : (branding?.defaultBankDetails || '');
  const footerContactHtml = showFooter && (footerPhone.trim() || footerBankDetails.trim()) ?
    `<p style="margin-top: 12px; font-size: 11px; color: #555;">${footerPhone.trim() ? `Tel: ${footerPhone.trim()}<br/>` : ''}${footerBankDetails.trim() ? footerBankDetails.trim().replace(/\n/g, '<br/>') : ''}</p>` : '';
  const footerHtml = showFooter && (branding?.emailFooter || footerContactHtml) ?
    (footerContactHtml + (branding?.emailFooter ? `<p style="margin-top: 8px; font-size: 12px; color: #666;">${branding.emailFooter}</p>` : '')) : '';
  
  // Notes
  const notes = invoice.notes || "Thank you for your business!";
  
  // Choose template based on style
  switch (style) {
    case 'professional':
      return `
        <div style="max-width: 800px; margin: 0 auto; padding: 30px;">
          <!-- Header with background color -->
          <div style="padding: 20px; border-radius: 5px; margin-bottom: 30px; background-color: ${primaryColor};" class="professional-header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h1 style="color: white; margin: 0; font-size: 28px;">INVOICE</h1>
                <p style="color: rgba(255,255,255,0.8); margin-top: 5px;">#${invoice.invoiceNumber}</p>
              </div>
              <div style="text-align: right; color: white;">
                ${logoHtml}
              </div>
            </div>
          </div>
          
          <!-- Client and Invoice Info -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="padding: 15px; background-color: #f9fafb; border-radius: 5px; width: 48%;">
              <h3 style="color: ${primaryColor}; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee;">BILL TO</h3>
              <p style="margin: 5px 0; font-weight: bold;">${clientName}</p>
              ${clientContactPerson}
              ${clientAddress}
              <p style="margin: 5px 0;">${clientEmail}</p>
              ${clientPhone}
            </div>
            <div style="padding: 15px; background-color: #f9fafb; border-radius: 5px; width: 48%;">
              <h3 style="color: ${primaryColor}; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee;">INVOICE DETAILS</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <p style="margin: 5px 0; font-weight: bold;">Issue Date:</p>
                <p style="margin: 5px 0;">${issueDate}</p>
                <p style="margin: 5px 0; font-weight: bold;">Due Date:</p>
                <p style="margin: 5px 0;">${dueDate}</p>
                <p style="margin: 5px 0; font-weight: bold;">Status:</p>
                <p style="margin: 5px 0;">${invoice.status}</p>
              </div>
            </div>
          </div>
          
          <!-- Line Items -->
          <div style="margin-bottom: 30px;">
            <h3 style="color: ${primaryColor}; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee;">LINE ITEMS</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: ${primaryColor}15;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase;">Item</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase;">Quantity</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase;">Rate (MWK)</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; text-transform: uppercase;">Tax Rate</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; text-transform: uppercase;">Amount (MWK)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <!-- Totals -->
          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 250px; padding: 15px; background-color: ${primaryColor}15; border-radius: 5px;">
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span>Subtotal:</span>
                <span>${formattedSubtotal}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span>Tax:</span>
                <span>${formattedTax}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0; margin-top: 5px; border-top: 1px solid rgba(0,0,0,0.1); font-weight: bold; color: ${primaryColor};">
                <span>Total:</span>
                <span>${formattedTotal}</span>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
            <div>
              <h3 style="color: ${primaryColor}; margin-bottom: 10px;">NOTES</h3>
              <p style="font-size: 14px; color: #666;">${notes}</p>
            </div>
            <div style="text-align: right;">
              ${footerHtml}
            </div>
          </div>
        </div>
      `;
      
    case 'minimal':
      return `
        <div style="max-width: 800px; margin: 0 auto; padding: 30px; font-family: system-ui, sans-serif;">
          <!-- Simple Header -->
          <div style="margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h2 style="color: ${primaryColor}; margin: 0; font-weight: normal;">Invoice #${invoice.invoiceNumber}</h2>
                <p style="color: #71717a; margin-top: 5px;">Issued: ${issueDate}</p>
              </div>
              <div>
                ${logoHtml}
              </div>
            </div>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
          </div>
          
          <!-- Client and Invoice Info - Simple 2 column layout -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="width: 48%;">
              <p style="color: #71717a; font-size: 14px; margin-bottom: 5px;">Bill To</p>
              <p style="margin: 5px 0; font-weight: medium;">${clientName}</p>
              ${clientContactPerson ? `<p style="margin: 5px 0; font-size: 14px;">${clientContactPerson}</p>` : ''}
              ${clientAddress ? `<p style="margin: 5px 0; font-size: 14px;">${clientAddress}</p>` : ''}
              <p style="margin: 5px 0; font-size: 14px;">${clientEmail}</p>
              ${clientPhone ? `<p style="margin: 5px 0; font-size: 14px;">Phone: ${clientPhone}</p>` : ''}
            </div>
            <div style="width: 48%;">
              <p style="color: #71717a; font-size: 14px; margin-bottom: 5px;">Payment Details</p>
              <p style="margin: 5px 0; font-weight: medium;">Due Date: ${dueDate}</p>
              <p style="margin: 5px 0; font-size: 14px;">Amount Due: ${formattedTotal}</p>
              <p style="margin: 5px 0; font-size: 14px;">Status: ${invoice.status}</p>
            </div>
          </div>
          
          <!-- Line Items - Simplified table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr>
                <th style="padding-bottom: 10px; text-align: left; font-size: 12px; font-weight: normal; color: #71717a; text-transform: uppercase;">Description</th>
                <th style="padding-bottom: 10px; text-align: right; font-size: 12px; font-weight: normal; color: #71717a; text-transform: uppercase;">Qty</th>
                <th style="padding-bottom: 10px; text-align: right; font-size: 12px; font-weight: normal; color: #71717a; text-transform: uppercase;">Rate (MWK)</th>
                <th style="padding-bottom: 10px; text-align: center; font-size: 12px; font-weight: normal; color: #71717a; text-transform: uppercase;">Tax</th>
                <th style="padding-bottom: 10px; text-align: right; font-size: 12px; font-weight: normal; color: #71717a; text-transform: uppercase;">Amount (MWK)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <!-- Totals - Right aligned -->
          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 220px;">
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span style="color: #4b5563;">Subtotal</span>
                <span>${formattedSubtotal}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span style="color: #4b5563;">Tax</span>
                <span>${formattedTax}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 18px; color: ${primaryColor};">
                <span>Total</span>
                <span>${formattedTotal}</span>
              </div>
            </div>
          </div>
          
          <!-- Simple Footer with less content -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px;">
            <p>${notes}</p>
            ${footerHtml}
          </div>
        </div>
      `;
      
    case 'standard':
    default:
      return `
        <div style="max-width: 800px; margin: 0 auto; padding: 30px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <h1 style="color: ${primaryColor}; margin: 0; font-size: 24px;">INVOICE</h1>
              <p style="color: #71717a; margin-top: 5px;">#${invoice.invoiceNumber}</p>
            </div>
            <div>
              ${logoHtml}
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="width: 48%;">
              <h3 style="color: #4b5563; margin-bottom: 10px;">Bill To:</h3>
              <p style="margin: 5px 0; font-weight: medium;">${clientName}</p>
              ${clientContactPerson}
              ${clientAddress}
              <p style="margin: 5px 0;">${clientEmail}</p>
              ${clientPhone}
            </div>
            <div style="width: 48%;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <h3 style="color: #4b5563; margin-bottom: 10px;">Invoice Date:</h3>
                  <p style="margin: 5px 0;">${issueDate}</p>
                </div>
                <div>
                  <h3 style="color: #4b5563; margin-bottom: 10px;">Due Date:</h3>
                  <p style="margin: 5px 0;">${dueDate}</p>
                </div>
                <div style="grid-column: span 2;">
                  <h3 style="color: #4b5563; margin-bottom: 10px;">Status:</h3>
                  <p style="margin: 5px 0;">${invoice.status}</p>
                </div>
              </div>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Item</th>
                <th style="border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Quantity</th>
                <th style="border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Rate (MWK)</th>
                <th style="border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Tax Rate</th>
                <th style="border-bottom: 2px solid #e5e7eb; padding: 10px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Amount (MWK)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 220px; text-align: right;">
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span style="color: #4b5563;">Subtotal:</span>
                <span style="font-weight: medium;">${formattedSubtotal}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span style="color: #4b5563;">Tax:</span>
                <span style="font-weight: medium;">${formattedTax}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 10px 0; margin-top: 5px; border-top: 2px solid #e5e7eb; font-weight: bold; font-size: 18px; color: ${primaryColor};">
                <span>Total:</span>
                <span>${formattedTotal}</span>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <h3 style="color: #4b5563; margin-bottom: 10px;">Notes:</h3>
            <p style="color: #4b5563;">${notes}</p>
            ${footerHtml}
          </div>
        </div>
      `;
  }
}

/**
 * Generate a payment receipt PDF
 * 
 * @param {Object} receiptData - The receipt data containing payment and invoice information
 * @returns {Promise<Buffer>} - A promise that resolves to a PDF buffer
 */
export async function generatePaymentReceiptPDF(receiptData) {
  try {
    const { type, payment, invoice, client, payments, totalPaid, isFullyPaid, isPartialPayment } = receiptData;
    
    // Generate HTML for the receipt
    const receiptHtml = generatePaymentReceiptHtml(receiptData);
    
    // Debug: Log the generated HTML to check for issues
    console.log('Generated receipt HTML length:', receiptHtml.length);
    console.log('Receipt HTML preview:', receiptHtml.substring(0, 200));

    // Create a full HTML document with proper styles
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt - ${invoice.invoiceNumber}</title>
          <style>
            @page {
              margin: 0.5in;
              size: A4;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              margin: 0;
              padding: 0;
              line-height: 1.6;
            }
            .receipt-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #4f46e5;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #4f46e5;
              margin-bottom: 5px;
            }
            .receipt-title {
              font-size: 20px;
              color: #374151;
              margin-bottom: 10px;
            }
            .receipt-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
              flex-wrap: wrap;
            }
            .info-section {
              flex: 1;
              min-width: 200px;
              margin: 10px;
            }
            .info-section h3 {
              color: #4f46e5;
              font-size: 14px;
              margin-bottom: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .info-section p {
              margin: 5px 0;
              color: #374151;
            }
            .payment-details {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 30px;
            }
            .payment-summary {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #4f46e5;
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .payment-amount {
              font-size: 24px;
              font-weight: bold;
            }
            .payment-status {
              background: #10b981;
              color: white;
              padding: 5px 15px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .payment-method {
              display: flex;
              align-items: center;
              margin-bottom: 15px;
            }
            .payment-method-icon {
              width: 40px;
              height: 40px;
              background: #4f46e5;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 15px;
              color: white;
            }
            .payment-method-info h4 {
              margin: 0;
              color: #374151;
              font-size: 16px;
            }
            .payment-method-info p {
              margin: 5px 0 0 0;
              color: #6b7280;
              font-size: 14px;
            }
            .payments-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .payments-table th,
            .payments-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            .payments-table th {
              background: #f3f4f6;
              font-weight: 600;
              color: #374151;
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 0.5px;
            }
            .payments-table td {
              color: #374151;
            }
            .total-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 20px;
              margin-top: 20px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
              font-size: 16px;
            }
            .total-row.final {
              font-weight: bold;
              font-size: 18px;
              color: #4f46e5;
              border-top: 2px solid #4f46e5;
              padding-top: 10px;
              margin-top: 15px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          ${receiptHtml}
        </body>
      </html>
    `;

    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for rendering
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in'
      }
    });
    
    await browser.close();
    
    return pdf;
  } catch (error) {
    console.error('Error generating payment receipt PDF:', error);
    throw new Error('Failed to generate payment receipt PDF');
  }
}

/**
 * Generate HTML for payment receipt
 */
function generatePaymentReceiptHtml(receiptData) {
  const { type, payment, invoice, client, payments, totalPaid, isFullyPaid } = receiptData;
  
  // Calculate payment status for individual receipts
  const isFullPayment = type === 'individual' ? payment.amount >= invoice.total : false;
  const isPartialPayment = type === 'individual' ? payment.amount < invoice.total : false;
  
  // Export formatting: no trailing .00 on receipts
  const formatCurrency = (amount) => formatCurrencyForExport(amount, 'MWK');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodName = (method) => {
    switch (method.toLowerCase()) {
      case 'cash': return 'Cash';
      case 'bank_transfer': return 'Bank Transfer';
      case 'mobile_money': return 'Mobile Money';
      case 'check': return 'Check';
      case 'credit_card': return 'Credit Card';
      default: return method;
    }
  };

  if (type === 'individual') {
    return `
      <div class="receipt-container">
        <div class="header">
          <div class="company-name">Payment Receipt</div>
          <div class="receipt-title">Invoice #${invoice.invoiceNumber}</div>
        </div>

        <div class="receipt-info">
          <div class="info-section">
            <h3>Client Information</h3>
            <p><strong>Name:</strong> ${client.name}</p>
            <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
          </div>
          <div class="info-section">
            <h3>Receipt Details</h3>
            <p><strong>Receipt Date:</strong> ${formatDate(payment.paymentDate)}</p>
            <p><strong>Payment ID:</strong> ${payment.id}</p>
            <p><strong>Invoice Total:</strong> ${formatCurrency(invoice.total)}</p>
          </div>
        </div>

        <div class="payment-details">
          <div class="payment-summary">
            <div>
              <div style="font-size: 14px; opacity: 0.9;">Payment Amount</div>
              <div class="payment-amount">${formatCurrency(payment.amount)}</div>
            </div>
            <div class="payment-status">
              ${isFullPayment ? 'Full Payment' : 'Partial Payment'}
            </div>
          </div>

          <div class="payment-method">
            <div class="payment-method-icon">💳</div>
            <div class="payment-method-info">
              <h4>${getPaymentMethodName(payment.paymentMethod)}</h4>
              <p>Payment Date: ${formatDateTime(payment.paymentDate)}</p>
              ${payment.reference ? `<p>Reference: ${payment.reference}</p>` : ''}
              ${payment.notes ? `<p>Notes: ${payment.notes}</p>` : ''}
            </div>
          </div>

          ${isPartialPayment ? `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 15px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Note:</strong> This is a partial payment of ${formatCurrency(payment.amount)} 
                from invoice total of ${formatCurrency(invoice.total)}. 
                Outstanding balance: ${formatCurrency(invoice.total - payment.amount)}
              </p>
            </div>
          ` : `
            <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 12px; margin-top: 15px;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>Payment Complete:</strong> This payment of ${formatCurrency(payment.amount)} 
                fully settles invoice #${invoice.invoiceNumber} for ${formatCurrency(invoice.total)}.
              </p>
            </div>
          `}
        </div>

        <div class="footer">
          <p>Thank you for your payment!</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  } else {
    // Combined receipt
    return `
      <div class="receipt-container">
        <div class="header">
          <div class="company-name">Payment Receipt Summary</div>
          <div class="receipt-title">Invoice #${invoice.invoiceNumber}</div>
        </div>

        <div class="receipt-info">
          <div class="info-section">
            <h3>Client Information</h3>
            <p><strong>Name:</strong> ${client.name}</p>
            <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
          </div>
          <div class="info-section">
            <h3>Receipt Summary</h3>
            <p><strong>Total Payments:</strong> ${payments.length}</p>
            <p><strong>Invoice Total:</strong> ${formatCurrency(invoice.total)}</p>
            <p><strong>Total Paid:</strong> ${formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div class="payment-details">
          <div class="payment-summary">
            <div>
              <div style="font-size: 14px; opacity: 0.9;">Total Amount Paid</div>
              <div class="payment-amount">${formatCurrency(totalPaid)}</div>
            </div>
            <div class="payment-status">
              ${isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
            </div>
          </div>

          <h3 style="color: #4f46e5; margin-bottom: 15px;">Payment History</h3>
          <table class="payments-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td>${formatDateTime(p.paymentDate)}</td>
                  <td>${getPaymentMethodName(p.paymentMethod)}</td>
                  <td>${formatCurrency(p.amount)}</td>
                  <td>${p.reference || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>Invoice Total:</span>
              <span>${formatCurrency(invoice.total)}</span>
            </div>
            <div class="total-row">
              <span>Total Paid:</span>
              <span>${formatCurrency(totalPaid)}</span>
            </div>
            <div class="total-row">
              <span>Outstanding Balance:</span>
              <span>${formatCurrency(invoice.total - totalPaid)}</span>
            </div>
            <div class="total-row final">
              <span>Status:</span>
              <span>${isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}</span>
            </div>
          </div>

          ${!isFullyPaid ? `
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-top: 15px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Outstanding Balance:</strong> ${formatCurrency(invoice.total - totalPaid)} 
                remaining to be paid on this invoice.
              </p>
            </div>
          ` : `
            <div style="background: #d1fae5; border: 1px solid #10b981; border-radius: 6px; padding: 12px; margin-top: 15px;">
              <p style="margin: 0; color: #065f46; font-size: 14px;">
                <strong>Payment Complete:</strong> All payments totaling ${formatCurrency(totalPaid)} 
                fully settle invoice #${invoice.invoiceNumber}.
              </p>
            </div>
          `}
        </div>

        <div class="footer">
          <p>Thank you for your payments!</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  }
}