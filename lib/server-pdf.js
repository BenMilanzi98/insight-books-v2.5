// lib/server-pdf.js
// Server-side PDF generation for invoices, quotations, and payment receipts.
// Uses jsPDF (no browser/Puppeteer required) for reliable cross-platform PDF output.
import {
  generateInvoicePdfBuffer,
  generateQuotationPdfBuffer,
  generatePaymentReceiptPdfBuffer,
} from './server-pdf-jspdf';

/**
 * Generate a PDF from an invoice using a specific template.
 *
 * @param {Object} invoice  - The invoice data
 * @param {Object} template - The template configuration
 * @param {Object} branding - The branding settings
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePdf(invoice, template, branding) {
  return generateInvoicePdfBuffer(invoice, template, branding);
}

/**
 * Generate a payment receipt PDF.
 *
 * @param {Object} receiptData - Receipt data (payment, invoice, client, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePaymentReceiptPDF(receiptData) {
  return generatePaymentReceiptPdfBuffer(receiptData);
}

/**
 * Generate a quotation PDF.
 *
 * @param {Object} quotation - The quotation data
 * @param {Object} template  - The template configuration
 * @param {Object} branding  - The branding settings
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateQuotationPdf(quotation, template, branding) {
  return generateQuotationPdfBuffer(quotation, template, branding);
}
