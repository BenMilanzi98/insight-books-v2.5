import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import {
  SYNC_STATUS,
  SYNC_TYPE,
  CONFIG_SYNC_TRIGGER,
  CONFIGURATION_TYPE,
  CONFIGURATION_STATUS,
  CONFIG_RESPONSE_OUTCOME,
  CONFIG_FETCH_OUTCOME,
  EIS_OUTBOX_EVENT,
  TERMINAL_STATUS,
  ACTIVATION_MODE,
} from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch, createChecksum } from '../../domain/valueObjects/index.js';
import { evaluateConfigurationSyncReadiness } from './syncReadinessService.js';
import { CONFIGURATION_SYNC_ORDER, listRequiredConfigurationTypes } from './configurationTypeRegistry.js';
import {
  mapGlobalConfigurationRequest,
  mapTerminalConfigurationRequest,
  mapTaxpayerConfigurationRequest,
} from './configRequestMappers.js';
import { parseConfigurationResponse, compareConfigurationVersions } from './configResponseParser.js';
import {
  getGlobalConfiguration,
  getTerminalConfiguration,
  getTaxpayerConfiguration,
} from '../../infrastructure/mraClient/configurationClient.js';
import { storeConfigurationSnapshot, activateConfigurationSnapshot } from '../services/configurationService.js';
import {
  extractTaxDefinitions,
  extractLevyDefinitions,
  extractOfflineThresholds,
  extractReceiptConfiguration,
  extractTaxpayerProfile,
  validateExtractedTaxDefinitions,
  validateExtractedOfflineThresholds,
} from './configExtractors.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { openManualReviewCase } from '../services/reconciliationService.js';
import { EIS_SERVICE_IDENTITY } from '../../infrastructure/security/serviceIdentity.js';
import { resolveActivationMode } from '../../infrastructure/mraClient/environmentConfig.js';

const TERMINAL_STATUSES = Object.values(TERMINAL_STATUS);

function mapperFor(type) {
  if (type === CONFIGURATION_TYPE.GLOBAL) return mapGlobalConfigurationRequest;
  if (type === CONFIGURATION_TYPE.TERMINAL) return mapTerminalConfigurationRequest;
  return mapTaxpayerConfigurationRequest;
}

function clientFor(type) {
  if (type === CONFIGURATION_TYPE.GLOBAL) return getGlobalConfiguration;
  if (type === CONFIGURATION_TYPE.TERMINAL) return getTerminalConfiguration;
  return getTaxpayerConfiguration;
}

/**
 * Request a configuration Sync Run (idempotent).
 */
export async function requestConfigurationSync({
  tenantId,
  businessId = tenantId,
  terminalId,
  trigger = CONFIG_SYNC_TRIGGER.MANUAL,
  configurationTypes = listRequiredConfigurationTypes(),
  reason = null,
  requestedBy,
  businessDate = null,
  priority = trigger === CONFIG_SYNC_TRIGGER.MRA_REQUESTED ? 10 : 100,
  idempotencyKey = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });

  const key =
    idempotencyKey ||
    `cfg-sync:${terminalId}:${trigger}:${(configurationTypes || []).sort().join(',')}:${businessDate || 'na'}`;

  const existing = await db.mraEisSyncRun.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    if (existing.tenantId !== tenantId || existing.businessId !== businessId || existing.terminalId !== terminalId) {
      throw EisErrors.idempotencyConflict({ message: 'Sync idempotency key reused with different scope.' });
    }
    return { syncRun: existing, idempotent: true };
  }

  const readiness = await evaluateConfigurationSyncReadiness({
    tenantId,
    businessId,
    terminalId,
    configurationTypes,
    trigger,
    environment: terminal.environment,
    db,
  });
  if (!readiness.synchronizationAllowed) {
    throw EisErrors.validation({
      message: 'Configuration sync readiness failed.',
      details: { blockers: readiness.blockers },
    });
  }

  const syncRun = await db.mraEisSyncRun.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      syncType: SYNC_TYPE.CONFIGURATION,
      environment: terminal.environment,
      status: SYNC_STATUS.QUEUED,
      trigger,
      requestedConfigurationTypes: configurationTypes,
      currentVersionSummary: readiness.currentVersions,
      requestedBy: requestedBy || 'system',
      serviceIdentity: EIS_SERVICE_IDENTITY.CONFIGURATION_SYNC_WORKER,
      priority,
      businessDate,
      idempotencyKey: key,
      correlationId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      warnings: reason ? [{ code: 'REASON', message: String(reason).slice(0, 500) }] : [],
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: requestedBy,
    actorType: requestedBy ? 'USER' : 'SERVICE',
    action: 'CONFIGURATION_SYNC_REQUESTED',
    resourceType: 'MraEisSyncRun',
    resourceId: syncRun.id,
    environment: terminal.environment,
    metadata: { trigger, configurationTypes, terminalId },
  }, db);

  return { syncRun, readiness, idempotent: false };
}

