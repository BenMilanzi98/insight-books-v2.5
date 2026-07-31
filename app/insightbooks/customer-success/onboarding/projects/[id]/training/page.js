'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin training coordination tab. */
export default function OnboardingTrainingTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Training</h1>
      <p style={{ color: '#555' }}>
        Consumes Phase 16 TRAINING handoff. Cannot set <code>COMPLETED</code> without a Phase 18
        Training-domain source. Stub returns <code>UNKNOWN</code> / <code>IN_PROGRESS</code> only.
      </p>
    </div>
  );
}
