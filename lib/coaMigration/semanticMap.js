/**
 * Phase 3 Rule 2: name-based hints → canonical target codes (per guide; non-exhaustive).
 * @param {{ accountName?: string|null, bucket: string }} row
 * @returns {string|null}
 */
export function semanticMapTarget({ accountName, bucket }) {
  const n = (accountName || '').trim();
  if (!n) return null;

  const rules = [
    { bucket: 'Expense', re: /transport|fuel|vehicle|car allowance/i, code: '5340' },
    { bucket: 'Expense', re: /electricity|water|internet|phone bill|airtime/i, code: '5310' },
    { bucket: 'Expense', re: /stationery|printing|office materials/i, code: '5320' },
    { bucket: 'Expense', re: /advertising|promotions|social media|public relations|\bpr\b/i, code: '5330' },
    { bucket: 'Expense', re: /interest on loan|bank fees|wire fees|ledger fees/i, code: '5500' },
    { bucket: 'Expense', re: /amortization|depreciation/i, code: '5400' },
    { bucket: 'Expense', re: /staff salaries|wages|payroll/i, code: '5200' },
    { bucket: 'Asset', re: /cash in hand|till float|petty float/i, code: '1120' },
    { bucket: 'Asset', re: /debtors|trade debtors|receivables/i, code: '1200' },
    { bucket: 'Asset', re: /stock|merchandise|finished goods/i, code: '1310' },
    { bucket: 'Liability', re: /creditors|trade creditors|payables/i, code: '2110' },
    { bucket: 'Liability', re: /vat output|vat control|tax payable/i, code: '2120' },
    { bucket: 'Revenue', re: /sales|product revenue|goods sold/i, code: '4100' },
    { bucket: 'Revenue', re: /consulting|professional fees|service fees/i, code: '4150' },
    { bucket: 'Equity', re: /retained|accumulated profit/i, code: '3200' },
    { bucket: 'Equity', re: /current year|ytd earnings|profit.*year/i, code: '3300' },
    { bucket: 'Equity', re: /opening balance|suspense/i, code: '3999' },
    { bucket: 'Equity', re: /owner|capital|shareholder equity/i, code: '3100' },
  ];

  for (const r of rules) {
    if (r.bucket === bucket && r.re.test(n)) return r.code;
  }
  return null;
}
