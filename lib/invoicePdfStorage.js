import fs from 'fs';
import path from 'path';
import os from 'os';

const SUBDIR = 'insightbooks-invoices';

/** Candidate directories for invoice PDFs (writable tmp first for Docker read-only roots). */
function candidateDirs() {
  return [
    path.join(os.tmpdir(), SUBDIR),
    path.join(process.cwd(), 'tmp'),
  ];
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.accessSync(dir, fs.constants.W_OK);
  return dir;
}

/** Returns the first writable directory for saving invoice PDFs. */
export function getInvoicePdfDir() {
  for (const dir of candidateDirs()) {
    try {
      return ensureDir(dir);
    } catch {
      // try next
    }
  }
  const fallback = path.join(os.tmpdir(), SUBDIR);
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function invoicePdfFilenames(invoiceId, invoiceNumber) {
  const names = [`invoice-${invoiceId}.pdf`];
  if (invoiceNumber != null && invoiceNumber !== '') {
    names.push(`invoice-INV-${invoiceNumber}.pdf`);
    names.push(`invoice-${invoiceNumber}.pdf`);
  }
  return names;
}

/** Find an uploaded invoice PDF across all candidate directories. */
export function findInvoicePdf(invoiceId, invoiceNumber) {
  const filenames = invoicePdfFilenames(invoiceId, invoiceNumber);
  for (const dir of candidateDirs()) {
    for (const filename of filenames) {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) {
        return { filePath, filename, dir };
      }
    }
  }
  return null;
}

export function invoicePdfExists(invoiceId, invoiceNumber) {
  return findInvoicePdf(invoiceId, invoiceNumber) != null;
}

export function saveInvoicePdf(buffer, filename) {
  const dir = getInvoicePdfDir();
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return { filePath, filename, dir };
}

export function deleteInvoicePdf(invoiceId, invoiceNumber) {
  const found = findInvoicePdf(invoiceId, invoiceNumber);
  if (!found) return false;
  fs.unlinkSync(found.filePath);
  return true;
}
