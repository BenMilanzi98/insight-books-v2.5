/**
 * Versioned ownership holdings — never overwrite history.
 */

import {
  assertOwnershipTotalWithinLimit,
  percentToMinor,
  minorToPercentString,
} from '../domain/ownershipPercent.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { EquityTransactionType } from '../domain/enums.js';

export async function listActiveHoldings(db, tenantId, asOfDate = new Date()) {
  const asOf = new Date(asOfDate);
  return db.eqV2OwnershipHolding.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    include: {
      relationship: { select: { id: true, partyName: true, relationshipType: true } },
      shareClass: { select: { id: true, classCode: true, className: true } },
    },
    orderBy: { ownershipPercentage: 'desc' },
  });
}

export async function validateActiveOwnershipTotal(db, tenantId, asOfDate) {
  const holdings = await listActiveHoldings(db, tenantId, asOfDate);
  const minors = holdings.map((h) => percentToMinor(h.ownershipPercentage));
  const total = assertOwnershipTotalWithinLimit(minors);
  return { totalPercent: minorToPercentString(total), holdings };
}

export async function createShareClass(db, context, input) {
  return db.eqV2ShareClass.create({
    data: {
      tenantId: context.businessId,
      classCode: String(input.classCode).trim().toUpperCase(),
      className: input.className,
      description: input.description || null,
      nominalValue: String(input.nominalValue),
      currency: input.currency || 'MWK',
      authorizedQuantity: input.authorizedQuantity != null ? String(input.authorizedQuantity) : null,
      votingRightsPerShare: String(input.votingRightsPerShare ?? 1),
      equityAccountId: input.equityAccountId || null,
      sharePremiumAccountId: input.sharePremiumAccountId || null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      status: input.status || 'DRAFT',
      createdBy: context.userId || null,
    },
  });
}

export async function approveShareClass(db, context, id) {
  const row = await db.eqV2ShareClass.findFirst({ where: { id, tenantId: context.businessId } });
  if (!row) throw new AccountingValidationError('Share class not found.');
  return db.eqV2ShareClass.update({
    where: { id },
    data: { status: 'ACTIVE', approvedBy: context.userId || null },
  });
}

/**
 * Apply ownership effects for share issuance / transfer / redemption.
 */
export async function applyOwnershipFromTransaction(db, context, tx) {
  const effective = tx.effectiveOwnershipDate || tx.transactionDate;
  if (tx.transactionType === EquityTransactionType.SHARE_ISSUANCE) {
    if (!tx.relationshipId || !tx.shareClassId) return;
    await closeOpenHolding(db, context.businessId, tx.relationshipId, tx.shareClassId, effective);
    const pct = tx.metadata?.ownershipPercentage != null ? String(tx.metadata.ownershipPercentage) : '0';
    await db.eqV2OwnershipHolding.create({
      data: {
        tenantId: context.businessId,
        relationshipId: tx.relationshipId,
        shareClassId: tx.shareClassId,
        quantityHeld: String(tx.shareQuantity || 0),
        nominalValueHeld: String(
          Number(tx.shareQuantity || 0) * Number(tx.nominalValue || 0)
        ),
        paidValue: String(tx.amount),
        ownershipPercentage: pct,
        votingPercentage: pct,
        effectiveFrom: effective,
        sourceTransactionId: tx.id,
        status: 'ACTIVE',
        version: 1,
      },
    });
    const sc = await db.eqV2ShareClass.findUnique({ where: { id: tx.shareClassId } });
    if (sc) {
      const qty = Number(tx.shareQuantity || 0);
      const nextIssued = Number(sc.issuedQuantity) + qty;
      if (sc.authorizedQuantity != null && nextIssued > Number(sc.authorizedQuantity)) {
        throw new AccountingValidationError('Authorized share quantity exceeded.');
      }
      await db.eqV2ShareClass.update({
        where: { id: tx.shareClassId },
        data: {
          issuedQuantity: String(nextIssued),
          paidQuantity: String(Number(sc.paidQuantity) + qty),
        },
      });
    }
    await db.eqV2OwnershipMovement.create({
      data: {
        tenantId: context.businessId,
        movementType: 'ISSUE',
        toRelationshipId: tx.relationshipId,
        shareClassId: tx.shareClassId,
        quantity: String(tx.shareQuantity || 0),
        ownershipPercentage: pct,
        effectiveDate: effective,
        equityTransactionId: tx.id,
        createdBy: context.userId || null,
      },
    });
    // Validate total if percentages tracked
    if (Number(pct) > 0) {
      await validateActiveOwnershipTotal(db, context.businessId, effective);
    }
    return;
  }

  if (tx.transactionType === EquityTransactionType.SHARE_TRANSFER) {
    const fromId = tx.metadata?.fromRelationshipId;
    const toId = tx.relationshipId || tx.metadata?.toRelationshipId;
    const qty = Number(tx.shareQuantity || tx.metadata?.quantity || 0);
    const shareClassId = tx.shareClassId || tx.metadata?.shareClassId;
    if (!fromId || !toId || !shareClassId || !(qty > 0)) {
      throw new AccountingValidationError('Share transfer requires from/to, class, and quantity.');
    }
    await transferQuantity(db, context, {
      fromId,
      toId,
      shareClassId,
      qty,
      effective,
      txId: tx.id,
      ownershipPercentage: tx.metadata?.ownershipPercentage,
    });
  }
}

