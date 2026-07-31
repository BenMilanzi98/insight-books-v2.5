'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';

/** Phase 19 Wave 4 — Queues hub (thin AdminShell). */
export default function AdoptionQueuesPage() {
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-queues" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Queues</h1>
      <p style={{ color: '#555', marginBottom: '1.25rem' }}>
        New requests, active / at-risk plans, value review. Counts via reliability
        gate — UNAVAILABLE / null on fail.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption">← Overview</Link>
      </p>
    </div>
  );
}
