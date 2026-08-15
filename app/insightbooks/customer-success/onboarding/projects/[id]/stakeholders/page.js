'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/** Phase 17 Wave 2 — thin stakeholders tab (Contact verification gate). */
export default function OnboardingStakeholdersTabPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 720 }}>
      <p>
        <Link href={`/insightbooks/customer-success/onboarding/projects/${id}`}>← Project</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', margin: '1rem 0 0.5rem' }}>{tt('Stakeholders')}</h1>
      <p style={{ color: '#555' }}>
        Assign Customer/Internal roles. Required Customer-facing roles need a verified CRM Contact
        (<code>{tt('CONTACT_NOT_VERIFIED')}</code> when unverified).
      </p>
    </div>
  );
}
