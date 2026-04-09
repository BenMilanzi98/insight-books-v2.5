// lib/receiptPdf.js
// Sale receipt PDF generation. Now delegates to jsPDF-based generator (no Puppeteer required).
// Kept for backward compatibility — callers that pass (sale, tenantSettings, taxData) get a
// proper PDF; callers that pass only an HTML string get a minimal text-fallback PDF.
import { generateSaleReceiptPdfBuffer } from './server-pdf-jspdf';
import { textToMinimalPdf } from './fallback-text-pdf';

/**
 * Generate a sale receipt PDF from structured sale data.
 *
 * @param {Object} sale           - The sale record (with items, tenant, etc.)
 * @param {Object} tenantSettings - Tenant settings (currency, address, footer, etc.)
 * @param {Object} taxData        - Pre-processed tax breakdown
 * @returns {Buffer} PDF buffer
 */
export function saleReceiptToPdf(sale, tenantSettings, taxData) {
  return generateSaleReceiptPdfBuffer(sale, tenantSettings, taxData);
}

/**
 * Legacy entry point: accepts an HTML string. Since we no longer use Puppeteer,
 * this returns a minimal text-based PDF as a fallback. Prefer saleReceiptToPdf() instead.
 *
 * @param {string} htmlString - Receipt HTML (ignored for layout; only kept for compat)
 * @returns {Promise<Buffer>}
 */
export async function receiptHtmlToPdf(htmlString) {
  console.warn('receiptHtmlToPdf: Puppeteer removed. Use saleReceiptToPdf(sale, tenantSettings, taxData) for formatted output.');
  const text = htmlString
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 3000);
  return textToMinimalPdf(text);
}
