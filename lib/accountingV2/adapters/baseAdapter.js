/**
 * Phase 9 — Module Accounting Adapter contract helpers.
 *
 * Every operational adapter builds a Posting Engine input from a loaded source.
 * Adapters never write JournalEntry / JournalEntryLine / account balances.
 */

import { createAccountingContext } from '../domain/accountingContext.js';
import { DEFAULT_CURRENCY } from '../domain/money.js';
import { getSourcePostingState } from '../engine/sourcePostingState.js';
import { runCutoverPosting } from './cutoverBridge.js';

/**
 * Build a context from tenant/user (API / job boundary).
 */
export function contextFromSession({
  tenantId,
  userId,
  currency,
  branchId = null,
  requestId = null,
  correlationId = null,
  sourceChannel = 'api',
  permissions = [],
}) {
  return createAccountingContext({
    businessId: tenantId,
    userId,
    currency: currency ?? DEFAULT_CURRENCY,
    baseCurrency: currency ?? DEFAULT_CURRENCY,
    branchId,
    requestId: requestId ?? undefined,
    correlationId: correlationId ?? undefined,
    sourceChannel,
    permissions,
  });
}

/**
 * Standard adapter submit: cutover + optional source-state readback.
 */
export async function submitViaCutover(params) {
  const outcome = await runCutoverPosting(params);
  let sourceState = null;
  try {
    const ref = (await params.buildEngineInput())?.sourceReference;
    if (ref?.sourceType && ref?.sourceId) {
      sourceState = await getSourcePostingState(params.db, params.context, {
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        eventType: ref.eventType,
      });
    }
  } catch {
    /* readback is best-effort */
  }
  return { ...outcome, sourceState };
}

/** ISO date-only from Date|string. */
export function toIsoDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

/** Decimal string from Prisma Decimal / number / string. */
export function amountString(value) {
  if (value == null) return '0.00';
  if (typeof value === 'object' && typeof value.toString === 'function') return value.toString();
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * Resolve cash/bank GL id for engine metadata.
 * Prefers PaymentAccount.coaAccountId / getPaymentAccount; if missing, resolvePurposeAccount.
 * Returns null when neither resolves (template may still call resolvePurpose).
 *
 * @param {object} params
 * @param {object} params.db
 * @param {object} params.context AccountingContext
 * @param {string} params.tenantId
 * @param {string|null|undefined} params.paymentMethod
 * @param {string} [params.purpose='CASH_ON_HAND']
 * @returns {Promise<string|null>}
 */
export async function resolveCashAccountIdForEngine({
  db,
  context,
  tenantId,
  paymentMethod,
  purpose = 'CASH_ON_HAND',
}) {
  if (paymentMethod) {
    try {
      const { getPaymentAccount } = await import('../../transactionJournalHelpers.js');
      const cash = await getPaymentAccount(tenantId, paymentMethod, db);
      if (cash?.id) return cash.id;
    } catch {
      /* fall through to purpose */
    }
  }
  try {
    const { resolvePurposeAccount } = await import(
      '../../coaV2/application/accountMappingRegistry.js'
    );
    const acct = await resolvePurposeAccount(context, purpose, {}, db);
    return acct?.id ?? null;
  } catch {
    return null;
  }
}
