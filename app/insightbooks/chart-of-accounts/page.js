import { redirect } from 'next/navigation';

/**
 * System Chart of Accounts was removed from the System Administration control plane.
 * APIs under /api/admin/system-coa* are retained for ops/seeding.
 * Tenant Chart of Accounts remains at /chart-of-accounts.
 */
export default function RemovedSystemChartOfAccountsPage() {
  redirect('/insightbooks/dashboard?notice=coa-removed');
}
