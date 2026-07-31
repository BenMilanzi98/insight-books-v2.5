/**
 * Accounting V2 — standardized transaction boundary.
 *
 * Every accounting write operation runs inside exactly one database transaction.
 * The transaction client is passed explicitly; repository functions must accept it
 * and must never fall back to the global client inside a boundary.
 *
 * Retry policy: only classified transient database failures are retried, with the
 * SAME idempotency key. Business/validation failures are never retried.
 */

import { classifyError, AccountingConcurrencyError } from '../domain/errors.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * @template T
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} work
 * @param {object} [options]
 * @param {number} [options.maxAttempts] retries for transient DB failures only
 * @param {number} [options.timeoutMs]
 * @param {(info: object) => void} [options.onAttempt] observability hook
 * @returns {Promise<T>}
 */
export async function runInAccountingTransaction(prisma, context, work, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // When handed an interactive transaction client (no $transaction), join it.
  // Nesting prisma.$transaction from inside a sale/invoice tx would start a
  // separate connection that cannot see uncommitted source rows.
  if (typeof prisma?.$transaction !== 'function') {
    const startedAt = Date.now();
    try {
      const result = await work(prisma);
      options.onAttempt?.({
        attempt: 1,
        status: 'joined',
        durationMs: Date.now() - startedAt,
        requestId: context.requestId,
        correlationId: context.correlationId,
      });
      return result;
    } catch (err) {
      const { code } = classifyError(err);
      options.onAttempt?.({
        attempt: 1,
        status: 'joined_failed',
        errorCode: code,
        retryable: false,
        durationMs: Date.now() - startedAt,
        requestId: context.requestId,
        correlationId: context.correlationId,
      });
      throw err;
    }
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const result = await prisma.$transaction(async (tx) => work(tx), {
        timeout: timeoutMs,
        // Serializable would be ideal; Prisma default (ReadCommitted) is retained to
        // avoid surprising legacy coexistence. The registry unique constraint is the
        // hard duplicate guard regardless of isolation level.
      });
      options.onAttempt?.({
        attempt,
        status: 'committed',
        durationMs: Date.now() - startedAt,
        requestId: context.requestId,
        correlationId: context.correlationId,
      });
      return result;
    } catch (err) {
      const { retryable, code } = classifyError(err);
      options.onAttempt?.({
        attempt,
        status: 'rolled_back',
        errorCode: code,
        retryable,
        durationMs: Date.now() - startedAt,
        requestId: context.requestId,
        correlationId: context.correlationId,
      });
      lastError = err;
      if (!retryable || attempt === maxAttempts) throw err;
    }
  }
  // Unreachable, but keeps control flow explicit.
  throw new AccountingConcurrencyError({
    requestId: context.requestId,
    correlationId: context.correlationId,
    diagnostic: { cause: String(lastError) },
  });
}

/**
 * Guard helper: repositories call this to insist they were handed a transaction
 * client (an object with model delegates but no $transaction of its own).
 * @param {unknown} tx
 */
export function assertTransactionClient(tx) {
  if (!tx || typeof tx !== 'object') {
    throw new TypeError('Accounting repository requires an explicit transaction client.');
  }
  if (typeof (/** @type {any} */ (tx).$transaction) === 'function') {
    throw new TypeError(
      'Accounting repository was handed the root Prisma client. Pass the transaction client from runInAccountingTransaction.'
    );
  }
}
