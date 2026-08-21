import { redirect } from 'next/navigation';

/** Equity Management moved into Capital Account. */
export default function EquityManagementRedirectPage() {
  redirect('/capital-account');
}
