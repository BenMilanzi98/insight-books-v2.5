/**
 * Per-tenant monotonic document sequence allocation (PO, GR, INV, QUO).
 * Uses optimistic concurrency on DocumentSequence.lastIssued.
 */

export const DOCUMENT_SEQUENCE_TYPES = ['PO', 'GR', 'INV', 'QUO'];

const MAX_ALLOC_ATTEMPTS = 20;

function parseTrailingInt(s) {
  const m = String(s || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function maxPoSeq(tx, tenantId) {
  const rows = await tx.purchaseOrder.findMany({
    where: { tenantId },
    select: { poNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  let max = 0;
  for (const r of rows) max = Math.max(max, parseTrailingInt(r.poNumber));
  return max;
}

async function maxGrSeq(tx, tenantId) {
  const rows = await tx.goodsReceipt.findMany({
    where: { tenantId },
    select: { receiptNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  let max = 0;
  for (const r of rows) {
    const m = String(r.receiptNumber || '').match(/GR-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function maxSeqFromInvoiceRows(rows) {
  let max = 0;
  for (const r of rows) {
    const parts = String(r.invoiceNumber || '').split('-');
    if (parts.length < 2) continue;
    const lastPart = parts[parts.length - 1];
    const n = parseInt(lastPart, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max;
}

async function maxInvSeq(tx, tenantId) {
  const rows = await tx.invoice.findMany({
    where: { tenantId },
    select: { invoiceNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  return maxSeqFromInvoiceRows(rows);
}

function maxSeqFromQuotationRows(rows) {
  let max = 0;
  for (const r of rows) {
    const parts = String(r.quotationNumber || '').split('-');
    if (parts.length >= 3) {
      const n = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    } else if (parts.length === 2) {
      const n = parseInt(parts[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max;
}

async function maxQuoSeq(tx, tenantId) {
  const rows = await tx.quotation.findMany({
    where: { tenantId },
    select: { quotationNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  return maxSeqFromQuotationRows(rows);
}

const SEEDERS = {
  PO: maxPoSeq,
  GR: maxGrSeq,
  INV: maxInvSeq,
  QUO: maxQuoSeq,
};

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {'PO'|'GR'|'INV'|'QUO'} documentType
 * @returns {Promise<number>} Next sequence integer (1-based)
 */
export async function allocateNextDocumentNumber(tx, tenantId, documentType) {
  if (!DOCUMENT_SEQUENCE_TYPES.includes(documentType)) {
    throw new Error(`Invalid document type: ${documentType}`);
  }
  const seed = SEEDERS[documentType];

  for (let i = 0; i < MAX_ALLOC_ATTEMPTS; i++) {
    const row = await tx.documentSequence.findUnique({
      where: { tenantId_documentType: { tenantId, documentType } },
    });

    if (!row) {
      const base = await seed(tx, tenantId);
      try {
        await tx.documentSequence.create({
          data: { tenantId, documentType, lastIssued: base + 1 },
        });
        return base + 1;
      } catch (e) {
        if (e.code === 'P2002') continue;
        throw e;
      }
    } else {
      const next = row.lastIssued + 1;
      const res = await tx.documentSequence.updateMany({
        where: { id: row.id, lastIssued: row.lastIssued },
        data: { lastIssued: next },
      });
      if (res.count === 1) return next;
    }
  }

  throw new Error('Could not allocate document number');
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 * @param {string[]} types Subset of DOCUMENT_SEQUENCE_TYPES
 * @param {number} [lastIssued=0] Next issued number will be lastIssued + 1
 */
export async function resetDocumentSequences(db, tenantId, types, lastIssued = 0) {
  const valid = types.filter((t) => DOCUMENT_SEQUENCE_TYPES.includes(t));
  for (const documentType of valid) {
    await db.documentSequence.upsert({
      where: { tenantId_documentType: { tenantId, documentType } },
      create: { tenantId, documentType, lastIssued },
      update: { lastIssued },
    });
  }
}

export function formatPoNumber(seq) {
  return `PO-${String(seq).padStart(5, '0')}`;
}

export function formatGrNumber(seq) {
  return `GR-${String(seq).padStart(5, '0')}`;
}

/** DDMMYYYY + 5-digit suffix, matching existing invoice/quotation display format */
export function formatDatedDocumentNumber(prefix, date, seq) {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateStr = `${day}${month}${year}`;
  return `${prefix}-${dateStr}-${String(seq).padStart(5, '0')}`;
}
