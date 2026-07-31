/**
 * Accounting V2 — journal draft and journal line draft.
 *
 * A draft is the validated in-memory representation of a journal before persistence.
 * Line rules enforced here (structural):
 *   - a line carries a debit OR a credit, never both, never neither
 *   - no negative debits or credits
 *   - zero-value lines require an explicit approved reason
 * Contextual rules (account tenancy, active/posting status, period validity) belong to
 * the journal validation service, which has repository access.
 */

import { money, sumMoneyValues, isNegativeMoney, isZeroMoney } from './money.js';
import { AccountingValidationError, UnbalancedJournalError } from './errors.js';

/**
 * @typedef {object} JournalLineDraft
 * @property {string} accountId
 * @property {import('./money.js').MoneyValue|null} debit
 * @property {import('./money.js').MoneyValue|null} credit
 * @property {import('./money.js').MoneyValue|null} baseDebit
 * @property {import('./money.js').MoneyValue|null} baseCredit
 * @property {string|null} description
 * @property {number} sequence
 * @property {object} dimensions
 * @property {string|null} taxReference
 * @property {string|null} subledgerReference
 * @property {object} metadata
 */

/**
 * @param {object} input
 * @param {string} input.accountId
 * @param {unknown} [input.debit] decimal string/number, exclusive with credit
 * @param {unknown} [input.credit]
 * @param {string} [input.currency]
 * @param {number} [input.sequence]
 * @param {string} [input.zeroValueReason] required if both sides are zero/absent
 * @returns {JournalLineDraft}
 */
export function createJournalLineDraft(input) {
  if (!input?.accountId || typeof input.accountId !== 'string') {
    throw new AccountingValidationError('Journal line requires an accountId.', [
      { path: 'accountId', message: 'required string' },
    ]);
  }
  const currency = input.currency ?? 'MWK';
  const debit = input.debit != null && input.debit !== '' ? money(input.debit, currency) : null;
  const credit = input.credit != null && input.credit !== '' ? money(input.credit, currency) : null;

  if (debit && credit && !isZeroMoney(debit) && !isZeroMoney(credit)) {
    throw new AccountingValidationError('A journal line cannot carry both a debit and a credit.', [
      { path: 'debit/credit', message: 'both sides present' },
    ]);
  }
  if ((debit && isNegativeMoney(debit)) || (credit && isNegativeMoney(credit))) {
    throw new AccountingValidationError('Negative debit or credit values are not permitted.', [
      { path: 'debit/credit', message: 'negative amount' },
    ]);
  }
  const effectiveDebit = debit && !isZeroMoney(debit) ? debit : null;
  const effectiveCredit = credit && !isZeroMoney(credit) ? credit : null;
  if (!effectiveDebit && !effectiveCredit && !input.zeroValueReason) {
    throw new AccountingValidationError(
      'Zero-value journal lines require an explicit approved reason.',
      [{ path: 'zeroValueReason', message: 'required for zero-value line' }]
    );
  }

  return Object.freeze({
    accountId: input.accountId,
    debit: effectiveDebit,
    credit: effectiveCredit,
    baseDebit: input.baseDebit ?? effectiveDebit,
    baseCredit: input.baseCredit ?? effectiveCredit,
    description: input.description ?? null,
    sequence: input.sequence ?? 0,
    dimensions: Object.freeze({ ...(input.dimensions ?? {}) }),
    taxReference: input.taxReference ?? null,
    subledgerReference: input.subledgerReference ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

/**
 * @typedef {object} JournalDraft
 * @property {string} description
 * @property {string} transactionDate ISO date
 * @property {string} postingDate ISO date
 * @property {import('./sourceReference.js').SourceReference} sourceReference
 * @property {string} currency
 * @property {string|number} exchangeRate
 * @property {string|null} financialYearId
 * @property {string|null} accountingPeriodId
 * @property {object} dimensions
 * @property {JournalLineDraft[]} lines
 * @property {object} metadata
 * @property {{debitMinor:number, creditMinor:number}} totals
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Create and structurally validate a journal draft: at least two lines, balanced
 * debits/credits in transaction currency (and base currency when base amounts differ).
 * @param {object} input
 * @returns {JournalDraft}
 */
export function createJournalDraft(input) {
  const issues = [];
  if (!input?.description || typeof input.description !== 'string') {
    issues.push({ path: 'description', message: 'required string' });
  }
  if (!input?.transactionDate || !ISO_DATE_RE.test(String(input.transactionDate))) {
    issues.push({ path: 'transactionDate', message: 'required ISO date' });
  }
  if (!input?.sourceReference) {
    issues.push({ path: 'sourceReference', message: 'required' });
  }
  if (!Array.isArray(input?.lines) || input.lines.length < 2) {
    issues.push({ path: 'lines', message: 'a journal requires at least two lines' });
  }
  if (issues.length > 0) {
    throw new AccountingValidationError('Journal draft is invalid.', issues);
  }

  const currency = input.currency ?? 'MWK';
  const lines = input.lines.map((line, i) =>
    Object.isFrozen(line) && line.accountId
      ? line
      : createJournalLineDraft({ currency, sequence: i + 1, ...line })
  );

  const debitTotal = sumMoneyValues(lines.map((l) => l.debit).filter(Boolean), currency);
  const creditTotal = sumMoneyValues(lines.map((l) => l.credit).filter(Boolean), currency);
  if (debitTotal.minor !== creditTotal.minor) {
    throw new UnbalancedJournalError({ debitMinor: debitTotal.minor, creditMinor: creditTotal.minor });
  }
  const baseDebitTotal = sumMoneyValues(lines.map((l) => l.baseDebit).filter(Boolean), lines.find((l) => l.baseDebit)?.baseDebit?.currency ?? currency);
  const baseCreditTotal = sumMoneyValues(lines.map((l) => l.baseCredit).filter(Boolean), lines.find((l) => l.baseCredit)?.baseCredit?.currency ?? currency);
  if (baseDebitTotal.minor !== baseCreditTotal.minor) {
    throw new UnbalancedJournalError({ debitMinor: baseDebitTotal.minor, creditMinor: baseCreditTotal.minor });
  }

  return Object.freeze({
    description: input.description,
    transactionDate: input.transactionDate,
    postingDate: input.postingDate ?? input.transactionDate,
    sourceReference: input.sourceReference,
    currency,
    exchangeRate: input.exchangeRate ?? 1,
    financialYearId: input.financialYearId ?? null,
    accountingPeriodId: input.accountingPeriodId ?? null,
    dimensions: Object.freeze({ ...(input.dimensions ?? {}) }),
    lines: Object.freeze(lines),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    totals: Object.freeze({ debitMinor: debitTotal.minor, creditMinor: creditTotal.minor }),
  });
}
