'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin readiness tab. UNKNOWN ≠ READY. */
export default function OnboardingReadinessTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Readiness</h1>
      <p style={{ color: '#555' }}>
        Server-side dimension evaluation (tenant / business-branch / users / configuration /
        accounting / migration / MRA / training / testing / defects).{' '}
        <code>UNKNOWN</code> is never treated as <code>READY</code>. No Tenant journals from this
        plane.
      </p>
    </div>
  );
}
