/**
 * Configurable document readiness checklist (no financial impact).
 */

export const DEFAULT_DOCUMENT_CHECKLIST = Object.freeze([
  { key: 'BUSINESS_REGISTRATION', label: 'Business registration', required: true },
  { key: 'TAX_REGISTRATION', label: 'Tax registration', required: true },
  { key: 'TAX_CLEARANCE', label: 'Tax clearance certificate', required: true },
  { key: 'BANK_STATEMENTS_3M', label: 'Bank statements (3 months)', required: true },
  { key: 'MANAGEMENT_ACCOUNTS', label: 'Management accounts', required: true },
  { key: 'CASH_FLOW_FORECAST', label: 'Cash flow forecast', required: true },
  { key: 'USE_OF_FUNDS', label: 'Use-of-funds schedule', required: true },
  { key: 'EXISTING_LOAN_STATEMENTS', label: 'Existing loan statements', required: false },
  { key: 'BOARD_RESOLUTION', label: 'Board / owner resolution', required: false },
  { key: 'COLLATERAL_DOCS', label: 'Collateral / security documents', required: false },
  { key: 'VALUATION_REPORT', label: 'Valuation report', required: false },
  { key: 'INSURANCE', label: 'Insurance documents', required: false },
]);

/**
 * @param {Array<{key:string,status?:string,expiryDate?:string}>} submitted
 */
export function assessDocumentReadiness(submitted = [], checklist = DEFAULT_DOCUMENT_CHECKLIST) {
  const byKey = new Map((submitted || []).map((d) => [d.key, d]));
  const items = [];
  let required = 0;
  let satisfied = 0;
  const missing = [];
  const expired = [];

  for (const req of checklist) {
    const row = byKey.get(req.key);
    const status = normalizeStatus(row);
    if (req.required) required += 1;
    if (status === 'EXPIRED') expired.push(req.key);
    if (req.required && (status === 'VALID' || status === 'UPLOADED' || status === 'UNDER_REVIEW')) {
      // UNDER_REVIEW / UPLOADED count toward completion but VALID preferred
      if (status === 'VALID') satisfied += 1;
      else satisfied += 0.5;
    } else if (req.required && status === 'MISSING') {
      missing.push(req.label || req.key);
    } else if (req.required && status === 'EXPIRED') {
      missing.push(`${req.label || req.key} (expired)`);
    } else if (!req.required && status === 'VALID') {
      /* optional bonus ignored for % */
    }

    items.push({
      key: req.key,
      label: req.label,
      required: req.required,
      status,
      expiryDate: row?.expiryDate || null,
      notes: row?.notes || null,
    });
  }

  const completionPercent = required === 0 ? 100 : Math.round((satisfied / required) * 100);

  return {
    completionPercent,
    requiredCount: required,
    missing,
    expired,
    items,
    note: 'Document status does not change financial values. Expired documents are not treated as valid.',
  };
}

function normalizeStatus(row) {
  if (!row) return 'MISSING';
  const s = String(row.status || 'MISSING').toUpperCase();
  if (row.expiryDate) {
    const exp = new Date(row.expiryDate);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return 'EXPIRED';
  }
  if (
    [
      'NOT_REQUIRED',
      'REQUIRED',
      'MISSING',
      'REQUESTED',
      'UPLOADED',
      'UNDER_REVIEW',
      'VALID',
      'INVALID',
      'EXPIRED',
      'EXPIRING_SOON',
      'REPLACEMENT_REQUIRED',
      'WAIVED',
    ].includes(s)
  ) {
    return s;
  }
  return 'MISSING';
}
