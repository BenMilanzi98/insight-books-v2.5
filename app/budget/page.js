import { redirect } from 'next/navigation';

/** Legacy budgeting → Budget & Forecast (overview first). */
export default function LegacyBudgetPage() {
  redirect('/budget-forecast/reports');
}
