import { redirect } from 'next/navigation';

/**
 * Legacy mock affiliate-system route. Canonical page is /insightbooks/affiliate.
 */
export default function AdminAffiliateSystemRedirectPage() {
  redirect('/insightbooks/affiliate');
}
