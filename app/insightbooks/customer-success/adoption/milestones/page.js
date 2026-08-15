'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';

/**
 * Phase 19 Wave 2 — Adoption Milestones (thin but real).
 */
export default function CustomerSuccessAdoptionMilestonesPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Adoption</Link>
      </p>
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        {tt('Adoption Milestones')}
      </h1>
      <p style={{ color: '#555' }}>
        Materialised from pinned plan template. Evidence modes:{' '}
        <code>{tt('PRODUCT_ANALYTICS')}</code>, <code>TRAINING_CERT</code>,{' '}
        <code>CS_ATTESTATION</code>, <code>MIXED</code>. Phase 9 gate fail →{' '}
        <code>UNKNOWN</code> / <code>UNAVAILABLE</code> — never invent{' '}
        <code>MET</code>.
      </p>
    </div>
  );
}
