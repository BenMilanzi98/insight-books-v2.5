'use client';

import Link from 'next/link';

/**
 * Phase 19 Wave 1 — Adoption Requests list (thin but real).
 */
export default function CustomerSuccessAdoptionRequestsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Adoption</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Adoption Requests
      </h1>
      <p style={{ color: '#555' }}>
        ADR-YYYY-###### spine. List is portfolio fail-closed via{' '}
        <code>listAdoptionRequests</code>. Training COMPLETED → Request;
        COMPLETED_WITH_GAPS does not auto-create.
      </p>
    </div>
  );
}