async function closeOpenHolding(db, tenantId, relationshipId, shareClassId, asOf) {
  const open = await db.eqV2OwnershipHolding.findFirst({
    where: {
      tenantId,
      relationshipId,
      shareClassId,
      status: 'ACTIVE',
      effectiveTo: null,
    },
    orderBy: { version: 'desc' },
  });
  if (open) {
    const end = new Date(asOf);
    end.setUTCDate(end.getUTCDate() - 1);
    await db.eqV2OwnershipHolding.update({
      where: { id: open.id },
      data: { effectiveTo: end, status: 'SUPERSEDED' },
    });
  }
}

async function transferQuantity(db, context, opts) {
  const fromHolding = await db.eqV2OwnershipHolding.findFirst({
    where: {
      tenantId: context.businessId,
      relationshipId: opts.fromId,
      shareClassId: opts.shareClassId,
      status: 'ACTIVE',
      effectiveTo: null,
    },
  });
  if (!fromHolding || Number(fromHolding.quantityHeld) < opts.qty) {
    throw new AccountingValidationError('Transfer quantity exceeds holdings.');
  }
  const dayBefore = new Date(opts.effective);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  await db.eqV2OwnershipHolding.update({
    where: { id: fromHolding.id },
    data: { effectiveTo: dayBefore, status: 'SUPERSEDED' },
  });
  const remaining = Number(fromHolding.quantityHeld) - opts.qty;
  if (remaining > 0) {
    await db.eqV2OwnershipHolding.create({
      data: {
        tenantId: context.businessId,
        relationshipId: opts.fromId,
        shareClassId: opts.shareClassId,
        quantityHeld: String(remaining),
        nominalValueHeld: fromHolding.nominalValueHeld,
        paidValue: fromHolding.paidValue,
        ownershipPercentage: fromHolding.ownershipPercentage,
        votingPercentage: fromHolding.votingPercentage,
        effectiveFrom: opts.effective,
        sourceTransactionId: opts.txId,
        status: 'ACTIVE',
        version: fromHolding.version + 1,
      },
    });
  }
  await closeOpenHolding(db, context.businessId, opts.toId, opts.shareClassId, opts.effective);
  await db.eqV2OwnershipHolding.create({
    data: {
      tenantId: context.businessId,
      relationshipId: opts.toId,
      shareClassId: opts.shareClassId,
      quantityHeld: String(opts.qty),
      nominalValueHeld: '0',
      paidValue: '0',
      ownershipPercentage: String(opts.ownershipPercentage || 0),
      votingPercentage: String(opts.ownershipPercentage || 0),
      effectiveFrom: opts.effective,
      sourceTransactionId: opts.txId,
      status: 'ACTIVE',
      version: 1,
    },
  });
  await db.eqV2OwnershipMovement.create({
    data: {
      tenantId: context.businessId,
      movementType: 'TRANSFER',
      fromRelationshipId: opts.fromId,
      toRelationshipId: opts.toId,
      shareClassId: opts.shareClassId,
      quantity: String(opts.qty),
      effectiveDate: opts.effective,
      createsCompanyJournal: false,
      equityTransactionId: opts.txId,
      createdBy: context.userId || null,
    },
  });
}

export async function buildCapitalizationTable(db, tenantId, asOfDate = new Date()) {
  const holdings = await listActiveHoldings(db, tenantId, asOfDate);
  const classes = await db.eqV2ShareClass.findMany({
    where: { tenantId, status: 'ACTIVE' },
  });
  const rows = holdings.map((h) => ({
    relationshipId: h.relationshipId,
    partyName: h.relationship?.partyName,
    shareClass: h.shareClass?.classCode,
    quantityHeld: String(h.quantityHeld),
    ownershipPercentage: String(h.ownershipPercentage),
    votingPercentage: String(h.votingPercentage),
    paidValue: String(h.paidValue),
  }));
  const ownershipTotal = assertOwnershipTotalWithinLimit(
    rows.map((r) => percentToMinor(r.ownershipPercentage))
  );
  return {
    asOfDate,
    rows,
    ownershipTotalPercent: minorToPercentString(ownershipTotal),
    shareClasses: classes.map((c) => ({
      classCode: c.classCode,
      authorizedQuantity: c.authorizedQuantity != null ? String(c.authorizedQuantity) : null,
      issuedQuantity: String(c.issuedQuantity),
      paidQuantity: String(c.paidQuantity),
      nominalValue: String(c.nominalValue),
    })),
  };
}
