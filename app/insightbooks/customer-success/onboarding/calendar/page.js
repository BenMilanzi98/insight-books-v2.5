'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Calendar hub (kick-off / go-live windows). */
export default function OnboardingCalendarPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-calendar" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Calendar')}</h1>
      <p style={{ color: '#555' }}>
        {tt('Kick-off and go-live windows via Phase 13 Meeting links. RSVP ≠ attendance.')}
      </p>
    </div>
  );
}
