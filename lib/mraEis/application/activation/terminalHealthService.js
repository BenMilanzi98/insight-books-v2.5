import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { safeTerminalDto } from './activationOrchestrator.js';

export async function getTerminalHealth({
  tenantId,
  businessId = tenantId,
  terminalId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) return null;

  const [jwtRef, secretRef, lastActivation, lastConfirmation] = await Promise.all([
    db.mraEisCredentialReference.findFirst({
      where: { terminalId, credentialType: 'TERMINAL_JWT', status: 'ACTIVE' },
    }),
    db.mraEisCredentialReference.findFirst({
      where: { terminalId, credentialType: 'TERMINAL_SECRET', status: 'ACTIVE' },
    }),
    db.mraEisActivationAttempt.findFirst({
      where: { terminalId },
      orderBy: { attemptNumber: 'desc' },
    }),
    db.mraEisConfirmationAttempt.findFirst({
      where: { terminalId },
      orderBy: { confirmationAttemptNumber: 'desc' },
    }),
  ]);

  const blockers = [];
  const warnings = [];
  const recommendedActions = [];

  const tokenExpiring =
    terminal.tokenExpiresAt &&
    terminal.tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 3600 * 1000;
  const tokenExpired =
    terminal.status === TERMINAL_STATUS.TOKEN_EXPIRED ||
    (terminal.tokenExpiresAt && terminal.tokenExpiresAt < new Date());

  if (tokenExpired) {
    blockers.push('TOKEN_EXPIRED');
    recommendedActions.push('Request reactivation');
  } else if (tokenExpiring) {
    warnings.push('TOKEN_EXPIRING');
  }
  if (terminal.status === TERMINAL_STATUS.UNKNOWN_ACTIVATION_OUTCOME) {
    blockers.push('UNKNOWN_ACTIVATION_OUTCOME');
    recommendedActions.push('Open manual review — do not retry activation');
  }
  if (terminal.status === TERMINAL_STATUS.ACTIVE && (!jwtRef || !secretRef)) {
    blockers.push('ACTIVE_WITHOUT_CREDENTIALS');
  }
  if (terminal.status === TERMINAL_STATUS.CONFIRMATION_PENDING) {
    recommendedActions.push('Submit activation confirmation');
  }
  if (terminal.status === TERMINAL_STATUS.TAC_REQUIRED) {
    recommendedActions.push('Enter Terminal Activation Code');
  }

  return {
    terminalId: terminal.id,
    status: terminal.status,
    environment: terminal.environment,
    entitlementValid: true,
    certificationValid: terminal.environment !== 'PRODUCTION',
    activationConfirmed: Boolean(terminal.activationConfirmedAt) && terminal.status === TERMINAL_STATUS.ACTIVE,
    jwtStatus: jwtRef ? (tokenExpired ? 'EXPIRED' : 'ACTIVE') : 'MISSING',
    terminalSecretStatus: secretRef ? 'ACTIVE' : 'MISSING',
    configurationStatus: terminal.activeTerminalConfigurationSnapshotId ? 'PRESENT' : 'PENDING_SYNC',
    lastSuccessfulContactAt: terminal.lastSuccessfulContactAt,
    lastActivationAttempt: lastActivation
      ? { id: lastActivation.id, status: lastActivation.status, outcome: lastActivation.outcome }
      : null,
    lastConfirmationAttempt: lastConfirmation
      ? { id: lastConfirmation.id, status: lastConfirmation.status, outcome: lastConfirmation.outcome }
      : null,
    blocked: terminal.status === TERMINAL_STATUS.BLOCKED,
    tokenExpiring: Boolean(tokenExpiring),
    reactivationRequired: terminal.status === TERMINAL_STATUS.REACTIVATION_REQUIRED,
    blockers,
    warnings,
    recommendedActions,
    terminal: safeTerminalDto(terminal),
  };
}

export async function markExpiredTokens({ db = prisma } = {}) {
  const now = new Date();
  const rows = await db.mraEisTerminal.findMany({
    where: {
      status: TERMINAL_STATUS.ACTIVE,
      tokenExpiresAt: { lt: now },
    },
    take: 100,
  });
  for (const row of rows) {
    await db.mraEisTerminal.update({
      where: { id: row.id },
      data: {
        status: TERMINAL_STATUS.TOKEN_EXPIRED,
        previousStatus: row.status,
        version: { increment: 1 },
      },
    });
  }
  return { marked: rows.length };
}
