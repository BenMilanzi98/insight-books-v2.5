import prisma from '@/lib/prisma.js';
import crypto from 'crypto';
import {
  TERMINAL_STATUS,
  ACTIVATION_ATTEMPT_STATUS,
  ACTIVATION_OUTCOME,
  CREDENTIAL_TYPE,
  CONFIGURATION_TYPE,
  CONFIGURATION_STATUS,
} from '../../domain/operationalEnums.js';
import { transitionTerminal } from '../../domain/operationalStateMachines.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateTerminalActivationReadiness } from './readinessService.js';
import { ensureStablePlatformIdentity } from './platformIdentity.js';
import { mapTerminalActivationRequest, mapConfirmationRequest } from './activationMapper.js';
import { parseActivationResponse, parseConfirmationResponse } from './activationResponseParser.js';
import { activateTerminalViaMra, confirmTerminalViaMra } from '../../infrastructure/mraClient/activationClient.js';
import {
  storeSecret,
  storeEphemeralSecret,
  withEphemeralSecret,
  revokeSecret,
} from '../../security.js';
import { storeConfigurationSnapshot, activateConfigurationSnapshot } from '../services/configurationService.js';
import { computeActivationConfirmationSignature } from '../../infrastructure/security/activationHmac.js';
import { assertCryptoAllowed } from '../../infrastructure/security/cryptoRegistry.js';
import { withSecret } from '../../security.js';
import { EIS_CRYPTO_OPERATION, EIS_SECRET_TYPE } from '../../infrastructure/security/secretTypes.js';
import { EIS_SERVICE_IDENTITY } from '../../infrastructure/security/serviceIdentity.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { openManualReviewCase } from '../services/reconciliationService.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { createDraftTerminal, transitionTerminalStatus } from '../services/terminalService.js';
import { TERMINAL_SCOPE_TYPE } from '../../domain/operationalEnums.js';
import { resolveActivationMode } from '../../infrastructure/mraClient/environmentConfig.js';

function safeTerminalDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    businessId: row.businessId,
    branchId: row.branchId,
    environment: row.environment,
    terminalLabel: row.terminalLabel,
    status: row.status,
    mraTerminalId: row.mraTerminalId,
    productId: row.productId,
    productVersion: row.productVersion,
    platformIdentityReference: row.platformIdentityReference,
    offlineCertified: row.offlineCertified,
    tokenExpiresAt: row.tokenExpiresAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTerminalForOnboarding({
  tenantId,
  businessId = tenantId,
  branchId = null,
  environment,
  terminalLabel,
  scopeType = TERMINAL_SCOPE_TYPE.BUSINESS,
  idempotencyKey,
  createdBy,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const readiness = await evaluateTerminalActivationReadiness({
    tenantId,
    businessId,
    branchId,
    environment,
    db,
  });
  if (!readiness.readyToCreateTerminal) {
    throw EisErrors.validation({
      message: 'Terminal readiness failed.',
      details: { blockers: readiness.blockers },
    });
  }
  if (!Object.values(TERMINAL_SCOPE_TYPE).includes(scopeType)) {
    throw EisErrors.validation({ message: 'Unsupported terminal scope.' });
  }

  if (idempotencyKey) {
    const existing = await db.mraEisTerminal.findFirst({
      where: {
        tenantId,
        businessId,
        environment,
        terminalLabel,
      },
    });
    if (existing) return { terminal: safeTerminalDto(existing), readiness, idempotent: true };
  }

  const identity = await ensureStablePlatformIdentity({ tenantId, businessId, environment, db });
  const terminal = await createDraftTerminal({
    tenantId,
    businessId,
    branchId,
    environment,
    terminalLabel,
    createdBy,
    db,
  });

  const updated = await db.mraEisTerminal.update({
    where: { id: terminal.id },
    data: {
      productId: readiness.productId,
      productVersion: readiness.productVersion,
      platformIdentityReference: identity.identityValue,
      status: readiness.readyToSubmitActivation
        ? TERMINAL_STATUS.TAC_REQUIRED
        : TERMINAL_STATUS.READINESS_INCOMPLETE,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: createdBy,
    actorType: 'USER',
    action: 'TERMINAL_DRAFT_CREATED',
    resourceType: 'MraEisTerminal',
    resourceId: updated.id,
    newStatus: updated.status,
    environment,
    metadata: { scopeType, productId: readiness.productId, productVersion: readiness.productVersion },
  }, db);

  return { terminal: safeTerminalDto(updated), readiness, idempotent: false };
}

export async function submitTacForTerminal({
  tenantId,
  businessId = tenantId,
  terminalId,
  terminalActivationCode,
  expectedVersion,
  actorId,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });
  if (expectedVersion != null && terminal.version !== expectedVersion) {
    throw EisErrors.versionConflict({ details: { expectedVersion, actual: terminal.version } });
  }
  if (terminal.status !== TERMINAL_STATUS.TAC_REQUIRED && terminal.status !== TERMINAL_STATUS.ACTIVATION_FAILED) {
    throw EisErrors.invalidTerminalTransition({
      message: `TAC entry requires TAC_REQUIRED status (current: ${terminal.status}).`,
      currentStatus: terminal.status,
    });
  }

  const tac = String(terminalActivationCode || '');
  if (tac.length < 4 || tac.length > 50) {
    throw EisErrors.validation({ message: 'Terminal Activation Code format is invalid.' });
  }

  const eph = await storeEphemeralSecret({
    tenantId,
    businessId,
    terminalId,
    environment: terminal.environment,
    secretType: EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE,
    purpose: 'TERMINAL_ACTIVATION',
    plaintext: tac,
    ttlMs: 15 * 60 * 1000,
    // oneTime=false until confirmation destroys the lease (HMAC needs TAC again)
    oneTime: false,
    createdByService: EIS_SERVICE_IDENTITY.TERMINAL_ACTIVATION_SERVICE,
    db,
  });

  if (terminal.status === TERMINAL_STATUS.ACTIVATION_FAILED) {
    await transitionTerminalStatus({
      tenantId,
      businessId,
      terminalId,
      nextStatus: TERMINAL_STATUS.TAC_REQUIRED,
      expectedVersion: terminal.version,
      actorId,
      db,
    });
  }

  await transitionTerminalStatus({
    tenantId,
    businessId,
    terminalId,
    nextStatus: TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING,
    actorId,
    db,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: 'USER',
    action: 'TAC_SUBMITTED',
    resourceType: 'MraEisTerminal',
    resourceId: terminalId,
    environment: terminal.environment,
    metadata: { ephemeralSecretId: eph.ephemeralSecretId, expiresAt: eph.expiresAt },
  }, db);

  return {
    terminalId,
    status: TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING,
    tacReferenceId: eph.ephemeralSecretId,
    expiresAt: eph.expiresAt,
  };
}

export async function runTerminalActivation({
  tenantId,
  businessId = tenantId,
  terminalId,
  tacReferenceId,
  idempotencyKey,
  actorId,
  requestId = crypto.randomUUID(),
  correlationId = crypto.randomUUID(),
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);

  if (idempotencyKey) {
    const prior = await db.mraEisActivationAttempt.findUnique({ where: { idempotencyKey } });
    if (prior) {
      if (prior.terminalId !== terminalId || prior.tenantId !== tenantId) {
        throw EisErrors.idempotencyConflict({ message: 'Activation idempotency key reused with different scope.' });
      }
      return { attempt: prior, terminal: safeTerminalDto(await db.mraEisTerminal.findUnique({ where: { id: terminalId } })), idempotent: true };
    }
  }

  const readiness = await evaluateTerminalActivationReadiness({
    tenantId,
    businessId,
    environment: (await db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId } }))?.environment,
    db,
  });
  if (!readiness.readyToSubmitActivation) {
    throw EisErrors.validation({
      message: 'Not ready to submit activation.',
      details: { blockers: readiness.blockers },
    });
  }

  // Transaction A — claim / attempt
  const prep = await db.$transaction(async (tx) => {
    const terminal = await tx.mraEisTerminal.findFirst({
      where: { id: terminalId, tenantId, businessId },
    });
    if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });
    if (
      ![
        TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING,
        TERMINAL_STATUS.TAC_REQUIRED,
      ].includes(terminal.status)
    ) {
      if (terminal.status === TERMINAL_STATUS.UNKNOWN_ACTIVATION_OUTCOME) {
        throw EisErrors.validation({
          message: 'Unknown activation outcome blocks ordinary retry. Manual review required.',
          requiredAction: 'MANUAL_REVIEW',
        });
      }
      throw EisErrors.invalidTerminalTransition({
        currentStatus: terminal.status,
        message: `Cannot activate from status ${terminal.status}.`,
      });
    }

    transitionTerminal(terminal.status, TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING);
    transitionTerminal(TERMINAL_STATUS.ACTIVATION_REQUEST_PENDING, TERMINAL_STATUS.ACTIVATION_IN_PROGRESS);

    const attemptNumber =
      (await tx.mraEisActivationAttempt.count({ where: { terminalId } })) + 1;

    const attempt = await tx.mraEisActivationAttempt.create({
      data: {
        tenantId,
        businessId,
        terminalId,
        environment: terminal.environment,
        mode: resolveActivationMode(terminal.environment),
        attemptNumber,
        status: ACTIVATION_ATTEMPT_STATUS.SENDING,
        idempotencyKey: idempotencyKey || `act:${terminalId}:${attemptNumber}:${requestId}`,
        tacEphemeralSecretId: tacReferenceId,
        requestId,
        correlationId,
      },
    });

    await tx.mraEisTerminal.update({
      where: { id: terminalId },
      data: {
        status: TERMINAL_STATUS.ACTIVATION_IN_PROGRESS,
        previousStatus: terminal.status,
        activationAttemptCount: { increment: 1 },
        activationRequestedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return { terminal, attempt };
  });

  // External call — no open DB transaction
  let mraResult;
  let dispatched = false;
  try {
    mraResult = await withEphemeralSecret(
      {
        ephemeralSecretId: tacReferenceId,
        tenantId,
        businessId,
        terminalId,
        environment: prep.terminal.environment,
        secretType: EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE,
        // Keep TAC until confirmation succeeds (HMAC input = TAC per Phase 1 contract)
        destroyAfter: false,
        db,
      },
      async (tac) => {
        const mapped = mapTerminalActivationRequest({
          terminalActivationCode: tac,
          productId: prep.terminal.productId || readiness.productId,
          productVersion: prep.terminal.productVersion || readiness.productVersion,
          platformIdentity: prep.terminal.platformIdentityReference,
          taxpayerTin: readiness.sellerTin,
        });
        await db.mraEisActivationAttempt.update({
          where: { id: prep.attempt.id },
          data: {
            activationRequestChecksum: mapped.canonical.checksum,
            status: ACTIVATION_ATTEMPT_STATUS.SENT_AWAITING_RESULT,
          },
        });
        return activateTerminalViaMra({
          environment: prep.terminal.environment,
          requestBody: mapped.body,
          requestId,
        });
      }
    );
    dispatched = true;
  } catch (err) {
    dispatched = Boolean(err?.dispatched);
    if (dispatched) {
      await db.mraEisActivationAttempt.update({
        where: { id: prep.attempt.id },
        data: {
          status: ACTIVATION_ATTEMPT_STATUS.UNKNOWN_OUTCOME,
          outcome: ACTIVATION_OUTCOME.UNKNOWN_OUTCOME,
          unknownOutcomeAt: new Date(),
          completedAt: new Date(),
          safeErrorCode: err.code || 'UNKNOWN_OUTCOME',
          safeErrorSummary: 'Activation outcome unknown after dispatch.',
          retryClassification: 'RECONCILE_BEFORE_RETRY',
        },
      });
      await db.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.UNKNOWN_ACTIVATION_OUTCOME,
          previousStatus: TERMINAL_STATUS.ACTIVATION_IN_PROGRESS,
          version: { increment: 1 },
        },
      });
      await openManualReviewCase({
        tenantId,
        businessId,
        terminalId,
        caseType: 'ACTIVATION_FAILURE',
        severity: 'HIGH',
        sourceEntityType: 'MraEisActivationAttempt',
        sourceEntityId: prep.attempt.id,
        title: 'Unknown activation outcome',
        description: 'Activation may have been processed by MRA; ordinary retry is blocked.',
        openedBy: actorId || 'system',
        db,
      });
      return {
        attemptId: prep.attempt.id,
        status: TERMINAL_STATUS.UNKNOWN_ACTIVATION_OUTCOME,
        outcome: ACTIVATION_OUTCOME.UNKNOWN_OUTCOME,
        retryAllowed: false,
      };
    }

    await db.mraEisActivationAttempt.update({
      where: { id: prep.attempt.id },
      data: {
        status: ACTIVATION_ATTEMPT_STATUS.TEMPORARY_FAILURE,
        outcome: ACTIVATION_OUTCOME.TEMPORARY_MRA_FAILURE,
        completedAt: new Date(),
        safeErrorCode: err.code || 'PRE_DISPATCH_FAILURE',
        safeErrorSummary: 'Activation failed before confirmed dispatch.',
        retryClassification: 'AUTOMATIC_RETRY',
      },
    });
    await db.mraEisTerminal.update({
      where: { id: terminalId },
      data: {
        status: TERMINAL_STATUS.ACTIVATION_FAILED,
        previousStatus: TERMINAL_STATUS.ACTIVATION_IN_PROGRESS,
        version: { increment: 1 },
      },
    });
    throw err;
  }

  const parsed = parseActivationResponse(mraResult);

  // Transaction B — persist result / credentials / config
  return db.$transaction(async (tx) => {
    await tx.mraEisActivationAttempt.update({
      where: { id: prep.attempt.id },
      data: {
        status: parsed.accepted
          ? ACTIVATION_ATTEMPT_STATUS.ACCEPTED
          : ACTIVATION_ATTEMPT_STATUS.REJECTED,
        httpStatus: parsed.httpStatus,
        mraApplicationStatus: parsed.mraApplicationStatus,
        responseChecksum: parsed.responseChecksum,
        outcome: parsed.outcome,
        retryClassification: parsed.retryClassification,
        sanitizedResponse: parsed.sanitizedResponse,
        completedAt: new Date(),
        safeErrorCode: parsed.accepted ? null : parsed.outcome,
        safeErrorSummary: parsed.remark,
      },
    });

    if (!parsed.accepted) {
      await tx.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.ACTIVATION_FAILED,
          previousStatus: TERMINAL_STATUS.ACTIVATION_IN_PROGRESS,
          activationResponseReceivedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return {
        attemptId: prep.attempt.id,
        status: TERMINAL_STATUS.ACTIVATION_FAILED,
        outcome: parsed.outcome,
        retryAllowed: parsed.retryClassification === 'DATA_CORRECTION_REQUIRED',
        sanitized: parsed.sanitizedResponse,
      };
    }

    await tx.mraEisTerminal.update({
      where: { id: terminalId },
      data: {
        status: TERMINAL_STATUS.ACTIVATION_RESPONSE_RECEIVED,
        mraTerminalId: parsed.mraTerminalId,
        activationResponseReceivedAt: new Date(),
        version: { increment: 1 },
      },
    });

    let jwtRef;
    let secretRef;
    try {
      jwtRef = await storeSecret({
        tenantId,
        businessId,
        terminalId,
        environment: prep.terminal.environment,
        credentialType: CREDENTIAL_TYPE.TERMINAL_JWT,
        plaintext: parsed.jwtToken,
        serviceIdentity: EIS_SERVICE_IDENTITY.CREDENTIAL_ROTATION_WORKER,
        createdByService: 'phase7-activation',
        activate: true,
        db: tx,
      });
      secretRef = await storeSecret({
        tenantId,
        businessId,
        terminalId,
        environment: prep.terminal.environment,
        credentialType: CREDENTIAL_TYPE.TERMINAL_SECRET,
        plaintext: parsed.secretKey,
        serviceIdentity: EIS_SERVICE_IDENTITY.CREDENTIAL_ROTATION_WORKER,
        createdByService: 'phase7-activation',
        activate: true,
        db: tx,
      });
    } catch (err) {
      if (jwtRef?.credentialReferenceId) {
        await revokeSecret({
          tenantId,
          businessId,
          credentialReferenceId: jwtRef.credentialReferenceId,
          db: tx,
        }).catch(() => {});
      }
      await tx.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.CREDENTIAL_STORAGE_FAILED,
          version: { increment: 1 },
        },
      });
      await openManualReviewCase({
        tenantId,
        businessId,
        terminalId,
        caseType: 'ACTIVATION_FAILURE',
        severity: 'CRITICAL',
        sourceEntityType: 'MraEisActivationAttempt',
        sourceEntityId: prep.attempt.id,
        title: 'Partial credential storage failure',
        description: 'Activation accepted by MRA but secure credential persistence failed.',
        openedBy: actorId || 'system',
        db: tx,
      });
      return {
        attemptId: prep.attempt.id,
        status: TERMINAL_STATUS.CREDENTIAL_STORAGE_FAILED,
        outcome: parsed.outcome,
        retryAllowed: false,
      };
    }

    await tx.mraEisTerminal.update({
      where: { id: terminalId },
      data: {
        status: TERMINAL_STATUS.CREDENTIALS_PERSISTED,
        credentialsPersistedAt: new Date(),
        currentCredentialReferenceId: secretRef.credentialReferenceId,
        version: { increment: 1 },
      },
    });

    try {
      for (const [type, data] of [
        [CONFIGURATION_TYPE.GLOBAL, parsed.globalConfiguration],
        [CONFIGURATION_TYPE.TERMINAL, parsed.terminalConfiguration],
        [CONFIGURATION_TYPE.TAXPAYER, parsed.taxpayerConfiguration],
      ]) {
        if (!data) continue;
        const snap = await storeConfigurationSnapshot({
          tenantId,
          businessId,
          terminalId,
          environment: prep.terminal.environment,
          configurationType: type,
          mraVersion: String(data.version || `activation-${prep.attempt.id}`),
          canonicalData: data,
          createdByService: 'phase7-activation-bootstrap',
          db: tx,
        });
        if (snap.status !== CONFIGURATION_STATUS.ACTIVE) {
          await activateConfigurationSnapshot({
            tenantId,
            businessId,
            snapshotId: snap.id,
            activatedBy: 'phase7-activation',
            reason: 'Bootstrap from activation response',
            correlationId,
            requestId,
            db: tx,
          });
        }
      }
    } catch {
      await tx.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.CONFIGURATION_BOOTSTRAP_FAILED,
          version: { increment: 1 },
        },
      });
      return {
        attemptId: prep.attempt.id,
        status: TERMINAL_STATUS.CONFIGURATION_BOOTSTRAP_FAILED,
        outcome: parsed.outcome,
        retryAllowed: false,
      };
    }

    await tx.mraEisTerminal.update({
      where: { id: terminalId },
      data: {
        status: TERMINAL_STATUS.CONFIRMATION_PENDING,
        version: { increment: 1 },
      },
    });

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorId,
      actorType: 'SERVICE',
      action: 'ACTIVATION_ACCEPTED_CREDENTIALS_PERSISTED',
      resourceType: 'MraEisTerminal',
      resourceId: terminalId,
      newStatus: TERMINAL_STATUS.CONFIRMATION_PENDING,
      environment: prep.terminal.environment,
      metadata: {
        attemptId: prep.attempt.id,
        mraTerminalId: parsed.mraTerminalId,
        jwtRef: jwtRef.credentialReferenceId,
        secretRef: secretRef.credentialReferenceId,
      },
    }, tx);

    return {
      attemptId: prep.attempt.id,
      status: TERMINAL_STATUS.CONFIRMATION_PENDING,
      outcome: parsed.outcome,
      mraTerminalId: parsed.mraTerminalId,
      tacReferenceId,
      retryAllowed: false,
      nextAction: 'CONFIRM_ACTIVATION',
    };
  });
}

