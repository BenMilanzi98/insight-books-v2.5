/**
 * Maps tenant-specific account codes to a harmonized group code for consolidation.
 * Built from official blueprint migration tables + inter-company account markers.
 */
import {
  COMPREHENSIVE_TEMPLATE_TO_BLUEPRINT,
  DUPLICATE_SEMANTIC_MERGE,
  LEGACY_TO_OFFICIAL,
} from '@/lib/coaComprehensiveTemplateMap';

/** @type {Map<string, string>} */
let aliasToGroup = null;

function buildAliasMap() {
  if (aliasToGroup) return aliasToGroup;
  aliasToGroup = new Map();

  for (const row of COMPREHENSIVE_TEMPLATE_TO_BLUEPRINT) {
    if (row.templateCode && row.targetCode) {
      aliasToGroup.set(String(row.templateCode).trim(), String(row.targetCode).trim());
    }
  }
  for (const row of DUPLICATE_SEMANTIC_MERGE) {
    aliasToGroup.set(String(row.fromCode).trim(), String(row.toCode).trim());
  }
  for (const row of LEGACY_TO_OFFICIAL) {
    aliasToGroup.set(String(row.fromCode).trim(), String(row.toCode).trim());
  }

  return aliasToGroup;
}

/**
 * Resolve a tenant account code to the harmonized group code used in consolidation.
 * Follows alias chains (e.g. 5017 → 5018 → …).
 * @param {string|null|undefined} accountCode
 * @returns {string}
 */
export function resolveHarmonizedAccountCode(accountCode) {
  const map = buildAliasMap();
  let code = String(accountCode ?? '').trim();
  if (!code) return 'UNKNOWN';

  const seen = new Set();
  while (map.has(code) && !seen.has(code)) {
    seen.add(code);
    code = map.get(code);
  }
  return code;
}

/** Account codes commonly used for inter-company receivables (due from related entities). */
export const INTERCOMPANY_RECEIVABLE_CODE_PREFIXES = ['124', '125', '126'];

/** Account codes commonly used for inter-company payables (due to related entities). */
export const INTERCOMPANY_PAYABLE_CODE_PREFIXES = ['212', '213', '2148', '2149'];

const IC_NAME_PATTERNS = [
  /inter[\s-]?comp/i,
  /due from related/i,
  /due to related/i,
  /related part/i,
  /intercompany/i,
  /inter-company/i,
];

/**
 * @param {{ accountCode?: string, code?: string, accountName?: string, name?: string }} row
 * @returns {'receivable'|'payable'|null}
 */
export function classifyIntercompanyAccount(row) {
  const code = String(row?.accountCode || row?.code || '').trim();
  const name = String(row?.accountName || row?.name || '').trim();
  const type = String(row?.accountType || row?.type || '').toLowerCase();

  const nameMatch = IC_NAME_PATTERNS.some((re) => re.test(name));
  const recvPrefix = INTERCOMPANY_RECEIVABLE_CODE_PREFIXES.some((p) => code.startsWith(p));
  const payPrefix = INTERCOMPANY_PAYABLE_CODE_PREFIXES.some((p) => code.startsWith(p));

  if (nameMatch || recvPrefix) {
    if (type.includes('liabil')) return 'payable';
    return 'receivable';
  }
  if (payPrefix || (nameMatch && type.includes('liabil'))) {
    return 'payable';
  }
  return null;
}
