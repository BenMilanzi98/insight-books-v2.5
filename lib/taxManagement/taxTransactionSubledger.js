/**
 * Project posted V2 journal lines into TaxTransaction subledger (idempotent).
 */

import prisma from '../prisma.js';

function subledgerEnabled(db = prisma) {
  return Boolean(db?.taxTransaction?.create);
}

/**
 * Upsert tax subledger rows for a posted journal's lines that touch mapped tax accounts.
 * Safe to call repeatedly — unique on journalLineId.
 */
export async function projectJournalToTaxSubledger({
  tenantId,
  journalEntry,
  lines,
  purposeByAccountId = {},
  isReversal = false,
  reversedFromId = null,
  db = prisma,
}) {
  if (!subledgerEnabled(db) || !journalEntry?.id || !Array.isArray(lines)) {
    return { written: 0, skipped: true };
  }

  let written = 0;
  for (const line of lines) {
    if (!line?.id || !line.accountId) continue;
    let purpose = purposeByAccountId[line.accountId] || line.purpose || null;
    let taxTypeId = line.taxTypeId || null;

    if (!purpose && !taxTypeId) {
      const taxType = await db.taxType.findFirst({
        where: { tenantId, accountId: line.accountId },
        select: { id: true },
      });
      if (!taxType) continue;
      taxTypeId = taxType.id;
      purpose = 'TAX_PAYABLE';
    }

    const debit = Number(line.debitAmount ?? line.debit ?? 0) || 0;
    const credit = Number(line.creditAmount ?? line.credit ?? 0) || 0;
    if (debit === 0 && credit === 0) continue;

    const amountSigned = debit - credit;
    const direction = debit > 0 ? 'DEBIT' : 'CREDIT';

    await db.taxTransaction.upsert({
      where: { journalLineId: line.id },
      create: {
        tenantId,
        journalEntryId: journalEntry.id,
        journalLineId: line.id,
        taxTypeId,
        purpose,
        direction,
        amountSigned,
        postingDate: journalEntry.postingDate || journalEntry.entryDate || new Date(),
        sourceModule: journalEntry.sourceModule || null,
        sourceType: journalEntry.sourceType || null,
        sourceId: journalEntry.sourceId || null,
        isReversal: Boolean(isReversal || journalEntry.isReversal),
        reversedFromId,
        metadata: {
          journalNumber: journalEntry.journalNumber || null,
          taxCode: line.taxCode || null,
        },
      },
      update: {
        purpose,
        taxTypeId,
        direction,
        amountSigned,
        isReversal: Boolean(isReversal || journalEntry.isReversal),
      },
    });
    written += 1;
  }


  return { written, skipped: false };
}

export async function sumAccumulatedTax({
  tenantId,
  purpose = null,
  taxTypeId = null,
  startDate = null,
  endDate = null,
  db = prisma,
}) {
  if (!subledgerEnabled(db)) {
    return { available: false, total: 0 };
  }

  const where = {
    tenantId,
    ...(purpose ? { purpose } : {}),
    ...(taxTypeId ? { taxTypeId } : {}),
  };
  if (startDate || endDate) {
    where.postingDate = {};
    if (startDate) where.postingDate.gte = new Date(startDate);
    if (endDate) where.postingDate.lte = new Date(endDate);
  }

  const agg = await db.taxTransaction.aggregate({
    where,
    _sum: { amountSigned: true },
  });

  return {
    available: true,
    total: Number(agg._sum.amountSigned || 0),
  };
}
