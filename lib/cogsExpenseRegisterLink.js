/**
 * Resolve sale/invoice id from COGS journal source keys.
 * V2 posts use sourceType Sale-COGS / Invoice-COGS (not bare Sale).
 */

export function resolveCogsLinkedSaleId(sourceType, sourceId) {
  if (!sourceId) return null;
  const type = String(sourceType || '');
  const id = String(sourceId);
  if (type === 'Sale-COGS' || type === 'Sale') {
    return id.replace(/-revenue$/i, '');
  }
  if (type === 'Invoice-COGS' || type === 'Invoice') {
    return id;
  }
  return null;
}

export function isCogsDocumentSourceType(sourceType) {
  const type = String(sourceType || '');
  return (
    type === 'Sale-COGS' ||
    type === 'Invoice-COGS' ||
    type === 'Sale' ||
    type === 'Invoice'
  );
}

/** Prefer one row per document when legacy Transaction + V2 journal both exist. */
export function cogsRegisterDedupeKey(row) {
  if (row.linkedSaleId) return `doc:${row.linkedSaleId}`;
  if (row.sourceType && row.sourceId) return `${row.sourceType}:${row.sourceId}`;
  return row.id;
}
