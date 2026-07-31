/** Thermal receipt roll widths supported by POS print (mm). */
export const RECEIPT_PAPER_WIDTH_MIN_MM = 58;
export const RECEIPT_PAPER_WIDTH_MAX_MM = 90;
export const RECEIPT_PAPER_WIDTH_DEFAULT_MM = 80;

/** Common thermal roll sizes offered in settings UIs. */
export const RECEIPT_PAPER_WIDTH_PRESETS_MM = Object.freeze([
  58, 70, 72, 76, 80, 88, 90,
]);

/**
 * Normalize a paper width to an integer mm in [58, 90].
 * Invalid / missing values fall back to {@link RECEIPT_PAPER_WIDTH_DEFAULT_MM}.
 * @param {unknown} value
 * @param {number} [fallback=RECEIPT_PAPER_WIDTH_DEFAULT_MM]
 * @returns {number}
 */
export function normalizeReceiptPaperWidthMm(
  value,
  fallback = RECEIPT_PAPER_WIDTH_DEFAULT_MM
) {
  const base = Number.isFinite(Number(fallback))
    ? Math.min(
        RECEIPT_PAPER_WIDTH_MAX_MM,
        Math.max(RECEIPT_PAPER_WIDTH_MIN_MM, Math.round(Number(fallback)))
      )
    : RECEIPT_PAPER_WIDTH_DEFAULT_MM;

  if (value === undefined || value === null || value === '') {
    return base;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return base;
  return Math.min(
    RECEIPT_PAPER_WIDTH_MAX_MM,
    Math.max(RECEIPT_PAPER_WIDTH_MIN_MM, Math.round(n))
  );
}

/**
 * CSS viewport width in px at 96 dpi for the given roll width.
 * @param {unknown} mm
 * @returns {number}
 */
export function receiptViewportWidthPx(mm) {
  const widthMm = normalizeReceiptPaperWidthMm(mm);
  return Math.max(200, Math.round((widthMm * 96) / 25.4));
}

/**
 * Slightly tighter type on narrow rolls so labels and amounts fit.
 * @param {unknown} mm
 * @returns {{ bodyPx: number, headerPx: number, grandPx: number, logoPx: number, labelMinPx: number, totalLabelMinPx: number }}
 */
export function receiptTypographyForWidth(mm) {
  const widthMm = normalizeReceiptPaperWidthMm(mm);
  if (widthMm <= 58) {
    return {
      bodyPx: 10,
      headerPx: 13,
      grandPx: 12,
      logoPx: 44,
      labelMinPx: 62,
      totalLabelMinPx: 72,
    };
  }
  if (widthMm <= 72) {
    return {
      bodyPx: 11,
      headerPx: 14,
      grandPx: 13,
      logoPx: 50,
      labelMinPx: 72,
      totalLabelMinPx: 84,
    };
  }
  return {
    bodyPx: 12,
    headerPx: 16,
    grandPx: 14,
    logoPx: 56,
    labelMinPx: 80,
    totalLabelMinPx: 95,
  };
}
