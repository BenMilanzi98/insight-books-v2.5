import crypto from 'crypto';
import { EisErrors } from '../errors.js';

export function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw EisErrors.validation({ message: `${field} is required.` });
  }
  return value.trim();
}

export function createMoney(value, field = 'amount') {
  const n = Number(value);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw EisErrors.validation({ message: `${field} must be a finite number.` });
  }
  // Store as string with 2dp to avoid float drift in domain layer
  const normalized = (Math.round(n * 100) / 100).toFixed(2);
  return Object.freeze({
    kind: 'Money',
    value: normalized,
    toNumber: () => Number(normalized),
    toString: () => normalized,
  });
}

export function createQuantity(value, field = 'quantity') {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw EisErrors.validation({ message: `${field} must be a non-negative finite number.` });
  }
  const normalized = n.toFixed(6);
  return Object.freeze({
    kind: 'Quantity',
    value: normalized,
    toNumber: () => Number(normalized),
  });
}

export function createChecksum(payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
  return Object.freeze({ kind: 'Checksum', value: hash });
}

export function createIdempotencyKey(parts) {
  const key = parts.map((p) => String(p ?? '')).join(':');
  return Object.freeze({ kind: 'IdempotencyKey', value: key });
}

export function createMraTin(value) {
  const tin = assertNonEmptyString(value, 'mraTin');
  if (!/^[A-Za-z0-9-]{5,32}$/.test(tin)) {
    throw EisErrors.validation({ message: 'mraTin format is invalid.' });
  }
  return Object.freeze({ kind: 'MraTin', value: tin });
}

export function createBusinessDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw EisErrors.validation({ message: 'businessDate is invalid.' });
  }
  const iso = d.toISOString().slice(0, 10);
  return Object.freeze({ kind: 'BusinessDate', value: iso, toDate: () => new Date(`${iso}T00:00:00.000Z`) });
}

export function assertTenantBusinessMatch(tenantId, businessId) {
  if (!tenantId || !businessId || tenantId !== businessId) {
    throw EisErrors.businessMismatch({ tenantId, businessId });
  }
}

export function assertSameScope(expected, actual, label) {
  if (expected.tenantId !== actual.tenantId || expected.businessId !== actual.businessId) {
    throw EisErrors.crossTenant({
      tenantId: expected.tenantId,
      businessId: expected.businessId,
      message: `${label} crosses tenant/business scope.`,
      details: { expected, actual },
    });
  }
}
