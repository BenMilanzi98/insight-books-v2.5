import { redirect } from 'next/navigation';

export default function LegacyHiringRedirect() {
  redirect('/rentals/hirings?tab=customer');
}
