import { redirect } from 'next/navigation';

export default async function BankReconciliationRedirect({ searchParams }) {
  const sp = await searchParams;
  const paymentAccountId = sp?.paymentAccountId;
  if (paymentAccountId) {
    redirect(`/payments/reconcile/${encodeURIComponent(paymentAccountId)}`);
  }
  redirect('/payments');
}