export async function runTerminalConfirmation({
  tenantId,
  businessId = tenantId,
  terminalId,
  tacReferenceId = null,
  activationTacForConfirm = null,
  actorId,
  requestId = crypto.randomUUID(),
  correlationId = crypto.randomUUID(),
  confirmationScenario,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: terminalId, tenantId, businessId },
  });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });
  if (terminal.status !== TERMINAL_STATUS.CONFIRMATION_PENDING) {
    throw EisErrors.invalidTerminalTransition({
      currentStatus: terminal.status,
      message: 'Confirmation requires CONFIRMATION_PENDING.',
    });
  }
  if (!terminal.mraTerminalId) {
    throw EisErrors.validation({ message: 'MRA terminal ID missing; cannot confirm.' });
  }

  assertCryptoAllowed('ACTIVATION_CONFIRMATION_HMAC_SHA512_V1', {
    forProduction: terminal.environment === 'PRODUCTION',
  });

  const secretRef = await db.mraEisCredentialReference.findFirst({
    where: {
      terminalId,
      tenantId,
      businessId,
      credentialType: CREDENTIAL_TYPE.TERMINAL_SECRET,
      status: 'ACTIVE',
    },
  });
  if (!secretRef) {
    throw EisErrors.validation({ message: 'Active terminal secret reference required for confirmation.' });
  }

  const attemptNumber =
    (await db.mraEisConfirmationAttempt.count({ where: { terminalId } })) + 1;

  const attempt = await db.mraEisConfirmationAttempt.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      confirmationAttemptNumber: attemptNumber,
      status: 'SENDING',
      signerVersion: 'ACTIVATION_CONFIRMATION_HMAC_SHA512_V1',
      requestId,
      correlationId,
    },
  });

  await db.mraEisTerminal.update({
    where: { id: terminalId },
    data: {
      status: TERMINAL_STATUS.CONFIRMATION_IN_PROGRESS,
      previousStatus: TERMINAL_STATUS.CONFIRMATION_PENDING,
      version: { increment: 1 },
    },
  });

  // Phase 1 contract: HMAC-SHA512(TAC, secretKey). Prefer ephemeral TAC lease.
  let signature;
  try {
    const signWith = async (tacPlaintext) =>
      withSecret(
        {
          credentialReferenceId: secretRef.id,
          tenantId,
          businessId,
          terminalId,
          environment: terminal.environment,
          operation: EIS_CRYPTO_OPERATION.MRA_ACTIVATION_CONFIRMATION,
          serviceIdentity: EIS_SERVICE_IDENTITY.ACTIVATION_CONFIRMATION_SERVICE,
          requestId,
          correlationId,
          db,
        },
        async (secretKey) => computeActivationConfirmationSignature(tacPlaintext, secretKey)
      );

    if (activationTacForConfirm) {
      signature = await signWith(activationTacForConfirm);
    } else if (tacReferenceId) {
      signature = await withEphemeralSecret(
        {
          ephemeralSecretId: tacReferenceId,
          tenantId,
          businessId,
          terminalId,
          environment: terminal.environment,
          secretType: EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE,
          destroyAfter: true,
          db,
        },
        async (tac) => signWith(tac)
      );
    } else {
      throw EisErrors.validation({
        message: 'TAC reference required for activation confirmation (HMAC input).',
      });
    }
  } catch (err) {
    await db.mraEisConfirmationAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'REJECTED',
        outcome: 'SIGNING_FAILED',
        completedAt: new Date(),
        safeErrorCode: err.code || 'SIGNING_ERROR',
      },
    });
    await db.mraEisTerminal.update({
      where: { id: terminalId },
      data: { status: TERMINAL_STATUS.CONFIRMATION_FAILED, version: { increment: 1 } },
    });
    throw err;
  }

  const mapped = mapConfirmationRequest({ terminalId: terminal.mraTerminalId });
  let mraResult;
  try {
    mraResult = await confirmTerminalViaMra({
      environment: terminal.environment,
      requestBody: mapped.body,
      signature,
      requestId,
      confirmationScenario,
    });
  } catch (err) {
    if (err?.dispatched) {
      await db.mraEisConfirmationAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'UNKNOWN_OUTCOME',
          unknownOutcomeAt: new Date(),
          completedAt: new Date(),
          safeErrorCode: err.code || 'UNKNOWN_OUTCOME',
        },
      });
      await db.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.UNKNOWN_CONFIRMATION_OUTCOME,
          version: { increment: 1 },
        },
      });
      await openManualReviewCase({
        tenantId,
        businessId,
        terminalId,
        caseType: 'ACTIVATION_FAILURE',
        severity: 'HIGH',
        sourceEntityType: 'MraEisConfirmationAttempt',
        sourceEntityId: attempt.id,
        title: 'Unknown confirmation outcome',
        description: 'Confirmation may have succeeded; ordinary retry blocked.',
        openedBy: actorId || 'system',
        db,
      });
      return {
        attemptId: attempt.id,
        status: TERMINAL_STATUS.UNKNOWN_CONFIRMATION_OUTCOME,
        retryAllowed: false,
      };
    }
    throw err;
  }

  const parsed = parseConfirmationResponse(mraResult);
  await db.mraEisConfirmationAttempt.update({
    where: { id: attempt.id },
    data: {
      status: parsed.accepted ? 'ACCEPTED' : 'REJECTED',
      httpStatus: parsed.httpStatus,
      mraApplicationStatus: parsed.mraApplicationStatus,
      outcome: parsed.outcome,
      responseChecksum: parsed.responseChecksum,
      sanitizedResponse: parsed.sanitizedResponse,
      requestChecksum: mapped.canonical.checksum,
      completedAt: new Date(),
    },
  });

  if (!parsed.accepted) {
    await db.mraEisTerminal.update({
      where: { id: terminalId },
      data: { status: TERMINAL_STATUS.CONFIRMATION_FAILED, version: { increment: 1 } },
    });
    return {
      attemptId: attempt.id,
      status: TERMINAL_STATUS.CONFIRMATION_FAILED,
      retryAllowed: true,
    };
  }

  // ACTIVE only after confirmation success
  await db.mraEisTerminal.update({
    where: { id: terminalId },
    data: {
      status: TERMINAL_STATUS.ACTIVE,
      activationConfirmedAt: new Date(),
      activatedAt: new Date(),
      version: { increment: 1 },
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisTerminal',
    aggregateId: terminalId,
    eventType: EIS_OUTBOX_EVENT.CONFIGURATION_SYNC_REQUESTED,
    payload: { terminalId, reason: 'POST_ACTIVATION', environment: terminal.environment },
    idempotencyKey: `config-sync-after-activation:${terminalId}`,
    db,
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: 'SERVICE',
    action: 'TERMINAL_ACTIVATED',
    resourceType: 'MraEisTerminal',
    resourceId: terminalId,
    newStatus: TERMINAL_STATUS.ACTIVE,
    environment: terminal.environment,
    metadata: { attemptId: attempt.id, mraTerminalId: terminal.mraTerminalId },
  }, db);

  return {
    attemptId: attempt.id,
    status: TERMINAL_STATUS.ACTIVE,
    mraTerminalId: terminal.mraTerminalId,
    nextAction: 'CONFIGURATION_SYNC',
  };
}

export { safeTerminalDto };
