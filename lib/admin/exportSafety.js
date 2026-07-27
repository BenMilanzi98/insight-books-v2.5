/**
 * Spreadsheet export safety — prevent CSV/Excel formula injection.
 */

/**
 * Prefix a leading formula trigger character with a single quote.
 * @param {unknown} cell
 * @returns {string}
 */
export function preventFormulaInjection(cell) {
  if (cell == null) return '';
  const s = String(cell);
  if (/^[=+\-@]/.test(s)) {
    return `'${s}`;
  }
  return s;
}
