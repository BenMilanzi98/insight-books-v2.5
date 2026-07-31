'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import OnboardingContextBar from '@/components/admin/customerSuccess/OnboardingContextBar';

/** Phase 17 Wave 4 — Request detail. */
export default function OnboardingRequestDetailPage() {
  const params = useParams();
  const id = params?.id || '—';
  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <p>
        <Link href="/insightbooks/customer-success/onboarding/requests">← Requests</Link>
      </p>
      <OnboardingContextBar population={`onboarding-request:${id}`} />
      <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>Request {id}</h1>
      <p style={{ color: '#555' }}>
        Detail surface — status history, pins, accept/reject/convert actions via API. One
        Project per Request.
      </p>
    </div>
  );
}
