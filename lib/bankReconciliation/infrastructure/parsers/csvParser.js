import { normalizeStatementRow } from './normalizeRow.js';
import { MAX_ROWS } from '../fileSecurity.js';

function parseCsvText(text, delimiter = ',') {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      i += ch === '\r' ? 2 : 1;
      continue;
    }
    if (ch === '\r') {
      row.push(field);
      field = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);
  return rows;
}

/**
 * @param {Buffer} buffer
 * @param {object} profileOptions
 */
export function parseCsvStatement(buffer, profileOptions = {}) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const delimiter = profileOptions.delimiter || (text.includes('\t') ? '\t' : ',');
  const skipRows = Number(profileOptions.skipRows) || 0;
  const matrix = parseCsvText(text, delimiter).slice(skipRows);
  if (matrix.length < 2) {
    return { rows: [], warnings: ['CSV has no data rows'] };
  }
  if (matrix.length - 1 > MAX_ROWS) {
    throw Object.assign(new Error(`TOO_MANY_ROWS max=${MAX_ROWS}`), { code: 'TOO_MANY_ROWS' });
  }
  const headers = matrix[0].map((h) => String(h).trim());
  const columnMap = profileOptions.columnMap || guessColumnMap(headers);
  const warnings = [];
  const rows = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = matrix[r][idx] ?? '';
    });
    const normalized = normalizeStatementRow(obj, r, {
      columnMap,
      dateFormat: profileOptions.dateFormat,
      currency: profileOptions.currency,
    });
    if (normalized) rows.push(normalized);
    else warnings.push(`Skipped line ${r + skipRows}`);
  }
  return { rows, warnings, columnMap, format: 'CSV' };
}

export function guessColumnMap(headers) {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (...names) => {
    for (const n of names) {
      const i = lower.findIndex((h) => h === n || h.includes(n));
      if (i >= 0) return headers[i];
    }
    return null;
  };
  return {
    date: find('date', 'transaction date', 'posted'),
    description: find('description', 'narration', 'memo', 'details'),
    reference: find('reference', 'ref', 'cheque', 'check'),
    debit: find('debit', 'withdrawal', 'money out'),
    credit: find('credit', 'deposit', 'money in'),
    amount: find('amount', 'value'),
    balance: find('balance', 'running'),
    payee: find('payee', 'name', 'beneficiary'),
  };
}
