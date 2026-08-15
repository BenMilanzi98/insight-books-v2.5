'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — My Work hub (thin AdminShell). */
export default function AdoptionMyWorkPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-my-work" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{tt('My Work')}</h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Owner + portfolio scoped Adoption Plans. Empty / missing portfolio scope
        fails closed (UNAVAILABLE) — never invents work items.
      </p>
      <p style={{ fontSize: '0.875rem', color: '#777' }}>
        {tt('Data via')} <code>{tt('getAdoptionMyWork')}</code>.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
