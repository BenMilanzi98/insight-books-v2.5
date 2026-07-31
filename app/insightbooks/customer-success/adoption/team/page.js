'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — Team hub (thin AdminShell). */
export default function AdoptionTeamPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-team" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Team</h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        CS owner workload view (thin). Portfolio fail-closed.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
