'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — My Work (owner-scoped; excludes other CS owners). */
export default function OnboardingMyWorkPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar
        population="onboarding-my-work"
        permissionScope="customerSuccess.read (owner-scoped)"
      />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>{tt('My Work')}</h1>
      <p style={{ color: '#555' }}>
        Projects where you are CS / implementation owner. Other owners&apos; projects are
        excluded. Counts via <code>{tt('getOnboardingMyWork')}</code>.
      </p>
    </div>
  );
}
