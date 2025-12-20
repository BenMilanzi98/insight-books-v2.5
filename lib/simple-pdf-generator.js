// lib/simple-pdf-generator.js
import puppeteer from 'puppeteer';

/**
 * Generate a simple text-based receipt as fallback
 */
function generateFallbackReceipt(receiptData) {
  const { type, payment, invoice, expense, client, payments, totalPaid, isFullyPaid } = receiptData;
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  let receiptText = '';
  
  // Determine if this is an invoice or expense receipt
  const isExpenseReceipt = !!expense;
  const documentNumber = isExpenseReceipt ? `EXP-${expense.id.slice(-8)}` : invoice.invoiceNumber;
  const documentTotal = isExpenseReceipt ? expense.amount : invoice.total;
  const documentType = isExpenseReceipt ? 'Expense' : 'Invoice';
  
  if (type === 'individual') {
    receiptText = `
PAYMENT RECEIPT
${documentType} #${documentNumber}

Client Information:
Name: ${client.name}
Email: ${client.email || 'N/A'}
Phone: ${client.phone || 'N/A'}

Receipt Details:
Receipt Date: ${formatDate(payment.paymentDate)}
Payment ID: ${payment.id}
${documentType} Total: ${formatCurrency(documentTotal)}

Payment Information:
Amount: ${formatCurrency(payment.amount)}
Method: ${payment.paymentMethod}
Reference: ${payment.reference || 'N/A'}
Notes: ${payment.notes || 'N/A'}

Status: ${payment.amount >= documentTotal ? 'Full Payment' : 'Partial Payment'}

Generated on: ${new Date().toLocaleString()}
Powered by InsightBooks
    `;
  } else {
    receiptText = `
PAYMENT RECEIPT SUMMARY
${documentType} #${documentNumber}

Client Information:
Name: ${client.name}
Email: ${client.email || 'N/A'}
Phone: ${client.phone || 'N/A'}

Receipt Summary:
Total Payments: ${payments.length}
${documentType} Total: ${formatCurrency(documentTotal)}
Total Paid: ${formatCurrency(totalPaid)}

Payment History:
${payments.map(p => `${formatDate(p.paymentDate)} - ${p.paymentMethod} - ${formatCurrency(p.amount)} - ${p.reference || 'N/A'}`).join('\n')}

Status: ${isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}
Outstanding Balance: ${formatCurrency(documentTotal - totalPaid)}

Generated on: ${new Date().toLocaleString()}
Powered by InsightBooks
    `;
  }

  return receiptText;
}

/**
 * Generate a simple payment receipt PDF
 * 
 * @param {Object} receiptData - The receipt data containing payment and invoice information
 * @returns {Promise<Buffer>} - A promise that resolves to a PDF buffer
 */
