/**
 * Email safety helpers for System Admin — never expose raw SMTP secrets;
 * sanitize untrusted template variables before render.
 */

const MASKED = '••••••••';

/**
 * Mask a secret for API/UI display. Never returns the raw value.
 * @param {unknown} value
 * @returns {null|string} null for empty/missing; otherwise masked bullets
 */
export function maskSecret(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return MASKED;
}

/**
 * Resend must target an existing communication/log id only (no recreate-from-body).
 * @param {unknown} communicationId
 * @returns {boolean}
 */
export function shouldResendOnly(communicationId) {
  return typeof communicationId === 'string' && communicationId.trim().length > 0;
}

/**
 * Strip HTML tags from untrusted template variable values.
 * Nested objects/arrays are walked; non-strings are left as-is.
 * @param {Record<string, unknown>|null|undefined} vars
 * @returns {Record<string, unknown>}
 */
export function sanitizeTemplateVariables(vars) {
  if (vars == null || typeof vars !== 'object' || Array.isArray(vars)) {
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(vars)) {
    out[key] = sanitizeValue(value);
  }
  return out;
}

function stripHtml(text) {
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return stripHtml(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value != null && typeof value === 'object') {
    return sanitizeTemplateVariables(value);
  }
  return value;
}
