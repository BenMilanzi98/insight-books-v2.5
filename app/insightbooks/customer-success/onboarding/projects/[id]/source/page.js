'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function OnboardingProjectSourcePage() {
  const params = useParams();
  const id = params?.id || '';
  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>
          ← Project
        </Link>
      </p>
      <h1 style={{ fontSize: '1.2rem' }}>Source</h1>
      <p style={{ color: '#555' }}>
        Request / handoff / conversion lineage. Use <code>getOnboardingLineage</code>.
      </p>
    </div>
  );
}
