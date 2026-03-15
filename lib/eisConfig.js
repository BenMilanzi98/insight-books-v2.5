/**
 * MRA EIS API configuration and validation rules.
 * Endpoints are resolved based on EIS_ENVIRONMENT (sandbox | production).
 */

const SANDBOX_BASE = 'https://dev-eis-api.mra.mw';
const PRODUCTION_BASE = 'https://eis-api.mra.mw';

export function getBaseUrl() {
  if (process.env.EIS_API_BASE_URL) return process.env.EIS_API_BASE_URL;
  return process.env.EIS_ENVIRONMENT === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

/**
 * Actual MRA EIS API v1 endpoints (from swagger spec at eis-api.mra.mw).
 */
export const EIS_ENDPOINTS = {
  // Onboarding
  ACTIVATE_TERMINAL: '/api/v1/onboarding/activate-terminal',
  TERMINAL_ACTIVATED_CONFIRMATION: '/api/v1/onboarding/terminal-activated-confirmation',

  // Configuration
  GET_LATEST_CONFIGS: '/api/v1/configuration/get-latest-configs',
  REQUEST_NEW_TERMINAL_TOKEN: '/api/v1/configuration/request-new-terminal-token',

  // Sales
  SUBMIT_SALES_TRANSACTION: '/api/v1/sales/submit-sales-transaction',
  LAST_SUBMITTED_ONLINE: '/api/v1/sales/last-submitted-online-transaction',
  LAST_SUBMITTED_OFFLINE: '/api/v1/sales/last-submitted-offline-transaction',

  // Stock
  WAREHOUSE_INVENTORY: '/api/v1/stock/warehouse-inventory',
  TRANSFER_INVENTORY: '/api/v1/stock/transfer-inventory',
  SUBMIT_INFORMAL_PURCHASE: '/api/v1/stock/submit-informal-purchase',
  SUBMIT_ADJUSTMENT: '/api/v1/stock/submit-adjustment',
  GET_STOCK_ADJUSTMENT_REASONS: '/api/v1/stock/getStockAdjustmentReasons',
  GET_SUPPLIERS: '/api/v1/stock/get-suppliers',

  // Raw materials
  GET_RAW_MATERIAL: '/api/v1/raw-material/get-raw-material',
  SUBMIT_CONVERSION: '/api/v1/raw-material/submit-conversion',

  // Utilities
  PING: '/api/v1/utilities/ping',
  VALIDATE_VAT5_CERTIFICATE: '/api/v1/utilities/validate-vat5-certificate',
  GET_TERMINAL_BLOCKING_MESSAGE: '/api/v1/utilities/get-terminal-blocking-message',
  CHECK_TERMINAL_UNBLOCK_STATUS: '/api/v1/utilities/check-terminal-unblock-status',
  VALIDATE_AUTHORIZATION_CODE: '/api/v1/utilities/validate-authorization-code',
  PRODUCT_STATUS: '/api/v1/utilities/product-status',
  GET_TERMINAL_SITE_PRODUCTS: '/api/v1/utilities/get-terminal-site-products',
  TAXPAYER_INITIAL_INVENTORY_UPLOAD: '/api/v1/utilities/taxpayer-initial-inventory-upload',
};

export const EIS_VALIDATION = {
  TPIN_LENGTH: 8,
  TPIN_REGEX: /^\d{8}$/,
  STANDARD_VAT_RATE: 16.5,
  MAX_INVOICE_NUMBER_LENGTH: 50,
  CURRENCY: 'MWK',
  DATE_FORMAT: 'YYYY-MM-DD',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 60000,
  REQUEST_TIMEOUT_MS: 30000,
};

export function validateTPIN(tpin) {
  if (!tpin) return { valid: false, error: 'TPIN is required' };
  const trimmed = String(tpin).trim();
  if (!EIS_VALIDATION.TPIN_REGEX.test(trimmed)) {
    return { valid: false, error: 'TPIN must be exactly 8 digits' };
  }
  return { valid: true, tpin: trimmed };
}

/**
 * MRA EIS invoice number format (POS test case TC-INV-014):
 * taxpayerId-terminalPosition-transactionDate-receiptSequentialNumber
 * e.g. 12345678-01-20250604-00001
 */
export const EIS_INVOICE_NUMBER_FORMAT_REGEX = /^\d{8}-\d{1,5}-\d{8}-\d{1,10}$/;

export function validateEISInvoiceNumberFormat(invoiceNumber) {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') return { valid: false, error: 'Invoice number is required' };
  const trimmed = invoiceNumber.trim();
  if (trimmed.length > EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH) {
    return { valid: false, error: `Invoice number must be at most ${EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH} characters` };
  }
  if (!EIS_INVOICE_NUMBER_FORMAT_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invoice number must follow MRA format: taxpayerId-terminalPosition-transactionDate-receiptSequentialNumber (e.g. 12345678-01-20250604-00001)' };
  }
  return { valid: true };
}

/**
 * Generate MRA-compliant EIS invoice number.
 * Format: {tpin}-{terminalPosition}-{YYYYMMDD}-{sequenceNumber}
 * e.g. 12345678-01-20250604-00001
 */
export function generateEISInvoiceNumber(tpin, terminalPosition = '01', date, sequenceNumber) {
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = String(sequenceNumber).padStart(5, '0');
  const pos = String(terminalPosition).padStart(2, '0');
  return `${String(tpin).trim()}-${pos}-${dateStr}-${seq}`;
}

export function validateInvoiceData(invoice) {
  const errors = [];

  if (!invoice.invoiceNumber) errors.push('Invoice number is required');
  if (invoice.invoiceNumber && invoice.invoiceNumber.length > EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH) {
    errors.push(`Invoice number must be at most ${EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH} characters`);
  }
  if (!invoice.invoiceDate) errors.push('Invoice date is required');
  if (!invoice.items || invoice.items.length === 0) errors.push('At least one line item is required');

  // Seller TPIN required for MRA (POS/EIS compliance)
  const sellerTpin = invoice.seller?.tpin;
  if (!sellerTpin || typeof sellerTpin !== 'string' || !EIS_VALIDATION.TPIN_REGEX.test(String(sellerTpin).trim())) {
    errors.push('Seller TPIN is required and must be exactly 8 digits (configure in /account)');
  }

  if (invoice.items) {
    invoice.items.forEach((item, i) => {
      if (!item.description) errors.push(`Item ${i + 1}: description is required`);
      if (item.quantity == null || item.quantity <= 0) errors.push(`Item ${i + 1}: quantity must be positive`);
      if (item.unitPrice == null || item.unitPrice < 0) errors.push(`Item ${i + 1}: unitPrice cannot be negative`);
    });
  }

  return { valid: errors.length === 0, errors };
}
