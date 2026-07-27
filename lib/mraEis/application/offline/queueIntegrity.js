/**
 * Phase 16 — Offline queue integrity (checksum + optional hash chain).
 */

import crypto from 'crypto';
import { OfflineErrors } from './offlineErrors.js';

export function computeQueueItemChecksum(item) {
  return crypto
    .createHash('sha256')
    .update(
      [
        item.id,
        item.offlineEnvelopeId,
        item.offlineFiscalNumber,
        item.queueSequence,
        item.sealedChecksum,
        item.previousChecksum || '',
      ].join('|')
    )
    .digest('hex');
}

export function verifyQueuePartitionIntegrity(items = []) {
  const ordered = [...items].sort((a, b) => a.queueSequence - b.queueSequence);
  const issues = [];
  let prevChecksum = null;
  let prevSequence = null;

  for (const item of ordered) {
    if (item.state === 'SEALED' || item.state === 'READY_FOR_UPLOAD' || item.state === 'WAITING_FOR_CONNECTIVITY') {
      const expected = item.sealedChecksum;
      if (!expected) {
        issues.push({ type: 'MISSING_SEALED_CHECKSUM', id: item.id });
      }
    }
    if (prevSequence != null && item.queueSequence !== prevSequence + 1) {
      issues.push({
        type: 'GAP_OR_OUT_OF_ORDER',
        id: item.id,
        expected: prevSequence + 1,
        actual: item.queueSequence,
      });
    }
    if (item.previousChecksum != null && prevChecksum != null && item.previousChecksum !== prevChecksum) {
      issues.push({ type: 'HASH_CHAIN_BREAK', id: item.id });
    }
    if (item._tampered === true) {
      issues.push({ type: 'TAMPER_FLAG', id: item.id });
    }
    prevChecksum = item.sealedChecksum || prevChecksum;
    prevSequence = item.queueSequence;
  }

  return {
    valid: issues.length === 0,
    issues,
    itemCount: ordered.length,
    blocksUpload: issues.length > 0,
    blocksNewOfflineSales: issues.some((i) =>
      ['HASH_CHAIN_BREAK', 'TAMPER_FLAG', 'MISSING_SEALED_CHECKSUM'].includes(i.type)
    ),
  };
}

export function assertQueueIntegrityOrThrow(items) {
  const result = verifyQueuePartitionIntegrity(items);
  if (!result.valid) {
    throw OfflineErrors.queueIntegrity({
      message: 'Offline queue integrity failed.',
      details: { issues: result.issues },
    });
  }
  return result;
}

/**
 * Link hash chain when sealing next item.
 */
export function linkQueueItem(previousItem, nextItem) {
  return {
    ...nextItem,
    previousChecksum: previousItem?.sealedChecksum || null,
  };
}
