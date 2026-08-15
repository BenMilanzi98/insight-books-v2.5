'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Reports catalogue subset. */
export default function OnboardingReportsPage() {
  const reports = [
    'Overview',
    'At-Risk',
    'Overdue Customer Tasks',
    'Go-Live Readiness',
    'Completion',
  ];
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-reports" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Reports')}</h1>
      <ul style={{ lineHeight: 1.8 }}>
        {reports.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p style={{ fontSize: '0.875rem', color: '#777' }}>
        {tt('CSV/XLSX export via')} <code>{tt('exportOnboardingReport')}</code> with permission recheck;
        credentials stripped.
      </p>
    </div>
  );
}
