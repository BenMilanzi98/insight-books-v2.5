/**
 * Phase 16 — Offline sequence reservation (in-memory durable map for mock/unit;
 * Prisma-backed for server agent scopes). Never MAX+1, never backwards, never reuse.
 */

import crypto from 'crypto';
import { resolveOfflineNumberingContract } from './offlineContractRegistry.js';
import { OfflineErrors } from './offlineErrors.js';

/** Process-local durable store for mock/tests — survives within process; not browser. */
const SCOPES = new Map();

function scopeKey({ tenantId, businessId, terminalId, agentId, environment }) {
  return [tenantId, businessId, terminalId || '', agentId || '', environment].join(':');
}

export function getOrInitOfflineSequence({
  tenantId,
  businessId,
  terminalId = null,
  agentId = null,
  environment = 'SANDBOX',
  mode = 'MOCK',
  rangeStart = 1,
  rangeEnd = 999999,
  nextValue = 1,
} = {}) {
  const numbering = resolveOfflineNumberingContract({ environment, mode });
  if (!numbering.allowsAllocation) {
    throw OfflineErrors.sequenceUnavailable({
      message: 'Offline numbering contract blocked.',
      details: { decision: numbering.decision },
    });
  }

  const key = scopeKey({ tenantId, businessId, terminalId, agentId, environment });
  if (!SCOPES.has(key)) {
    SCOPES.set(key, {
      id: crypto.randomUUID(),
      tenantId,
      businessId,
      terminalId,
      agentId,
      environment,
      contractVersion: numbering.contract.contractVersion,
      rangeStart,
      rangeEnd,
      nextValue,
      lastReservedValue: null,
      lastAssignedValue: null,
      reserved: new Set(),
      status: 'ACTIVE',
      version: 1,
    });
  }
  return SCOPES.get(key);
}

/**
 * Atomic reservation — no MAX+1 scan of sales tables.
 */
export function reserveOfflineFiscalNumber({
  tenantId,
  businessId,
  terminalId = null,
  agentId = null,
  environment = 'SANDBOX',
  mode = 'MOCK',
  fiscalSnapshotId,
} = {}) {
  if (!fiscalSnapshotId) {
    throw OfflineErrors.sequenceUnavailable({ message: 'fiscalSnapshotId required for reservation.' });
  }

  const seq = getOrInitOfflineSequence({
    tenantId,
    businessId,
    terminalId,
    agentId,
    environment,
    mode,
  });

  if (seq.status === 'EXHAUSTED' || seq.nextValue > seq.rangeEnd) {
    seq.status = 'EXHAUSTED';
    throw OfflineErrors.sequenceUnavailable({
      code: 'MRA_EIS_OFFLINE_SEQUENCE_EXHAUSTED',
      message: 'Offline sequence range exhausted.',
    });
  }

  const value = seq.nextValue;
  if (seq.reserved.has(value)) {
    throw OfflineErrors.sequenceUnavailable({ message: 'Offline number reuse detected.' });
  }

  // Advance first (atomic within process)
  seq.nextValue = value + 1;
  seq.lastReservedValue = value;
  seq.lastAssignedValue = value;
  seq.reserved.add(value);
  seq.version += 1;

  if (seq.nextValue > seq.rangeEnd) {
    seq.status = 'EXHAUSTED';
  } else if (seq.rangeEnd - seq.nextValue < 10) {
    seq.status = 'NEARING_EXHAUSTION';
  }

  const formatted = `OFF-${environment}-${String(value).padStart(8, '0')}`;

  return {
    sequenceId: seq.id,
    offlineFiscalNumber: formatted,
    numericValue: value,
    fiscalSnapshotId,
    contractVersion: seq.contractVersion,
    nextValueAfter: seq.nextValue,
    status: seq.status,
    maxPlusOneUsed: false,
    reused: false,
    movedBackwards: false,
  };
}

/** Test helper — does not move sequence backwards in production paths. */
export function __resetOfflineSequencesForTests() {
  SCOPES.clear();
}

export function explainOfflineSequence({ tenantId, businessId, terminalId, agentId, environment }) {
  const key = scopeKey({ tenantId, businessId, terminalId, agentId, environment });
  const seq = SCOPES.get(key);
  if (!seq) return { found: false };
  return {
    found: true,
    nextValue: seq.nextValue,
    lastReservedValue: seq.lastReservedValue,
    lastAssignedValue: seq.lastAssignedValue,
    reservedCount: seq.reserved.size,
    status: seq.status,
    neverMovesBackwards: true,
    neverReuses: true,
  };
}
