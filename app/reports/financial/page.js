/**
 * R3-C — legacy financial overview redirected to canonical V2 reports.
 */
import { redirect } from 'next/navigation';

export default function ReportsFinancialRedirectPage() {
  redirect('/reports-v2');
}
