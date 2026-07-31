/**
 * Tenant / env policy for outbound rental booking side-effects.
 */

/**
 * @param {{ rentalPostInvoiceOnBook?: boolean|null }|null} settings
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldPostInvoiceOnBook(settings, env = process.env) {
  if (env.RENTAL_POST_INVOICE_ON_BOOK === 'false') return false;
  if (env.RENTAL_POST_INVOICE_ON_BOOK === 'true') return true;
  if (settings && typeof settings.rentalPostInvoiceOnBook === 'boolean') {
    return settings.rentalPostInvoiceOnBook;
  }
  // Backward-compatible default when settings row lacks the column/value
  return true;
}

/**
 * @param {{ rentalAutoCompleteExpired?: boolean|null }|null} settings
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldAutoCompleteExpiredRentals(settings, env = process.env) {
  if (env.RENTAL_AUTO_COMPLETE_EXPIRED === 'true') return true;
  if (env.RENTAL_AUTO_COMPLETE_EXPIRED === 'false') return false;
  if (settings && typeof settings.rentalAutoCompleteExpired === 'boolean') {
    return settings.rentalAutoCompleteExpired;
  }
  return false;
}

/**
 * When false, legacy POST /api/rentals create is refused (Contracts V2 only).
 * @param {{ rentalLegacyBookingEnabled?: boolean|null }|null} settings
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isLegacyRentalBookingEnabled(settings, env = process.env) {
  if (env.RENTAL_LEGACY_BOOKING_ENABLED === 'false') return false;
  if (env.RENTAL_LEGACY_BOOKING_ENABLED === 'true') return true;
  if (settings && typeof settings.rentalLegacyBookingEnabled === 'boolean') {
    return settings.rentalLegacyBookingEnabled;
  }
  return true;
}
