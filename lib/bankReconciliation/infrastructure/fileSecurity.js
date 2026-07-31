/**
 * Statement file security — MIME/signature/size/rows/formula injection.
 */

import crypto from 'crypto';

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS = 20_000;

const ALLOWED_EXT = new Set(['.csv', '.txt', '.xlsx', '.xls', '.ofx', '.qfx']);

const MAGIC = {
  xlsx: [0x50, 0x4b], // ZIP / OOXML
  ofx: null, // text
};

export function fileExtension(fileName = '') {
  const i = String(fileName).lastIndexOf('.');
  return i >= 0 ? String(fileName).slice(i).toLowerCase() : '';
}

export function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {{ buffer: Buffer, fileName: string, mimeType?: string }} input
 * @throws {Error}
 */
export function assertSafeStatementFile(input) {
  const { buffer, fileName, mimeType } = input;
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw Object.assign(new Error('FILE_REQUIRED'), { code: 'FILE_REQUIRED' });
  }
  if (buffer.length === 0) {
    throw Object.assign(new Error('FILE_EMPTY'), { code: 'FILE_EMPTY' });
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw Object.assign(new Error(`FILE_TOO_LARGE max=${MAX_FILE_BYTES}`), { code: 'FILE_TOO_LARGE' });
  }
  const ext = fileExtension(fileName);
  if (!ALLOWED_EXT.has(ext)) {
    throw Object.assign(new Error(`FILE_TYPE_NOT_ALLOWED ${ext}`), { code: 'FILE_TYPE_NOT_ALLOWED' });
  }
  if (ext === '.xlsx' || ext === '.xls') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      // .xls may be OLE; allow OLE signature D0 CF 11 E0
      const ole = buffer[0] === 0xd0 && buffer[1] === 0xcf;
      if (!ole && ext === '.xlsx') {
        throw Object.assign(new Error('FILE_SIGNATURE_MISMATCH'), { code: 'FILE_SIGNATURE_MISMATCH' });
      }
    }
  }
  // Block obvious formula injection in CSV text previews
  if (ext === '.csv' || ext === '.txt' || ext === '.ofx' || ext === '.qfx') {
    const head = buffer.slice(0, Math.min(buffer.length, 4096)).toString('utf8');
    if (/^[=+\-@].*/m.test(head.split(/\r?\n/).slice(0, 5).join('\n'))) {
      // warn only — cells are escaped on parse; reject if entire first cell is formula bomb pattern with DDE
      if (/^=\s*(cmd|powershell|msiexec)/i.test(head)) {
        throw Object.assign(new Error('FILE_FORMULA_INJECTION'), { code: 'FILE_FORMULA_INJECTION' });
      }
    }
  }
  return {
    ext,
    mimeType: mimeType || guessMime(ext),
    byteSize: buffer.length,
    fileHash: hashBuffer(buffer),
  };
}

function guessMime(ext) {
  switch (ext) {
    case '.csv':
    case '.txt':
      return 'text/csv';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.ofx':
    case '.qfx':
      return 'application/x-ofx';
    default:
      return 'application/octet-stream';
  }
}

/** Neutralize spreadsheet formula injection when writing cell strings. */
export function sanitizeCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}
