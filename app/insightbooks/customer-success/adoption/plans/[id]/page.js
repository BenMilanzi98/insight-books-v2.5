'use client';

import Link from 'next/link';
import AdoptionContextBar from '@/components/admin/customerSuccess/AdoptionContextBar';
import { useParams } from 'next/navigation';

/** Phase 19 Wave 4 — Adoption Plan detail (thin AdminShell). */
export default function AdoptionPlanDetailPage() {
  const params = useParams();
  const id = params?.id || '';
  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <AdoptionContextBar population="adoption-plan-detail" />
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        Adoption Plan
      </h1>
      <p style={{ color: '#555' }}>Plan id: {id}</p>
      <p style={{ marginTop: '1rem' }}>
        <Link href="/insightbooks/customer-success/adoption/plans">← Plans</Link>
      </p>
    </div>
  );
}
