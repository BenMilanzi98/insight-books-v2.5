/**
 * Phase 17 — Restriction / Unblock-status / Revalidation workers (durable claim-lease style).
 * Does not alter fiscal evidence, Journals, or Stock Movements.
 */

import crypto from 'crypto';
import { ingestRestriction } from './restrictionService.js';
import { queryUnblockStatus, applyClearanceAndRevalidate } from './unblockService.js';

const CLAIMS = new Map();

export function claimJob({ jobType, jobKey, workerId, leaseMs = 30_000 } = {}) {
  const key = `${jobType}:${jobKey}`;
  const existing = CLAIMS.get(key);
  const now = Date.now();
  if (existing && existing.expiresAt > now && existing.workerId !== workerId) {
    return { claimed: false, reason: 'LEASE_HELD' };
  }
  const claim = {
    jobType,
    jobKey,
    workerId,
    claimedAt: now,
    expiresAt: now + leaseMs,
    claimId: crypto.randomUUID(),
  };
  CLAIMS.set(key, claim);
  return { claimed: true, claim };
}

export function releaseClaim({ jobType, jobKey, workerId } = {}) {
  const key = `${jobType}:${jobKey}`;
  const existing = CLAIMS.get(key);
  if (existing && existing.workerId === workerId) CLAIMS.delete(key);
}

export function __resetRestrictionWorkerClaimsForTests() {
  CLAIMS.clear();
}

export async function processRestrictionIngestEvent(event, { useMemory = true } = {}) {
  const workerId = event.workerId || `restriction-worker-${process.pid}`;
  const lease = claimJob({
    jobType: 'RESTRICTION_INGEST',
    jobKey: event.idempotencyKey || event.sourceReference || event.id,
    workerId,
  });
  if (!lease.claimed) return { processed: false, ...lease };

  try {
    const result = await ingestRestriction({
      ...event,
      useMemory,
    });
    return {
      processed: true,
      created: result.created,
      duplicated: result.duplicated,
      restrictionId: result.restriction.id,
      fiscalEvidenceMutated: false,
      journalCreated: false,
      stockMovementCreated: false,
    };
  } finally {
    releaseClaim({
      jobType: 'RESTRICTION_INGEST',
      jobKey: event.idempotencyKey || event.sourceReference || event.id,
      workerId,
    });
  }
}

export async function processUnblockStatusJob(job, { useMemory = true } = {}) {
  const workerId = job.workerId || `unblock-status-worker-${process.pid}`;
  const lease = claimJob({
    jobType: 'UNBLOCK_STATUS',
    jobKey: job.requestId,
    workerId,
  });
  if (!lease.claimed) return { processed: false, ...lease };

  try {
    const result = await queryUnblockStatus({
      tenantId: job.tenantId,
      businessId: job.businessId,
      requestId: job.requestId,
      mockScenario: job.mockScenario || 'REVIEW_PENDING',
      useMemory,
    });
    return {
      processed: true,
      cleared: false,
      terminalReactivated: false,
      httpSuccessInsufficient: true,
      ...result,
    };
  } finally {
    releaseClaim({ jobType: 'UNBLOCK_STATUS', jobKey: job.requestId, workerId });
  }
}

export async function processRevalidationJob(job, { useMemory = true } = {}) {
  const workerId = job.workerId || `revalidation-worker-${process.pid}`;
  const lease = claimJob({
    jobType: 'REVALIDATION',
    jobKey: job.requestId,
    workerId,
  });
  if (!lease.claimed) return { processed: false, ...lease };

  try {
    const result = await applyClearanceAndRevalidate({
      tenantId: job.tenantId,
      businessId: job.businessId,
      requestId: job.requestId,
      actorId: job.actorId || null,
      revalidationOverrides: job.revalidationOverrides || {},
      useMemory,
    });
    return {
      processed: true,
      terminalSetActiveDirectly: false,
      ...result,
    };
  } finally {
    releaseClaim({ jobType: 'REVALIDATION', jobKey: job.requestId, workerId });
  }
}
