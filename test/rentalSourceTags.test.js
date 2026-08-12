import { describe, expect, it } from 'vitest';
import {
  OUTBOUND_INVOICE_SOURCE,
  formatRentalTraceNote,
  resolveOutboundInvoiceSource,
  RENTAL_TRACE_EVENT,
} from '../lib/rentalSourceTags.js';

describe('rentalSourceTags', () => {
  it('maps space rental kind to RENTAL_SPACE', () => {
    expect(resolveOutboundInvoiceSource('rental')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
    expect(resolveOutboundInvoiceSource('space')).toBe(OUTBOUND_INVOICE_SOURCE.RENTAL_SPACE);
  });

  it('maps quantity pool / hiring kind to CUSTOMER_HIRE', () => {
    expect(resolveOutboundInvoiceSource('hiring')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
    expect(resolveOutboundInvoiceSource('quantity_pool')).toBe(OUTBOUND_INVOICE_SOURCE.CUSTOMER_HIRE);
  });

  it('returns null for unknown / inbound kinds', () => {
    expect(resolveOutboundInvoiceSource('supplier_hire')).toBeNull();
    expect(resolveOutboundInvoiceSource(null)).toBeNull();
  });

  it('exports stable trace event constants', () => {
    expect(RENTAL_TRACE_EVENT.REVERSAL).toBe('REVERSAL');
    expect(RENTAL_TRACE_EVENT.DAMAGE).toBe('DAMAGE');
    expect(RENTAL_TRACE_EVENT.REPAIR).toBe('REPAIR');
    expect(RENTAL_TRACE_EVENT.SUPPLIER_HIRE_SPEND).toBe('SUPPLIER_HIRE_SPEND');
  });

  it('formats repair and damage notes for report scraping', () => {
    expect(formatRentalTraceNote({ event: 'REPAIR', rentalTransactionId: 'rt-1' })).toContain(
      'source=REPAIR'
    );
    expect(formatRentalTraceNote({ event: 'DAMAGE', rentalTransactionId: 'rt-1' })).toContain(
      'source=DAMAGE'
    );
  });

  it('tags customer-hire damage and repair rows with their source', () => {
    expect(
      formatRentalTraceNote({
        event: 'DAMAGE',
        rentalTransactionId: 'rt-1',
        rentalKind: 'hiring',
      })
    ).toContain('rentalSource=CUSTOMER_HIRE');
  });
});
