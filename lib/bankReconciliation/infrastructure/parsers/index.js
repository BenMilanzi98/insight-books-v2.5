import { fileExtension } from '../fileSecurity.js';
import { parseCsvStatement } from './csvParser.js';
import { parseXlsxStatement } from './xlsxParser.js';
import { parseOfxStatement } from './ofxParser.js';

/**
 * Parse a statement buffer using profile format hints or file extension.
 */
export function parseStatementBuffer(buffer, fileName, profileOptions = {}) {
  const format = String(profileOptions.format || '').toUpperCase();
  const ext = fileExtension(fileName);
  if (format === 'OFX' || format === 'QFX' || ext === '.ofx' || ext === '.qfx') {
    return parseOfxStatement(buffer, profileOptions);
  }
  if (format === 'XLSX' || format === 'XLS' || ext === '.xlsx' || ext === '.xls') {
    return parseXlsxStatement(buffer, profileOptions);
  }
  return parseCsvStatement(buffer, profileOptions);
}

export { parseCsvStatement, parseXlsxStatement, parseOfxStatement };
