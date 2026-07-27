/**
 * Phase 16 — Ordered offline upload worker (mock path).
 * Never reposts accounting/inventory. Unknown outcomes are not blindly retried.
 */

import crypto from 'crypto';
import { assertQueueIntegrityOrThrow } from './queueIntegrity.js';
import { mockOfflineUpload } from './mockOfflineMraServer.js';
import { resolveOfflineUploadContract } from './offlineContractRegistry.js';
import { OfflineErrors } from './offlineErrors.js';
import { verifyOfflineSignature, canonicalizeOfflinePayload } from './offlineSigner.js';

/**
 * Upload a single ordered partition in sequence order.
 * @param {object[]} items — queue items with envelope payloads
 */
export async function processOrderedOfflineUploadPartition({
  items = [],
  environment = 'SANDBOX',
  mode = 'MOCK',
  terminalBlocked = false,
} = {}) {
  const uploadContract = resolveOfflineUploadContract({ environment, mode });
  if (!uploadContract.allowsUpload) {
    throw OfflineErrors.contractUnverified({
      message: 'Offline upload contract blocked.',
      details: { decision: uploadContract.decision },
    });
  }

  if (terminalBlocked) {
    throw OfflineErrors.terminalBlocked();
  }

  assertQueueIntegrityOrThrow(items);

  const ordered = [...items].sort((a, b) => a.queueSequence - b.queueSequence);
  const results = [];
  let blockedLater = false;

  for (const item of ordered) {
    if (blockedLater) {
      results.push({
        queueItemId: item.id,
        skipped: true,
        reason: 'PRIOR_ITEM_BLOCKS_ORDER',
      });
      continue;
    }

    if (item.state === 'ACCEPTED') {
      results.push({
        queueItemId: item.id,
        skipped: true,
        reason: 'ALREADY_ACCEPTED_NO_RESUBMIT',
        uploaded: false,
      });
      continue;
    }

    if (item.state === 'UNKNOWN_OUTCOME') {
      results.push({
        queueItemId: item.id,
        skipped: true,
        reason: 'UNKNOWN_REQUIRES_PHASE_15_RECONCILIATION',
        uploaded: false,
        createPhase15Event: true,
      });
      blockedLater = true;
      continue;
    }

    // Re-verify signature before upload
    if (item.envelopePayload) {
      const bytes = canonicalizeOfflinePayload(item.envelopePayload);
      const v = verifyOfflineSignature({
        exactCanonicalBytes: bytes,
        signature: item.offlineSignature || item.envelope?.offlineSignature,
        environment,
        mode,
      });
      if (!v.valid) {
        results.push({
          queueItemId: item.id,
          outcome: 'SIGNATURE_INVALID',
          uploaded: false,
        });
        blockedLater = true;
        continue;
      }
    }

    const attempt = {
      id: crypto.randomUUID(),
      queueItemId: item.id,
      attemptNumber: (item.uploadAttemptCount || 0) + 1,
      uploadContractVersion: uploadContract.contract.contractVersion,
      state: 'DISPATCHING',
      // no credentials
    };

    const response = await mockOfflineUpload({
      offlineFiscalNumber: item.offlineFiscalNumber,
      offlineSignature: item.offlineSignature,
      queueSequence: item.queueSequence,
      environment,
    });

    if (response.timedOut || response.outcome === 'UNKNOWN_OUTCOME') {
      results.push({
        queueItemId: item.id,
        attemptId: attempt.id,
        outcome: 'UNKNOWN_OUTCOME',
        uploaded: true,
        blindRetryForbidden: true,
        createPhase15Event: true,
        journalCreated: false,
        stockMovementCreated: false,
        fiscalNumberChanged: false,
        signatureChanged: false,
      });
      blockedLater = true;
      continue;
    }

    if (response.outcome === 'ACCEPTED') {
      results.push({
        queueItemId: item.id,
        attemptId: attempt.id,
        outcome: 'ACCEPTED',
        mraTransactionId: response.body?.mraTransactionId || null,
        applicationStatus: response.body?.applicationStatus,
        uploaded: true,
        receiptClaimsAcceptanceOnlyWithEvidence: true,
        originalReceiptImmutable: true,
        journalCreated: false,
        stockMovementCreated: false,
        fiscalNumberChanged: false,
        configurationRefreshRequired: Boolean(response.body?.shouldRefreshConfiguration),
        terminalBlockDetected: Boolean(response.body?.shouldBlockTerminal),
      });
      continue;
    }

    if (response.outcome === 'REJECTED') {
      results.push({
        queueItemId: item.id,
        attemptId: attempt.id,
        outcome: 'REJECTED',
        responseCode: response.body?.responseCode,
        uploaded: true,
        fiscalNumberRetained: true,
        signatureRetained: true,
        automaticRetry: false,
        journalReversed: false,
        stockReversed: false,
        terminalBlockDetected: Boolean(response.body?.shouldBlockTerminal),
      });
      // ordering: do not skip later unless contract allows — default block
      blockedLater = true;
      continue;
    }

    results.push({
      queueItemId: item.id,
      attemptId: attempt.id,
      outcome: response.outcome || 'TEMPORARY_FAILURE',
      uploaded: true,
      blindRetryForbidden: response.outcome === 'UNKNOWN_OUTCOME',
    });
    if (response.outcome === 'UNKNOWN_OUTCOME') blockedLater = true;
  }

  return {
    processed: results.length,
    results,
    accountingReposted: false,
    inventoryReposted: false,
  };
}
