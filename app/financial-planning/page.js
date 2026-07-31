import { redirect } from 'next/navigation';

/** Financial Planning pilot absorbed into Budget & Forecast. */
export default function FinancialPlanningRedirectPage() {
  redirect('/budget-forecast/forecasts');
}
