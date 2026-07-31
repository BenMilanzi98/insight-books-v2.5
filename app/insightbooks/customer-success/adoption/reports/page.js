'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — Reports hub (thin AdminShell). */
export default function AdoptionReportsPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-reports" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        Adoption Reports
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Overview, at-risk, dormancy, value review, expansion. Exports strip
        secrets/tokens; portfolio fail-closed. DQ/recon never invent success zeroes.
      </p>
      <p style={{ fontSize: '0.875rem', color: '#777' }}>
        Catalogue via <code>listAdoptionReports</code> /{' '}
        <code>exportAdoptionReport</code>.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
