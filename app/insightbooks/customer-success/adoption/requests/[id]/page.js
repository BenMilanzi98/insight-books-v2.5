'use client';
import { tt } from '@/lib/i18n/runtime';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';
import { useParams } from 'next/navigation';

/** Phase 19 Wave 4 — Adoption Request detail (thin AdminShell). */
export default function AdoptionRequestDetailPage() {
  const params = useParams();
  const id = params?.id || '';
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-request-detail" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {tt('Adoption Request')}
      </h1>
      <p style={{ color: '#555' }}>Request id: {id}</p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption/requests">
          ← Requests
        </Link>
      </p>
    </div>
  );
}
