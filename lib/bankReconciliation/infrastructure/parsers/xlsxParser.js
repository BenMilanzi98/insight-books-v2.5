import * as XLSX from 'xlsx';
import { normalizeStatementRow } from './normalizeRow.js';
import { MAX_ROWS } from '../fileSecurity.js';
import { guessColumnMap } from './csvParser.js';

/**
 * @param {Buffer} buffer
 * @param {object} profileOptions
 */
export function parseXlsxStatement(buffer, profileOptions = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = profileOptions.sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw Object.assign(new Error(`SHEET_NOT_FOUND ${sheetName}`), { code: 'SHEET_NOT_FOUND' });
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const skipRows = Number(profileOptions.skipRows) || 0;
  const sliced = matrix.slice(skipRows);
  if (sliced.length < 2) {
    return { rows: [], warnings: ['XLSX has no data rows'], format: 'XLSX' };
  }
  if (sliced.length - 1 > MAX_ROWS) {
    throw Object.assign(new Error(`TOO_MANY_ROWS max=${MAX_ROWS}`), { code: 'TOO_MANY_ROWS' });
  }
  const headers = sliced[0].map((h) => String(h).trim());
  const columnMap = profileOptions.columnMap || guessColumnMap(headers);
  const warnings = [];
  const rows = [];
  for (let r = 1; r < sliced.length; r += 1) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = sliced[r][idx] ?? '';
    });
    const normalized = normalizeStatementRow(obj, r, {
      columnMap,
      dateFormat: profileOptions.dateFormat,
      currency: profileOptions.currency,
    });
    if (normalized) rows.push(normalized);
    else warnings.push(`Skipped row ${r + skipRows + 1}`);
  }
  return { rows, warnings, columnMap, format: 'XLSX', sheetName };
}
