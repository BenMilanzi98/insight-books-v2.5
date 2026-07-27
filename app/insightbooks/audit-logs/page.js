import { redirect } from 'next/navigation';

/**
 * Legacy stub route. Canonical audit UI is /insightbooks/audit.
 */
export default function AdminAuditLogsRedirectPage() {
  redirect('/insightbooks/audit');
}
