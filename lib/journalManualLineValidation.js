/**
 * Manual journal rules: prevent duplicate GL lines on inventory accounts per entry.
 */

function accountDisplayName(account) {
  return (
    (account.accountName || account.name || '') +
    ' ' +
    (account.accountCode || account.code || '')
  ).toLowerCase();
}

/**
 * True when the account is treated as inventory / stock on hand for journal validation.
 */
export function isInventoryLedgerAccount(account) {
  if (!account) return false;
  const type = (account.accountType || account.type || '').toLowerCase();
  if (type !== 'asset') return false;

  const code = (account.accountCode || account.code || '').trim();
  const digits = code.replace(/\D/g, '');
  if (digits.startsWith('13')) return true;

  const blob = accountDisplayName(account);
  if (blob.includes('inventory')) return true;
  if (blob.includes('stock on hand')) return true;
  if (blob.includes('merchandise')) return true;

  const subtype = (account.accountSubtype || '').toLowerCase();
  if (subtype.includes('inventory')) return true;

  return false;
}

/**
 * @param {Array<{ accountId: string }>} lines
 * @param {Array<object>} accounts - prisma Account rows for line accountIds
 * @returns {{ ok: true } | { ok: false, error: string, details?: string }}
 */
export function validateNoDuplicateInventoryLines(lines, accounts) {
  const byId = Object.fromEntries((accounts || []).map((a) => [a.id, a]));
  const seen = new Map();

  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].accountId;
    const acc = byId[id];
    if (!acc || !isInventoryLedgerAccount(acc)) continue;

    const prev = seen.get(id);
    if (prev != null) {
      const label = acc.accountName || acc.name || acc.accountCode || acc.code || id;
      return {
        ok: false,
        error:
          'Each inventory account may appear only once per journal entry. Combine amounts into a single line or use separate inventory accounts.',
        details: `Duplicate lines for account: ${label}`,
      };
    }
    seen.set(id, i);
  }

  return { ok: true };
}
