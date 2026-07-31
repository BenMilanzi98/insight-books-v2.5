'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import TrainingContextBar from '@/components/admin/customerSuccess/TrainingContextBar';

/** Phase 18 Wave 4 — Training Request detail (thin). */
export default function TrainingRequestDetailPage() {
  const params = useParams();
  const id = params?.id || '';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960 }}>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/insightbooks/customer-success/training/requests">← Requests</Link>
      </p>
      <TrainingContextBar population="training-request-detail" />
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>
        Training Request
      </h1>
      <p style={{ color: '#555' }}>
        Request <code>{id}</code>. Accept / reject / convert via training request services.
        Never fabricates Program delivery.
      </p>
    </div>
  );
}
