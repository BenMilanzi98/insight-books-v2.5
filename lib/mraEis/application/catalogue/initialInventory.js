import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch, createChecksum } from '../../domain/valueObjects/index.js';
import { classifyBusinessEisType, BUSINESS_EIS_TYPE } from './businessTypeClassification.js';
import { getInitialInventoryContractDecision } from './productSyncContract.js';
import { isMappingTypeBlocked } from '../mapping/mappingTypeRegistry.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { EisErrors } from '../../domain/errors.js';
import { submitInitialInventoryToMra } from '../../infrastructure/mraClient/catalogueClient.js';

/**
 * Evaluate whether MRA initial Inventory upload is required.
 * Does not assume every Product Business requires upload.
 */
export async function evaluateInitialMraInventoryRequirement({
  tenantId,
  businessId = tenantId,
  terminalId = null,
  siteMappingId = null,
  warehouseMappingId = null,
  environment = 'SANDBOX',
  productMappingsComplete = false,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const businessClass = await classifyBusinessEisType({ tenantId, businessId, environment: env, db });
  const contract = getInitialInventoryContractDecision();
  const blockers = [];
  const warnings = [];
  const requiredActions = [];

  const productBusiness = businessClass.businessType === BUSINESS_EIS_TYPE.PRODUCT_BASED
    || businessClass.businessType === BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE;
  const serviceBusiness = businessClass.businessType === BUSINESS_EIS_TYPE.SERVICE_BASED
    || businessClass.businessType === BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE;

  // Conservative: Product businesses may require inventory — contract unverified → do not force upload
  const mraInventoryRequired = productBusiness;
  const virtualWarehouseRequired = productBusiness && isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE');
  const initialUploadRequired = false; // not confirmed by verified contract
  const initialUploadSupported = false;
  const initialUploadContractVerified = contract.status === 'VERIFIED' || contract.status === 'VERIFIED_IN_SANDBOX';

  if (productBusiness && !productMappingsComplete) {
    warnings.push('PRODUCT_MAPPINGS_INCOMPLETE_FOR_INVENTORY');
  }
  if (virtualWarehouseRequired) {
    blockers.push('VIRTUAL_WAREHOUSE_REQUIRED');
    warnings.push('VIRTUAL_WAREHOUSE_MAPPING_UNVERIFIED');
  }
  if (mraInventoryRequired && !initialUploadContractVerified) {
    warnings.push('INITIAL_INVENTORY_CONTRACT_UNVERIFIED');
    requiredActions.push('AWAIT_MRA_INVENTORY_CONTRACT');
  }
  if (!serviceBusiness && !productBusiness) {
    blockers.push('BUSINESS_TYPE_UNKNOWN');
  }

  return {
    businessType: businessClass.businessType,
    ProductBusiness: productBusiness,
    ServiceBusiness: serviceBusiness && !productBusiness ? true : serviceBusiness,
    mixedBusiness: businessClass.businessType === BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE,
    mraInventoryRequired,
    virtualWarehouseRequired,
    initialUploadRequired,
    initialUploadSupported,
    initialUploadContractVerified,
    activeCatalogueAvailable: true,
    ProductMappingsComplete: productMappingsComplete,
    warehouseMappingsComplete: Boolean(warehouseMappingId),
    localOpeningStockAvailable: null,
    localInventoryReconciled: false,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    requiredActions: [...new Set(requiredActions)],
    policyVersion: 'phase10-initial-inventory-requirement-v1',
    evaluatedAt: new Date().toISOString(),
    terminalId,
    siteMappingId,
    localInventoryRemainsSourceOfTruth: true,
  };
}

/**
 * Read-only opening inventory reconciliation. No Journal / Stock Movement.
 */
export async function reconcileOpeningInventoryReadOnly({
  tenantId,
  businessId = tenantId,
  warehouseId = null,
  cutoffTimestamp = new Date(),
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const mappings = await db.mraEisProductMapping.findMany({
    where: { tenantId, businessId, localItemId: { not: null }, status: 'ACTIVE' },
    take: 500,
  });

  const lines = [];
  for (const mapping of mappings) {
    const product = await db.product.findFirst({
      where: { id: mapping.localItemId, tenantId: businessId },
      select: { id: true, name: true, stockLevel: true, sku: true },
    }).catch(() => null);
    const external = await db.mraEisExternalCatalogueItem.findFirst({
      where: { id: mapping.externalCatalogueItemId, tenantId, businessId },
    });
    const localQty = product ? Number(product.stockLevel || 0) : null;
    const externalQty = external?.quantity != null ? Number(external.quantity) : null;
    let status = 'LOCAL_QUANTITY_ONLY';
    if (localQty != null && externalQty != null) {
      status = localQty === externalQty ? 'MATCHED' : 'QUANTITY_DIFFERENCE';
    } else if (externalQty != null && localQty == null) status = 'EXTERNAL_QUANTITY_ONLY';
    if (localQty != null && localQty < 0) status = 'NEGATIVE_LOCAL_QUANTITY';
    if (!mapping) status = 'MAPPING_MISSING';

    lines.push({
      localProductId: mapping.localItemId,
      externalMraProductCode: external?.mraCode || null,
      warehouseId,
      localQuantityOnHand: localQty,
      externalMraQuantity: externalQty,
      difference: localQty != null && externalQty != null ? localQty - externalQty : null,
      mappingVersion: mapping.mappingVersion,
      reconciliationStatus: status,
      cutoffTimestamp,
      stockMovementCreated: false,
      journalCreated: false,
    });
  }

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorType: 'SERVICE',
    action: 'INVENTORY_RECONCILIATION_READONLY',
    resourceType: 'Business',
    resourceId: businessId,
    environment,
    metadata: { lineCount: lines.length, stockAdjusted: false },
  }, db);

  return {
    lines,
    cutoffTimestamp,
    environment,
    readOnly: true,
    stockAdjusted: false,
    journalCreated: false,
    reconciliationVersion: 'phase10-inventory-reconcile-v1',
  };
}

