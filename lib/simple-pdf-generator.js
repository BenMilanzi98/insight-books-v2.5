// lib/simple-pdf-generator.js
// Delegates to the jsPDF-based server PDF generator (no Puppeteer required).
import { generatePaymentReceiptPdfBuffer } from './server-pdf-jspdf';

/**
 * Generate a simple payment receipt PDF.
 *
 * @param {Object} receiptData - The receipt data containing payment and invoice/expense information
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateSimplePaymentReceiptPDF(receiptData) {
  return generatePaymentReceiptPdfBuffer(receiptData);
}