export async function generateSimplePaymentReceiptPDF(receiptData) {
  let browser;
  
  try {
    const { type, payment, invoice, expense, client, payments, totalPaid, isFullyPaid } = receiptData;
    
    // Validate required data
    if (!invoice && !expense) {
      throw new Error('Either invoice or expense data is required');
    }
    
    if (!client) {
      throw new Error('Client data is required');
    }
    
    if (type === 'individual' && !payment) {
      throw new Error('Payment data is required for individual receipt');
    }
    
    if (type === 'combined' && (!payments || payments.length === 0)) {
      throw new Error('Payments data is required for combined receipt');
    }
    
    // Determine if this is an invoice or expense receipt
    const isExpenseReceipt = !!expense;
    const document = isExpenseReceipt ? expense : invoice;
    const documentNumber = isExpenseReceipt ? `EXP-${expense.id.slice(-8)}` : invoice.invoiceNumber;
    const documentType = isExpenseReceipt ? 'Expense' : 'Invoice';
    // Get the document total amount (invoices use 'total', expenses use 'amount')
    const documentTotal = isExpenseReceipt ? expense.amount : invoice.total;
    
    // Calculate payment status for individual receipts
    const isFullPayment = type === 'individual' ? payment.amount >= documentTotal : false;
    const isPartialPayment = type === 'individual' ? payment.amount < documentTotal : false;
    
    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'MWK'
      }).format(amount);
    };

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

    // Generate simple HTML
    let htmlContent;
    
    // Ensure all required values are defined
    const safeDocumentNumber = documentNumber || 'N/A';
    const safeClientName = client?.name || 'N/A';
    const safeClientEmail = client?.email || 'N/A';
    const safeClientPhone = client?.phone || 'N/A';
    
    if (type === 'individual') {
      const safePaymentDate = payment?.paymentDate ? formatDate(payment.paymentDate) : 'N/A';
      const safePaymentId = payment?.id || 'N/A';
      const safePaymentAmount = payment?.amount ? formatCurrency(payment.amount) : formatCurrency(0);
      const safePaymentMethod = payment?.paymentMethod ? getPaymentMethodName(payment.paymentMethod) : 'N/A';
      const safePaymentDateTime = payment?.paymentDate ? formatDateTime(payment.paymentDate) : 'N/A';
      const safePaymentReference = payment?.reference || 'N/A';
      const safePaymentNotes = payment?.notes || '';
      const safeDocumentTotal = formatCurrency(documentTotal || 0);
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt - ${safeDocumentNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #4f46e5; margin-bottom: 5px; }
            .receipt-title { font-size: 20px; color: #374151; margin-bottom: 10px; }
            .info-section { margin-bottom: 20px; }
            .info-section h3 { color: #4f46e5; font-size: 16px; margin-bottom: 10px; }
            .payment-details { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; }
            .payment-summary { background: #4f46e5; color: white; padding: 15px; margin-bottom: 15px; }
            .payment-amount { font-size: 24px; font-weight: bold; }
            .payment-status { background: #10b981; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
            .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Payment Receipt</div>
            <div class="receipt-title">${documentType} #${safeDocumentNumber}</div>
          </div>

          <div class="info-section">
            <h3>Client Information</h3>
            <p><strong>Name:</strong> ${safeClientName}</p>
            <p><strong>Email:</strong> ${safeClientEmail}</p>
            <p><strong>Phone:</strong> ${safeClientPhone}</p>
          </div>

          <div class="info-section">
            <h3>Receipt Details</h3>
            <p><strong>Receipt Date:</strong> ${safePaymentDate}</p>
            <p><strong>Payment ID:</strong> ${safePaymentId}</p>
            <p><strong>${documentType} Total:</strong> ${safeDocumentTotal}</p>
          </div>

          <div class="payment-details">
            <div class="payment-summary">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 14px; opacity: 0.9;">Payment Amount</div>
                  <div class="payment-amount">${safePaymentAmount}</div>
                </div>
                <div class="payment-status">
                  ${isFullPayment ? 'Full Payment' : 'Partial Payment'}
                </div>
              </div>
            </div>

            <div style="margin: 15px 0;">
              <h4>Payment Method: ${safePaymentMethod}</h4>
              <p>Payment Date: ${safePaymentDateTime}</p>
              ${safePaymentReference !== 'N/A' ? `<p>Reference: ${safePaymentReference}</p>` : ''}
              ${safePaymentNotes ? `<p>Notes: ${safePaymentNotes}</p>` : ''}
            </div>

            ${isPartialPayment ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; margin-top: 15px;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Note:</strong> This is a partial payment of ${safePaymentAmount} 
                  from ${documentType.toLowerCase()} total of ${safeDocumentTotal}. 
                  Outstanding balance: ${formatCurrency((documentTotal || 0) - (payment?.amount || 0))}
                </p>
              </div>
            ` : `
              <div style="background: #d1fae5; border: 1px solid #10b981; padding: 12px; margin-top: 15px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Payment Complete:</strong> This payment of ${safePaymentAmount} 
                  fully settles ${documentType.toLowerCase()} #${safeDocumentNumber} for ${safeDocumentTotal}.
                </p>
              </div>
            `}
          </div>

          <div class="footer">
            <p>Thank you for your payment!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p style="margin-top: 15px; font-size: 10px; color: #9ca3af;">
              Powered by <a href="https://insightbooksafrica.com/" style="color: #4f46e5; text-decoration: none;">InsightBooks</a>
            </p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Combined receipt
      const safeTotalPaid = formatCurrency(totalPaid || 0);
      const safeDocumentTotal = formatCurrency(documentTotal || 0);
      const safePayments = payments || [];
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Receipt Summary - ${safeDocumentNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #4f46e5; margin-bottom: 5px; }
            .receipt-title { font-size: 20px; color: #374151; margin-bottom: 10px; }
            .info-section { margin-bottom: 20px; }
            .info-section h3 { color: #4f46e5; font-size: 16px; margin-bottom: 10px; }
            .payment-details { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; }
            .payment-summary { background: #4f46e5; color: white; padding: 15px; margin-bottom: 15px; }
            .payment-amount { font-size: 24px; font-weight: bold; }
            .payment-status { background: #10b981; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
            .payments-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .payments-table th, .payments-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .payments-table th { background: #f3f4f6; font-weight: 600; color: #374151; }
            .total-section { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; }
            .total-row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
            .total-row.final { font-weight: bold; font-size: 18px; color: #4f46e5; border-top: 2px solid #4f46e5; padding-top: 10px; margin-top: 15px; }
            .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Payment Receipt Summary</div>
            <div class="receipt-title">${documentType} #${safeDocumentNumber}</div>
          </div>

          <div class="info-section">
            <h3>Client Information</h3>
            <p><strong>Name:</strong> ${safeClientName}</p>
            <p><strong>Email:</strong> ${safeClientEmail}</p>
            <p><strong>Phone:</strong> ${safeClientPhone}</p>
          </div>

          <div class="info-section">
            <h3>Receipt Summary</h3>
            <p><strong>Total Payments:</strong> ${safePayments.length}</p>
            <p><strong>${documentType} Total:</strong> ${safeDocumentTotal}</p>
            <p><strong>Total Paid:</strong> ${safeTotalPaid}</p>
          </div>

          <div class="payment-details">
            <div class="payment-summary">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 14px; opacity: 0.9;">Total Amount Paid</div>
                  <div class="payment-amount">${safeTotalPaid}</div>
                </div>
                <div class="payment-status">
                  ${isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
                </div>
              </div>
            </div>

            <h3 style="color: #4f46e5; margin-bottom: 15px;">Payment History</h3>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
              <div style="background: #f3f4f6; padding: 12px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
                  <div>Date</div>
                  <div>Method</div>
                  <div>Amount</div>
                  <div>Reference</div>
                </div>
              </div>
              ${safePayments.map(p => `
                <div style="padding: 12px; border-bottom: 1px solid #e5e7eb; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px;">
                  <div>${p.paymentDate ? formatDateTime(p.paymentDate) : 'N/A'}</div>
                  <div>${p.paymentMethod ? getPaymentMethodName(p.paymentMethod) : 'N/A'}</div>
                  <div>${p.amount ? formatCurrency(p.amount) : formatCurrency(0)}</div>
                  <div>${p.reference || 'N/A'}</div>
                </div>
              `).join('')}
            </div>

            <div class="total-section">
              <div class="total-row">
                <span>${documentType} Total:</span>
                <span>${safeDocumentTotal}</span>
              </div>
              <div class="total-row">
                <span>Total Paid:</span>
                <span>${safeTotalPaid}</span>
              </div>
              <div class="total-row">
                <span>Outstanding Balance:</span>
                <span>${formatCurrency((documentTotal || 0) - (totalPaid || 0))}</span>
              </div>
              <div class="total-row final">
                <span>Status:</span>
                <span>${isFullyPaid ? 'FULLY PAID' : 'PARTIALLY PAID'}</span>
              </div>
            </div>

            ${!isFullyPaid ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; margin-top: 15px;">
                <p style="margin: 0; color: #92400e;">
                  <strong>Outstanding Balance:</strong> ${formatCurrency((documentTotal || 0) - (totalPaid || 0))} 
                  remaining to be paid on this ${documentType.toLowerCase()}.
                </p>
              </div>
            ` : `
              <div style="background: #d1fae5; border: 1px solid #10b981; padding: 12px; margin-top: 15px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Payment Complete:</strong> All payments totaling ${safeTotalPaid} 
                  fully settle ${documentType.toLowerCase()} #${safeDocumentNumber}.
                </p>
              </div>
            `}
          </div>

          <div class="footer">
            <p>Thank you for your payments!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p style="margin-top: 15px; font-size: 10px; color: #9ca3af;">
              Powered by <a href="https://insightbooksafrica.com/" style="color: #4f46e5; text-decoration: none;">InsightBooks</a>
            </p>
          </div>
        </body>
        </html>
      `;
    }

    // Launch puppeteer with more robust settings
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--run-all-compositor-stages-before-draw',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    // Add executable path if running in production
    if (process.env.NODE_ENV === 'production') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    console.log('Launching Puppeteer with options:', JSON.stringify(launchOptions, null, 2));
    browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Debug: Log HTML content length
    console.log('HTML content length:', htmlContent.length);
    console.log('Receipt type:', type);
    
    // Set content and wait for rendering
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for fonts and styles to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Debug: Check if page content loaded properly
    const bodyText = await page.evaluate(() => document.body.textContent);
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    console.log('Page body text length:', bodyText.length);
    console.log('Page body HTML length:', bodyHtml.length);
    
    // Check if body has content
    if (!bodyText || bodyText.trim().length === 0) {
      console.error('Page body is empty! HTML content:', htmlContent.substring(0, 500));
      throw new Error('Page content is empty - HTML may not be rendering correctly');
    }
    
    // Generate PDF with more robust settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    
    // Debug: Check PDF size
    console.log('Generated PDF size:', pdf.length, 'bytes');
    
    if (pdf.length === 0) {
      throw new Error('Generated PDF is empty (0 bytes)');
    }
    
    return pdf;
    
  } catch (error) {
    console.error('Error generating simple payment receipt PDF:', error);
    console.error('Error stack:', error.stack);
    console.error('Receipt data type:', receiptData?.type);
    console.error('Receipt data keys:', receiptData ? Object.keys(receiptData) : 'No receipt data');
    
    // Try fallback text-based receipt
    try {
      console.log('Attempting fallback text-based receipt...');
      const fallbackText = generateFallbackReceipt(receiptData);
      
      // Create a simple PDF with the text content
      const textPdf = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length ${fallbackText.length + 100}
>>
stream
BT
/F1 10 Tf
50 750 Td
(${fallbackText.replace(/[()\\]/g, '\\$&').replace(/\n/g, ') Tj\n50 720 Td\n(')}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${297 + fallbackText.length}
%%EOF`);
      
      console.log('Fallback PDF generated successfully, size:', textPdf.length, 'bytes');
      return textPdf;
    } catch (fallbackError) {
      console.error('Fallback PDF generation also failed:', fallbackError);
      
      // Return a minimal error PDF
      const minimalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Error generating PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF');
      return minimalPdf;
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}
