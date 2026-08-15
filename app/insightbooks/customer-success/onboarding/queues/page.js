'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Onboarding queues. */
export default function OnboardingQueuesPage() {
  const queues = [
    'ready',
    'in-progress',
    'at-risk',
    'blocked',
    'go-live',
    'stabilisation',
    'completed',
    'cancelled',
  ];
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-queues" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('Queues')}</h1>
      <ul style={{ lineHeight: 1.8 }}>
        {queues.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
    </div>
  );
}
