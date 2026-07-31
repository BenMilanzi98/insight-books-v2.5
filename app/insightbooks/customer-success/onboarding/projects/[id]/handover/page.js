'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin handover tab. */
export default function OnboardingHandoverTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Handover</h1>
      <p style={{ color: '#555' }}>
        Create and accept handover (CS / Support / Technical / Billing / Customer Admin) with open
        items. Required before completion certificate.
      </p>
    </div>
  );
}
