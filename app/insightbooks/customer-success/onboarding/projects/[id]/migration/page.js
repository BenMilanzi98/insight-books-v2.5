'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 3 — thin migration coordination tab. */
export default function OnboardingMigrationTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>{tt('Migration')}</h1>
      <p style={{ color: '#555' }}>
        Coordination states, private file inventory metadata, dry-run / recon gates. Upload alone ≠
        complete; <code>COMPLETED</code> {tt('rejected without reconciliation. Engine remains NOT_AVAILABLE until a real migration service is wired.')}
      </p>
    </div>
  );
}