/**
 * Claim a queued Sync Run with lease.
 */
export async function claimConfigurationSyncRun({
  syncRunId,
  workerId,
  leaseMs = 120_000,
  db = prisma,
}) {
  const now = new Date();
  const run = await db.mraEisSyncRun.findUnique({ where: { id: syncRunId } });
  if (!run) throw EisErrors.validation({ message: 'Sync Run not found.', httpStatus: 404 });
  if (![SYNC_STATUS.QUEUED, SYNC_STATUS.RETRY_SCHEDULED, SYNC_STATUS.CREATED].includes(run.status)) {
    if (run.claimOwner === workerId && run.claimExpiresAt && run.claimExpiresAt > now) {
      return run;
    }
    throw EisErrors.validation({
      message: `Sync Run cannot be claimed in status ${run.status}.`,
      code: 'SYNC_CLAIM_CONFLICT',
    });
  }

  const claimed = await db.mraEisSyncRun.updateMany({
    where: {
      id: syncRunId,
      version: run.version,
      status: { in: [SYNC_STATUS.QUEUED, SYNC_STATUS.RETRY_SCHEDULED, SYNC_STATUS.CREATED] },
    },
    data: {
      status: SYNC_STATUS.CLAIMED,
      claimOwner: workerId,
      claimExpiresAt: new Date(now.getTime() + leaseMs),
      startedAt: run.startedAt || now,
      attemptCount: { increment: 1 },
      version: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    throw EisErrors.validation({ message: 'Sync claim conflict.', code: 'SYNC_CLAIM_CONFLICT' });
  }
  return db.mraEisSyncRun.findUnique({ where: { id: syncRunId } });
}

/**
 * Execute a claimed configuration Sync Run end-to-end (mock-safe).
 */
export async function executeConfigurationSyncRun({
  syncRunId,
  workerId = 'config-sync-worker',
  scenario = null,
  db = prisma,
}) {
  let run = await db.mraEisSyncRun.findUnique({ where: { id: syncRunId } });
  if (!run) throw EisErrors.validation({ message: 'Sync Run not found.', httpStatus: 404 });
  if (run.status !== SYNC_STATUS.CLAIMED) {
    run = await claimConfigurationSyncRun({ syncRunId, workerId, db });
  }

  const tenantId = run.tenantId;
  const businessId = run.businessId;
  const terminalId = run.terminalId;
  const types = run.requestedConfigurationTypes?.length
    ? run.requestedConfigurationTypes
    : CONFIGURATION_SYNC_ORDER;

  const terminal = await db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });

  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: { status: SYNC_STATUS.VALIDATING_READINESS, version: { increment: 1 } },
  });

  const readiness = await evaluateConfigurationSyncReadiness({
    tenantId,
    businessId,
    terminalId,
    configurationTypes: types,
    trigger: 'RECOVERY',
    environment: terminal.environment,
    db,
  });
  // Ignore ACTIVE_SYNC_ALREADY_RUNNING for this run
  const blockers = readiness.blockers.filter((b) => b.code !== 'ACTIVE_SYNC_ALREADY_RUNNING');
  if (blockers.length) {
    await db.mraEisSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: SYNC_STATUS.FAILED,
        safeErrorCode: blockers[0].code,
        safeErrorSummary: blockers[0].message,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { syncRunId, status: SYNC_STATUS.FAILED, blockers };
  }

  const taxpayerTin =
    (await db.tenant.findUnique({ where: { id: tenantId }, select: { tin: true, taxId: true } }))?.tin ||
    (await db.tenant.findUnique({ where: { id: tenantId }, select: { taxId: true } }))?.taxId ||
    'TEST-TIN-0001';

  const mode = resolveActivationMode(terminal.environment);
  const fetched = {};
  const snapshots = {};
  let snapshotsCreated = 0;
  let snapshotsUnchanged = 0;
  let conflictsFound = 0;
  const warnings = [];

  for (const configurationType of CONFIGURATION_SYNC_ORDER.filter((t) => types.includes(t))) {
    const fetchStatus =
      configurationType === CONFIGURATION_TYPE.GLOBAL
        ? SYNC_STATUS.FETCHING_GLOBAL
        : configurationType === CONFIGURATION_TYPE.TERMINAL
          ? SYNC_STATUS.FETCHING_TERMINAL
          : SYNC_STATUS.FETCHING_TAXPAYER;

    await db.mraEisSyncRun.update({
      where: { id: syncRunId },
      data: { status: fetchStatus, version: { increment: 1 } },
    });

    const current = readiness.currentVersions?.[configurationType];
    const mapFn = mapperFor(configurationType);
    const mapped = mapFn({
      terminal,
      taxpayerTin,
      currentVersion: current?.version || null,
    });

    const attemptNumber =
      (await db.mraEisConfigFetchAttempt.count({
        where: { syncRunId, configurationType },
      })) + 1;

    const attempt = await db.mraEisConfigFetchAttempt.create({
      data: {
        syncRunId,
        tenantId,
        businessId,
        terminalId,
        configurationType,
        attemptNumber,
        endpointKey: mapped.endpointKey,
        requestContractVersion: mapped.contractVersion,
        requestChecksum: mapped.canonical.checksum,
        requestId: run.requestId,
        correlationId: run.correlationId,
        workerId,
      },
    });

    let mraResult;
    try {
      mraResult = await clientFor(configurationType)({
        environment: terminal.environment,
        requestBody: mapped.body,
        requestId: run.requestId,
        scenario: mode === ACTIVATION_MODE.MOCK ? scenario : null,
      });
    } catch (err) {
      await db.mraEisConfigFetchAttempt.update({
        where: { id: attempt.id },
        data: {
          completedAt: new Date(),
          outcome: err?.dispatched ? CONFIG_FETCH_OUTCOME.UNKNOWN_OUTCOME : CONFIG_FETCH_OUTCOME.TEMPORARY_FAILURE,
          safeErrorCode: err.code || 'FETCH_ERROR',
          safeErrorSummary: 'Configuration fetch failed.',
          retryClassification: err?.dispatched ? 'RECONCILE_BEFORE_RETRY' : 'AUTOMATIC_RETRY',
        },
      });
      if (err?.dispatched) {
        await db.mraEisSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: SYNC_STATUS.UNKNOWN_OUTCOME,
            safeErrorCode: 'UNKNOWN_OUTCOME',
            safeErrorSummary: 'Configuration fetch outcome unknown after dispatch.',
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await openManualReviewCase({
          tenantId,
          businessId,
          terminalId,
          caseType: 'CONFIGURATION_SYNC_FAILURE',
          severity: 'HIGH',
          sourceEntityType: 'MraEisSyncRun',
          sourceEntityId: syncRunId,
          title: 'Unknown configuration sync outcome',
          description: `${configurationType} fetch may have succeeded; evidence required.`,
          openedBy: workerId,
          db,
        }).catch(() => {});
        return { syncRunId, status: SYNC_STATUS.UNKNOWN_OUTCOME, retryAllowed: configurationType !== 'WRITE' };
      }

      // Partial: schedule retry, do not activate
      await db.mraEisSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: SYNC_STATUS.PARTIALLY_COMPLETED,
          safeErrorCode: err.code || 'PARTIAL_FETCH_FAILURE',
          safeErrorSummary: `${configurationType} fetch failed temporarily.`,
          nextAttemptAt: new Date(Date.now() + 60_000),
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return {
        syncRunId,
        status: SYNC_STATUS.PARTIALLY_COMPLETED,
        failedType: configurationType,
        snapshotsPreserved: true,
        activated: false,
      };
    }

    const parsed = parseConfigurationResponse({
      httpStatus: mraResult.httpStatus,
      body: mraResult.body,
      configurationType,
      expectedTerminalId: terminal.mraTerminalId,
      expectedTin: taxpayerTin,
    });

    await db.mraEisConfigFetchAttempt.update({
      where: { id: attempt.id },
      data: {
        completedAt: new Date(),
        httpStatus: parsed.httpStatus,
        mraApplicationStatus: parsed.mraApplicationStatus,
        responseChecksum: parsed.responseChecksum,
        outcome: parsed.accepted
          ? parsed.outcome === CONFIG_RESPONSE_OUTCOME.CONFIGURATION_UNCHANGED
            ? CONFIG_FETCH_OUTCOME.NO_CHANGE
            : CONFIG_FETCH_OUTCOME.ACCEPTED
          : CONFIG_FETCH_OUTCOME.REJECTED,
        retryClassification: parsed.retryClassification,
        safeErrorCode: parsed.accepted ? null : parsed.outcome,
        safeErrorSummary: parsed.remark,
        sanitizedResponse: parsed.sanitizedResponse,
      },
    });

    if (parsed.terminalBlocked) {
      await db.mraEisTerminal.update({
        where: { id: terminalId },
        data: {
          status: TERMINAL_STATUS.BLOCKED,
          previousStatus: terminal.status,
          blockedAt: new Date(),
          blockReason: 'MRA terminal configuration indicates blocked',
          version: { increment: 1 },
        },
      });
      await db.mraEisSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: SYNC_STATUS.FAILED,
          safeErrorCode: 'TERMINAL_BLOCKED',
          safeErrorSummary: 'Terminal blocked by MRA configuration response.',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return { syncRunId, status: SYNC_STATUS.FAILED, terminalBlocked: true };
    }

    if (!parsed.accepted) {
      if (parsed.retryClassification === 'AUTOMATIC_RETRY') {
        await db.mraEisSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: SYNC_STATUS.PARTIALLY_COMPLETED,
            safeErrorCode: parsed.outcome,
            nextAttemptAt: new Date(Date.now() + 60_000),
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        return { syncRunId, status: SYNC_STATUS.PARTIALLY_COMPLETED, failedType: configurationType, activated: false };
      }
      await db.mraEisSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: SYNC_STATUS.FAILED,
          safeErrorCode: parsed.outcome,
          safeErrorSummary: parsed.remark || 'Configuration response rejected.',
          validationFailures: { increment: 1 },
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return { syncRunId, status: SYNC_STATUS.FAILED, outcome: parsed.outcome };
    }

    fetched[configurationType] = parsed;

    if (parsed.outcome === CONFIG_RESPONSE_OUTCOME.CONFIGURATION_UNCHANGED && current?.snapshotId) {
      snapshots[configurationType] = await db.mraEisConfigurationSnapshot.findUnique({
        where: { id: current.snapshotId },
      });
      snapshotsUnchanged += 1;
      continue;
    }

    const comparison = compareConfigurationVersions({
      localActiveVersion: current?.version,
      localChecksum: current?.checksum,
      remoteVersion: parsed.version,
      remoteChecksum: createChecksum(parsed.payload).value,
    });

    if (comparison.conflict) {
      conflictsFound += 1;
      await db.mraEisSyncRun.update({
        where: { id: syncRunId },
        data: {
          status: SYNC_STATUS.CONFLICT,
          conflictsFound,
          safeErrorCode: 'SAME_VERSION_CHECKSUM_CONFLICT',
          safeErrorSummary: `${configurationType} same version different checksum.`,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await openManualReviewCase({
        tenantId,
        businessId,
        terminalId,
        caseType: 'CONFIGURATION_CONFLICT',
        severity: 'CRITICAL',
        sourceEntityType: 'MraEisSyncRun',
        sourceEntityId: syncRunId,
        title: 'Same-version configuration checksum conflict',
        description: `${configurationType} version ${parsed.version} conflict.`,
        openedBy: workerId,
        db,
      }).catch(() => {});
      // Mark terminal conflict without destroying prior active config
      if (TERMINAL_STATUSES.includes('CONFIGURATION_CONFLICT') || true) {
        await db.mraEisTerminal.update({
          where: { id: terminalId },
          data: {
            status: 'CONFIGURATION_CONFLICT',
            previousStatus: terminal.status,
            version: { increment: 1 },
          },
        }).catch(() => {});
      }
      return { syncRunId, status: SYNC_STATUS.CONFLICT, conflictType: configurationType, priorActivePreserved: true };
    }

    await db.mraEisSyncRun.update({
      where: { id: syncRunId },
      data: { status: SYNC_STATUS.STORING_SNAPSHOTS, version: { increment: 1 } },
    });

    try {
      const snap = await storeConfigurationSnapshot({
        tenantId,
        businessId,
        terminalId,
        environment: terminal.environment,
        configurationType,
        mraVersion: parsed.version,
        canonicalData: parsed.payload,
        createdByService: 'phase8-configuration-sync',
        db,
      });
      snapshots[configurationType] = snap;
      if (snap.createdAt && Date.now() - new Date(snap.createdAt).getTime() < 5000) {
        snapshotsCreated += 1;
      } else {
        snapshotsUnchanged += 1;
      }
    } catch (err) {
      if (err?.code === 'CONFIGURATION_VERSION_CONFLICT') {
        conflictsFound += 1;
        await db.mraEisSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: SYNC_STATUS.CONFLICT,
            conflictsFound,
            safeErrorCode: err.code,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        return { syncRunId, status: SYNC_STATUS.CONFLICT, priorActivePreserved: true };
      }
      throw err;
    }
  }

  // Extraction + set validation
  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: { status: SYNC_STATUS.EXTRACTING_DERIVED_RULES, version: { increment: 1 } },
  });

  const globalPayload = fetched[CONFIGURATION_TYPE.GLOBAL]?.payload || snapshots[CONFIGURATION_TYPE.GLOBAL]?.canonicalData;
  const terminalPayload = fetched[CONFIGURATION_TYPE.TERMINAL]?.payload || snapshots[CONFIGURATION_TYPE.TERMINAL]?.canonicalData;
  const taxpayerPayload = fetched[CONFIGURATION_TYPE.TAXPAYER]?.payload || snapshots[CONFIGURATION_TYPE.TAXPAYER]?.canonicalData;

  const taxes = extractTaxDefinitions(globalPayload, {
    configurationSnapshotId: snapshots[CONFIGURATION_TYPE.GLOBAL]?.id,
    tenantId,
    businessId,
    terminalId,
    environment: terminal.environment,
  });
  const levies = extractLevyDefinitions(globalPayload, {
    configurationSnapshotId: snapshots[CONFIGURATION_TYPE.GLOBAL]?.id,
    tenantId,
    businessId,
    terminalId,
    environment: terminal.environment,
  });
  const offline = extractOfflineThresholds(globalPayload, terminalPayload);
  const receipt = extractReceiptConfiguration(globalPayload);
  const taxpayerProfile = extractTaxpayerProfile(taxpayerPayload);

  const setBlockers = [
    ...validateExtractedTaxDefinitions(taxes),
    ...validateExtractedOfflineThresholds(offline),
  ];
  if (
    taxpayerProfile.tin &&
    taxpayerTin &&
    String(taxpayerProfile.tin) !== String(taxpayerTin) &&
    mode !== ACTIVATION_MODE.MOCK
  ) {
    setBlockers.push({ code: 'TIN_MISMATCH', message: 'Taxpayer TIN does not match Business TIN.' });
  }
  if (
    terminalPayload?.terminalId &&
    String(terminalPayload.terminalId) !== String(terminal.mraTerminalId)
  ) {
    setBlockers.push({ code: 'TERMINAL_IDENTITY_MISMATCH', message: 'Terminal ID mismatch.' });
  }
  for (const t of types) {
    if (!snapshots[t]) setBlockers.push({ code: 'CONFIGURATION_SET_INCOMPLETE', message: `Missing ${t} snapshot.` });
  }

  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: { status: SYNC_STATUS.VALIDATING_CONFIGURATION_SET, version: { increment: 1 } },
  });

  if (setBlockers.length) {
    await db.mraEisSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: SYNC_STATUS.FAILED,
        validationFailures: setBlockers.length,
        safeErrorCode: setBlockers[0].code,
        safeErrorSummary: setBlockers[0].message,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { syncRunId, status: SYNC_STATUS.FAILED, setBlockers, activated: false, priorActivePreserved: true };
  }

  // Persist tax/levy definitions (idempotent per snapshot+external id)
  for (const row of taxes) {
    await db.mraEisExternalTaxDefinition.upsert({
      where: {
        configurationSnapshotId_externalTaxId: {
          configurationSnapshotId: row.configurationSnapshotId,
          externalTaxId: row.externalTaxId,
        },
      },
      create: row,
      update: {},
    }).catch(async () => {
      // upsert unique name may differ — try create ignore
      const exists = await db.mraEisExternalTaxDefinition.findFirst({
        where: {
          configurationSnapshotId: row.configurationSnapshotId,
          externalTaxId: row.externalTaxId,
        },
      });
      if (!exists) await db.mraEisExternalTaxDefinition.create({ data: row });
    });
  }
  for (const row of levies) {
    const exists = await db.mraEisExternalLevyDefinition.findFirst({
      where: {
        configurationSnapshotId: row.configurationSnapshotId,
        externalLevyId: row.externalLevyId,
      },
    });
    if (!exists) await db.mraEisExternalLevyDefinition.create({ data: row });
  }

  // Atomic activation of complete required set
  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: { status: SYNC_STATUS.ACTIVATING, version: { increment: 1 } },
  });

  const activatedIds = {};
  try {
    await db.$transaction(async (tx) => {
      for (const configurationType of types) {
        const snap = snapshots[configurationType];
        if (!snap) throw new Error(`Missing snapshot ${configurationType}`);
        if (snap.status === CONFIGURATION_STATUS.ACTIVE) {
          activatedIds[configurationType] = snap.id;
          continue;
        }
        const activated = await activateConfigurationSnapshot({
          tenantId,
          businessId,
          snapshotId: snap.id,
          activatedBy: workerId,
          reason: `Phase 8 sync ${run.trigger}`,
          correlationId: run.correlationId,
          requestId: run.requestId,
          db: tx,
        });
        activatedIds[configurationType] = activated.id;
      }

      const policyChecksum = createChecksum({
        global: activatedIds[CONFIGURATION_TYPE.GLOBAL],
        terminal: activatedIds[CONFIGURATION_TYPE.TERMINAL],
        taxpayer: activatedIds[CONFIGURATION_TYPE.TAXPAYER],
        taxes: taxes.map((t) => t.externalTaxId),
        offline,
        receipt: receipt.version,
      }).value;

      const refreshHours = Number(terminalPayload?.configurationRefreshHours || 24);
      const nextRequiredSyncAt = new Date(Date.now() + refreshHours * 3600 * 1000);

      await tx.mraEisConfigurationPolicy.upsert({
        where: { terminalId },
        create: {
          tenantId,
          businessId,
          terminalId,
          environment: terminal.environment,
          globalConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.GLOBAL],
          terminalConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.TERMINAL],
          taxpayerConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.TAXPAYER],
          activeVersionSummary: {
            GLOBAL: fetched[CONFIGURATION_TYPE.GLOBAL]?.version,
            TERMINAL: fetched[CONFIGURATION_TYPE.TERMINAL]?.version,
            TAXPAYER: fetched[CONFIGURATION_TYPE.TAXPAYER]?.version,
          },
          taxDefinitionVersion: String(taxes.length),
          levyDefinitionVersion: String(levies.length),
          offlineAllowedByMra: offline.offlineAllowedByMra,
          offlineMaximumAmount: offline.offlineMaximumAmount,
          offlineMaximumAgeHours: offline.offlineMaximumAgeHours,
          receiptPolicyVersion: receipt.version,
          terminalBlocked: false,
          nextRequiredSyncAt,
          mappingRevalidationRequired: true,
          policyChecksum,
        },
        update: {
          globalConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.GLOBAL],
          terminalConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.TERMINAL],
          taxpayerConfigurationSnapshotId: activatedIds[CONFIGURATION_TYPE.TAXPAYER],
          activeVersionSummary: {
            GLOBAL: fetched[CONFIGURATION_TYPE.GLOBAL]?.version,
            TERMINAL: fetched[CONFIGURATION_TYPE.TERMINAL]?.version,
            TAXPAYER: fetched[CONFIGURATION_TYPE.TAXPAYER]?.version,
          },
          taxDefinitionVersion: String(taxes.length),
          levyDefinitionVersion: String(levies.length),
          offlineAllowedByMra: offline.offlineAllowedByMra,
          offlineMaximumAmount: offline.offlineMaximumAmount,
          offlineMaximumAgeHours: offline.offlineMaximumAgeHours,
          receiptPolicyVersion: receipt.version,
          terminalBlocked: false,
          nextRequiredSyncAt,
          mappingRevalidationRequired: true,
          policyChecksum,
          rebuiltAt: new Date(),
        },
      });

      // Restore ACTIVE if was stale/conflict
      if (terminal.status !== TERMINAL_STATUS.ACTIVE && terminal.status !== TERMINAL_STATUS.BLOCKED) {
        await tx.mraEisTerminal.update({
          where: { id: terminalId },
          data: {
            status: TERMINAL_STATUS.ACTIVE,
            previousStatus: terminal.status,
            lastConfigurationSyncAt: new Date(),
            offlineMaximumAmount: offline.offlineMaximumAmount,
            offlineMaximumAgeHours: offline.offlineMaximumAgeHours,
            version: { increment: 1 },
          },
        });
      } else {
        await tx.mraEisTerminal.update({
          where: { id: terminalId },
          data: {
            lastConfigurationSyncAt: new Date(),
            offlineMaximumAmount: offline.offlineMaximumAmount,
            offlineMaximumAgeHours: offline.offlineMaximumAgeHours,
            version: { increment: 1 },
          },
        });
      }
    });
  } catch (err) {
    await db.mraEisSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: SYNC_STATUS.FAILED,
        safeErrorCode: 'ACTIVATION_FAILED',
        safeErrorSummary: 'Atomic configuration activation failed; prior active set preserved.',
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return {
      syncRunId,
      status: SYNC_STATUS.FAILED,
      activated: false,
      priorActivePreserved: true,
      error: err.message,
    };
  }

  // Mapping revalidation hooks (Outbox) — no local data mutation
  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: { status: SYNC_STATUS.REVALIDATING_MAPPINGS, version: { increment: 1 } },
  });

  const mappingEvents = [
    EIS_OUTBOX_EVENT.TAX_MAPPING_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.LEVY_MAPPING_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.SITE_MAPPING_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.PAYMENT_MAPPING_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.PRODUCT_MAPPING_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.OFFLINE_READINESS_REVALIDATION_REQUESTED,
    EIS_OUTBOX_EVENT.RECEIPT_POLICY_REBUILD_REQUESTED,
  ];
  for (const eventType of mappingEvents) {
    await appendEisOutboxEvent({
      tenantId,
      businessId,
      aggregateType: 'MraEisTerminal',
      aggregateId: terminalId,
      eventType,
      payload: { terminalId, syncRunId, environment: terminal.environment },
      idempotencyKey: `${eventType}:${syncRunId}`,
      db,
    }).catch(() => {});
  }

  const noChanges = snapshotsCreated === 0 && conflictsFound === 0;
  const finalStatus = noChanges
    ? SYNC_STATUS.COMPLETED_NO_CHANGES
    : warnings.length
      ? SYNC_STATUS.COMPLETED_WITH_WARNINGS
      : SYNC_STATUS.COMPLETED;

  await db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: {
      status: finalStatus,
      snapshotsCreated,
      snapshotsUnchanged,
      conflictsFound,
      recordsReceived: types.length,
      completedAt: new Date(),
      claimOwner: null,
      claimExpiresAt: null,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorType: 'SERVICE',
    action: 'CONFIGURATION_SYNC_COMPLETED',
    resourceType: 'MraEisSyncRun',
    resourceId: syncRunId,
    newStatus: finalStatus,
    environment: terminal.environment,
    metadata: {
      snapshotsCreated,
      snapshotsUnchanged,
      taxCount: taxes.length,
      levyCount: levies.length,
      offlineAllowedByMra: offline.offlineAllowedByMra,
      receiptVersion: receipt.version,
      mappingRevalidationRequested: true,
    },
  }, db);

  return {
    syncRunId,
    status: finalStatus,
    activated: true,
    activatedIds,
    snapshotsCreated,
    snapshotsUnchanged,
    taxDefinitions: taxes.length,
    levyDefinitions: levies.length,
    offline,
    receipt,
    mappingRevalidationRequested: true,
    offlineEnabled: false,
    localTaxRatesModified: false,
    saleSubmitted: false,
    journalCreated: false,
  };
}

/**
 * Convenience: request + claim + execute (for manual/API/post-activation).
 */
export async function runConfigurationSyncNow(args) {
  const { syncRun, idempotent } = await requestConfigurationSync(args);
  if (idempotent && [SYNC_STATUS.COMPLETED, SYNC_STATUS.COMPLETED_NO_CHANGES, SYNC_STATUS.COMPLETED_WITH_WARNINGS].includes(syncRun.status)) {
    return { syncRunId: syncRun.id, status: syncRun.status, idempotent: true };
  }
  await claimConfigurationSyncRun({
    syncRunId: syncRun.id,
    workerId: args.workerId || 'inline-config-sync',
    db: args.db || prisma,
  });
  return executeConfigurationSyncRun({
    syncRunId: syncRun.id,
    workerId: args.workerId || 'inline-config-sync',
    scenario: args.scenario || null,
    db: args.db || prisma,
  });
}
