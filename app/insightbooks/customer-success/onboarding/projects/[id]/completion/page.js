'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin completion / certificate tab. */
export default function OnboardingCompletionTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>{tt('Completion')}</h1>
      <p style={{ color: '#555' }}>
        Customer + internal sign-off, reconciliation, and accepted handover required. Immutable
        certificate with checksum; exact retry returns the same certificate. Progress % alone never
        equals completion.
      </p>
    </div>
  );
}
