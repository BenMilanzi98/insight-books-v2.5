import { redirect } from 'next/navigation';

/** Legacy budget reports → Budget & Forecast reports. */
export default function LegacyBudgetReportsPage() {
  redirect('/budget-forecast/reports');
}
