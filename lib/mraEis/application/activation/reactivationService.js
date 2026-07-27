import prisma from '@/lib/prisma.js';
import { TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { openManualReviewCase } from '../services/reconciliationService.js';
import { transitionTerminalStatus } from '../services/terminalService.js';

/**
 * Controlled reactivation foundation — preserves historical evidence.
 * Does not invent MRA reactivation APIs; routes to TAC_REQUIRED or MANUAL_REVIEW.
 */
export async function requestTerminalReactivation({
  tenantId,
  businessId = tenantId,
  terminalId,
  reason,
  actorId,
  approvalId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!reason || String(reason).trim().length < 5) {
    throw EisErrors.validation({ message: 'Reactivation reason is required (min 5 characters).' });
  }

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });
  if (terminal.status === TERMINAL_STATUS.REVOKED) {
    throw EisErrors.validation({
      message: 'Revoked terminals cannot reactivate directly; use terminal replacement.',
      requiredAction: 'REQUEST_REPLACEMENT',
    });
  }
  if (terminal.environment === 'PRODUCTION' && !approvalId) {
    throw EisErrors.validation({
      message: 'Production reactivation requires an approval.',
      requiredAction: 'APPROVAL_REQUIRED',
    });
  }

  const eligible = [
    TERMINAL_STATUS.ACTIVE,
    TERMINAL_STATUS.TOKEN_EXPIRED,
    TERMINAL_STATUS.REACTIVATION_REQUIRED,
    TERMINAL_STATUS.INACTIVE,
    TERMINAL_STATUS.CONFIRMATION_FAILED,
  ];
  if (!eligible.includes(terminal.status) && terminal.status !== TERMINAL_STATUS.MANUAL_REVIEW) {
    throw EisErrors.invalidTerminalTransition({
      currentStatus: terminal.status,
      message: `Reactivation cannot start from ${terminal.status}.`,
    });
  }

  // Preserve credential references as historical; do not delete evidence
  await db.mraEisCredentialReference.updateMany({
    where: {
      terminalId,
      tenantId,
      businessId,
      status: 'ACTIVE',
    },
    data: {
      status: 'ROTATED',
      rotatedAt: new Date(),
    },
  }).catch(() => {});

  const next =
    terminal.environment === 'PRODUCTION'
      ? TERMINAL_STATUS.MANUAL_REVIEW
      : TERMINAL_STATUS.REACTIVATION_REQUIRED;

  await transitionTerminalStatus({
    tenantId,
    businessId,
    terminalId,
    nextStatus: next,
    expectedVersion: terminal.version,
    actorId,
    reason,
    db,
  });

  if (next === TERMINAL_STATUS.MANUAL_REVIEW || next === TERMINAL_STATUS.REACTIVATION_REQUIRED) {
    await openManualReviewCase({
      tenantId,
      businessId,
      terminalId,
      caseType: 'REACTIVATION_REQUEST',
      severity: terminal.environment === 'PRODUCTION' ? 'HIGH' : 'MEDIUM',
      sourceEntityType: 'MraEisTerminal',
      sourceEntityId: terminalId,
      title: 'Terminal reactivation requested',
      description: String(reason).slice(0, 2000),
      openedBy: actorId || 'system',
      db,
    }).catch(() => {});
  }

  // Sandbox/mock may proceed to new TAC entry after review flag
  if (terminal.environment !== 'PRODUCTION' && next === TERMINAL_STATUS.REACTIVATION_REQUIRED) {
    await transitionTerminalStatus({
      tenantId,
      businessId,
      terminalId,
      nextStatus: TERMINAL_STATUS.TAC_REQUIRED,
      actorId,
      reason: 'Reactivation: new TAC required',
      db,
    });
  }

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: 'USER',
    action: 'TERMINAL_REACTIVATION_REQUESTED',
    resourceType: 'MraEisTerminal',
    resourceId: terminalId,
    environment: terminal.environment,
    metadata: {
      reason: String(reason).slice(0, 500),
      approvalId,
      priorStatus: terminal.status,
      priorMraTerminalId: terminal.mraTerminalId,
    },
  }, db);

  return {
    terminalId,
    priorStatus: terminal.status,
    status: next === TERMINAL_STATUS.REACTIVATION_REQUIRED ? TERMINAL_STATUS.TAC_REQUIRED : next,
    nextAction: next === TERMINAL_STATUS.MANUAL_REVIEW ? 'AWAIT_MANUAL_REVIEW' : 'ENTER_NEW_TAC',
    historicalEvidencePreserved: true,
  };
}
