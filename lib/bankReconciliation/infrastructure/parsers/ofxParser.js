import { normalizeStatementRow } from './normalizeRow.js';
import { MAX_ROWS } from '../fileSecurity.js';

/**
 * Minimal OFX/QFX SGML parser for bank statement transactions (STMTTRN).
 * Not a full OFX 2.0 XML implementation — covers common bank exports.
 */
export function parseOfxStatement(buffer, profileOptions = {}) {
  const text = buffer.toString('utf8');
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  if (blocks.length > MAX_ROWS) {
    throw Object.assign(new Error(`TOO_MANY_ROWS max=${MAX_ROWS}`), { code: 'TOO_MANY_ROWS' });
  }
  const warnings = [];
  const rows = [];
  let lineNumber = 0;
  for (const block of blocks) {
    lineNumber += 1;
    const body = block.split(/<\/STMTTRN>/i)[0];
    const get = (tag) => {
      const m = body.match(new RegExp(`<${tag}>([^\\r\\n<]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const dt = get('DTPOSTED') || get('DTUSER');
    const date = ofxDate(dt);
    const amount = get('TRNAMT');
    const fitid = get('FITID');
    const name = get('NAME');
    const memo = get('MEMO');
    const checknum = get('CHECKNUM');
    const normalized = normalizeStatementRow(
      {
        date,
        description: memo || name || 'OFX transaction',
        reference: checknum || fitid,
        amount,
        payee: name,
      },
      lineNumber,
      {
        columnMap: {
          date: 'date',
          description: 'description',
          reference: 'reference',
          amount: 'amount',
          payee: 'payee',
        },
        dateFormat: 'YYYYMMDD',
        currency: profileOptions.currency,
      }
    );
    if (normalized) rows.push(normalized);
    else warnings.push(`Skipped OFX STMTTRN #${lineNumber}`);
  }

  const balAmt = text.match(/<BALAMT>([^\r\n<]+)/i);
  const dtAsOf = text.match(/<DTASOF>([^\r\n<]+)/i);
  return {
    rows,
    warnings,
    format: 'OFX',
    statementClosing: balAmt ? balAmt[1].trim() : null,
    statementDate: dtAsOf ? ofxDate(dtAsOf[1].trim()) : null,
  };
}

function ofxDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  // YYYYMMDD or YYYYMMDDHHMMSS
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}
