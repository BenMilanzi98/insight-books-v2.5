import { redirect } from 'next/navigation';

export default function LegacyInboundHiringRedirect() {
  redirect('/rentals/hirings?tab=supplier');
}
