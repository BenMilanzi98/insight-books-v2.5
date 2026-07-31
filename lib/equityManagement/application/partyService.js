import { OwnershipStatus, RelationshipType } from '../domain/enums.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';

const ACTIVE_LIKE = new Set([OwnershipStatus.ACTIVE, OwnershipStatus.PENDING_VERIFICATION]);

export async function listRelationships(db, tenantId, filters = {}) {
  return db.eqV2PartyRelationship.findMany({
    where: {
      tenantId,
      ...(filters.relationshipType ? { relationshipType: filters.relationshipType } : {}),
      ...(filters.ownershipStatus ? { ownershipStatus: filters.ownershipStatus } : {}),
    },
    orderBy: { partyName: 'asc' },
  });
}

export async function getRelationship(db, tenantId, id) {
  const row = await db.eqV2PartyRelationship.findFirst({ where: { id, tenantId } });
  if (!row) {
    throw new AccountingValidationError('Owner/shareholder relationship not found.', [
      { path: 'relationshipId', message: 'not found' },
    ]);
  }
  return row;
}

export async function createRelationship(db, context, input) {
  const relationshipType = input.relationshipType || RelationshipType.OWNER;
  if (!Object.values(RelationshipType).includes(relationshipType)) {
    throw new AccountingValidationError('Invalid relationship type.');
  }
  if (!input.partyName || !String(input.partyName).trim()) {
    throw new AccountingValidationError('partyName is required.');
  }

  return db.eqV2PartyRelationship.create({
    data: {
      tenantId: context.businessId,
      partyName: String(input.partyName).trim(),
      partyType: input.partyType || 'PERSON',
      relationshipType,
      ownershipStatus: input.ownershipStatus || OwnershipStatus.ACTIVE,
      ownerNumber: input.ownerNumber || null,
      shareholderNumber: input.shareholderNumber || null,
      partnerNumber: input.partnerNumber || null,
      email: input.email || null,
      phone: input.phone || null,
      taxIdentifierRef: input.taxIdentifierRef || null,
      address: input.address || null,
      verificationStatus: input.verificationStatus || 'UNVERIFIED',
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      legacyEquityAccountId: input.legacyEquityAccountId || null,
      createdBy: context.userId || null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function updateRelationshipNonFinancial(db, context, id, input) {
  const existing = await getRelationship(db, context.businessId, id);
  if ([OwnershipStatus.EXITED, OwnershipStatus.ARCHIVED].includes(existing.ownershipStatus) && input.ownershipStatus == null) {
    throw new AccountingValidationError('Exited/archived relationships cannot be edited.');
  }
  return db.eqV2PartyRelationship.update({
    where: { id },
    data: {
      email: input.email ?? existing.email,
      phone: input.phone ?? existing.phone,
      address: input.address ?? existing.address,
      taxIdentifierRef: input.taxIdentifierRef ?? existing.taxIdentifierRef,
      verificationStatus: input.verificationStatus ?? existing.verificationStatus,
      ownershipStatus: input.ownershipStatus ?? existing.ownershipStatus,
      effectiveTo: input.effectiveTo != null ? new Date(input.effectiveTo) : existing.effectiveTo,
      approvedBy: input.approvedBy ?? existing.approvedBy,
    },
  });
}

export async function assertActiveRelationship(db, tenantId, relationshipId) {
  const rel = await getRelationship(db, tenantId, relationshipId);
  if (!ACTIVE_LIKE.has(rel.ownershipStatus)) {
    throw new AccountingValidationError('Owner/shareholder is not active.', [
      { path: 'relationshipId', message: rel.ownershipStatus },
    ]);
  }
  return rel;
}

/**
 * Soft-exit: never delete when transactions/holdings exist.
 */
export async function requestExit(db, context, relationshipId, { exitDate, reason } = {}) {
  const rel = await getRelationship(db, context.businessId, relationshipId);
  const [txCount, holdingCount] = await Promise.all([
    db.eqV2EquityTransaction.count({
      where: { tenantId: context.businessId, relationshipId },
    }),
    db.eqV2OwnershipHolding.count({
      where: { tenantId: context.businessId, relationshipId, status: 'ACTIVE', effectiveTo: null },
    }),
  ]);
  if (holdingCount > 0) {
    throw new AccountingValidationError(
      'Cannot exit while active holdings remain — transfer or redeem first.',
      [{ path: 'holdings', message: String(holdingCount) }]
    );
  }
  return db.eqV2PartyRelationship.update({
    where: { id: rel.id },
    data: {
      ownershipStatus: OwnershipStatus.EXITED,
      effectiveTo: exitDate ? new Date(exitDate) : new Date(),
      metadata: {
        ...(rel.metadata || {}),
        exitReason: reason || null,
        hadTransactions: txCount > 0,
      },
    },
  });
}

export async function deleteRelationshipIfSafe(db, context, relationshipId) {
  const rel = await getRelationship(db, context.businessId, relationshipId);
  const [txCount, holdingCount, allocCount] = await Promise.all([
    db.eqV2EquityTransaction.count({ where: { relationshipId } }),
    db.eqV2OwnershipHolding.count({ where: { relationshipId } }),
    db.eqV2DividendAllocation.count({ where: { relationshipId } }),
  ]);
  if (txCount || holdingCount || allocCount) {
    throw new AccountingValidationError(
      'Owner/shareholder with accounting history cannot be deleted — archive or exit instead.',
      [{ path: 'relationshipId', message: 'has history' }]
    );
  }
  await db.eqV2PartyRelationship.delete({ where: { id: rel.id } });
  return { deleted: true };
}
