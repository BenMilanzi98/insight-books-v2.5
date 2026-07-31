/**
 * Posting engine — strictly typed Posting Command (Phase 4).
 *
 * The command is the only input the engine accepts. It is validated and frozen
 * before any database read or write. Monetary values are decimal strings; JS
 * floating point is never accepted as an authoritative amount. Client-supplied
 * architecture overrides (posting mode, architecture version, business id) are
 * rejected at the API boundary and again here.
 */

import { createSourceReference, deriveIdempotencyKey, hashCommandContent } from '../domain/sourceReference.js';
import { createAccountingContext } from '../domain/accountingContext.js';
import { money, DEFAULT_CURRENCY } from '../domain/money.js';
import { validateDimensions } from '../domain/dimensionPolicy.js';
import { InvalidPostingCommandError, AccountingContextRequiredError } from '../domain/errors.js';
import { AccountingEventType, isEnumValue } from '../domain/enums.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const CURRENCY_RE = /^[A-Z]{3}$/;

/** Fields a client is never allowed to set — the server resolves them. */
export const SERVER_RESOLVED_FIELDS = Object.freeze([
  'postingMode',
  'architectureVersion',
  'businessId',
  'tenantId',
  'idempotencyKey', // derived from identity, never trusted from the client
]);

/**
 * @typedef {object} PostingCommand
 * @property {import('../domain/accountingContext.js').AccountingContext} context
 * @property {import('../domain/sourceReference.js').SourceReference} sourceReference
 * @property {string} idempotencyKey canonical, derived server-side
 * @property {string} transactionDate ISO date
 * @property {string|null} requestedPostingDate ISO date
 * @property {string} currency
 * @property {string} baseCurrency
 * @property {string|number} exchangeRate
 * @property {import('../domain/money.js').MoneyValue|null} totalAmount
 * @property {import('../domain/money.js').MoneyValue|null} taxAmount
 * @property {string|null} description
 * @property {string|null} approvalReference
 * @property {string[]} attachmentReferences
 * @property {Record<string,string>} dimensions
 * @property {object} metadata
 * @property {object|null} payload template-specific input (e.g. manual journal lines)
 * @property {string|null} initiatedBy
 * @property {string|null} approvedBy
 */

/**
 * Build and validate a Posting Command. Throws `InvalidPostingCommandError`
 * with structured issues; never mutates the database.
 *
 * @param {object} input
 * @param {import('../domain/accountingContext.js').AccountingContext|object} input.context
 * @param {object} input.sourceReference sourceModule/sourceType/sourceId/eventType/…
 * @returns {PostingCommand}
 */
