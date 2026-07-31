'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — Attention / Dormancy hub (thin AdminShell). */
export default function AdoptionAttentionPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-attention" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        Attention / Dormancy
      </h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        Dormancy risk queue from Phase 9 inactive-class signals. Analytics missing
        → UNAVAILABLE (not healthy zero).
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <Link href="/insightbooks/customer-success/adoption/dormancy">
            Dormancy Recovery cases
          </Link>
        </li>
      </ul>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
