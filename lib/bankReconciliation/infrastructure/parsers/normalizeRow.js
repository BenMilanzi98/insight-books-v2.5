import crypto from 'crypto';
import { signedFromDebitCredit, normalizeReference, fromSignedMinor, toSignedMinor } from '../../domain/signedAmount.js';
import { sanitizeCell } from '../fileSecurity.js';

function parseDate(value, dateFormat) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const s = String(value).trim();
  // ISO / YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T00:00:00.000Z');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const dayFirst = !dateFormat || dateFormat.toUpperCase().startsWith('DD');
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    return new Date(Date.UTC(y, month - 1, day));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Normalize a raw parsed object into the shared statement row contract.
 * @returns {object|null}
 */
export function normalizeStatementRow(raw, lineNumber, options = {}) {
  const map = options.columnMap || {};
  const get = (key) => {
    const col = map[key] || key;
    if (raw[col] != null && raw[col] !== '') return raw[col];
    // case-insensitive fallback
    const lower = String(col).toLowerCase();
    for (const [k, v] of Object.entries(raw)) {
      if (String(k).toLowerCase() === lower) return v;
    }
    return undefined;
  };

  const transactionDate = parseDate(get('date') ?? get('transactionDate'), options.dateFormat);
  if (!transactionDate) return null;

  const description = sanitizeCell(get('description') ?? get('memo') ?? get('narration') ?? '');
  const reference = sanitizeCell(get('reference') ?? get('checkNumber') ?? '') || null;
  const payee = sanitizeCell(get('payee') ?? get('name') ?? '') || null;
  const signedAmountMinor = signedFromDebitCredit({
    debit: get('debit'),
    credit: get('credit'),
    amount: get('amount') ?? get('signedAmount'),
  });
  if (signedAmountMinor === 0 && !description) return null;

  const balRaw = get('balance') ?? get('runningBalance');
  const runningBalance = balRaw != null && String(balRaw).trim() !== '' ? fromSignedMinor(toSignedMinor(balRaw)) : null;

  const fingerprint = crypto
    .createHash('sha256')
    .update(
      [
        transactionDate.toISOString().slice(0, 10),
        String(signedAmountMinor),
        normalizeReference(reference) || '',
        String(description).slice(0, 120).toUpperCase(),
      ].join('|')
    )
    .digest('hex');

  return {
    lineNumber,
    transactionDate,
    valueDate: parseDate(get('valueDate'), options.dateFormat),
    description: description || '(no description)',
    reference,
    referenceNormalized: normalizeReference(reference),
    payee,
    signedAmountMinor,
    signedAmount: fromSignedMinor(signedAmountMinor),
    runningBalance,
    currency: options.currency || 'MWK',
    rowFingerprint: fingerprint,
    remainingAmountMinor: signedAmountMinor,
    rawPayload: raw,
  };
}