export function createPostingCommand(input) {
  if (!input?.context?.businessId || !input.context.userId) {
    throw new AccountingContextRequiredError();
  }
  // Re-freeze through the canonical constructor if a plain object was passed.
  const context = Object.isFrozen(input.context)
    ? input.context
    : createAccountingContext(input.context);

  const issues = [];

  for (const field of SERVER_RESOLVED_FIELDS) {
    if (field in input && input[field] != null && field !== 'businessId' && field !== 'tenantId') {
      issues.push({ path: field, message: 'server-resolved field must not be supplied by the caller' });
    }
  }

  let sourceReference = null;
  try {
    sourceReference = createSourceReference(input.sourceReference ?? {});
  } catch (err) {
    issues.push({ path: 'sourceReference', message: err?.message ?? 'invalid source reference' });
  }

  if (!input.transactionDate || !ISO_DATE_RE.test(String(input.transactionDate))) {
    issues.push({ path: 'transactionDate', message: 'required ISO date (YYYY-MM-DD)' });
  } else if (Number.isNaN(new Date(input.transactionDate).getTime())) {
    issues.push({ path: 'transactionDate', message: 'not a real calendar date' });
  }
  if (input.requestedPostingDate != null) {
    if (!ISO_DATE_RE.test(String(input.requestedPostingDate)) ||
        Number.isNaN(new Date(input.requestedPostingDate).getTime())) {
      issues.push({ path: 'requestedPostingDate', message: 'must be an ISO date when supplied' });
    }
  }

  const currency = input.currency ?? context.currency ?? DEFAULT_CURRENCY;
  if (!CURRENCY_RE.test(currency)) {
    issues.push({ path: 'currency', message: `invalid currency code "${currency}"` });
  }
  const baseCurrency = input.baseCurrency ?? context.baseCurrency ?? DEFAULT_CURRENCY;
  if (!CURRENCY_RE.test(baseCurrency)) {
    issues.push({ path: 'baseCurrency', message: `invalid base currency "${baseCurrency}"` });
  }

  const exchangeRate = input.exchangeRate ?? 1;
  const rateNumber = typeof exchangeRate === 'string' ? Number(exchangeRate) : exchangeRate;
  if (!Number.isFinite(rateNumber) || rateNumber <= 0) {
    issues.push({ path: 'exchangeRate', message: 'must be a positive decimal' });
  }

  let totalAmount = null;
  if (input.totalAmount != null && input.totalAmount !== '') {
    if (typeof input.totalAmount === 'number' && !Number.isInteger(input.totalAmount * 100)) {
      // Floats with sub-cent noise are exactly the class of input we refuse.
      issues.push({ path: 'totalAmount', message: 'authoritative amounts must be decimal strings' });
    } else {
      try {
        totalAmount = money(String(input.totalAmount), currency);
        if (totalAmount.minor < 0) issues.push({ path: 'totalAmount', message: 'must not be negative' });
      } catch (err) {
        issues.push({ path: 'totalAmount', message: err?.message ?? 'invalid decimal' });
      }
    }
  }

  let taxAmount = null;
  if (input.taxAmount != null && input.taxAmount !== '') {
    try {
      taxAmount = money(String(input.taxAmount), currency);
      if (taxAmount.minor < 0) issues.push({ path: 'taxAmount', message: 'must not be negative' });
    } catch (err) {
      issues.push({ path: 'taxAmount', message: err?.message ?? 'invalid decimal' });
    }
  }

  const dimensions = { ...(input.dimensions ?? {}) };
  for (const [key, value] of Object.entries(dimensions)) {
    if (value != null && typeof value !== 'string') {
      issues.push({ path: `dimensions.${key}`, message: 'dimension values must be strings' });
    }
  }
  if (sourceReference) {
    try {
      validateDimensions(sourceReference.eventType, dimensions);
    } catch (err) {
      for (const issue of err?.issues ?? [{ path: 'dimensions', message: err?.message }]) {
        issues.push(issue);
      }
    }
  }

  const metadata = input.metadata ?? {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    issues.push({ path: 'metadata', message: 'metadata must be a plain object' });
  } else if (JSON.stringify(metadata).length > 16_384) {
    issues.push({ path: 'metadata', message: 'metadata exceeds the supported size' });
  }

  const attachmentReferences = input.attachmentReferences ?? [];
  if (!Array.isArray(attachmentReferences) || attachmentReferences.some((a) => typeof a !== 'string')) {
    issues.push({ path: 'attachmentReferences', message: 'must be an array of reference strings' });
  }

  if (sourceReference && !isEnumValue(AccountingEventType, sourceReference.eventType)) {
    issues.push({ path: 'eventType', message: `unsupported event type "${sourceReference.eventType}"` });
  }

  if (issues.length > 0) {
    throw new InvalidPostingCommandError(issues, {
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
  }

  const idempotencyKey = deriveIdempotencyKey(context.businessId, sourceReference);

  return Object.freeze({
    context,
    sourceReference,
    idempotencyKey,
    transactionDate: String(input.transactionDate).slice(0, 10),
    requestedPostingDate: input.requestedPostingDate ? String(input.requestedPostingDate).slice(0, 10) : null,
    currency,
    baseCurrency,
    exchangeRate,
    totalAmount,
    taxAmount,
    description: input.description ?? sourceReference.description ?? null,
    approvalReference: input.approvalReference ?? null,
    attachmentReferences: Object.freeze([...attachmentReferences]),
    dimensions: Object.freeze(dimensions),
    metadata: Object.freeze({ ...metadata }),
    payload: input.payload ?? null,
    initiatedBy: input.initiatedBy ?? context.userId,
    approvedBy: input.approvedBy ?? null,
  });
}

/**
 * Stable content hash of the materially significant command fields — used to
 * detect the same idempotency key being reused with different data.
 * @param {PostingCommand} command
 * @param {import('../domain/journalDraft.js').JournalDraft|null} [draft]
 * @returns {Promise<string>}
 */
export async function computeCommandHash(command, draft = null) {
  return hashCommandContent({
    sourceReference: command.sourceReference,
    transactionDate: command.transactionDate,
    currency: command.currency,
    amount: command.totalAmount?.decimal ?? draft?.totals?.debitMinor ?? null,
    lines: draft
      ? draft.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit?.decimal ?? null,
          credit: l.credit?.decimal ?? null,
        }))
      : command.payload?.lines
        ? command.payload.lines.map((l) => ({
            accountId: l.accountId ?? null,
            purpose: l.purpose ?? null,
            debit: l.debit != null ? String(l.debit) : null,
            credit: l.credit != null ? String(l.credit) : null,
          }))
        : null,
  });
}
