/**
 * Pure source checksum + mutation classification — Phase 12 (no Prisma).
 */
import crypto from 'crypto';

export const SOURCE_CHECKSUM_VERSION = 'phase12-source-checksum-v1';
export const MUTATION_CLASS = Object.freeze({
  UNCHANGED: 'UNCHANGED',
  NON_MATERIAL_CHANGE: 'NON_MATERIAL_CHANGE',
  MATERIAL_CHANGE: 'MATERIAL_CHANGE',
  SOURCE_DELETED: 'SOURCE_DELETED',
  SOURCE_REOPENED: 'SOURCE_REOPENED',
  ACCOUNTING_CHANGED: 'ACCOUNTING_CHANGED',
  INVENTORY_CHANGED: 'INVENTORY_CHANGED',
  AMBIGUOUS: 'AMBIGUOUS',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

function checksum(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

export function computeSourceChecksumFromLoaded({
  sourceType,
  source,
  lines = [],
  payments = [],
  bridge,
}) {
  const header = {
    sourceType,
    sourceId: source.id,
    sourceTransactionNumber: source.saleNumber || source.invoiceNumber || null,
    businessId: bridge.businessId,
    branchId: source.branchId || bridge.branchId || null,
    customerId: source.clientId || null,
    currency: bridge.currency || 'MWK',
    transactionDate: (source.saleDate || source.issueDate || source.createdAt)?.toISOString?.() || null,
    finalizedAt: bridge.sourceFinalizedAt?.toISOString?.() || null,
    totals: {
      subtotal: String(source.subtotal ?? ''),
      tax: String(source.totalTaxAmount ?? source.taxAmount ?? ''),
      discount: String(source.totalDiscountAmount ?? source.discount ?? ''),
      total: String(source.total ?? ''),
    },
    paymentClassification: source.paymentMethod || null,
  };

  const lineEvidence = (lines || []).map((l, idx) => ({
    lineIdentity: l.id || `idx-${idx}`,
    itemType: l.isService ? 'SERVICE' : 'PRODUCT',
    productId: l.productId || null,
    quantity: String(l.quantity ?? ''),
    unitPrice: String(l.unitPrice ?? ''),
    discount: String(l.discountAmount ?? ''),
    tax: String(l.taxAmount ?? ''),
    lineTotal: String(l.amount ?? l.lineTotal ?? ''),
    order: idx,
  }));

  const paymentEvidence = (payments || []).map((p, idx) => ({
    id: p.id || `pay-${idx}`,
    method: p.paymentMethod || p.method || null,
    amount: String(p.amount ?? ''),
  }));

  const payload = {
    checksumVersion: SOURCE_CHECKSUM_VERSION,
    header,
    lines: lineEvidence,
    payments: paymentEvidence,
  };
  return { payload, sourceChecksum: checksum(payload), checksumVersion: SOURCE_CHECKSUM_VERSION };
}

export function classifySourceMutation({
  bridgeChecksum,
  currentChecksum,
  identityMatches,
  sourceStatus,
}) {
  if (!identityMatches) return MUTATION_CLASS.MATERIAL_CHANGE;
  if (bridgeChecksum && currentChecksum && bridgeChecksum !== currentChecksum) {
    return MUTATION_CLASS.MATERIAL_CHANGE;
  }
  const status = String(sourceStatus || '').toUpperCase();
  if (['DRAFT', 'VOID', 'VOIDED', 'CANCELLED', 'REOPENED'].includes(status)) {
    return MUTATION_CLASS.SOURCE_REOPENED;
  }
  return MUTATION_CLASS.UNCHANGED;
}
