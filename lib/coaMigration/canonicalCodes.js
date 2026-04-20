import { CHART_OF_ACCOUNTS_BLUEPRINT } from '../chartOfAccountsBlueprint.js';

/** @type {Set<string>} */
let _canonicalCodes;

export function getCanonicalAccountCodes() {
  if (!_canonicalCodes) {
    _canonicalCodes = new Set(CHART_OF_ACCOUNTS_BLUEPRINT.map((r) => r.code));
  }
  return _canonicalCodes;
}

export function isCanonicalCode(code) {
  if (code == null) return false;
  return getCanonicalAccountCodes().has(String(code).trim());
}

/**
 * Codes allowed by the structure file **plus** operational children:
 * - **1130-xx** — payment / bank lines under Bank - Primary (1130)
 * - **3101–3199** — capital contribution subs under Owner's Capital (3100)
 */
export function isStructureExtensionCode(code) {
  const c = String(code ?? '').trim();
  if (/^1130-\d{2}$/.test(c)) return true;
  if (/^\d{4}$/.test(c)) {
    const n = parseInt(c, 10);
    if (n >= 3101 && n <= 3199) return true;
  }
  return false;
}
