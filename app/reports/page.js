/**
 * R3-C — legacy `/reports` hub retired. All financial reporting uses `/reports-v2`
 * (Accounting V2 JE-only engine).
 */
import { redirect } from 'next/navigation';
import { buildReportsV2PathFromLegacyQuery } from '@/lib/accountingV2/reporting/legacyReportRedirectMap';

export default async function ReportsLegacyRedirectPage({ searchParams }) {
  const params = await searchParams;
  redirect(buildReportsV2PathFromLegacyQuery(params));
}
