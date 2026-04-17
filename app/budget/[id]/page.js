import { redirect } from 'next/navigation';

/** Legacy budget detail: open Budget & Forecast expense budgets list. */
export default function LegacyBudgetDetailPage() {
  redirect('/budget-forecast/budgets');
}
