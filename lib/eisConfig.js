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

export const EIS_ENDPOINTS = {
  AUTH_TOKEN: '/auth/token',
  INVOICES_SUBMIT: '/invoices/submit',
  INVOICES_STATUS: '/invoices/status', // + /{id}
  INVOICES_LIST: '/invoices/list',
  INVOICES_VALIDATE: '/invoices/validate',
  REPORTS_VAT: '/reports/vat-summary',
  REPORTS_PAYE: '/reports/paye-summary',
  SYSTEM_HEALTH: '/system/health',
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

export function validateInvoiceData(invoice) {
  const errors = [];

  if (!invoice.invoiceNumber) errors.push('Invoice number is required');
  if (invoice.invoiceNumber && invoice.invoiceNumber.length > EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH) {
    errors.push(`Invoice number must be at most ${EIS_VALIDATION.MAX_INVOICE_NUMBER_LENGTH} characters`);
  }
  if (!invoice.invoiceDate) errors.push('Invoice date is required');
  if (!invoice.items || invoice.items.length === 0) errors.push('At least one line item is required');

  if (invoice.items) {
    invoice.items.forEach((item, i) => {
      if (!item.description) errors.push(`Item ${i + 1}: description is required`);
      if (item.quantity == null || item.quantity <= 0) errors.push(`Item ${i + 1}: quantity must be positive`);
      if (item.unitPrice == null || item.unitPrice < 0) errors.push(`Item ${i + 1}: unitPrice cannot be negative`);
    });
  }

  return { valid: errors.length === 0, errors };
}
