/**
 * Sale line classification — Phase 11.
 */

export const SALE_LINE_CLASS = Object.freeze({
  PRODUCT: 'PRODUCT',
  PRODUCT_VARIANT: 'PRODUCT_VARIANT',
  SERVICE: 'SERVICE',
  BUNDLE: 'BUNDLE',
  COMPOSITE: 'COMPOSITE',
  DISCOUNT_LINE: 'DISCOUNT_LINE',
  ROUNDING_LINE: 'ROUNDING_LINE',
  TAX_LINE: 'TAX_LINE',
  LEVY_LINE: 'LEVY_LINE',
  SHIPPING_LINE: 'SHIPPING_LINE',
  OTHER_CHARGE: 'OTHER_CHARGE',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Classify a source sale line. Lines cannot be silently discarded.
 */
export function classifySaleLine(line = {}) {
  if (line.lineClass && SALE_LINE_CLASS[line.lineClass]) {
    return { class: line.lineClass, sellable: isSellable(line.lineClass) };
  }
  if (line.isDiscount || line.type === 'DISCOUNT') {
    return { class: SALE_LINE_CLASS.DISCOUNT_LINE, sellable: false };
  }
  if (line.isRounding || line.type === 'ROUNDING') {
    return { class: SALE_LINE_CLASS.ROUNDING_LINE, sellable: false };
  }
  if (line.isShipping || line.type === 'SHIPPING') {
    return { class: SALE_LINE_CLASS.SHIPPING_LINE, sellable: false };
  }
  if (line.isTaxLine || line.type === 'TAX') {
    return { class: SALE_LINE_CLASS.TAX_LINE, sellable: false };
  }
  if (line.isLevyLine || line.type === 'LEVY') {
    return { class: SALE_LINE_CLASS.LEVY_LINE, sellable: false };
  }
  if (line.isBundle || line.type === 'BUNDLE') {
    return { class: SALE_LINE_CLASS.BUNDLE, sellable: true };
  }
  if (line.localProductVariantId || line.variantId) {
    return { class: SALE_LINE_CLASS.PRODUCT_VARIANT, sellable: true };
  }
  if (line.isService || line.isCustomService || line.serviceId) {
    return { class: SALE_LINE_CLASS.SERVICE, sellable: true };
  }
  if (line.productId || line.localProductId || line.localItemId) {
    return { class: SALE_LINE_CLASS.PRODUCT, sellable: true };
  }
  if (line.isCustom && line.description) {
    return { class: SALE_LINE_CLASS.OTHER_CHARGE, sellable: true };
  }
  return { class: SALE_LINE_CLASS.UNKNOWN, sellable: false };
}

function isSellable(cls) {
  return [
    SALE_LINE_CLASS.PRODUCT,
    SALE_LINE_CLASS.PRODUCT_VARIANT,
    SALE_LINE_CLASS.SERVICE,
    SALE_LINE_CLASS.BUNDLE,
    SALE_LINE_CLASS.COMPOSITE,
    SALE_LINE_CLASS.OTHER_CHARGE,
    SALE_LINE_CLASS.SHIPPING_LINE,
  ].includes(cls);
}

export function classifyAllSaleLines(lines = []) {
  return (lines || []).map((line, index) => {
    const classified = classifySaleLine(line);
    return {
      index,
      sourceLineId: line.id || line.sourceLineId || `line-${index}`,
      ...classified,
      line,
    };
  });
}
