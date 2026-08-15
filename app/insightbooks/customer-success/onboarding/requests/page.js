'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Onboarding Requests list. */
export default function OnboardingRequestsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-requests" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Onboarding Requests')}</h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        ONR-YYYY-###### — consume Phase 16 ONBOARDING handoffs; validate, accept, reject, or
        convert. Server pagination/filter via API.
      </p>
      <p style={{ fontSize: '0.875rem', color: '#777' }}>
        {tt('Detail:')} <code>/insightbooks/customer-success/onboarding/requests/[id]</code>
      </p>
    </div>
  );
}
