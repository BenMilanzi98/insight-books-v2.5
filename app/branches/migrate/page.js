import { redirect } from 'next/navigation';

/** Branch migration is internal — redirect to dashboard. */
export default function BranchesMigratePage() {
  redirect('/dashboard');
}
