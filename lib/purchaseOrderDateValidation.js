export function dateOnlyUTCString(d) {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.toISOString().slice(0, 10);
}

/**
 * @throws {Error} if expected delivery is strictly before PO date (calendar day, UTC)
 */
export function assertExpectedDeliveryOnOrAfterPoDate(poDate, expectedDeliveryDate) {
  if (expectedDeliveryDate == null || expectedDeliveryDate === '') return;
  const po = dateOnlyUTCString(poDate);
  const exp = dateOnlyUTCString(expectedDeliveryDate);
  if (!po || !exp) return;
  if (exp < po) {
    throw new Error('Expected delivery date must be on or after the order date.');
  }
}
