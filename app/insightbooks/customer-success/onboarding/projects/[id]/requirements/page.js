'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 2 — thin requirements / scope CR tab. */
export default function OnboardingRequirementsTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>{tt('Requirements & scope')}</h1>
      <p style={{ color: '#555' }}>
        Confirm accepted commercial scope. Mismatch → Change Request with{' '}
        <code>SCOPE_MISMATCH</code>. Never silently mutates Subscription entitlements.
      </p>
    </div>
  );
}
