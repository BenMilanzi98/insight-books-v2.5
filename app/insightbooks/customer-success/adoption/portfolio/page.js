'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — Portfolio hub (thin AdminShell). */
export default function AdoptionPortfolioPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-portfolio" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Portfolio</h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Tenant portfolio scope for Adoption lists, search, export, DQ, and metrics.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
