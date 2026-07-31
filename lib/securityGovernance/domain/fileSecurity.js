/**
 * Generic upload security (extends bank-recon patterns for platform use).
 */

import { createHash } from 'crypto';
import { FileSecurityError } from './errors.js';

const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'js',
  'mjs',
  'vbs',
  'ps1',
  'sh',
  'dll',
  'msi',
  'jar',
  'scr',
]);

const FORMULA_PREFIX = /^[=+\-@]/;

export function assertSafeUpload({
  filename,
  mimeType,
  sizeBytes,
  maxBytes = 10 * 1024 * 1024,
  allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'csv', 'xlsx', 'xls', 'txt'],
} = {}) {
  if (!filename || typeof filename !== 'string') {
    throw new FileSecurityError('Filename required.');
  }
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new FileSecurityError('Path traversal rejected.', { filename });
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new FileSecurityError('Executable or script uploads are not allowed.', { ext });
  }
  if (!allowedExtensions.includes(ext)) {
    throw new FileSecurityError('File type not allowed.', { ext });
  }
  if (sizeBytes != null && Number(sizeBytes) > maxBytes) {
    throw new FileSecurityError('File exceeds size limit.', { maxBytes });
  }
  return { ext, mimeType: mimeType || null, safeName: filename.replace(/[^\w.\-]+/g, '_') };
}

export function sanitizeSpreadsheetCell(value) {
  if (value == null) return value;
  const s = String(value);
  if (FORMULA_PREFIX.test(s)) return `'${s}`;
  return s;
}

export function fileContentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
