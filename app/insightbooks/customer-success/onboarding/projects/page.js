'use client';

import Link from 'next/link';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Onboarding Projects list. */
export default function OnboardingProjectsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding">← Onboarding</Link>
      </p>
      <OnboardingContextBar population="onboarding-projects" />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>Onboarding Projects</h1>
      <p style={{ color: '#555' }}>
        ONB-YYYY-###### — portfolio-scoped list. Open a project for detail tabs (overview
        through audit).
      </p>
    </div>
  );
}
