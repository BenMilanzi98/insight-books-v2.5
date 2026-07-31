import { describe, expect, it } from 'vitest';
import {
  shouldPostInvoiceOnBook,
  shouldAutoCompleteExpiredRentals,
  isLegacyRentalBookingEnabled,
} from '../lib/rentalBookingPolicy.js';

describe('rentalBookingPolicy', () => {
  it('defaults post-invoice-on-book to true when unset', () => {
    expect(shouldPostInvoiceOnBook(null, {})).toBe(true);
    expect(shouldPostInvoiceOnBook({}, {})).toBe(true);
  });

  it('respects tenant setting', () => {
    expect(shouldPostInvoiceOnBook({ rentalPostInvoiceOnBook: false }, {})).toBe(false);
    expect(shouldPostInvoiceOnBook({ rentalPostInvoiceOnBook: true }, {})).toBe(true);
  });

  it('env overrides tenant for post invoice', () => {
    expect(
      shouldPostInvoiceOnBook({ rentalPostInvoiceOnBook: true }, { RENTAL_POST_INVOICE_ON_BOOK: 'false' })
    ).toBe(false);
  });

  it('defaults auto-complete expired to false (safe)', () => {
    expect(shouldAutoCompleteExpiredRentals(null, {})).toBe(false);
    expect(shouldAutoCompleteExpiredRentals({}, {})).toBe(false);
  });

  it('allows explicit auto-complete when enabled', () => {
    expect(shouldAutoCompleteExpiredRentals({ rentalAutoCompleteExpired: true }, {})).toBe(true);
  });

  it('defaults legacy booking enabled', () => {
    expect(isLegacyRentalBookingEnabled(null, {})).toBe(true);
    expect(isLegacyRentalBookingEnabled({ rentalLegacyBookingEnabled: false }, {})).toBe(false);
  });

  it('env disables legacy booking', () => {
    expect(
      isLegacyRentalBookingEnabled({ rentalLegacyBookingEnabled: true }, {
        RENTAL_LEGACY_BOOKING_ENABLED: 'false',
      })
    ).toBe(false);
  });
});
