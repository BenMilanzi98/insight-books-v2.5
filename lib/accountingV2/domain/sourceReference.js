/**
 * Accounting V2 — standard source reference and accounting-event identity.
 *
 * One business event = one accounting identity. The idempotency key derives from
 * stable identity fields only — never timestamps, never amounts.
 */

import { AccountingSourceModule, AccountingEventType, assertEnumValue } from './enums.js';
import { AccountingValidationError } from './errors.js';

/**
 * @typedef {object} SourceReference
 * @property {string} sourceModule AccountingSourceModule value
 * @property {string} sourceType entity type, e.g. 'Invoice'
 * @property {string} sourceId primary key of the source entity
 * @property {string|null} sourceNumber human number, e.g. 'INV-456'
 * @property {string} eventType AccountingEventType value
 * @property {number} eventVersion increments only for legitimate re-issue of the same event
 * @property {string|null} externalReference
 * @property {string|null} importBatchId
 * @property {string|null} webhookEventId
 * @property {string|null} description
 * @property {object} metadata
 */

/**
 * @param {Partial<SourceReference> & {sourceModule:string, sourceType:string, sourceId:string, eventType:string}} input
 * @returns {SourceReference}
 */
export function createSourceReference(input) {
  const issues = [];
  if (!input?.sourceType || typeof input.sourceType !== 'string') {
    issues.push({ path: 'sourceType', message: 'required string' });
  }
  if (!input?.sourceId || typeof input.sourceId !== 'string') {
    issues.push({ path: 'sourceId', message: 'required string' });
  }
  if (issues.length > 0) {
    throw new AccountingValidationError('Source reference is incomplete.', issues);
  }
  assertEnumValue(AccountingSourceModule, input.sourceModule, 'sourceModule');
  assertEnumValue(AccountingEventType, input.eventType, 'eventType');
  const eventVersion = input.eventVersion ?? 1;
  if (!Number.isInteger(eventVersion) || eventVersion < 1) {
    throw new AccountingValidationError('eventVersion must be a positive integer.', [
      { path: 'eventVersion', message: String(input.eventVersion) },
    ]);
  }
  return Object.freeze({
    sourceModule: input.sourceModule,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceNumber: input.sourceNumber ?? null,
    eventType: input.eventType,
    eventVersion,
    externalReference: input.externalReference ?? null,
    importBatchId: input.importBatchId ?? null,
    webhookEventId: input.webhookEventId ?? null,
    description: input.description ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

/**
 * Canonical accounting idempotency key. Derived exclusively from stable identity:
 * business + module + type + id + event type + event version.
 *
 * ACCOUNTING:{businessId}:{sourceModule}:{sourceType}:{sourceId}:{eventType}:{eventVersion}
 *
 * @param {string} businessId
 * @param {SourceReference} sourceRef
 * @returns {string}
 */
export function deriveIdempotencyKey(businessId, sourceRef) {
  if (!businessId || typeof businessId !== 'string') {
    throw new AccountingValidationError('businessId is required for idempotency key derivation.');
  }
  const parts = [
    'ACCOUNTING',
    businessId,
    sourceRef.sourceModule,
    sourceRef.sourceType,
    sourceRef.sourceId,
    sourceRef.eventType,
    String(sourceRef.eventVersion),
  ];
  for (const part of parts) {
    if (part.includes(':')) {
      throw new AccountingValidationError('Identity fields must not contain ":".', [
        { path: 'sourceReference', message: `illegal character in "${part}"` },
      ]);
    }
  }
  return parts.join(':');
}

/**
 * Stable content hash of the materially significant command fields, used to detect
 * the same idempotency key being reused with different data.
 * @param {object} command
 * @returns {Promise<string>} hex sha-256
 */
export async function hashCommandContent(command) {
  const { createHash } = await import('crypto');
  const material = JSON.stringify(orderKeys({
    eventType: command.sourceReference?.eventType,
    sourceId: command.sourceReference?.sourceId,
    transactionDate: command.transactionDate,
    currency: command.currency,
    amount: command.amount ?? null,
    lines: command.lines ?? null,
  }));
  return createHash('sha256').update(material).digest('hex');
}

/** Deterministic key ordering for stable hashing. */
function orderKeys(value) {
  if (Array.isArray(value)) return value.map(orderKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, orderKeys(value[k])])
    );
  }
  return value;
}
