'use client';

import Link from 'next/link';

/**
 * Phase 19 Wave 3 — Expansion / renewal handoffs (thin but real).
 */
export default function CustomerSuccessAdoptionExpansionPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Adoption</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Expansion Handoffs
      </h1>
      <p style={{ color: '#555' }}>
        Record-only handoffs: <code>DRAFT</code> → <code>HANDED_OFF</code> →{' '}
        <code>ACKNOWLEDGED</code>. Target queues: RENEWALS, SALES, CS_LEADERSHIP.
        Never mutates Subscription, entitlement, invoice, or Tenant GL. Exact
        retry is idempotent.
      </p>
    </div>
  );
}