/**
 * Immutable compliance inventory snapshot (in-memory/JSON evidence — no accounting).
 * Stored as Manual Review / audit metadata when DB model absent.
 */
export async function createInitialInventorySnapshot({
  tenantId,
  businessId = tenantId,
  warehouseId = null,
  terminalId = null,
  siteMappingId = null,
  cutoffTimestamp = new Date(),
  createdBy,
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const reconciliation = await reconcileOpeningInventoryReadOnly({
    tenantId,
    businessId,
    warehouseId,
    cutoffTimestamp,
    environment,
    db,
  });

  const canonical = {
    tenantId,
    businessId,
    warehouseId,
    terminalId,
    siteMappingId,
    environment,
    cutoffTimestamp,
    lines: reconciliation.lines,
    createdBy,
  };
  const snapshotChecksum = createChecksum(canonical).value;
  const snapshot = {
    id: `invsnap_${snapshotChecksum.slice(0, 16)}`,
    ...canonical,
    status: 'CREATED',
    snapshotChecksum,
    journalCreated: false,
    stockMovementCreated: false,
    version: 1,
    createdAt: new Date().toISOString(),
  };

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: createdBy,
    actorType: 'USER',
    action: 'INITIAL_INVENTORY_SNAPSHOT_CREATED',
    resourceType: 'MraEisInitialInventorySnapshot',
    resourceId: snapshot.id,
    environment,
    metadata: { snapshotChecksum, journalCreated: false, stockMovementCreated: false },
  }, db);

  return snapshot;
}

/**
 * Blocked submission provider unless contract verified + feature flag.
 */
export async function submitInitialInventorySnapshot({
  tenantId,
  businessId = tenantId,
  snapshot,
  approvedBy,
  environment = 'SANDBOX',
  idempotencyKey = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!snapshot?.snapshotChecksum || snapshot.status !== 'APPROVED') {
    // Allow CREATED → still block submit without approval
    if (snapshot?.status !== 'APPROVED') {
      throw EisErrors.validation({
        message: 'Initial Inventory snapshot must be approved before submission.',
        code: 'INITIAL_INVENTORY_REQUIRED',
      });
    }
  }

  try {
    const result = await submitInitialInventoryToMra({
      snapshotId: snapshot.id,
      idempotencyKey: idempotencyKey || snapshot.snapshotChecksum,
      environment,
    });
    const accepted =
      result.httpStatus === 200
      && result.body
      && (result.body.statusCode === 1 || result.body.statusCode === 200)
      && result.body.data?.inventoryReference;

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorId: approvedBy,
      actorType: 'USER',
      action: accepted ? 'INITIAL_INVENTORY_ACCEPTED' : 'INITIAL_INVENTORY_REJECTED',
      resourceType: 'MraEisInitialInventorySnapshot',
      resourceId: snapshot.id,
      environment,
      metadata: {
        httpStatus: result.httpStatus,
        applicationAccepted: Boolean(accepted),
        localStockMutated: false,
      },
    }, db);

    if (result.body?.statusCode == null) {
      return {
        outcome: 'UNKNOWN_OUTCOME',
        retryBlind: false,
        message: 'Unknown Inventory submission outcome — do not blind-retry.',
        evidence: { httpStatus: result.httpStatus, bodySafe: { statusCode: null } },
      };
    }

    return {
      outcome: accepted ? 'ACCEPTED' : 'REJECTED',
      retryBlind: false,
      evidence: {
        httpStatus: result.httpStatus,
        inventoryReference: result.body?.data?.inventoryReference || null,
      },
      localStockMutated: false,
    };
  } catch (err) {
    if (err.code === 'INITIAL_INVENTORY_CONTRACT_UNVERIFIED') throw err;
    throw err;
  }
}

export async function approveInitialInventorySnapshot({ snapshot, approvedBy }) {
  if (!snapshot) throw EisErrors.validation({ message: 'Snapshot required' });
  return {
    ...snapshot,
    status: 'APPROVED',
    approvedBy,
    approvedAt: new Date().toISOString(),
    journalCreated: false,
    stockMovementCreated: false,
  };
}
