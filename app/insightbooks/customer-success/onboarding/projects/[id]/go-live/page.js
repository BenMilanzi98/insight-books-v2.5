'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin go-live tab. Success → STABILISATION, not COMPLETED. */
export default function OnboardingGoLiveTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>Go-live</h1>
      <p style={{ color: '#555' }}>
        Approval / execution / outcome. Critical defects block approval. Successful outcome moves
        the project to <code>STABILISATION</code> — never immediate <code>COMPLETED</code>. Never
        fabricate go-live.
      </p>
    </div>
  );
}
