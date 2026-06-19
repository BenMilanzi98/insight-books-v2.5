/**
 * Per-tenant monotonic document sequence allocation (PO, GR, INV, QUO).
 * Uses optimistic concurrency on DocumentSequence.lastIssued.
 */

export const DOCUMENT_SEQUENCE_TYPES = ['PO', 'GR', 'INV', 'QUO', 'SALE'];

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

/** Max trailing sequence from SALE-YYYYMMDD-### (global per tenant, not per calendar day). */
async function maxSaleSeq(tx, tenantId) {
  const rows = await tx.sale.findMany({
    where: { tenantId },
    select: { saleNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  let max = 0;
  for (const r of rows) {
    const m = String(r.saleNumber || '').match(/^SALE-\d{8}-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  return max;
}

const SEEDERS = {
  PO: maxPoSeq,
  GR: maxGrSeq,
  INV: maxInvSeq,
  QUO: maxQuoSeq,
  SALE: maxSaleSeq,
};

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {'PO'|'GR'|'INV'|'QUO'|'SALE'} documentType
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

function isDocumentSequenceInfrastructureError(e) {
  if (!e || typeof e !== 'object') return false;
  if (e.code === 'P2021') return true;
  const msg = String(e.message || '');
  if (/DocumentSequence|document_sequence/i.test(msg)) return true;
  if (/relation\s+["']?DocumentSequence/i.test(msg)) return true;
  if (/documentsequence/i.test(msg) && /does not exist/i.test(msg)) return true;
  return false;
}

/**
 * When the DocumentSequence table is missing (migration not applied) or unavailable,
 * derive the next PO suffix from existing rows for this tenant only.
 */
async function legacyNextPoSeq(tx, tenantId) {
  const recent = await tx.purchaseOrder.findMany({
    where: { tenantId },
    select: { poNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  let maxSeq = 0;
  for (const r of recent) {
    const n = parseTrailingInt(r.poNumber);
    if (n > maxSeq) maxSeq = n;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const seq = maxSeq + 1 + attempt;
    const poNumber = formatPoNumber(seq);
    const dup = await tx.purchaseOrder.findFirst({ where: { tenantId, poNumber } });
    if (!dup) return seq;
  }
  throw new Error('Could not allocate PO number (legacy fallback)');
}

async function legacyNextGrSeq(tx, tenantId) {
  const recent = await tx.goodsReceipt.findMany({
    where: { tenantId },
    select: { receiptNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });
  let maxSeq = 0;
  for (const r of recent) {
    const m = String(r.receiptNumber || '').match(/GR-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const seq = maxSeq + 1 + attempt;
    const receiptNumber = formatGrNumber(seq);
    const dup = await tx.goodsReceipt.findFirst({ where: { tenantId, receiptNumber } });
    if (!dup) return seq;
  }
  throw new Error('Could not allocate receipt number (legacy fallback)');
}

/**
 * Prefer DocumentSequence; if the table/model is missing, use per-tenant scan (PO only).
 */
function shouldFallbackToLegacySequence(e) {
  if (isDocumentSequenceInfrastructureError(e)) return true;
  // Old Prisma client / build without DocumentSequence: tx.documentSequence is undefined
  if (e instanceof TypeError) {
    const m = String(e.message || '');
    if (!/undefined/i.test(m)) return false;
    return /\bfindUnique\b|\bcreate\b|\bupdateMany\b/.test(m);
  }
  return false;
}

export async function allocateNextPONumberReliable(tx, tenantId) {
  if (!tenantId) {
    throw new Error('tenantId is required for PO allocation');
  }
  try {
    return await allocateNextDocumentNumber(tx, tenantId, 'PO');
  } catch (e) {
    if (!shouldFallbackToLegacySequence(e)) throw e;
    console.warn(
      '[documentSequences] PO: DocumentSequence path failed; using legacy per-tenant numbering.',
      e?.code || e?.name || '',
      e?.message || e
    );
    return legacyNextPoSeq(tx, tenantId);
  }
}

export async function allocateNextGRNumberReliable(tx, tenantId) {
  if (!tenantId) {
    throw new Error('tenantId is required for GR allocation');
  }
  try {
    return await allocateNextDocumentNumber(tx, tenantId, 'GR');
  } catch (e) {
    if (!shouldFallbackToLegacySequence(e)) throw e;
    console.warn(
      '[documentSequences] GR: DocumentSequence path failed; using legacy per-tenant numbering.',
      e?.code || e?.name || '',
      e?.message || e
    );
    return legacyNextGrSeq(tx, tenantId);
  }
}

async function legacyNextSaleSeq(tx, tenantId) {
  const recent = await tx.sale.findMany({
    where: { tenantId },
    select: { saleNumber: true },
    orderBy: { createdAt: 'desc' },
    take: 8000,
  });
  let maxSeq = 0;
  for (const r of recent) {
    const m = String(r.saleNumber || '').match(/^SALE-\d{8}-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return maxSeq + 1;
}

/**
 * Next monotonic POS sale suffix for the tenant (never resets by calendar day).
 * Full display number: SALE-YYYYMMDD-### with date from the sale’s business date.
 */
export async function allocateNextSaleNumberReliable(tx, tenantId) {
  if (!tenantId) {
    throw new Error('tenantId is required for SALE allocation');
  }
  try {
    return await allocateNextDocumentNumber(tx, tenantId, 'SALE');
  } catch (e) {
    if (!shouldFallbackToLegacySequence(e)) throw e;
    console.warn(
      '[documentSequences] SALE: DocumentSequence path failed; using legacy scan.',
      e?.code || e?.name || '',
      e?.message || e
    );
    return legacyNextSaleSeq(tx, tenantId);
  }
}

async function legacyNextInvSeq(tx, tenantId) {
  return maxInvSeq(tx, tenantId);
}

async function legacyNextQuoSeq(tx, tenantId) {
  return maxQuoSeq(tx, tenantId);
}

/**
 * Invoice number allocation with legacy fallback when DocumentSequence is unavailable.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {{ prefix?: string, issueDate?: Date|string }} [opts]
 */
export async function allocateNextInvNumberReliable(tx, tenantId, opts = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required for INV allocation');
  }
  const prefix = opts.prefix || 'INV';
  const issueDate = opts.issueDate ? (opts.issueDate instanceof Date ? opts.issueDate : new Date(opts.issueDate)) : new Date();

  try {
    return await allocateNextDocumentNumber(tx, tenantId, 'INV');
  } catch (e) {
    if (!shouldFallbackToLegacySequence(e)) throw e;
    console.warn(
      '[documentSequences] INV: DocumentSequence path failed; using legacy per-tenant numbering.',
      e?.code || e?.name || '',
      e?.message || e
    );
    const base = await legacyNextInvSeq(tx, tenantId);
    for (let attempt = 0; attempt < 40; attempt++) {
      const seq = base + 1 + attempt;
      const invoiceNumber = formatDatedDocumentNumber(prefix, issueDate, seq);
      const dup = await tx.invoice.findFirst({ where: { tenantId, invoiceNumber } });
      if (!dup) return seq;
    }
    throw new Error('Could not allocate invoice number (legacy fallback)');
  }
}

/**
 * Quotation number allocation with legacy fallback when DocumentSequence is unavailable.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {{ prefix?: string, issueDate?: Date|string }} [opts]
 */
export async function allocateNextQuoNumberReliable(tx, tenantId, opts = {}) {
  if (!tenantId) {
    throw new Error('tenantId is required for QUO allocation');
  }
  const prefix = opts.prefix || 'QUO';
  const issueDate = opts.issueDate ? (opts.issueDate instanceof Date ? opts.issueDate : new Date(opts.issueDate)) : new Date();

  try {
    return await allocateNextDocumentNumber(tx, tenantId, 'QUO');
  } catch (e) {
    if (!shouldFallbackToLegacySequence(e)) throw e;
    console.warn(
      '[documentSequences] QUO: DocumentSequence path failed; using legacy per-tenant numbering.',
      e?.code || e?.name || '',
      e?.message || e
    );
    const base = await legacyNextQuoSeq(tx, tenantId);
    for (let attempt = 0; attempt < 40; attempt++) {
      const seq = base + 1 + attempt;
      const quotationNumber = formatDatedDocumentNumber(prefix, issueDate, seq);
      const dup = await tx.quotation.findFirst({ where: { tenantId, quotationNumber } });
      if (!dup) return seq;
    }
    throw new Error('Could not allocate quotation number (legacy fallback)');
  }
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
