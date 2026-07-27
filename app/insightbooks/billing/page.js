import { redirect } from 'next/navigation';

/** Billing hub — canonical overview is /insightbooks/billing/overview */
export default function AdminBillingIndexPage() {
  redirect('/insightbooks/billing/overview');
}
