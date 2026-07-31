'use client';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Team hub stub. */
export default function OnboardingTeamPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-team" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>Team</h1>
      <p style={{ color: '#555' }}>
        Team workload view — portfolio-scoped. Thin Wave 4 surface.
      </p>
    </div>
  );
}
