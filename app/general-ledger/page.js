/**
 * Phase 4 — legacy `/general-ledger` retired. Canonical GL is `/general-ledger-v2`.
 */
import { redirect } from 'next/navigation';

export default async function GeneralLedgerLegacyRedirectPage({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item != null) qs.append(key, String(item));
        }
      } else {
        qs.set(key, String(value));
      }
    }
  }
  const query = qs.toString();
  redirect(query ? `/general-ledger-v2?${query}` : '/general-ledger-v2');
}
