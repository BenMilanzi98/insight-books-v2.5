import prisma from '@/lib/prisma.js';
import { TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { openManualReviewCase } from '../services/reconciliationService.js';
import { transitionTerminalStatus } from '../services/terminalService.js';
import { createTerminalForOnboarding } from './activationOrchestrator.js';

/**
 * Controlled terminal replacement foundation.
 * Original terminal retained; fiscal history stays linked to original.
 * Cross-Business replacement prohibited.
 */
export async function requestTerminalReplacement({
  tenantId,
  businessId = tenantId,
  terminalId,
  reason,
  actorId,
  approvalId = null,
  newTerminalLabel = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!reason || String(reason).trim().length < 5) {
    throw EisErrors.validation({ message: 'Replacement reason is required (min 5 characters).' });
  }

  const original = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!original) throw EisErrors.terminalNotFound({ tenantId, businessId });

  if (original.environment === 'PRODUCTION' && !approvalId) {
    throw EisErrors.validation({
      message: 'Production terminal replacement requires approval.',
      requiredAction: 'APPROVAL_REQUIRED',
    });
  }

  // Revoke old credentials metadata (ciphertext retained)
  await db.mraEisCredentialReference.updateMany({
    where: { terminalId, tenantId, businessId, status: 'ACTIVE' },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  }).catch(() => {});

  if (![TERMINAL_STATUS.REVOKED, TERMINAL_STATUS.INACTIVE].includes(original.status)) {
    await transitionTerminalStatus({
      tenantId,
      businessId,
      terminalId,
      nextStatus: TERMINAL_STATUS.REVOKED,
      expectedVersion: original.version,
      actorId,
      reason: `Replaced: ${reason}`,
      db,
    }).catch(async () => {
      await db.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.REVOKED,
          previousStatus: original.status,
          version: { increment: 1 },
        },
      });
    });
  }

  const label =
    newTerminalLabel ||
    `${original.terminalLabel || 'Terminal'}-replacement-${Date.now().toString(36)}`;

  const created = await createTerminalForOnboarding({
    tenantId,
    businessId,
    branchId: original.branchId,
    environment: original.environment,
    terminalLabel: label,
    scopeType: 'BUSINESS',
    idempotencyKey: `replace:${terminalId}:${label}`,
    createdBy: actorId,
    db,
  });

  await db.mraEisTerminal.update({
    where: { id: created.terminal.id },
    data: {
      replacedTerminalId: terminalId,
      replacementReason: String(reason).slice(0, 2000),
      replacementOfTerminalId: terminalId,
    },
  });

  await openManualReviewCase({
    tenantId,
    businessId,
    terminalId: created.terminal.id,
    caseType: 'TERMINAL_REPLACEMENT',
    severity: 'MEDIUM',
    sourceEntityType: 'MraEisTerminal',
    sourceEntityId: terminalId,
    title: 'Terminal replacement created',
    description: `Original ${terminalId} revoked. New draft ${created.terminal.id}. Reason: ${reason}`,
    openedBy: actorId || 'system',
    db,
  }).catch(() => {});

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: 'USER',
    action: 'TERMINAL_REPLACEMENT_REQUESTED',
    resourceType: 'MraEisTerminal',
    resourceId: created.terminal.id,
    environment: original.environment,
    metadata: {
      originalTerminalId: terminalId,
      originalMraTerminalId: original.mraTerminalId,
      reason: String(reason).slice(0, 500),
      approvalId,
      fiscalHistoryRemainsOnOriginal: true,
    },
  }, db);

  return {
    originalTerminalId: terminalId,
    originalStatus: TERMINAL_STATUS.REVOKED,
    replacementTerminal: created.terminal,
    historicalEvidencePreserved: true,
    fiscalNumbersTransferred: false,
    nextAction: 'COMPLETE_ONBOARDING_FOR_REPLACEMENT',
  };
}
