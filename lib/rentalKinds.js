/**
 * Outbound rental modes stored on RentalAsset / RentalTransaction.kind.
 * "hiring" is a legacy DB value for quantity pools — NOT inbound supplier hire.
 */

export const OUTBOUND_RENTAL_KIND = Object.freeze({
  RENTAL: 'rental',
  /** Legacy name — quantity pool outbound rental to a Customer */
  QUANTITY_POOL: 'hiring',
});

/** Normalize API/UI aliases to persisted kind */
export function normalizeOutboundRentalKind(kind) {
  const k = String(kind || '').toLowerCase().trim();
  if (k === 'rental' || k === 'serialised' || k === 'serialized' || k === 'space') {
    return OUTBOUND_RENTAL_KIND.RENTAL;
  }
  if (
    k === 'hiring' ||
    k === 'quantity' ||
    k === 'quantity_pool' ||
    k === 'pool' ||
    k === 'equipment_pool'
  ) {
    return OUTBOUND_RENTAL_KIND.QUANTITY_POOL;
  }
  return null;
}

export function isQuantityPoolKind(kind) {
  return normalizeOutboundRentalKind(kind) === OUTBOUND_RENTAL_KIND.QUANTITY_POOL;
}

export function outboundKindLabel(kind) {
  return isQuantityPoolKind(kind) ? 'Quantity rental' : 'Rental';
}
