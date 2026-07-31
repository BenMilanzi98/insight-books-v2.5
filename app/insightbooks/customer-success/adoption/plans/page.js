'use client';

import Link from 'next/link';

/**
 * Phase 19 Wave 1 — Adoption Plans list (thin but real).
 */
export default function CustomerSuccessAdoptionPlansPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Adoption</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Adoption Plans
      </h1>
      <p style={{ color: '#555' }}>
        ADP-YYYY-###### spine with pinned <code>planTemplateVersionId</code>.
        One Request → one Plan. COMPLETED only via{' '}
        <code>evaluateAdoptionPlanCompletion</code> (critical milestones
        MET|WAIVED + value review sign-off).
      </p>
    </div>
  );
}
