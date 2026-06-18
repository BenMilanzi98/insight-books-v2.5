import { redirect } from 'next/navigation';

/** Per-branch billing is deprecated — redirect to main subscription page. */
export default function BranchSubscriptionPage() {
  redirect('/subscription');
}
