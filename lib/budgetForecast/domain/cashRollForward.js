/**
 * Monthly cash roll-forward (minor or major — same unit throughout). Never posts.
 */

/**
 * @param {object} input
 * @param {number} input.openingCash
 * @param {Array<{ key?: string, periodStart?: Date|string, receipts?: number, payments?: number, expectedReceipts?: number, expectedPayments?: number }>} input.months
 * @returns {Array<{ key: string, periodStart: *, openingCash: number, expectedReceipts: number, expectedPayments: number, closingCash: number, warning: string|null }>}
 */
export function rollForwardCash({ openingCash = 0, months = [] } = {}) {
  let opening = Number(openingCash) || 0;
  return (months || []).map((m, i) => {
    const receipts = Number(m.expectedReceipts ?? m.receipts ?? 0) || 0;
    const payments = Number(m.expectedPayments ?? m.payments ?? 0) || 0;
    const closing = opening + receipts - payments;
    const key =
      m.key ||
      (m.periodStart ? String(m.periodStart).slice(0, 7) : `m${i + 1}`);
    const row = {
      key,
      periodStart: m.periodStart || null,
      periodEnd: m.periodEnd || null,
      openingCash: opening,
      expectedReceipts: receipts,
      expectedPayments: payments,
      closingCash: closing,
      warning: closing < 0 ? 'CASH_DIP' : null,
      sourceType: m.sourceType || 'FORECAST',
    };
    opening = closing;
    return row;
  });
}

/**
 * Build month cash rows from forecast lines period amounts.
 * Revenue → receipts; expense → payments.
 */
export function buildCashMonthsFromLines(lines, periods, classifyKind) {
  const months = (periods || []).map((p) => ({
    key: p.key || String(p.periodStart).slice(0, 7),
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    expectedReceipts: 0,
    expectedPayments: 0,
  }));
  const byKey = new Map(months.map((m) => [m.key, m]));

  for (const line of lines || []) {
    const kind = classifyKind
      ? classifyKind(line.accountTypeSnapshot, line.accountCategorySnapshot)
      : 'EXPENSE';
    for (const p of line.periodAmounts || line.periods || []) {
      const key = p.key || String(p.periodStart).slice(0, 7);
      const row = byKey.get(key);
      if (!row) continue;
      const amt = Number(p.forecastAmountMinor ?? p.forecastAmount ?? p.amount ?? 0) || 0;
      if (kind === 'REVENUE' || kind === 'OTHER_INCOME') row.expectedReceipts += amt;
      else if (kind === 'EXPENSE' || kind === 'COST_OF_SALES' || kind === 'OTHER_EXPENSE') {
        row.expectedPayments += amt;
      }
    }
  }
  return months;
}
