import prisma from '@/lib/prisma.js';
import {
  SYNC_STATUS,
  SYNC_TYPE,
  EXTERNAL_CATALOGUE_TYPE,
  EIS_OUTBOX_EVENT,
  MAPPING_STATUS,
} from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateCatalogueSyncReadiness, CATALOGUE_TYPES } from './catalogueSyncReadiness.js';
import {
  mapProductCatalogueRequest,
  mapServiceCatalogueRequest,
  mapCombinedCatalogueRequest,
} from './catalogueRequestMappers.js';
import { parseCatalogueResponse, CATALOGUE_RESPONSE_OUTCOME } from './catalogueResponseParser.js';
import { fetchCatalogueFromMra } from '../../infrastructure/mraClient/catalogueClient.js';
import { upsertExternalCatalogueItem } from '../services/mappingService.js';
import { getCatalogueReplacementDeltaPolicy } from './productSyncContract.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_SERVICE_IDENTITY } from '../../infrastructure/security/serviceIdentity.js';

const CLAIM_MS = 60_000;

function syncTypeFor(catalogueType) {
  if (catalogueType === CATALOGUE_TYPES.SERVICES) return SYNC_TYPE.SERVICES;
  return SYNC_TYPE.PRODUCTS;
}

export async function requestCatalogueSync({
  tenantId,
  businessId = tenantId,
  terminalId,
  siteMappingId = null,
  catalogueType = CATALOGUE_TYPES.PRODUCTS,
  trigger = 'MANUAL',
  requestedBy,
  idempotencyKey = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const terminal = await db.mraEisTerminal.findFirst({ where: { id: terminalId, tenantId, businessId } });
  if (!terminal) throw EisErrors.terminalNotFound({ tenantId, businessId });

  const key =
    idempotencyKey ||
    `cat-sync:${terminalId}:${catalogueType}:${trigger}:${siteMappingId || 'auto'}:${terminal.environment}`;

  const existing = await db.mraEisSyncRun.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    if (existing.tenantId !== tenantId || existing.businessId !== businessId) {
      throw EisErrors.idempotencyConflict({ message: 'Catalogue sync idempotency key reused with different scope.' });
    }
    return { syncRun: existing, idempotent: true };
  }

  const readiness = await evaluateCatalogueSyncReadiness({
    tenantId,
    businessId,
    terminalId,
    siteMappingId,
    environment: terminal.environment,
    catalogueType,
    trigger,
    db,
  });
  if (!readiness.syncAllowed) {
    throw EisErrors.validation({
      message: 'Catalogue sync not allowed.',
      code: 'CATALOGUE_SYNC_READINESS',
      details: { blockers: readiness.blockers },
    });
  }

  const syncRun = await db.mraEisSyncRun.create({
    data: {
      tenantId,
      businessId,
      terminalId,
      syncType: syncTypeFor(catalogueType),
      environment: terminal.environment,
      status: SYNC_STATUS.QUEUED,
      trigger,
      requestedBy: requestedBy || 'SYSTEM',
      serviceIdentity: EIS_SERVICE_IDENTITY,
      idempotencyKey: key,
      warnings: readiness.warnings,
      priority: trigger === 'MRA_REQUESTED' ? 10 : 100,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: requestedBy,
    actorType: requestedBy ? 'USER' : 'SERVICE',
    action: `${catalogueType}_CATALOGUE_SYNC_REQUESTED`,
    resourceType: 'MraEisSyncRun',
    resourceId: syncRun.id,
    environment: terminal.environment,
    metadata: { trigger, siteMappingId, localStockMutated: false },
  }, db);

  return { syncRun, idempotent: false, readiness };
}

export async function claimCatalogueSyncRun({
  syncRunId,
  workerId,
  leaseMs = CLAIM_MS,
  db = prisma,
}) {
  const now = new Date();
  const run = await db.mraEisSyncRun.findUnique({ where: { id: syncRunId } });
  if (!run) throw EisErrors.validation({ message: 'Sync run not found', httpStatus: 404 });
  if (![SYNC_STATUS.QUEUED, SYNC_STATUS.RETRY_SCHEDULED].includes(run.status)
      && !(run.status === SYNC_STATUS.CLAIMED && run.claimExpiresAt && run.claimExpiresAt < now)) {
    throw EisErrors.validation({ message: `Cannot claim sync run in status ${run.status}` });
  }
  return db.mraEisSyncRun.update({
    where: { id: syncRunId },
    data: {
      status: SYNC_STATUS.CLAIMED,
      claimOwner: workerId,
      claimExpiresAt: new Date(Date.now() + leaseMs),
      startedAt: run.startedAt || now,
      attemptCount: { increment: 1 },
      version: { increment: 1 },
    },
  });
}

/**
 * Execute catalogue sync — stores external records only.
 * Never creates local Products/Services, Journals, or Stock Movements.
 * Never inactivates missing records under UNKNOWN replacement policy or partial pages.
 */
export async function executeCatalogueSyncRun({
  syncRunId,
  workerId = 'catalogue-worker',
  db = prisma,
}) {
  let run = await db.mraEisSyncRun.findUnique({ where: { id: syncRunId } });
  if (!run) throw EisErrors.validation({ message: 'Sync run not found', httpStatus: 404 });
  if (run.status !== SYNC_STATUS.CLAIMED || run.claimOwner !== workerId) {
    run = await claimCatalogueSyncRun({ syncRunId, workerId, db });
  }

  const terminal = await db.mraEisTerminal.findFirst({
    where: { id: run.terminalId, tenantId: run.tenantId, businessId: run.businessId },
  });
  const siteMapping = await db.mraEisSiteMapping.findFirst({
    where: {
      tenantId: run.tenantId,
      businessId: run.businessId,
      environment: run.environment,
      status: MAPPING_STATUS.ACTIVE,
      ...(terminal?.branchId ? { branchId: terminal.branchId } : {}),
    },
  });
  if (!siteMapping) {
    return finalize(run, SYNC_STATUS.FAILED, { safeErrorCode: 'SITE_MAPPING_REQUIRED' }, db);
  }

  await db.mraEisSyncRun.update({
    where: { id: run.id },
    data: { status: 'REQUEST_MAPPING', version: { increment: 1 } },
  });

  const catalogueType =
    run.syncType === SYNC_TYPE.SERVICES ? CATALOGUE_TYPES.SERVICES : CATALOGUE_TYPES.PRODUCTS;
  const mapper =
    catalogueType === CATALOGUE_TYPES.SERVICES
      ? mapServiceCatalogueRequest
      : mapProductCatalogueRequest;

  const tenant = await db.tenant.findUnique({
    where: { id: run.tenantId },
    select: { tin: true, taxId: true },
  });

  const mapped = mapper({
    terminal,
    taxpayerTin: tenant?.tin || tenant?.taxId,
    mraSiteId: siteMapping.mraSiteId,
    environment: run.environment,
  });

  await db.mraEisSyncRun.update({
    where: { id: run.id },
    data: { status: 'FETCHING', version: { increment: 1 } },
  });

  let httpResult;
  try {
    httpResult = await fetchCatalogueFromMra({
      mappedRequest: mapped,
      environment: run.environment,
      method: 'POST',
    });
  } catch (err) {
    if (err.code === 'TIMEOUT') {
      return finalize(run, 'UNKNOWN_OUTCOME', { safeErrorCode: 'TIMEOUT' }, db);
    }
    return finalize(run, SYNC_STATUS.FAILED, { safeErrorCode: err.code || 'FETCH_FAILED', safeErrorSummary: err.message }, db);
  }

  const expectedType =
    catalogueType === CATALOGUE_TYPES.SERVICES
      ? EXTERNAL_CATALOGUE_TYPE.SERVICE
      : EXTERNAL_CATALOGUE_TYPE.PRODUCT;

  const parsed = parseCatalogueResponse({
    httpStatus: httpResult.httpStatus,
    body: httpResult.body,
    expectedTin: tenant?.tin || tenant?.taxId,
    expectedSiteId: siteMapping.mraSiteId,
    expectedType,
  });

  if (!parsed.accepted) {
    const status =
      parsed.outcome === CATALOGUE_RESPONSE_OUTCOME.TEMPORARY_MRA_FAILURE
        || parsed.outcome === CATALOGUE_RESPONSE_OUTCOME.RATE_LIMITED
        ? SYNC_STATUS.RETRY_SCHEDULED
        : parsed.outcome === CATALOGUE_RESPONSE_OUTCOME.TERMINAL_BLOCKED
          ? 'MANUAL_REVIEW'
          : SYNC_STATUS.FAILED;
    return finalize(run, status, { safeErrorCode: parsed.outcome }, db);
  }

  if (parsed.outcome === CATALOGUE_RESPONSE_OUTCOME.CATALOGUE_UNCHANGED) {
    return finalize(run, 'COMPLETED_NO_CHANGES', {
      targetVersion: parsed.catalogueVersion,
      recordsUnchanged: 1,
    }, db);
  }

  await db.mraEisSyncRun.update({
    where: { id: run.id },
    data: { status: 'STORING_CATALOGUE', version: { increment: 1 } },
  });

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let conflicts = 0;

  for (const rec of parsed.records || []) {
    try {
      // Same identity + same checksum → idempotent; changed content → new version via sourceVersion
      const prior = await db.mraEisExternalCatalogueItem.findFirst({
        where: {
          tenantId: run.tenantId,
          businessId: run.businessId,
          environment: run.environment,
          mraSiteId: siteMapping.mraSiteId,
          externalType: rec.externalType,
          mraCode: rec.mraCode,
          active: true,
          supersededAt: null,
        },
        orderBy: { synchronizedAt: 'desc' },
      });

      if (prior && prior.sourceChecksum === rec.recordChecksum && prior.sourceVersion === parsed.catalogueVersion) {
        unchanged += 1;
        continue;
      }
      if (prior && prior.sourceVersion === parsed.catalogueVersion && prior.sourceChecksum !== rec.recordChecksum) {
        conflicts += 1;
        await db.mraEisExternalCatalogueItem.update({
          where: { id: prior.id },
          data: { supersededAt: new Date(), active: false },
        });
      } else if (prior && prior.sourceVersion !== parsed.catalogueVersion) {
        await db.mraEisExternalCatalogueItem.update({
          where: { id: prior.id },
          data: { supersededAt: new Date() },
        });
      }

      const row = await upsertExternalCatalogueItem({
        tenantId: run.tenantId,
        businessId: run.businessId,
        environment: run.environment,
        mraTin: tenant?.tin || tenant?.taxId || '',
        mraSiteId: siteMapping.mraSiteId,
        externalType: rec.externalType,
        mraCode: rec.mraCode,
        name: rec.name,
        sourceVersion: parsed.catalogueVersion,
        record: rec,
        db,
      });

      await db.mraEisExternalCatalogueItem.update({
        where: { id: row.id },
        data: {
          barcode: rec.barcode,
          description: rec.description,
          unitOfMeasure: rec.unitOfMeasure,
          costPrice: rec.costPrice,
          sellingPrice: rec.sellingPrice,
          quantity: rec.quantity,
          active: rec.active,
          terminalId: run.terminalId,
        },
      });

      if (prior) updated += 1;
      else created += 1;
    } catch {
      conflicts += 1;
    }
  }

  // UNKNOWN replacement policy: do NOT inactivate missing records
  const replacement = getCatalogueReplacementDeltaPolicy();
  if (replacement.policy === 'UNKNOWN' || !parsed.complete) {
    // preserve prior actives
  }

  await appendEisOutboxEvent({
    tenantId: run.tenantId,
    businessId: run.businessId,
    eventType: EIS_OUTBOX_EVENT.PRODUCT_MAPPING_REVALIDATION_REQUESTED,
    aggregateType: 'MraEisSyncRun',
    aggregateId: run.id,
    payload: {
      catalogueVersion: parsed.catalogueVersion,
      autoRemap: false,
      localStockMutated: false,
    },
  }, db).catch(() => {});

  await recordEisControlAudit({
    tenantId: run.tenantId,
    businessId: run.businessId,
    actorType: 'SERVICE',
    action: 'CATALOGUE_SYNC_COMPLETED',
    resourceType: 'MraEisSyncRun',
    resourceId: run.id,
    environment: run.environment,
    metadata: {
      created,
      updated,
      unchanged,
      conflicts,
      localProductsCreated: 0,
      localStockMutated: 0,
      localPricesMutated: 0,
      localTaxesMutated: 0,
    },
  }, db);

  return finalize(
    run,
    conflicts > 0 ? 'COMPLETED_WITH_WARNINGS' : SYNC_STATUS.COMPLETED,
    {
      targetVersion: parsed.catalogueVersion,
      recordsReceived: (parsed.records || []).length,
      recordsCreated: created,
      recordsUpdated: updated,
      recordsUnchanged: unchanged,
      conflictsFound: conflicts,
    },
    db
  );
}

async function finalize(run, status, fields, db) {
  return db.mraEisSyncRun.update({
    where: { id: run.id },
    data: {
      status,
      completedAt: new Date(),
      claimOwner: null,
      claimExpiresAt: null,
      targetVersion: fields.targetVersion || run.targetVersion,
      recordsReceived: fields.recordsReceived ?? run.recordsReceived,
      recordsCreated: fields.recordsCreated ?? run.recordsCreated,
      recordsUpdated: fields.recordsUpdated ?? run.recordsUpdated,
      recordsUnchanged: fields.recordsUnchanged ?? run.recordsUnchanged,
      conflictsFound: fields.conflictsFound ?? run.conflictsFound,
      safeErrorCode: fields.safeErrorCode || null,
      safeErrorSummary: fields.safeErrorSummary || null,
      version: { increment: 1 },
    },
  });
}

export async function runCatalogueSyncNow(args) {
  const { syncRun } = await requestCatalogueSync(args);
  if (syncRun.status === SYNC_STATUS.COMPLETED || syncRun.status === 'COMPLETED_NO_CHANGES') {
    return syncRun;
  }
  const workerId = `immediate-${Date.now()}`;
  await claimCatalogueSyncRun({ syncRunId: syncRun.id, workerId, db: args.db || prisma });
  return executeCatalogueSyncRun({ syncRunId: syncRun.id, workerId, db: args.db || prisma });
}
