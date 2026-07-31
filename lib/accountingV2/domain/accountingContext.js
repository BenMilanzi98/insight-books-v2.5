/**
 * Accounting V2 — business-scoped accounting context.
 *
 * Every accounting command requires an explicit, validated context. Accounting services
 * never infer the business from global state; the context is constructed at the API
 * boundary from the authenticated session (never from client-supplied tenant ids).
 */

import { randomUUID } from 'crypto';
import { AccountingValidationError, CrossTenantAccountingError } from './errors.js';
import { DEFAULT_CURRENCY } from './money.js';

/**
 * @typedef {object} AccountingContext
 * @property {string} businessId tenant id owning every record touched by the command
 * @property {string|null} branchId
 * @property {string|null} departmentId
 * @property {string|null} projectId
 * @property {string|null} costCentreId
 * @property {string|null} financialYearId
 * @property {string|null} accountingPeriodId
 * @property {string} currency
 * @property {string} baseCurrency
 * @property {string} userId
 * @property {string[]} permissions
 * @property {string} requestId
 * @property {string} correlationId
 * @property {string} sourceChannel e.g. 'api' | 'import' | 'job' | 'webhook' | 'test'
 */

const REQUIRED = ['businessId', 'userId'];

/**
 * Build a frozen accounting context.
 * @param {Partial<AccountingContext> & {businessId: string, userId: string}} input
 * @returns {AccountingContext}
 */
export function createAccountingContext(input) {
  const issues = [];
  for (const field of REQUIRED) {
    if (!input?.[field] || typeof input[field] !== 'string') {
      issues.push({ path: field, message: 'required string' });
    }
  }
  if (issues.length > 0) {
    throw new AccountingValidationError('Accounting context is incomplete.', issues);
  }
  return Object.freeze({
    businessId: input.businessId,
    branchId: input.branchId ?? null,
    departmentId: input.departmentId ?? null,
    projectId: input.projectId ?? null,
    costCentreId: input.costCentreId ?? null,
    financialYearId: input.financialYearId ?? null,
    accountingPeriodId: input.accountingPeriodId ?? null,
    currency: input.currency ?? DEFAULT_CURRENCY,
    baseCurrency: input.baseCurrency ?? DEFAULT_CURRENCY,
    userId: input.userId,
    permissions: Object.freeze([...(input.permissions ?? [])]),
    requestId: input.requestId ?? randomUUID(),
    correlationId: input.correlationId ?? randomUUID(),
    sourceChannel: input.sourceChannel ?? 'api',
  });
}

/**
 * Build a context from an authenticated session user. The tenant is ALWAYS taken
 * from the session — client-supplied business ids are rejected, not merged.
 * @param {{id: string, tenantId: string|null}} sessionUser
 * @param {Partial<AccountingContext>} [extras]
 */
export function contextFromSessionUser(sessionUser, extras = {}) {
  if (!sessionUser?.tenantId) {
    throw new AccountingValidationError('Authenticated user has no business scope.');
  }
  if (extras.businessId && extras.businessId !== sessionUser.tenantId) {
    throw new CrossTenantAccountingError({
      diagnostic: { requested: extras.businessId, session: sessionUser.tenantId },
    });
  }
  return createAccountingContext({
    ...extras,
    businessId: sessionUser.tenantId,
    userId: sessionUser.id,
  });
}

/**
 * Assert an entity row belongs to the context business. Central guard used by
 * repositories before returning or mutating rows.
 * @param {AccountingContext} context
 * @param {{tenantId?: string|null, businessId?: string|null}} entity
 * @param {string} entityLabel
 */
export function assertSameBusiness(context, entity, entityLabel = 'record') {
  const owner = entity?.tenantId ?? entity?.businessId ?? null;
  if (owner !== context.businessId) {
    throw new CrossTenantAccountingError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { entityLabel, owner, expected: context.businessId },
    });
  }
}
