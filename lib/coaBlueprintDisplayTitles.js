import { CHART_OF_ACCOUNTS_BLUEPRINT } from '@/lib/chartOfAccountsBlueprint.js';

/** @param {string} code */
export function blueprintRowForCode(code) {
  const c = String(code ?? '').trim();
  return CHART_OF_ACCOUNTS_BLUEPRINT.find((b) => String(b.code).trim() === c) || null;
}

/** @param {string} code */
export function blueprintCatalogTitleForCode(code) {
  return blueprintRowForCode(code)?.name?.trim() || null;
}

/**
 * For chart API responses: if this GL code is defined in the shipped catalog (and is not a reclassification catch-all),
 * use the catalog title so list/detail views never show an absurd code ↔ title pairing from duplicate merges or bad renames.
 *
 * @param {Record<string, unknown>} account
 */
export function alignAccountDisplayTitleToBlueprint(account) {
  if (!account || typeof account !== 'object') return account;
  const c = String(account.accountCode || account.code || '').trim();
  const bp = blueprintRowForCode(c);
  if (!bp?.name || bp.requiresReclassification) return account;
  const title = String(bp.name).trim();
  const cur = String(account.accountName || account.name || '').trim();
  if (!cur || cur.toLowerCase() === title.toLowerCase()) return account;
  return { ...account, accountName: title, name: title };
}

/** @param {Array<Record<string, unknown>>} accounts */
export function alignChartAccountsListToBlueprint(accounts) {
  if (!Array.isArray(accounts)) return accounts;
  return accounts.map((a) => alignAccountDisplayTitleToBlueprint(a));
}
