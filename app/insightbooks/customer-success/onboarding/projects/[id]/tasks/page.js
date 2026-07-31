'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 2 — thin tasks / evidence tab. */
export default function OnboardingTasksTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Tasks & evidence</h1>
      <p style={{ color: '#555' }}>
        Customer Tasks require admin attestation evidence (or authorised waiver) before completion.
        Portal path reserved as <code>CUSTOMER_PORTAL_NOT_CONFIGURED</code>. Reject retains reason.
      </p>
    </div>
  );
}
