'use client';

import Link from 'next/link';

/**
 * Phase 19 Wave 3 — Dormancy risk / recovery (thin but real).
 */
export default function CustomerSuccessAdoptionDormancyPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Adoption</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Dormancy Recovery
      </h1>
      <p style={{ color: '#555' }}>
        Risk queue from Phase 9 <code>VALUE_THEN_INACTIVE</code> / inactive-class
        signals. Analytics missing → <code>UNAVAILABLE</code> (not a healthy
        zero). <code>RECOVERED</code> requires usage-return snapshot and/or
        attested outreach. Phase 8 interventions are linked by id only.
      </p>
    </div>
  );
}
