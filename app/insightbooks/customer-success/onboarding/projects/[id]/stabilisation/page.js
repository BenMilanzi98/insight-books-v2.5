'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin stabilisation tab. */
export default function OnboardingStabilisationTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Stabilisation</h1>
      <p style={{ color: '#555' }}>
        Daily checks, issue monitoring, exit criteria + approval before handover.
      </p>
    </div>
  );
}
