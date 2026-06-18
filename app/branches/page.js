import { redirect } from 'next/navigation';

/** Branch management is internal — redirect to dashboard. */
export default function BranchesPage() {
  redirect('/dashboard');
}
