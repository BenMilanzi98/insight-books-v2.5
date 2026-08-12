import { normalizeOutboundRentalKind, OUTBOUND_RENTAL_KIND } from '@/lib/rentalKinds';

export const OUTBOUND_INVOICE_SOURCE = Object.freeze({
  RENTAL_SPACE: 'RENTAL_SPACE',
  CUSTOMER_HIRE: 'CUSTOMER_HIRE',
});

export const RENTAL_TRACE_EVENT = Object.freeze({
  REVENUE: 'REVENUE',
  TAX: 'TAX',
  REVERSAL: 'REVERSAL',
  DAMAGE: 'DAMAGE',
  DAMAGE_LOSS: 'DAMAGE_LOSS',
  REPAIR: 'REPAIR',
  SUPPLIER_HIRE_SPEND: 'SUPPLIER_HIRE_SPEND',
  UTILIZATION: 'UTILIZATION',
});

export function formatRentalTraceNote({ event, rentalTransactionId, rentalAssetId, rentalKind }) {
  const rentalSource = resolveOutboundInvoiceSource(rentalKind);
  return [
    `source=${event}`,
    rentalTransactionId ? `rentalTransactionId=${rentalTransactionId}` : null,
    rentalAssetId ? `rentalAssetId=${rentalAssetId}` : null,
    rentalSource ? `rentalSource=${rentalSource}` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export function resolveOutboundInvoiceSource(kind) {
  const normalized = normalizeOutboundRentalKind(kind);
  if (normalized === OUTBOUND_RENTAL_KIND.RENTAL) return OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE;
  if (normalized === OUTBOUND_RENTAL_KIND.QUANTITY_POOL) return OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE;
  return null;
}
